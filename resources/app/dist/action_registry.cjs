'use strict';
/**
 * Phase 6: one ActionRegistry derived from real tool catalogs. Every action has
 * a schema, risk, permissions and approval requirement. Nothing here executes;
 * execution stays with the existing engine + approval path (Phase 7).
 */
const gateway = require('./model_gateway.cjs');
const skillsMcp = require('./skills_mcp_engine.cjs');
const connectors = require('./connector_registry.cjs');
const mcp = require('./mcp_manager.cjs');

const HIGH_PATTERN = /send|delete|remove|purchase|pay|buy|publish|submit|execute|run_command|terminal|write|move|archive/i;
function slice(v, n) { return String(v == null ? '' : v).slice(0, n); }
function riskFor(name, fallback) {
  return HIGH_PATTERN.test(String(name || '')) ? 'HIGH' : (fallback || 'LOW');
}
function makeAction(id, description, schema, source, risk) {
  const r = riskFor(id, risk);
  return {
    id,
    description: slice(description, 300),
    inputSchema: schema && typeof schema === 'object' ? schema : { type: 'object', properties: {} },
    risk: r,
    permissions: r === 'HIGH' || r === 'CRITICAL' ? ['approval:high-risk'] : [],
    confirmationRequired: r === 'HIGH' || r === 'CRITICAL',
    reversible: false,
    auditRequired: r !== 'LOW',
    source,
    status: 'REGISTERED',
  };
}

let cached = null;
function list() {
  if (cached) return cached;
  const out = [];
  for (const tool of (skillsMcp.MCP_TOOLS || [])) {
    out.push(makeAction('skill.' + tool.name, tool.description || tool.name, tool.inputSchema || {}, 'skills_mcp_engine'));
  }
  for (const c of connectors.list()) {
    for (const a of c.actions) {
      const props = {};
      for (const p of a.params) props[p] = { type: 'string' };
      out.push(makeAction('connector.' + a.id, c.summary + ' (' + c.name + ')', { type: 'object', properties: props }, 'connector_market'));
    }
  }
  for (const lane of gateway.LANES) {
    out.push(makeAction('model.' + lane.id, 'Chat via ' + lane.label, { type: 'object', properties: { messages: { type: 'array' } } }, 'model_gateway'));
  }
  try {
    for (const s of (mcp.listServers().servers || [])) {
      for (const t of (s.tools || [])) {
        out.push(makeAction('mcp.' + s.name + '.' + t.name, t.description || t.name, t.inputSchema || {}, 'mcp:' + s.name, 'MEDIUM'));
      }
    }
  } catch (e) { /* MCP registry unavailable; no fabricated actions */ }
  cached = out;
  return out;
}
function get(id) { return list().find((a) => a.id === id) || null; }
function check(id) {
  const a = get(id);
  if (!a) return { ok: false, code: 'NOT_FOUND', error: 'unknown action' };
  return {
    ok: true,
    id: a.id,
    risk: a.risk,
    decision: a.confirmationRequired ? 'APPROVAL_REQUIRED' : 'ALLOWED',
    permissions: a.permissions,
    reason: a.confirmationRequired ? 'risk ' + a.risk + ' requires an explicit approval decision' : 'low-risk action, no approval required',
  };
}
function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/list', (req, res) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 500));
    res.json({ ok: true, count: list().length, actions: list().slice(0, limit) });
  });
  router.get('/:id', (req, res) => {
    const a = get(req.params.id);
    res.status(a ? 200 : 404).json(a ? { ok: true, action: a } : { ok: false, code: 'NOT_FOUND' });
  });
  router.post('/check', (req, res) => res.json(check((req.body || {}).id)));
  return router;
}
module.exports = { list, get, check, createRouter };
