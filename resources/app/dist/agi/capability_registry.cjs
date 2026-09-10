'use strict';

/**
 * MYRAA AGI — Capability Registry
 * ---------------------------------------------------------------------------
 * Central catalog of every engine, its capabilities, dependencies, and status.
 * Replaces the fragmented per-engine require() pattern with a single manifest.
 *
 * Engines self-register at startup. The registry provides:
 *   - Discovery: list all engines, search by capability, filter by category
 *   - Health aggregation: roll up per-engine health into system-wide status
 *   - Dependency graph: detect missing/broken dependencies before execution
 *   - Versioning: track engine versions for hot-upgrade compatibility
 *
 * Usage:
 *   const registry = require('./capability_registry.cjs');
 *   registry.register({ id: 'desktop', name: 'Desktop Automation', ... });
 *   const engines = registry.search('mouse');
 *   const health  = registry.healthSummary();
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Storage ────────────────────────────────────────────────────────────────
const engines = new Map();          // id → EngineDescriptor
const capabilityIndex = new Map();  // capabilityId → Set<engineId>
const categoryIndex = new Map();    // category → Set<engineId>
const dependencyGraph = new Map();  // engineId → Set<engineId> (what it depends on)

// ── Persistence ────────────────────────────────────────────────────────────
let dataDir = null;
const REGISTRY_FILE = 'capability_registry.json';

function getDataDir() {
  if (dataDir) return dataDir;
  try {
    const appData = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
    dataDir = path.join(appData, 'MYRAA');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) { dataDir = '.'; }
  return dataDir;
}

// ── Engine Descriptor Shape ────────────────────────────────────────────────
// {
//   id:            string   (unique, e.g. 'desktop', 'memory', 'graft')
//   name:          string   (human-readable, e.g. 'Desktop Automation')
//   category:      string   (one of CATEGORIES below)
//   version:       string   (semver, e.g. '1.0.0')
//   description:   string   (one-line summary)
//   capabilities:  string[] (what this engine can do, e.g. ['mouse_click', 'keyboard_type'])
//   dependencies:  string[] (engine ids this engine needs at runtime)
//   entryPoint:    string   (relative path to .cjs file from dist/)
//   healthCheck:   function (optional) () => { state, latencyMs, detail }
//   riskLevel:     'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'
//   enabled:       boolean
//   lastHealth:    { state, latencyMs, timestamp } (cached)
// }

const CATEGORIES = {
  CORE:           'core',
  AI:             'ai',
  DESKTOP:        'desktop',
  FILESYSTEM:     'filesystem',
  DEVELOPMENT:    'development',
  MEMORY:         'memory',
  WEB:            'web',
  OFFICE:         'office',
  SECURITY:       'security',
  CONNECTOR:      'connector',
  AGENT:          'agent',
  SKILL:          'skill',
  PLUGIN:         'plugin',
  MAINTENANCE:    'maintenance',
  MULTIMODAL:     'multimodal',
};

// ── Registration ───────────────────────────────────────────────────────────

/**
 * Register an engine descriptor. Throws if id is duplicate.
 * @param {object} descriptor
 */
function register(descriptor) {
  const required = ['id', 'name', 'category', 'version', 'description', 'capabilities', 'entryPoint'];
  for (const field of required) {
    if (!descriptor[field]) throw new Error(`CapabilityRegistry: missing required field '${field}' for engine`);
  }
  if (!Object.values(CATEGORIES).includes(descriptor.category)) {
    throw new Error(`CapabilityRegistry: unknown category '${descriptor.category}' for engine '${descriptor.id}'`);
  }
  if (engines.has(descriptor.id)) {
    throw new Error(`CapabilityRegistry: duplicate engine id '${descriptor.id}'`);
  }

  const entry = {
    id: descriptor.id,
    name: descriptor.name,
    category: descriptor.category,
    version: descriptor.version || '0.0.0',
    description: descriptor.description,
    capabilities: Array.isArray(descriptor.capabilities) ? descriptor.capabilities : [],
    dependencies: Array.isArray(descriptor.dependencies) ? descriptor.dependencies : [],
    entryPoint: descriptor.entryPoint,
    healthCheck: typeof descriptor.healthCheck === 'function' ? descriptor.healthCheck : null,
    riskLevel: descriptor.riskLevel || 'LOW',
    enabled: descriptor.enabled !== false,
    lastHealth: { state: 'unknown', latencyMs: 0, timestamp: 0 },
    registeredAt: Date.now(),
  };

  engines.set(entry.id, entry);

  // Index by capability
  for (const cap of entry.capabilities) {
    if (!capabilityIndex.has(cap)) capabilityIndex.set(cap, new Set());
    capabilityIndex.get(cap).add(entry.id);
  }

  // Index by category
  if (!categoryIndex.has(entry.category)) categoryIndex.set(entry.category, new Set());
  categoryIndex.get(entry.category).add(entry.id);

  // Track dependencies
  if (entry.dependencies.length > 0) {
    dependencyGraph.set(entry.id, new Set(entry.dependencies));
  }

  return entry;
}

