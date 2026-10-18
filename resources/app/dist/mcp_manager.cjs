'use strict';
/**
 * MYRAA MCP Manager (Phase 24) - SKELETON.
 * Registry + bookkeeping for MCP (Model Context Protocol) servers only.
 * Honest scope: transports are NOT started, tools are NOT fetched, probes
 * return NOT_IMPLEMENTED. This is the config surface later phases build on.
 * Store: JSON, env MYRAA_MCP_DB (default %APPDATA%\MYRAA\mcp\servers.json)
 * Servers are never hard-deleted - use disable/enable.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const EVENTS_CAP = 200;
const TRANSPORTS = ['stdio', 'http'];
const NAME_RE = /^[a-z0-9_-]{1,40}$/i;

function dataDir() {
  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(base, 'MYRAA', 'mcp');
}

function defaultStorePath() {
  return process.env.MYRAA_MCP_DB || path.join(dataDir(), 'servers.json');
}

function nowIso() { return new Date().toISOString(); }
function sliceText(v, n) { return String(v == null ? '' : v).slice(0, n); }

function createMcpManager(opts) {
  const o = opts || {};
  const file = o.storePath || defaultStorePath();

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
      implemented: false,
    };
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
      rec.updatedAt = nowIso();
      journal('updated', rec.name, transport);
    } else {
      rec = {
        id: 'mcp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name, transport, command, url,
        status: 'registered',
        registeredAt: nowIso(), updatedAt: nowIso(), lastProbe: null,
      };
      state.servers.push(rec);
      journal('registered', name, transport);
    }
    if (!save()) return { ok: false, code: 'DB_ERROR', error: 'mcp store write failed' };
    return { ok: true, server: view(rec), note: 'bookkeeping only - transports are not started in this phase' };
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

  function listServers() {
    load();
    const servers = state.servers.slice().reverse().map(view);
    return { ok: true, count: servers.length, servers };
  }

  function probe(input) {
    load();
    const rec = findServer(input && input.name);
    if (!rec) return { ok: false, code: 'NOT_FOUND', error: 'unknown server (name or id)' };
    rec.lastProbe = { at: nowIso(), result: 'NOT_IMPLEMENTED' };
    save();
    return {
      ok: false,
      code: 'NOT_IMPLEMENTED',
      error: 'MCP transport execution is not implemented yet (skeleton phase). Registration is bookkeeping only.',
      server: view(rec),
    };
  }

  function status() {
    load();
    const byTransport = { stdio: 0, http: 0 };
    const byStatus = { registered: 0, disabled: 0 };
    for (const s of state.servers) {
      if (byTransport[s.transport] != null) byTransport[s.transport]++;
      if (byStatus[s.status] != null) byStatus[s.status]++;
    }
    return {
      ok: true,
      storePath: file,
      count: state.servers.length,
      byTransport,
      byStatus,
      events: state.events.length,
      implemented: false,
      policy: 'skeleton: config registry only - no transports started, no tools fetched, servers are disabled not deleted',
      updatedAt: state.updatedAt,
    };
  }

  function createRouter() {
    let express;
    try { express = require('express'); } catch (e) { express = null; }
    if (!express) return null;
    const router = express.Router();
    router.get('/', (req, res) => { res.json(status()); });
    router.get('/servers', (req, res) => { res.json(listServers()); });
    router.post('/register', (req, res) => { const r = registerServer(req.body || {}); res.status(r.ok ? 200 : 400).json(r); });
    router.post('/probe', (req, res) => { const r = probe(req.body || {}); res.status(r.ok ? 200 : 501).json(r); });
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
      description: 'List registered MCP servers (skeleton registry; transports not started).',
    });
    engine.register('mcp_status', {
      fn: async () => status(),
      risk: 'LOW',
      category: 'mcp',
      timeout: 3000,
      description: 'MCP manager status (counts, policy, implemented flag).',
    });
    return { ok: true, count: 2, names: ['mcp_servers', 'mcp_status'] };
  }

  return {
    registerServer, disableServer, enableServer, listServers, probe, status, createRouter, registerAgiTools,
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
  probe: singleton.probe,
  status: singleton.status,
  createRouter: singleton.createRouter,
  registerAgiTools: singleton.registerAgiTools,
};
