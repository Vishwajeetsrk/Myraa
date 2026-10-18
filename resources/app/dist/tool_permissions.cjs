'use strict';
/**
 * MYRAA Per-Agent Tool Permissions (Phase 24).
 * Policy store: which agent may use which tool. Deny rules beat allow rules.
 * HIGH/CRITICAL risk tools always require an explicit allow rule - a default
 * "allow" or a bare "*" wildcard never grants them.
 * Store: JSON, env MYRAA_PERMISSIONS_DB (default %APPDATA%\MYRAA\permissions\permissions.json)
 * All mutations are additive bookkeeping; revoke removes the allow and adds a deny.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const EVENTS_CAP = 200;
const NAME_RE = /^[a-z0-9_-]{1,40}$/i;

function dataDir() {
  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(base, 'MYRAA', 'permissions');
}

function defaultStorePath() {
  return process.env.MYRAA_PERMISSIONS_DB || path.join(dataDir(), 'permissions.json');
}

function nowIso() { return new Date().toISOString(); }
function sliceText(v, n) { return String(v == null ? '' : v).slice(0, n); }

function toolRe(tool) { return new RegExp('^' + String(tool || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$', 'i'); }

function matches(pattern, tool) {
  const p = sliceText(pattern, 80).trim();
  if (!p) return false;
  if (p === '*') return true;
  if (p.endsWith('*')) return String(tool).toLowerCase().startsWith(p.slice(0, -1).toLowerCase());
  return String(tool).toLowerCase() === p.toLowerCase();
}

function isHighRisk(risk) {
  const r = String(risk || '').toUpperCase();
  return r === 'HIGH' || r === 'CRITICAL';
}

function createPermissions(opts) {
  const o = opts || {};
  const file = o.storePath || defaultStorePath();

  let state = null;

  function blank() { return { agents: {}, events: [], updatedAt: nowIso() }; }

  function load() {
    if (state) return state;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      state = { agents: (parsed && parsed.agents) || {}, events: Array.isArray(parsed && parsed.events) ? parsed.events : [], updatedAt: (parsed && parsed.updatedAt) || nowIso() };
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

  function journal(action, agent, tool) {
    state.events.push({ at: nowIso(), action: sliceText(action, 40), agent: sliceText(agent, 40), tool: sliceText(tool, 80) });
    while (state.events.length > EVENTS_CAP) state.events.shift();
  }

  function policyFor(agent) {
    const name = sliceText(agent, 40).trim();
    if (!NAME_RE.test(name)) return null;
    return state.agents[name] || null;
  }

  function ensurePolicy(agent) {
    const name = sliceText(agent, 40).trim();
    if (!NAME_RE.test(name)) return { ok: false, code: 'VALIDATION', error: 'agent must be a single word (a-z, 0-9, _ or -)' };
    if (!state.agents[name]) state.agents[name] = { allow: [], deny: [], default: 'deny', updatedAt: nowIso() };
    return { ok: true, name };
  }

  function grant(input) {
    load();
    const name = sliceText(input && input.agent, 40).trim();
    const tool = sliceText(input && input.tool, 80).trim();
    if (!tool) return { ok: false, code: 'VALIDATION', error: 'tool pattern is required' };
    const ep = ensurePolicy(name);
    if (!ep.ok) return ep;
    const p = state.agents[ep.name];
    p.allow = p.allow.filter((x) => x.toLowerCase() !== tool.toLowerCase());
    p.allow.push(tool);
    p.deny = p.deny.filter((x) => x.toLowerCase() !== tool.toLowerCase());
    p.updatedAt = nowIso();
    journal('grant', ep.name, tool);
    if (!save()) return { ok: false, code: 'DB_ERROR', error: 'permissions store write failed' };
    return { ok: true, agent: ep.name, tool, policy: { allow: p.allow.slice(), deny: p.deny.slice(), default: p.default } };
  }

  function revoke(input) {
    load();
    const name = sliceText(input && input.agent, 40).trim();
    const tool = sliceText(input && input.tool, 80).trim();
    if (!tool) return { ok: false, code: 'VALIDATION', error: 'tool pattern is required' };
    const ep = ensurePolicy(name);
    if (!ep.ok) return ep;
    const p = state.agents[ep.name];
    p.allow = p.allow.filter((x) => x.toLowerCase() !== tool.toLowerCase());
    if (!p.deny.some((x) => x.toLowerCase() === tool.toLowerCase())) p.deny.push(tool);
    p.updatedAt = nowIso();
    journal('revoke', ep.name, tool);
    if (!save()) return { ok: false, code: 'DB_ERROR', error: 'permissions store write failed' };
    return { ok: true, agent: ep.name, tool, policy: { allow: p.allow.slice(), deny: p.deny.slice(), default: p.default } };
  }

  function setDefault(input) {
    load();
    const name = sliceText(input && input.agent, 40).trim();
    const mode = sliceText(input && input.mode, 10).toLowerCase();
    if (!['allow', 'deny'].includes(mode)) return { ok: false, code: 'VALIDATION', error: 'mode must be allow or deny' };
    const ep = ensurePolicy(name);
    if (!ep.ok) return ep;
    state.agents[ep.name].default = mode;
    state.agents[ep.name].updatedAt = nowIso();
    journal('default:' + mode, ep.name, '*');
    if (!save()) return { ok: false, code: 'DB_ERROR', error: 'permissions store write failed' };
    return { ok: true, agent: ep.name, default: mode };
  }

  function check(input) {
    load();
    const name = sliceText(input && input.agent, 40).trim();
    const tool = sliceText(input && input.tool, 80).trim();
    const risk = sliceText(input && input.risk, 12);
    if (!name || !tool) return { ok: false, code: 'VALIDATION', error: 'agent and tool are required' };
    const p = state.agents[name];
    if (!p) return { ok: true, allowed: false, reason: 'no policy for agent "' + name + '" (default deny)', agent: name, tool };
    const denyHit = p.deny.find((x) => matches(x, tool));
    if (denyHit) return { ok: true, allowed: false, reason: 'denied by rule "' + denyHit + '"', agent: name, tool };
    const allowHit = p.allow.find((x) => matches(x, tool));
    const explicit = allowHit && allowHit !== '*';
    if (allowHit && (!isHighRisk(risk) || explicit)) {
      return { ok: true, allowed: true, reason: 'allowed by rule "' + allowHit + '"', agent: name, tool };
    }
    if (isHighRisk(risk) && !explicit) {
      return { ok: true, allowed: false, reason: 'high-risk tools require an explicit allow rule for "' + name + '"', agent: name, tool };
    }
    if (p.default === 'allow') return { ok: true, allowed: true, reason: 'default allow', agent: name, tool };
    return { ok: true, allowed: false, reason: 'default deny', agent: name, tool };
  }

  function listAgents() {
    load();
    const agents = Object.keys(state.agents).map((name) => ({
      agent: name,
      allow: state.agents[name].allow.slice(),
      deny: state.agents[name].deny.slice(),
      default: state.agents[name].default,
      updatedAt: state.agents[name].updatedAt,
    }));
    return { ok: true, count: agents.length, agents };
  }

  function status() {
    load();
    let allowRules = 0, denyRules = 0;
    for (const name of Object.keys(state.agents)) {
      allowRules += state.agents[name].allow.length;
      denyRules += state.agents[name].deny.length;
    }
    return {
      ok: true,
      storePath: file,
      agents: Object.keys(state.agents).length,
      allowRules,
      denyRules,
      events: state.events.length,
      policy: 'deny rules beat allow rules; HIGH/CRITICAL risk tools always need an explicit (non-wildcard) allow; unknown agents default to deny',
      updatedAt: state.updatedAt,
    };
  }

  function createRouter() {
    let express;
    try { express = require('express'); } catch (e) { express = null; }
    if (!express) return null;
    const router = express.Router();
    router.get('/', (req, res) => { res.json(status()); });
    router.get('/agents', (req, res) => { res.json(listAgents()); });
    router.get('/check', (req, res) => { res.json(check({ agent: req.query.agent, tool: req.query.tool, risk: req.query.risk })); });
    router.post('/grant', (req, res) => { const r = grant(req.body || {}); res.status(r.ok ? 200 : 400).json(r); });
    router.post('/revoke', (req, res) => { const r = revoke(req.body || {}); res.status(r.ok ? 200 : 400).json(r); });
    router.post('/default', (req, res) => { const r = setDefault(req.body || {}); res.status(r.ok ? 200 : 400).json(r); });
    return router;
  }

  function registerAgiTools(engine) {
    if (!engine || typeof engine.register !== 'function') return { ok: false, count: 0, error: 'tool engine not available' };
    engine.register('permissions_check', {
      fn: async (params) => check({ agent: params && params.agent, tool: params && params.tool, risk: params && params.risk }),
      risk: 'LOW',
      category: 'permission',
      timeout: 3000,
      description: 'Check whether an agent may use a tool (deny beats allow; high-risk needs explicit allow).',
    });
    engine.register('permissions_list', {
      fn: async () => listAgents(),
      risk: 'LOW',
      category: 'permission',
      timeout: 3000,
      description: 'List per-agent tool permission policies.',
    });
    return { ok: true, count: 2, names: ['permissions_check', 'permissions_list'] };
  }

  return {
    grant, revoke, setDefault, check, listAgents, status, createRouter, registerAgiTools,
    storePath: () => file,
    _reset: () => { state = null; },
  };
}

const singleton = createPermissions({});

module.exports = {
  dataDir, defaultStorePath, createPermissions,
  grant: singleton.grant,
  revoke: singleton.revoke,
  setDefault: singleton.setDefault,
  check: singleton.check,
  listAgents: singleton.listAgents,
  status: singleton.status,
  createRouter: singleton.createRouter,
  registerAgiTools: singleton.registerAgiTools,
};