/**
 * Register multiple engines at once.
 */
function registerAll(descriptors) {
  return descriptors.map(d => register(d));
}

// ── Lookup ─────────────────────────────────────────────────────────────────

/** Get engine by id */
function get(id) {
  return engines.get(id) || null;
}

/** Check if engine is registered and enabled */
function isEnabled(id) {
  const e = engines.get(id);
  return e ? e.enabled : false;
}

/** Get all registered engines (array) */
function listAll() {
  return Array.from(engines.values());
}

/** Get engines by category */
function listByCategory(category) {
  const ids = categoryIndex.get(category);
  if (!ids) return [];
  return Array.from(ids).map(id => engines.get(id)).filter(Boolean);
}

/** Search engines by capability name (case-insensitive partial match) */
function searchByCapability(query) {
  const q = query.toLowerCase();
  const results = [];
  for (const [cap, engineIds] of capabilityIndex) {
    if (cap.toLowerCase().includes(q)) {
      for (const eid of engineIds) {
        const e = engines.get(eid);
        if (e) results.push(e);
      }
    }
  }
  // Also search engine names and descriptions
  for (const e of engines.values()) {
    if (e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)) {
      if (!results.find(r => r.id === e.id)) results.push(e);
    }
  }
  return results;
}

/** Search by name/description (case-insensitive) */
function search(query) {
  const q = query.toLowerCase();
  return Array.from(engines.values()).filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q) ||
    e.capabilities.some(c => c.toLowerCase().includes(q))
  );
}

// ── Dependency Validation ──────────────────────────────────────────────────

/**
 * Check if all dependencies of an engine are met.
 * Returns { ok: boolean, missing: string[], broken: string[] }
 */
function checkDependencies(engineId) {
  const deps = dependencyGraph.get(engineId);
  if (!deps || deps.size === 0) return { ok: true, missing: [], broken: [] };

  const missing = [];
  const broken = [];

  for (const depId of deps) {
    const dep = engines.get(depId);
    if (!dep) {
      missing.push(depId);
    } else if (!dep.enabled) {
      broken.push(depId);
    }
  }

  return { ok: missing.length === 0 && broken.length === 0, missing, broken };
}

/** Get the full dependency graph as adjacency list */
function getDependencyGraph() {
  const graph = {};
  for (const [id, deps] of dependencyGraph) {
    graph[id] = Array.from(deps);
  }
  return graph;
}

// ── Health ─────────────────────────────────────────────────────────────────

/**
 * Run health check for a single engine.
 */
async function checkEngineHealth(engineId) {
  const e = engines.get(engineId);
  if (!e) return { state: 'unknown', latencyMs: 0, detail: 'engine not found' };

  if (!e.healthCheck) {
    e.lastHealth = { state: 'no-check', latencyMs: 0, timestamp: Date.now(), detail: 'no healthCheck registered' };
    return e.lastHealth;
  }

  const start = Date.now();
  try {
    const result = await Promise.race([
      e.healthCheck(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('health check timeout')), 10000)),
    ]);
    const latencyMs = Date.now() - start;
    e.lastHealth = {
      state: result.state || 'unknown',
      latencyMs,
      timestamp: Date.now(),
      detail: result.detail || '',
      ...result,
    };
  } catch (err) {
    e.lastHealth = {
      state: 'error',
      latencyMs: Date.now() - start,
      timestamp: Date.now(),
      detail: err.message,
    };
  }
  return e.lastHealth;
}

