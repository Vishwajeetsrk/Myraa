'use strict';

/**
 * MYRAA AGI — Unified Health Monitor
 * ---------------------------------------------------------------------------
 * Single aggregation point for all component health checks.
 * Replaces the fragmented health check pattern (startup health, plugin health,
 * model router health, connector health) with one unified system.
 *
 * Components register health check functions. The monitor runs them on-demand
 * or at configurable intervals, caches results, and provides:
 *   - System-wide health summary (healthy/degraded/critical)
 *   - Per-component drill-down
 *   - Trend tracking (last N health snapshots)
 *   - Auto-alerting on state transitions
 *   - Express router for /api/agi/health
 *
 * Usage:
 *   const monitor = require('./unified_health_monitor.cjs');
 *   monitor.register('server', { check: async () => ({ state: 'healthy' }), interval: 30000 });
 *   const report = await monitor.checkAll();
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ── State ──────────────────────────────────────────────────────────────────

const components = new Map();
const history = [];               // circular buffer of system-wide snapshots
const emitter = new EventEmitter();
const HISTORY_MAX = 100;

// ── Health States ──────────────────────────────────────────────────────────

const STATES = {
  HEALTHY:  'healthy',
  DEGRADED: 'degraded',
  ERROR:    'error',
  UNKNOWN:  'unknown',
  TIMEOUT:  'timeout',
};

const STATE_PRIORITY = {
  healthy: 0,
  unknown: 1,
  degraded: 2,
  error: 3,
  timeout: 3,
};

// ── Component Descriptor ───────────────────────────────────────────────────
// {
//   id:         string
//   name:       string
//   category:   string (core|ai|desktop|memory|connector|plugin|agent|other)
//   check:      async function() => { state, latencyMs, detail?, metrics? }
//   interval:   number (ms, 0 = on-demand only)
//   timeout:    number (ms, max time for check)
//   critical:   boolean (if true, system is critical when this component fails)
//   lastResult: { state, latencyMs, detail, metrics, timestamp }
//   timer:      NodeJS.Timeout (for periodic checks)
// }

// ── Registration ───────────────────────────────────────────────────────────

function register(id, descriptor) {
  if (!id || !descriptor.check) throw new Error('HealthMonitor: id and check function required');

  const comp = {
    id,
    name: descriptor.name || id,
    category: descriptor.category || 'other',
    check: descriptor.check,
    interval: descriptor.interval || 0,
    timeout: descriptor.timeout || 10000,
    critical: descriptor.critical || false,
    lastResult: { state: STATES.UNKNOWN, latencyMs: 0, detail: '', metrics: {}, timestamp: 0 },
    timer: null,
  };

  components.set(id, comp);

  // Start periodic check if interval > 0
  if (comp.interval > 0) {
    comp.timer = setInterval(() => checkOne(id).catch(() => {}), comp.interval);
  }

  return comp;
}

function unregister(id) {
  const comp = components.get(id);
  if (comp) {
    if (comp.timer) clearInterval(comp.timer);
    components.delete(id);
  }
}

// ── Health Checks ──────────────────────────────────────────────────────────

/**
 * Check a single component.
 */
async function checkOne(id) {
  const comp = components.get(id);
  if (!comp) return { state: STATES.UNKNOWN, latencyMs: 0, detail: 'component not found' };

  const start = Date.now();
  try {
    const result = await Promise.race([
      comp.check(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), comp.timeout)
      ),
    ]);

    const latencyMs = Date.now() - start;
    const prev = comp.lastResult.state;
    comp.lastResult = {
      state: result.state || STATES.UNKNOWN,
      latencyMs,
      detail: result.detail || '',
      metrics: result.metrics || {},
      timestamp: Date.now(),
    };

    // Emit on state transition
    if (prev !== comp.lastResult.state) {
      emitter.emit('stateChange', {
        component: id,
        from: prev,
        to: comp.lastResult.state,
        timestamp: Date.now(),
      });
    }

    return comp.lastResult;

  } catch (err) {
    const latencyMs = Date.now() - start;
    const prev = comp.lastResult.state;
    comp.lastResult = {
      state: err.message === 'timeout' ? STATES.TIMEOUT : STATES.ERROR,
      latencyMs,
      detail: err.message,
      metrics: {},
      timestamp: Date.now(),
    };

    if (prev !== comp.lastResult.state) {
      emitter.emit('stateChange', {
        component: id,
        from: prev,
        to: comp.lastResult.state,
        timestamp: Date.now(),
      });
    }

    return comp.lastResult;
  }
}

/**
 * Check all registered components.
 */
async function checkAll() {
  const checks = Array.from(components.keys()).map(id => checkOne(id));
  await Promise.allSettled(checks);
  return getReport();
}

/**
 * Get the current health report without re-running checks.
 */
function getReport() {
  const results = {};
  let worstState = STATES.HEALTHY;
  let hasCritical = false;
  let criticalFailed = false;

  for (const [id, comp] of components) {
    results[id] = {
      name: comp.name,
      category: comp.category,
      critical: comp.critical,
      ...comp.lastResult,
    };

    // Determine worst state
    const p = STATE_PRIORITY[comp.lastResult.state] || 0;
    const worstP = STATE_PRIORITY[worstState] || 0;
    if (p > worstP) worstState = comp.lastResult.state;

    if (comp.critical) {
      hasCritical = true;
      if (comp.lastResult.state === STATES.ERROR || comp.lastResult.state === STATES.TIMEOUT) {
        criticalFailed = true;
      }
    }
  }

  let overall = worstState;
  if (criticalFailed) overall = STATES.ERROR;

  const summary = {
    total: components.size,
    healthy: 0,
    degraded: 0,
    error: 0,
    timeout: 0,
    unknown: 0,
  };

  for (const comp of components.values()) {
    const s = comp.lastResult.state;
    if (summary[s] !== undefined) summary[s]++;
  }

  return {
    overall,
    components: results,
    summary,
    timestamp: Date.now(),
  };
}

