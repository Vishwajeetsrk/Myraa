'use strict';
/**
 * MYRAA Performance Telemetry — cheap, in-memory latency and failure counters.
 * No continuous full-screen analysis; records only operations that report in.
 */

const samples = new Map();
const MAX_SAMPLES = 500;

function bucket(name) {
  const key = String(name || 'unknown').slice(0, 80);
  if (!samples.has(key)) samples.set(key, { count: 0, failures: 0, totalMs: 0, lastMs: null, worstMs: 0, history: [] });
  return samples.get(key);
}

function record(name, ms, ok = true) {
  const b = bucket(name);
  const n = Math.max(0, Number(ms) || 0);
  b.count += 1;
  b.totalMs += n;
  b.lastMs = n;
  if (n > b.worstMs) b.worstMs = n;
  if (!ok) b.failures += 1;
  b.history.push({ at: new Date().toISOString(), ms: n, ok: !!ok });
  while (b.history.length > MAX_SAMPLES) b.history.shift();
  try {
    const bus = require('./event_bus.cjs');
    bus.emit('system.telemetry', { operation: String(name).slice(0, 60), ms: n, ok: !!ok });
  } catch (e) { /* telemetry never breaks the caller */ }
  return { ok: true, operation: String(name).slice(0, 80) };
}

async function timed(name, fn) {
  const t = Date.now();
  let ok = true;
  try { return await fn(); }
  catch (e) { ok = false; throw e; }
  finally { record(name, Date.now() - t, ok); }
}

function summary() {
  const ops = {};
  let total = 0;
  let failures = 0;
  for (const [name, b] of samples.entries()) {
    ops[name] = {
      calls: b.count,
      failures: b.failures,
      failureRate: b.count ? Number((b.failures / b.count).toFixed(3)) : 0,
      avgMs: b.count ? Number((b.totalMs / b.count).toFixed(1)) : 0,
      lastMs: b.lastMs,
      worstMs: b.worstMs,
    };
    total += b.count;
    failures += b.failures;
  }
  return {
    ok: true,
    service: 'performance-telemetry',
    totalOperations: total,
    totalFailures: failures,
    overallFailureRate: total ? Number((failures / total).toFixed(3)) : 0,
    operations: ops,
    policy: 'Cheap monitoring: only reported operations are measured. No continuous full-resolution capture.',
  };
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json(summary()));
  router.post('/record', (req, res) => {
    const b = req.body || {};
    res.json(record(b.operation, b.ms, b.ok !== false));
  });
  return router;
}

module.exports = { STATUS: { ok: true, service: 'performance-telemetry' }, record, timed, summary, createRouter };
