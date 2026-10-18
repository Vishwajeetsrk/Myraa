'use strict';
/**
 * MYRAA MCP Manager (Phase 25) - stdio transport live.
 * Registry + real stdio transport: initialize handshake, tools/list, tools/call.
 * Honest scope: the http transport still returns NOT_IMPLEMENTED. Tools are only
 * executed when the user calls them (mcp_call is HIGH risk and approval-gated
 * by the tool engine). Store: JSON, env MYRAA_MCP_DB (default %APPDATA%\MYRAA\mcp\servers.json)
 * Servers are never hard-deleted - use disable/enable.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createStdioSession } = require('./mcp_stdio_client.cjs');

const EVENTS_CAP = 200;
const TRANSPORTS = ['stdio', 'http'];
const NAME_RE = /^[a-z0-9_-]{1,40}$/i;
const MAX_TOOLS = 200;
const PROBE_TIMEOUT_MS = 15000;
const CALL_TIMEOUT_MS = 20000;

const PRESETS = [
  { id: 'filesystem', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-filesystem "{dir}"', vars: ['dir'], note: 'Official reference filesystem server - read/write access scoped to one folder. Needs Node 18+/npx.' },
  { id: 'memory', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-memory', vars: [], note: 'Official knowledge-graph memory server. Needs Node 18+/npx.' },
  { id: 'everything', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-everything', vars: [], note: 'Official reference server with echo/add/sample tools - ideal for first probes. Needs Node 18+/npx.' },
  { id: 'git', transport: 'stdio', command: 'uvx mcp-server-git --repository "{dir}"', vars: ['dir'], note: 'Official git server (log/diff/show). Needs uv (uvx) installed.' },
  { id: 'fetch', transport: 'stdio', command: 'uvx mcp-server-fetch', vars: [], note: 'Official fetch server - URLs to markdown. Needs uv (uvx) installed.' },
  { id: 'time', transport: 'stdio', command: 'uvx mcp-server-time', vars: [], note: 'Official time/timezone server. Needs uv (uvx) installed.' },
  { id: 'sqlite', transport: 'stdio', command: 'uvx mcp-server-sqlite --db-path "{db}"', vars: ['db'], note: 'Official SQLite server - query one database file. Needs uv (uvx) installed.' },
];

function dataDir() {
  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(base, 'MYRAA', 'mcp');
}

function defaultStorePath() {
  return process.env.MYRAA_MCP_DB || path.join(dataDir(), 'servers.json');
}

function nowIso() { return new Date().toISOString(); }
function sliceText(v, n) { return String(v == null ? '' : v).slice(0, n); }

function appVersion() {
  try {
    const p = path.join(__dirname, '..', 'version.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')).version || '0.0.0';
  } catch (e) { return '0.0.0'; }
}

function mkErr(code, message) {
  const e = new Error(String(message == null ? '' : message));
  e.code = code;
  return e;
}

function normalizeTools(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_TOOLS).map((t) => {
    const tt = t && typeof t === 'object' ? t : {};
    const out = { name: sliceText(tt.name, 120), description: sliceText(tt.description, 400) };
    try {
      const s = JSON.stringify(tt.inputSchema || {});
      out.inputSchema = s.length <= 4000 ? JSON.parse(s) : { type: 'object', note: 'schema omitted (too large)' };
    } catch (e) {
      out.inputSchema = { type: 'object', note: 'schema omitted (not serializable)' };
    }
    return out;
  });
}

function normalizeContent(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 50).map((c) => {
    if (!c || typeof c !== 'object') return { type: 'unknown' };
    if (c.type === 'text') return { type: 'text', text: sliceText(c.text, 4000) };
    return { type: sliceText(c.type, 40) || 'unknown' };
  });
}

function createMcpManager(opts) {
  const o = opts || {};
  const file = o.storePath || defaultStorePath();
  const probeTimeoutMs = Number(o.probeTimeoutMs) > 0 ? Number(o.probeTimeoutMs) : PROBE_TIMEOUT_MS;
  const callTimeoutMs = Number(o.callTimeoutMs) > 0 ? Number(o.callTimeoutMs) : CALL_TIMEOUT_MS;
  const clientInfo = { name: 'myraa-mcp-manager', version: appVersion() };

  let state = null;

  function blank() { return { servers: [], events: [], updatedAt: nowIso() }; }

  function load() {
    if (state) return state;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      state = {
        servers: Array.isArray(parsed && parsed.servers) ? parsed.servers : [],
        events: Array.isArray(parsed && parsed.events) ? parsed.events : [],
        updatedAt: (parsed && parsed.updatedAt) || nowIso(),
      };
    } catch (e) { state = blank(); }
    return state;
  }

  function save() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      state.updatedAt = nowIso();
      const tmp = file + '.' + Date.now() + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmp, file);
      return true;
    } catch (e) { return false; }
  }

  function journal(action, name, note) {
    state.events.push({ at: nowIso(), action: sliceText(action, 40), name: sliceText(name, 40), note: sliceText(note, 120) });
    while (state.events.length > EVENTS_CAP) state.events.shift();
  }

  function findServer(name) {
    const needle = sliceText(name, 40).trim().toLowerCase();
    if (!needle) return null;
    return state.servers.find((s) => s.name.toLowerCase() === needle || s.id === name) || null;
  }

  function view(s) {
    return {
      id: s.id, name: s.name, transport: s.transport, status: s.status,
      command: s.transport === 'stdio' ? sliceText(s.command, 120) : null,
      url: s.transport === 'http' ? sliceText(s.url, 200) : null,
      registeredAt: s.registeredAt, updatedAt: s.updatedAt,
      lastProbe: s.lastProbe || null,
      serverInfo: s.serverInfo || null,
      protocolVersion: s.protocolVersion || null,
      toolsCount: Array.isArray(s.tools) ? s.tools.length : 0,
      toolsCachedAt: s.toolsCachedAt || null,
      preset: s.preset || null,
      implemented: s.transport === 'stdio',
    };
  }

  function bindSession(rec, timeoutMs) {
    const session = createStdioSession({ command: rec.command, timeoutMs });
    const started = session.start();
    if (!started.ok) return { error: { code: started.code, message: started.error, stderr: '', session: null } };
    return { session };
  }

  async function handshake(session, timeoutMs) {
    const init = await session.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo,
    }, timeoutMs);
    session.notify('notifications/initialized', {});
    return init && typeof init === 'object' ? init : {};
  }

  function registerServer(input) {
    load();
    const name = sliceText(input && input.name, 40).trim();
    const transport = sliceText(input && input.transport, 10).toLowerCase();
    if (!NAME_RE.test(name)) return { ok: false, code: 'VALIDATION', error: 'name must be a single word (a-z, 0-9, _ or -)' };
    if (!TRANSPORTS.includes(transport)) return { ok: false, code: 'VALIDATION', error: 'transport must be one of: ' + TRANSPORTS.join(', ') };
    const command = sliceText(input && input.command, 300).trim();
    const url = sliceText(input && input.url, 300).trim();
    if (transport === 'stdio' && !command) return { ok: false, code: 'VALIDATION', error: 'stdio servers need a command' };
    if (transport === 'http') {
      if (!/^https?:\/\/\S+$/i.test(url)) return { ok: false, code: 'VALIDATION', error: 'http servers need an http(s) url' };
    }
    let rec = state.servers.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (rec) {
      rec.transport = transport;
      rec.command = command;
      rec.url = url;
      rec.preset = null;
      rec.tools = [];
      rec.serverInfo = null;
      rec.protocolVersion = null;
      rec.toolsCachedAt = null;
      rec.lastProbe = null;
      if (rec.status !== 'disabled') rec.status = 'registered';
      rec.updatedAt = nowIso();
      journal('updated', rec.name, transport);
    } else {
      rec = {
        id: 'mcp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name, transport, command, url,
        status: 'registered',
        registeredAt: nowIso(), updatedAt: nowIso(), lastProbe: null,
        tools: [], serverInfo: null, protocolVersion: null, toolsCachedAt: null,
        preset: null,
      };
      state.servers.push(rec);
      journal('registered', name, transport);
    }
    if (!save()) return { ok: false, code: 'DB_ERROR', error: 'mcp store write failed' };
    return {
      ok: true,
      server: view(rec),
      note: transport === 'stdio'
        ? 'registered - run probe to start it and fetch its tools'
        : 'registered - http transport is not implemented yet (stdio only)',
    };
  }

  function setStatus(input, status) {
    load();
    const rec = findServer(input && input.name);
    if (!rec) return { ok: false, code: 'NOT_FOUND', error: 'unknown server (name or id)' };
    rec.status = status;
    rec.updatedAt = nowIso();
    journal(status === 'disabled' ? 'disabled' : 'enabled', rec.name, '');
    if (!save()) return { ok: false, code: 'DB_ERROR', error: 'mcp store write failed' };
    return { ok: true, server: view(rec) };
  }

  function disableServer(input) { return setStatus(input, 'disabled'); }
  function enableServer(input) { return setStatus(input, 'registered'); }

  function listPresets() {
    return {
      ok: true,
      count: PRESETS.length,
      presets: PRESETS.map((p) => ({ id: p.id, transport: p.transport, command: p.command, vars: p.vars.slice(), note: p.note, source: 'official' })),
      note: 'curated official MCP servers - npx presets need Node 18+, uv presets need uv/uvx; nothing is downloaded until the first probe/call',
    };
  }

  function addPreset(input) {
    const i = input || {};
    const preset = PRESETS.find((p) => p.id === sliceText(i.preset, 40).trim().toLowerCase());
    if (!preset) return { ok: false, code: 'VALIDATION', error: 'unknown preset - GET /api/mcp/presets lists them' };
    const vars = {};
    const missing = [];
    for (const v of preset.vars) {
      const raw = sliceText(i[v], 300).trim();
      if (!raw || raw.includes('"')) { missing.push(v); continue; }
      vars[v] = raw;
    }
    if (missing.length) return { ok: false, code: 'VALIDATION', error: 'preset "' + preset.id + '" needs: ' + missing.join(', ') + ' (absolute path, no quotes)' };
    let command = preset.command;
    for (const k of Object.keys(vars)) command = command.split('{' + k + '}').join(vars[k]);
    const name = sliceText(i.name, 40).trim() || preset.id;
    const out = registerServer({ name, transport: preset.transport, command });
    if (!out.ok) return out;
    load();
    const rec = findServer(name);
    if (rec) {
      rec.preset = preset.id;
      rec.updatedAt = nowIso();
      journal('preset-added', rec.name, preset.id);
      save();
    }
    return { ok: true, preset: preset.id, server: rec ? view(rec) : out.server, note: 'preset added - run probe to start it and fetch its tools' };
  }

  function listServers() {
    load();
    const servers = state.servers.slice().reverse().map(view);
    return { ok: true, count: servers.length, servers };
  }

  async function probeServer(input) {
    load();
    const rec = findServer(input && input.name);
    if (!rec) return { ok: false, code: 'NOT_FOUND', error: 'unknown server (name or id)' };
    if (rec.status === 'disabled') return { ok: false, code: 'DISABLED', error: 'server is disabled - enable it first', server: view(rec) };
    if (rec.transport !== 'stdio') return { ok: false, code: 'NOT_IMPLEMENTED', error: 'http transport is not implemented yet (stdio only)', server: view(rec) };
    const t0 = Date.now();
    const perReq = Math.max(1000, Math.floor(probeTimeoutMs / 2));
    const bound = bindSession(rec, perReq);
    if (bound.error) {
      rec.status = 'error';
      rec.lastProbe = { at: nowIso(), result: 'ERROR', code: bound.error.code, error: sliceText(bound.error.message, 300), latencyMs: Date.now() - t0 };
      journal('probe-error', rec.name, bound.error.code);
      save();
      return { ok: false, code: bound.error.code || 'SPAWN_ERROR', error: sliceText(bound.error.message, 500), stderr: '', server: view(rec) };
    }
    const session = bound.session;
    try {
      const init = await handshake(session, perReq);
      const tl = await session.request('tools/list', {}, perReq);
      if (!tl || !Array.isArray(tl.tools)) throw mkErr('PROTOCOL_ERROR', 'tools/list returned no tools array');
      const tools = normalizeTools(tl.tools);
      rec.tools = tools;
      rec.toolsCachedAt = nowIso();
      rec.serverInfo = init.serverInfo ? { name: sliceText(init.serverInfo.name, 80), version: sliceText(init.serverInfo.version, 40) } : null;
      rec.protocolVersion = init.protocolVersion ? sliceText(init.protocolVersion, 40) : null;
      rec.status = 'reachable';
      rec.updatedAt = nowIso();
      const latencyMs = Date.now() - t0;
      rec.lastProbe = { at: nowIso(), result: 'OK', toolsCount: tools.length, latencyMs };
      journal('probe-ok', rec.name, tools.length + ' tools, ' + latencyMs + 'ms');
      save();
      return {
        ok: true,
        server: view(rec),
        serverInfo: rec.serverInfo,
        protocolVersion: rec.protocolVersion,
        tools: tools.map((t) => ({ name: t.name, description: t.description })),
        latencyMs,
      };
    } catch (e) {
      const code = (e && e.code) || 'PROTOCOL_ERROR';
      rec.status = 'error';
      rec.updatedAt = nowIso();
      rec.lastProbe = { at: nowIso(), result: 'ERROR', code, error: sliceText(e && e.message, 300), latencyMs: Date.now() - t0 };
      journal('probe-error', rec.name, code);
      save();
      return { ok: false, code, error: sliceText(e && e.message, 500), stderr: sliceText(session.getStderr(), 300), server: view(rec) };
    } finally {
      session.close();
    }
  }

  function listTools(input) {
    load();
    const rec = findServer(input && input.name);
    if (!rec) return { ok: false, code: 'NOT_FOUND', error: 'unknown server (name or id)' };
    const tools = Array.isArray(rec.tools) ? rec.tools : [];
    return {
      ok: true,
      server: view(rec),
      count: tools.length,
      tools,
      cachedAt: rec.toolsCachedAt || null,
      note: tools.length ? null : 'no tools cached - run probe first',
    };
  }

  async function callTool(input) {
    load();
    const i = input || {};
    const rec = findServer(i.name);
    if (!rec) return { ok: false, code: 'NOT_FOUND', error: 'unknown server (name or id)' };
    const tool = sliceText(i.tool, 120).trim();
    if (!tool) return { ok: false, code: 'VALIDATION', error: 'tool name is required' };
    if (rec.status === 'disabled') return { ok: false, code: 'DISABLED', error: 'server is disabled - enable it first', server: view(rec) };
    if (rec.transport !== 'stdio') return { ok: false, code: 'NOT_IMPLEMENTED', error: 'http transport is not implemented yet (stdio only)', server: view(rec) };
    if (Array.isArray(rec.tools) && rec.tools.length && !rec.tools.some((t) => t.name === tool)) {
      return { ok: false, code: 'VALIDATION', error: 'unknown tool "' + tool + '" for server "' + rec.name + '" - run probe to refresh the tool list', server: view(rec) };
    }
    const perCall = Math.min(Number(i.timeoutMs) > 0 ? Number(i.timeoutMs) : callTimeoutMs, 120000);
    const initTimeout = Math.min(8000, perCall);
    const args = i.args && typeof i.args === 'object' ? i.args : {};
    const t0 = Date.now();
    const bound = bindSession(rec, initTimeout);
    if (bound.error) {
      journal('call-error', rec.name, bound.error.code);
      save();
      return { ok: false, code: bound.error.code || 'SPAWN_ERROR', error: sliceText(bound.error.message, 500), stderr: '', server: view(rec) };
    }
    const session = bound.session;
    try {
      await handshake(session, initTimeout);
      const r = await session.request('tools/call', { name: tool, arguments: args }, perCall);
      const isError = !!(r && r.isError);
      const content = normalizeContent(r && r.content);
      const latencyMs = Date.now() - t0;
      journal(isError ? 'call-error' : 'call-ok', rec.name, tool + ', ' + latencyMs + 'ms');
      save();
      return {
        ok: !isError,
        code: isError ? 'TOOL_ERROR' : null,
        isError,
        server: view(rec),
        tool,
        content,
        latencyMs,
      };
    } catch (e) {
      const code = (e && e.code) || 'PROTOCOL_ERROR';
      journal('call-error', rec.name, code);
      save();
      return { ok: false, code, error: sliceText(e && e.message, 500), stderr: sliceText(session.getStderr(), 300), server: view(rec) };
    } finally {
      session.close();
    }
  }

  function status() {
    load();
    const byTransport = { stdio: 0, http: 0 };
    const byStatus = { registered: 0, disabled: 0, reachable: 0, error: 0 };
    for (const s of state.servers) {
      if (byTransport[s.transport] != null) byTransport[s.transport]++;
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    }
    return {
      ok: true,
      storePath: file,
      count: state.servers.length,
      byTransport,
      byStatus,
      events: state.events.length,
      implemented: { stdio: true, http: false },
      clientInfo,
      policy: 'stdio transport live (initialize + tools/list + tools/call); http pending; servers are disabled not deleted; probe before call; calls run through the HIGH-risk approval path',
      updatedAt: state.updatedAt,
    };
  }

  function createRouter() {
    let express;
    try { express = require('express'); } catch (e) { express = null; }
    if (!express) return null;
    const router = express.Router();
    function reply(res, r, okCode) {
      const codes = { NOT_FOUND: 404, DISABLED: 409, VALIDATION: 400, NOT_IMPLEMENTED: 501 };
      res.status(r.ok ? okCode : (codes[r.code] || 502)).json(r);
    }
    router.get('/', (req, res) => { res.json(status()); });
    router.get('/servers', (req, res) => { res.json(listServers()); });
    router.get('/presets', (req, res) => { res.json(listPresets()); });
    router.get('/servers/:name/tools', (req, res) => { reply(res, listTools({ name: req.params.name }), 200); });
    router.post('/register', (req, res) => { const r = registerServer(req.body || {}); res.status(r.ok ? 200 : 400).json(r); });
    router.post('/presets/add', (req, res) => { const r = addPreset(req.body || {}); res.status(r.ok ? 200 : 400).json(r); });
    router.post('/probe', (req, res) => {
      probeServer(req.body || {})
        .then((r) => reply(res, r, 200))
        .catch((e) => res.status(500).json({ ok: false, code: 'INTERNAL', error: String((e && e.message) || e) }));
    });
    router.post('/call', (req, res) => {
      callTool(req.body || {})
        .then((r) => reply(res, r, 200))
        .catch((e) => res.status(500).json({ ok: false, code: 'INTERNAL', error: String((e && e.message) || e) }));
    });
    router.post('/disable', (req, res) => { const r = disableServer(req.body || {}); res.status(r.ok ? 200 : 400).json(r); });
    router.post('/enable', (req, res) => { const r = enableServer(req.body || {}); res.status(r.ok ? 200 : 400).json(r); });
    return router;
  }

  function registerAgiTools(engine) {
    if (!engine || typeof engine.register !== 'function') return { ok: false, count: 0, error: 'tool engine not available' };
    engine.register('mcp_servers', {
      fn: async () => listServers(),
      risk: 'LOW',
      category: 'mcp',
      timeout: 3000,
      description: 'List registered MCP servers with transport, status and cached tool count.',
    });
    engine.register('mcp_status', {
      fn: async () => status(),
      risk: 'LOW',
      category: 'mcp',
      timeout: 3000,
      description: 'MCP manager status (counts, transports implemented, policy).',
    });
    engine.register('mcp_probe', {
      fn: async (params) => probeServer(params || {}),
      risk: 'MEDIUM',
      category: 'mcp',
      timeout: 30000,
      description: 'Start a registered stdio MCP server, run the initialize handshake and cache its tool list. Use before mcp_call.',
    });
    engine.register('mcp_call', {
      fn: async (params) => callTool(params || {}),
      risk: 'HIGH',
      category: 'mcp',
      timeout: 40000,
      description: 'Call a tool on a registered stdio MCP server ({name, tool, args?}). HIGH risk - runs the server command; approval required.',
    });
    return { ok: true, count: 4, names: ['mcp_servers', 'mcp_status', 'mcp_probe', 'mcp_call'] };
  }

  return {
    registerServer, disableServer, enableServer, listServers, probeServer, probe: probeServer, listTools, callTool, listPresets, addPreset, status, createRouter, registerAgiTools,
    storePath: () => file,
    _reset: () => { state = null; },
  };
}

const singleton = createMcpManager({});

module.exports = {
  dataDir, defaultStorePath, createMcpManager,
  registerServer: singleton.registerServer,
  disableServer: singleton.disableServer,
  enableServer: singleton.enableServer,
  listServers: singleton.listServers,
  probeServer: singleton.probeServer,
  probe: singleton.probeServer,
  listTools: singleton.listTools,
  callTool: singleton.callTool,
  listPresets: singleton.listPresets,
  addPreset: singleton.addPreset,
  status: singleton.status,
  createRouter: singleton.createRouter,
  registerAgiTools: singleton.registerAgiTools,
};
