'use strict';
/**
 * MYRAA Health Manager (Phase 3).
 * One aggregate of REAL checks. Every result carries a measured latency and
 * a real source. No invented latency, no cached "operational" flags.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');

const gateway = require('./model_gateway.cjs');
const registry = require('./agi/capability_registry.cjs');
const bootstrap = require('./agi/capability_bootstrap.cjs');

function safeRequire(file) { try { return require(path.join(__dirname, file)); } catch (e) { return null; } }
function dataDir() {
  return process.env.MYRAA_DATA_DIR || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'MYRAA');
}
function exists(p) { try { return !!p && fs.existsSync(p); } catch (e) { return false; } }
function mapState(state) {
  const s = String(state || '').toUpperCase();
  if (s === 'ONLINE' || s === 'OK' || s === 'HEALTHY' || s === 'READY') return registry.STATUS.READY;
  if (s === 'AUTH_REQUIRED' || s === 'INVALID_KEY') return registry.STATUS.AUTH_REQUIRED;
  if (s === 'DEGRADED' || s === 'PARTIAL') return registry.STATUS.DEGRADED;
  if (s === 'OFFLINE' || s === 'NOT_INSTALLED' || s === 'NOT_CONFIGURED') return registry.STATUS.UNAVAILABLE;
  return registry.STATUS.ERROR;
}
function result(serviceId, t0, status, detail, extra) {
  return Object.assign({
    serviceId,
    status,
    latencyMs: Math.max(0, Date.now() - t0),
    checkedAt: new Date().toISOString(),
    version: null,
    capabilities: [],
    error: status === registry.STATUS.ERROR || status === registry.STATUS.UNAVAILABLE ? String(detail || '').slice(0, 300) : null,
  }, extra || {});
}
function timed(serviceId, fn) {
  const t0 = Date.now();
  return Promise.resolve().then(fn).then((r) => {
    const status = mapState(r && r.state);
    return result(serviceId, t0, status, (r && r.detail) || (r && r.error) || '', {
      version: (r && r.version) || null,
      capabilities: Array.isArray(r && r.capabilities) ? r.capabilities : [],
      sample: (r && r.sample) || undefined,
    });
  }, (e) => result(serviceId, t0, registry.STATUS.ERROR, e && e.message));
}

let last = null;

async function runAll(opts) {
  const o = opts || {};
  const checks = [];

  // 1. Registered capabilities (their own real health checks).
  try {
    bootstrap.ensureRegistered();
    const summary = await registry.healthSummary();
    checks.push(result('capabilities', Date.now(), mapState(summary.overall),
      summary.overall, { version: null, capabilities: Object.keys(summary.engines || {}) }));
  } catch (e) { checks.push(result('capabilities', Date.now(), registry.STATUS.ERROR, e.message)); }

  // 2. AI lanes (real bounded probes from the existing gateway).
  for (const lane of gateway.LANES) {
    checks.push(await timed('provider.' + lane.id, () => gateway.probeLane(lane.id, o)));
  }

  // 3. MCP registry state (real in-memory registry, not a status string).
  const mcp = safeRequire('mcp_manager.cjs');
  checks.push(await timed('mcp', () => {
    const s = mcp && mcp.status ? mcp.status() : null;
    if (!s || !s.ok) return { state: 'ERROR', detail: 'MCP registry unavailable' };
    return {
      state: s.count > 0 ? 'READY' : 'NOT_CONFIGURED',
      detail: s.count + ' registered MCP server(s)',
      capabilities: ['mcp.stdio', 'mcp.presets'],
    };
  }));

  // 4. Memory database (real file check).
  checks.push(await timed('memory.db', () => {
    const db = path.join(dataDir(), 'memory', 'myraa_memory.db');
    return exists(db) ? { state: 'READY', detail: 'SQLite memory database present', capabilities: ['memory.sqlite'] }
      : { state: 'ERROR', detail: 'SQLite memory database missing' };
  }));

  // 5. OCR engine (real reported status).
  const ocr = safeRequire('ocr_engine.cjs');
  checks.push(await timed('ocr', () => {
    if (!ocr || typeof ocr.status !== 'function') return { state: 'ERROR', detail: 'OCR module unavailable' };
    const s = ocr.status();
    return { state: s && (s.ok || s.available) ? 'READY' : 'UNAVAILABLE', detail: JSON.stringify(s || {}).slice(0, 200), capabilities: ['screen.ocr'] };
  }));

  // 6. Windows desktop agent (real bounded HTTP probe).
  checks.push(await timed('windows.agent', async () => {
    const url = process.env.DESKTOP_AGENT_URL || 'http://127.0.0.1:8765';
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      return { state: r.ok ? 'READY' : 'DEGRADED', detail: 'HTTP ' + r.status, capabilities: ['windows.control'] };
    } catch (e) {
      return { state: 'UNAVAILABLE', detail: 'agent not reachable at ' + url };
    } finally { clearTimeout(t); }
  }));

  // 7. Browser runtime (real dependency check).
  checks.push(await timed('browser.runtime', () => exists(path.join(__dirname, '..', 'node_modules', 'playwright'))
    ? { state: 'READY', detail: 'playwright installed', capabilities: ['browser.navigate', 'browser.click'] }
    : { state: 'UNAVAILABLE', detail: 'playwright not installed - browser agent cannot start' }));

  // 8. Network (real DNS resolution).
  checks.push(await timed('network.dns', () => new Promise((resolve) => {
    dns.lookup('api.github.com', (err, address) => err
      ? resolve({ state: 'UNAVAILABLE', detail: 'DNS failed: ' + err.message })
      : resolve({ state: 'READY', detail: 'resolved api.github.com to ' + address, capabilities: ['network.outbound'] }));
  })));

  const byStatus = {};
  for (const c of checks) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  last = { ok: true, checks, byStatus, generatedAt: new Date().toISOString() };
  return last;
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/run', async (req, res) => {
    try { res.json(await runAll()); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  router.get('/last', (req, res) => res.json(last || { ok: false, code: 'NOT_RUN', checks: [] }));
  return router;
}

module.exports = { STATUS: registry.STATUS, runAll, createRouter, getLast: () => last };