/**
 * Get health history (last N snapshots).
 */
function getHistory(limit = 20) {
  return history.slice(-limit);
}

// ── Built-in Health Checks ─────────────────────────────────────────────────

/** Check if the Express server port is listening */
function checkServerPort(port = 3000) {
  return async () => {
    try {
      const http = require('http');
      return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/api/system/about/diagnostics`, { timeout: 5000 }, (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            try {
              const info = JSON.parse(data);
              resolve({ state: STATES.HEALTHY, detail: `v${info.version}`, metrics: { port, version: info.version } });
            } catch {
              resolve({ state: STATES.HEALTHY, detail: 'responding', metrics: { port } });
            }
          });
        });
        req.on('error', () => resolve({ state: STATES.ERROR, detail: `port ${port} not responding` }));
        req.on('timeout', () => { req.destroy(); resolve({ state: STATES.TIMEOUT, detail: `port ${port} timeout` }); });
      });
    } catch (e) {
      return { state: STATES.ERROR, detail: e.message };
    }
  };
}

/** Check disk space */
function checkDiskSpace() {
  return async () => {
    try {
      const { execSync } = require('child_process');
      const output = execSync('powershell -NoProfile -Command "Get-PSDrive C | Select-Object Used,Free | ConvertTo-Json"', { encoding: 'utf8', timeout: 5000 });
      const info = JSON.parse(output.trim());
      const usedBytes = info.Used || 0;
      const freeBytes = info.Free || 0;
      const totalBytes = usedBytes + freeBytes;
      if (totalBytes > 0) {
        const freeGB = (freeBytes / (1024 ** 3)).toFixed(1);
        const totalGB = (totalBytes / (1024 ** 3)).toFixed(1);
        const pct = ((freeBytes / totalBytes) * 100).toFixed(1);
        const state = pct < 10 ? STATES.ERROR : pct < 25 ? STATES.DEGRADED : STATES.HEALTHY;
        return { state, detail: `${freeGB}GB free of ${totalGB}GB (${pct}%)`, metrics: { freeGB: Number(freeGB), totalGB: Number(totalGB), pctUsed: 100 - Number(pct) } };
      }
      return { state: STATES.UNKNOWN, detail: 'could not parse disk info' };
    } catch (e) {
      return { state: STATES.UNKNOWN, detail: e.message };
    }
  };
}

/** Check Node.js process health */
function checkProcess() {
  return async () => {
    const mem = process.memoryUsage();
    const heapUsedMB = (mem.heapUsed / (1024 * 1024)).toFixed(1);
    const rssMB = (mem.rss / (1024 * 1024)).toFixed(1);
    const state = Number(heapUsedMB) > 500 ? STATES.DEGRADED : STATES.HEALTHY;
    return {
      state,
      detail: `heap ${heapUsedMB}MB, rss ${rssMB}MB`,
      metrics: { heapUsedMB: Number(heapUsedMB), rssMB: Number(rssMB), uptime: process.uptime() },
    };
  };
}

// ── Trend Analysis ─────────────────────────────────────────────────────────

function recordSnapshot() {
  const report = getReport();
  history.push(report);
  if (history.length > HISTORY_MAX) history.shift();
  return report;
}

function getTrend(componentId, windowSize = 10) {
  const recent = history.slice(-windowSize);
  const states = recent.map(h => h.components[componentId]?.state || 'unknown');
  const errorCount = states.filter(s => s === 'error' || s === 'timeout').length;
  const avgLatency = recent
    .map(h => h.components[componentId]?.latencyMs || 0)
    .reduce((a, b) => a + b, 0) / (recent.length || 1);

  return {
    component: componentId,
    windowSize: recent.length,
    errorRate: recent.length > 0 ? (errorCount / recent.length * 100).toFixed(1) + '%' : 'N/A',
    avgLatencyMs: Math.round(avgLatency),
    recentStates: states,
    stable: new Set(states).size <= 2,
  };
}

// ── Express Router ─────────────────────────────────────────────────────────

function createRouter() {
  const express = require('express');
  const router = express.Router();

  router.get('/', async (req, res) => {
    if (req.query.refresh === 'true') await checkAll();
    res.json(getReport());
  });

  router.get('/summary', (req, res) => {
    const report = getReport();
    res.json({ overall: report.overall, summary: report.summary, timestamp: report.timestamp });
  });

  router.get('/component/:id', async (req, res) => {
    if (req.query.refresh === 'true') await checkOne(req.params.id);
    const comp = components.get(req.params.id);
    if (!comp) return res.status(404).json({ error: 'component not found' });
    res.json({ id: req.params.id, ...comp.lastResult });
  });

  router.get('/history', (req, res) => {
    res.json({ history: getHistory(Number(req.query.limit) || 20) });
  });

  router.get('/trend/:id', (req, res) => {
    res.json(getTrend(req.params.id, Number(req.query.window) || 10));
  });

  return router;
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  STATES,
  register,
  unregister,
  checkOne,
  checkAll,
  getReport,
  getHistory,
  getTrend,
  recordSnapshot,
  checkServerPort,
  checkDiskSpace,
  checkProcess,
  createRouter,
  onStateChange: (cb) => emitter.on('stateChange', cb),
};