/**
 * Run health checks for all enabled engines.
 * Returns { overall, engines: { [id]: health }, summary }
 */
async function healthSummary() {
  const results = {};
  const enabled = Array.from(engines.values()).filter(e => e.enabled && e.healthCheck);

  await Promise.allSettled(
    enabled.map(async (e) => {
      results[e.id] = await checkEngineHealth(e.id);
    })
  );

  const states = Object.values(results);
  const healthy = states.filter(s => s.state === 'healthy' || s.state === 'ok').length;
  const degraded = states.filter(s => s.state === 'degraded').length;
  const errored = states.filter(s => s.state === 'error').length;
  const unknown = states.filter(s => s.state === 'unknown' || s.state === 'no-check').length;

  let overall = 'healthy';
  if (errored > 0) overall = 'degraded';
  if (errored > states.length / 2) overall = 'critical';

  return {
    overall,
    engines: results,
    summary: {
      total: engines.size,
      enabled: enabled.length,
      healthy,
      degraded,
      error: errored,
      unknown,
    },
    timestamp: Date.now(),
  };
}

// ── Enable / Disable ───────────────────────────────────────────────────────

function enable(engineId) {
  const e = engines.get(engineId);
  if (e) { e.enabled = true; return true; }
  return false;
}

function disable(engineId) {
  const e = engines.get(engineId);
  if (e) { e.enabled = false; return true; }
  return false;
}

// ── Persistence ────────────────────────────────────────────────────────────

function saveRegistry() {
  try {
    const data = {};
    for (const [id, e] of engines) {
      data[id] = {
        id: e.id, name: e.name, category: e.category, version: e.version,
        description: e.description, capabilities: e.capabilities,
        dependencies: e.dependencies, entryPoint: e.entryPoint,
        riskLevel: e.riskLevel, enabled: e.enabled,
        registeredAt: e.registeredAt,
      };
    }
    const filePath = path.join(getDataDir(), REGISTRY_FILE);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) { return false; }
}

function loadRegistry() {
  try {
    const filePath = path.join(getDataDir(), REGISTRY_FILE);
    if (!fs.existsSync(filePath)) return false;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const [id, entry] of Object.entries(data)) {
      if (!engines.has(id)) {
        register({ ...entry, healthCheck: null });
      }
    }
    return true;
  } catch (e) { return false; }
}

// ── Summary ────────────────────────────────────────────────────────────────

function getSummary() {
  const cats = {};
  for (const [cat, ids] of categoryIndex) {
    cats[cat] = ids.size;
  }
  return {
    totalEngines: engines.size,
    totalCapabilities: capabilityIndex.size,
    categories: cats,
    enabledCount: Array.from(engines.values()).filter(e => e.enabled).length,
    dependencyCount: dependencyGraph.size,
  };
}

// ── Express Router (optional mount) ────────────────────────────────────────

function createRouter() {
  const express = require('express');
  const router = express.Router();

  router.get('/registry', (req, res) => {
    res.json({ engines: listAll(), summary: getSummary() });
  });

  router.get('/registry/search', (req, res) => {
    const q = req.query.q || '';
    res.json({ results: search(q) });
  });

  router.get('/registry/category/:category', (req, res) => {
    res.json({ engines: listByCategory(req.params.category) });
  });

  router.get('/registry/:id', (req, res) => {
    const e = get(req.params.id);
    if (!e) return res.status(404).json({ error: 'engine not found' });
    const deps = checkDependencies(e.id);
    res.json({ engine: e, dependencies: deps });
  });

  router.get('/health', async (req, res) => {
    res.json(await healthSummary());
  });

  router.get('/health/:id', async (req, res) => {
    const h = await checkEngineHealth(req.params.id);
    res.json(h);
  });

  router.post('/registry/:id/enable', (req, res) => {
    res.json({ ok: enable(req.params.id) });
  });

  router.post('/registry/:id/disable', (req, res) => {
    res.json({ ok: disable(req.params.id) });
  });

  return router;
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  CATEGORIES,
  register,
  registerAll,
  get,
  isEnabled,
  listAll,
  listByCategory,
  searchByCapability,
  search,
  checkDependencies,
  getDependencyGraph,
  checkEngineHealth,
  healthSummary,
  enable,
  disable,
  saveRegistry,
  loadRegistry,
  getSummary,
  createRouter,
};
