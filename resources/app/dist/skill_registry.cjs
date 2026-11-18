'use strict';
/**
 * Phase 9: real skill registry state. Reuses the existing discovery registry
 * (532 catalogued records) but derives installed/healthy/enabled from actual
 * SKILL.md files on disk instead of trusting the hardcoded "ACTIVE" label.
 */
const fs = require('fs');
const path = require('path');
const discovery = require('./skill_discovery_engine.cjs');
const registry = require('./agi/capability_registry.cjs');

function slice(v, n) { return String(v == null ? '' : v).slice(0, n); }
function recordFrom(e) {
  let p = e.path && fs.existsSync(e.path) ? e.path : null;
  try {
    if (p && fs.statSync(p).isDirectory()) {
      const candidate = path.join(p, 'SKILL.md');
      p = fs.existsSync(candidate) ? candidate : null;
    }
  } catch (e2) { p = null; }
  const installed = !!(p && e.hasSkillMd !== false);
  const status = installed ? registry.STATUS.READY : registry.STATUS.UNAVAILABLE;
  return {
    id: e.id,
    name: e.name,
    description: slice(e.description, 400),
    category: e.category || 'uncategorised',
    version: e.version || null,
    provider: e.source || null,
    dependencies: Array.isArray(e.dependencies) ? e.dependencies : [],
    tools: Array.isArray(e.tools_required) ? e.tools_required : [],
    permissions: [],
    local: installed,
    remote: !installed,
    enabled: installed,
    status,
    statusSource: 'runtime',
    health: installed ? { ok: true, detail: 'SKILL.md present' } : { ok: false, detail: 'SKILL.md not found' },
    lastUsed: null,
    history: [],
    inputSchema: { type: 'object', inputs: Array.isArray(e.input_types) ? e.input_types : [] },
    outputSchema: { type: 'object', outputs: Array.isArray(e.output_types) ? e.output_types : [] },
    error: installed ? null : 'SKILL.md not found at ' + (e.path || '(no path)'),
    risk: e.risk_level || 'UNKNOWN',
    methods: {
      inspect: installed, test: installed,
      run: false, install: false, uninstall: false, update: false,
      note: 'run/install/update/uninstall are NOT_IMPLEMENTED - this registry reports state only',
    },
    path: p,
  };
}
function all() {
  const out = [];
  for (const e of discovery.skillRegistry.values()) out.push(recordFrom(e));
  return out;
}
function list(opts) {
  const o = opts || {};
  let items = all();
  if (o.category) items = items.filter((s) => s.category === o.category);
  if (o.installed === true) items = items.filter((s) => s.local);
  const limit = Math.min(1000, Math.max(1, Number(o.limit) || 200));
  return { ok: true, total: items.length, skills: items.slice(0, limit) };
}
function summary() {
  const items = all();
  const byStatus = {};
  const categories = {};
  for (const s of items) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    categories[s.category] = (categories[s.category] || 0) + 1;
  }
  return {
    ok: true,
    catalogued: items.length,
    installed: items.filter((s) => s.local).length,
    byStatus,
    categories,
    discoveryLastScan: discovery.lastScanTime || null,
    note: 'counts are derived from skill records + real SKILL.md files',
  };
}
function get(id) { return all().find((s) => s.id === String(id || '').toLowerCase()) || null; }
function inspect(id) {
  const s = get(id);
  if (!s) return { ok: false, code: 'NOT_FOUND', error: 'unknown skill' };
  if (!s.path) return { ok: false, code: 'NOT_INSTALLED', error: s.error };
  try { return { ok: true, skill: s, content: fs.readFileSync(s.path, 'utf8').slice(0, 8000) }; }
  catch (e) { return { ok: false, code: 'READ_ERROR', error: e.message }; }
}
function test(id) {
  const s = get(id);
  if (!s) return { ok: false, code: 'NOT_FOUND', error: 'unknown skill' };
  if (!s.path) return { ok: false, code: 'NOT_INSTALLED', error: s.error };
  try {
    const text = fs.readFileSync(s.path, 'utf8');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.test(text);
    return { ok: frontmatter, code: frontmatter ? 'PASS' : 'NO_FRONTMATTER', skillId: s.id, checks: { file: true, frontmatter } };
  } catch (e) { return { ok: false, code: 'READ_ERROR', error: e.message }; }
}
function run() { return { ok: false, code: 'NOT_IMPLEMENTED', error: 'skill execution is not implemented by this registry' }; }

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/summary', (req, res) => res.json(summary()));
  router.get('/list', (req, res) => res.json(list(req.query)));
  router.get('/:id', (req, res) => {
    const s = get(req.params.id);
    res.status(s ? 200 : 404).json(s ? { ok: true, skill: s } : { ok: false, code: 'NOT_FOUND' });
  });
  router.post('/test', (req, res) => res.json(test((req.body || {}).id)));
  router.post('/run', (req, res) => res.json(run()));
  return router;
}

module.exports = { all, list, summary, get, inspect, test, run, createRouter };
