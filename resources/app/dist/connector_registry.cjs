'use strict';
/**
 * Phase 5: Connector registry with truthful statuses. Built from the existing
 * connector_market catalog and real env-key checks. A connector is never
 * CONNECTED just because it is catalogued; only a successful real probe earns READY.
 */
const market = require('./connector_market.cjs');
const registry = require('./agi/capability_registry.cjs');

const lastProbe = new Map();
function statusOf(c) {
  if (c.auth === 'none') return registry.STATUS.READY; // public API, no credentials required
  return process.env[c.auth] ? registry.STATUS.DISCONNECTED : registry.STATUS.NOT_CONFIGURED;
}
function publicConnector(c) {
  const p = lastProbe.get(c.id);
  return {
    id: c.id,
    name: c.name,
    vendor: null,
    icon: null,
    category: c.category,
    authType: c.auth === 'none' ? 'none' : 'env_key',
    keyEnv: c.auth === 'none' ? null : c.auth,
    configured: c.auth === 'none' || Boolean(process.env[c.auth]),
    scopes: [],
    status: p ? p.status : statusOf(c),
    statusSource: p ? 'health_check' : 'runtime',
    capabilities: c.actions.map((a) => a.id),
    actions: c.actions.map((a) => ({ id: c.id + '.' + a.id, params: Array.isArray(a.params) ? a.params : [] })),
    hosts: c.hosts.slice(),
    health: p || null,
    lastUsed: null,
    lastError: p && p.error ? p.error : null,
    summary: c.summary,
  };
}
function list() { return market.CONNECTOR_CATALOG.map(publicConnector); }

async function probe(id) {
  const c = market.findConnector(id);
  if (!c) return { ok: false, code: 'NOT_FOUND', error: 'unknown connector' };
  if (c.auth !== 'none' && !process.env[c.auth]) {
    return { ok: false, serviceId: c.id, status: registry.STATUS.NOT_CONFIGURED, error: 'set env ' + c.auth };
  }
  const host = c.hosts && c.hosts[0];
  if (!host) return { ok: false, serviceId: c.id, status: registry.STATUS.UNAVAILABLE, error: 'no allowlisted host' };
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const url = 'https://' + host;
    const headers = c.auth !== 'none' ? { Authorization: 'Bearer ' + process.env[c.auth] } : {};
    const r = await fetch(url, { headers, signal: ctrl.signal });
    const out = {
      ok: r.ok,
      serviceId: c.id,
      status: r.ok ? registry.STATUS.READY : registry.STATUS.DEGRADED,
      statusSource: 'health_check',
      latencyMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
      error: r.ok ? null : 'HTTP ' + r.status,
    };
    lastProbe.set(c.id, out);
    return out;
  } catch (e) {
    const out = {
      ok: false,
      serviceId: c.id,
      status: registry.STATUS.UNAVAILABLE,
      statusSource: 'health_check',
      latencyMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
      error: String(e && e.message).slice(0, 200),
    };
    lastProbe.set(c.id, out);
    return out;
  } finally { clearTimeout(timer); }
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/list', (req, res) => res.json({ ok: true, connectors: list() }));
  router.post('/probe', async (req, res) => res.json(await probe((req.body || {}).id)));
  router.get('/status', (req, res) => res.json(market.status()));
  return router;
}

module.exports = { list, probe, createRouter };
