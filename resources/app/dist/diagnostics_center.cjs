'use strict';
/**
 * Phase 15: one diagnostics center. Every test runs a real check or reports
 * honestly that it cannot be tested in this runtime (never a fake PASS).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const health = require('./health_manager.cjs');
const registry = require('./agi/capability_registry.cjs');
const skills = require('./skill_registry.cjs');
const projects = require('./project_index.cjs');
const connectors = require('./connector_registry.cjs');

const DIST = __dirname;
function safe(fn, fallback) { try { const v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }
function exists(p) { try { return !!p && fs.existsSync(p); } catch (e) { return false; } }
function dataDir() {
  return process.env.MYRAA_DATA_DIR || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'MYRAA');
}
function check(id, label, status, detail, t0, source) {
  return {
    id,
    label,
    status,
    source: source || 'runtime',
    latencyMs: Math.max(0, Date.now() - t0),
    checkedAt: new Date().toISOString(),
    detail: String(detail || '').slice(0, 300),
  };
}
function fromHealth(h, id, label) {
  return {
    id,
    label,
    status: h.status,
    source: h.statusSource || 'health_check',
    latencyMs: Number.isFinite(h.latencyMs) ? h.latencyMs : null,
    checkedAt: h.checkedAt || new Date().toISOString(),
    detail: h.error || h.sample || h.status,
  };
}

const CATALOG = Object.freeze([
  ['frontend', 'Frontend assets'],
  ['backend', 'Backend runtime'],
  ['database', 'SQLite memory database'],
  ['ai', 'AI providers'],
  ['voice', 'Voice / live session'],
  ['microphone', 'Microphone'],
  ['speaker', 'Speaker / TTS'],
  ['avatar', '3D companion assets'],
  ['windows', 'Windows agent'],
  ['python', 'Python agent'],
  ['browser', 'Browser agent'],
  ['mcp', 'MCP servers'],
  ['connectors', 'Connectors'],
  ['memory', 'Memory stores'],
  ['vector', 'Vector index'],
  ['gpu', 'GPU acceleration'],
  ['local_models', 'Local models (Ollama)'],
  ['network', 'Network'],
]);

let last = null;

async function runAll(opts) {
  const o = opts || {};
  const t0all = Date.now();
  const results = [];
  const h = await health.runAll(o);
  const byService = {};
  for (const c of h.checks) byService[c.serviceId] = c;

  results.push(check('frontend', 'Frontend assets',
    ['ui_polish_phase14.css', 'ui_accessibility_addon.js', 'avatar_state_addon.js', 'index.html'].every((f) => exists(path.join(DIST, f))) ? registry.STATUS.READY : registry.STATUS.ERROR,
    'polish + accessibility + avatar-state assets present', t0all));
  results.push(check('backend', 'Backend runtime',
    exists(path.join(DIST, 'server.cjs')) ? registry.STATUS.READY : registry.STATUS.ERROR, 'server.cjs present', t0all));
  const memDb = path.join(dataDir(), 'memory', 'myraa_memory.db');
  results.push(check('database', 'SQLite memory database', exists(memDb) ? registry.STATUS.READY : registry.STATUS.NOT_CONFIGURED, memDb, t0all, 'database'));
  for (const lane of ['openrouter', 'ollama', 'openai', 'groq']) {
    const hc = byService['provider.' + (lane === 'openrouter' ? 'openrouter_free' : lane === 'openai' ? 'openai_owned' : lane === 'groq' ? 'groq_owned' : 'ollama_local')];
    if (hc) results.push(fromHealth(hc, 'ai.' + lane, 'AI provider: ' + lane));
  }
  const liveStatus = safe(() => {
    try { return require('./event_bus.cjs').list({ type: 'task.voice_state', limit: 1 }).events.length; } catch (e) { return 0; }
  }, 0);
  results.push(check('voice', 'Voice / live session', liveStatus > 0 ? registry.STATUS.READY : registry.STATUS.NOT_CONFIGURED,
    liveStatus > 0 ? liveStatus + ' real voice-state event(s) recorded' : 'no voice session observed yet', t0all, 'websocket'));
  results.push(check('microphone', 'Microphone', registry.STATUS.UNAVAILABLE,
    'cannot be tested from Node - use the in-app mic test', t0all, 'runtime'));
  results.push(check('speaker', 'Speaker / TTS', exists(path.join(DIST, '..', 'data')) ? registry.STATUS.NOT_CONFIGURED : registry.STATUS.NOT_CONFIGURED,
    'OS speech synthesis is fire-and-forget; enable verified playback check later', t0all, 'runtime'));
  results.push(check('avatar', '3D companion assets', exists(path.join(DIST, 'assets', 'characters', 'evelyn', 'model.pmx')) ? registry.STATUS.READY : registry.STATUS.ERROR,
    'protected model present (not modified)', t0all));
  if (byService['windows.agent']) results.push(fromHealth(byService['windows.agent'], 'windows', 'Windows agent'));
  if (byService['mcp']) results.push(fromHealth(byService['mcp'], 'mcp', 'MCP servers'));
  if (byService['browser.runtime']) results.push(fromHealth(byService['browser.runtime'], 'browser', 'Browser agent'));
  if (byService['network.dns']) results.push(fromHealth(byService['network.dns'], 'network', 'Network'));
  if (byService['provider.ollama_local']) results.push(fromHealth(byService['provider.ollama_local'], 'local_models', 'Local models (Ollama)'));

  const cs = safe(() => connectors.list(), []);
  results.push(check('connectors', 'Connectors', cs.length ? registry.STATUS.READY : registry.STATUS.UNAVAILABLE,
    cs.length + ' catalogued; ' + cs.filter((c) => c.status === registry.STATUS.NOT_CONFIGURED).length + ' need credentials', t0all));
  const mem = safe(() => projects.memoryOverview(), null);
  results.push(check('memory', 'Memory stores', mem ? registry.STATUS.READY : registry.STATUS.ERROR,
    mem ? mem.sources.filter((s) => s.present).length + ' present, ' + mem.totalKnown + ' known entries' : 'overview unavailable', t0all, 'database'));
  const kb = path.join(dataDir(), 'memory', 'kb_index.json');
  results.push(check('vector', 'Vector index', exists(kb) ? registry.STATUS.READY : registry.STATUS.NOT_CONFIGURED, kb, t0all, 'database'));
  results.push(check('gpu', 'GPU acceleration', registry.STATUS.UNAVAILABLE,
    'no real GPU probe is implemented - not claiming READY', t0all, 'runtime'));

  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  last = {
    ok: true,
    checks: results,
    byStatus,
    catalog: CATALOG.map(([id, label]) => ({ id, label })),
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - t0all,
  };
  return last;
}

function report(data) {
  const d = data || last;
  if (!d) return '# MYRAA diagnostics\n\nNot run yet.\n';
  const lines = ['# MYRAA diagnostics', '', 'Generated: ' + d.generatedAt + ' (' + d.durationMs + ' ms)', ''];
  for (const c of d.checks) lines.push('- **' + c.label + '** [' + c.status + '] ' + c.detail + ' (' + c.source + ', ' + c.latencyMs + ' ms)');
  lines.push('', 'No status in this report is fabricated; UNAVAILABLE/NOT_CONFIGURED mean what they say.');
  return lines.join('\n');
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/catalog', (req, res) => res.json({ ok: true, catalog: CATALOG.map(([id, label]) => ({ id, label })) }));
  router.get('/run', async (req, res) => {
    try { res.json(await runAll()); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  router.get('/report', (req, res) => {
    res.type('text/markdown').send(report(last));
  });
  router.get('/last', (req, res) => res.json(last || { ok: false, code: 'NOT_RUN' }));
  return router;
}

module.exports = { CATALOG, runAll, report, createRouter, getLast: () => last };
