'use strict';
/**
 * Background Research — thin orchestration over the EXISTING parallel_runner.
 * No second job queue, no second worker pool. This module only submits
 * research.probe jobs, tracks progress, cancels them, and composes the final
 * evidence-based client records when the jobs finish.
 */

const runner = require('./parallel_runner.cjs');
const pool = runner.createPool({ concurrency: 3 });
const cd = require('./client_discovery.cjs');

const batches = new Map();

function start(input = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const urls = (Array.isArray(b.urls) ? b.urls : (b.url ? [b.url] : [])).slice(0, 100).filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
  if (!urls.length) return { ok: false, code: 'VALIDATION', error: 'Provide urls (array of public http(s) URLs).' };
  const jobs = [];
  for (const url of urls) {
    const r = pool.submit({ type: 'research.probe', params: { url, timeoutMs: b.timeoutMs || 9000 }, retries: 0, timeoutMs: (b.timeoutMs || 9000) + 4000 });
    if (r.ok) jobs.push({ jobId: r.job.id, url });
  }
  const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const batch = { id: batchId, jobs, status: 'RUNNING', createdAt: new Date().toISOString(), input: b };
  batches.set(batchId, batch);
  return { ok: true, batchId, submitted: jobs.length, note: 'Jobs run in the existing bounded parallel runner. This call does not block the user.' };
}

function progress(batchId) {
  const batch = batches.get(String(batchId || ''));
  if (!batch) return { ok: false, code: 'NOT_FOUND', error: 'unknown batch' };
  let done = 0;
  let failed = 0;
  const items = batch.jobs.map((j) => {
    const r = pool.get(j.jobId);
    const job = r.ok ? r.job : { status: 'UNKNOWN' };
    if (job.status === 'COMPLETED') done += 1;
    if (job.status === 'FAILED' || job.status === 'CANCELLED') failed += 1;
    return { jobId: j.jobId, url: j.url, status: job.status, ok: job.ok || false };
  });
  const finished = done + failed === items.length;
  if (finished && batch.status !== 'COMPLETED') batch.status = 'COMPLETED';
  return {
    ok: true,
    batchId: batch.id,
    status: batch.status,
    total: items.length,
    completed: done,
    failed,
    progress: items.length ? Number(((done + failed) / items.length).toFixed(3)) : 0,
    items,
    note: 'Progress comes from real job states; no result is invented.',
  };
}

function collect(batchId) {
  const batch = batches.get(String(batchId || ''));
  if (!batch) return { ok: false, code: 'NOT_FOUND' };
  const evidence = [];
  const probeDetails = [];
  for (const j of batch.jobs) {
    const r = pool.get(j.jobId);
    if (!r.ok || r.job.status !== 'COMPLETED' || !r.result || !r.result.ok) continue;
    const p = r.result;
    probeDetails.push({ url: p.url, title: p.title, emails: p.emails, phones: p.phones });
    if (p.title) evidence.push({ field: 'companyName', value: p.title, source: 'live public page title', url: p.url, confidence: 'likely', checkedAt: new Date().toISOString() });
    evidence.push({ field: 'website', value: p.url, source: 'live probe', url: p.url, confidence: 'verified', checkedAt: new Date().toISOString() });
    if (p.emails && p.emails[0]) evidence.push({ field: 'email', value: p.emails[0], source: 'mailto link on public page', url: p.url, confidence: 'likely', checkedAt: new Date().toISOString() });
    if (p.phones && p.phones[0]) evidence.push({ field: 'phone', value: p.phones[0], source: 'tel link on public page', url: p.url, confidence: 'likely', checkedAt: new Date().toISOString() });
  }
  const analysis = cd.analyze(batch.input || {}, evidence);
  return { ok: true, batchId: batch.id, probes: probeDetails, analysis, missing: analysis.missing, websiteStatus: analysis.record.website };
}

function cancel(batchId) {
  const batch = batches.get(String(batchId || ''));
  if (!batch) return { ok: false, code: 'NOT_FOUND' };
  let cancelled = 0;
  for (const j of batch.jobs) {
    const r = pool.cancel(j.jobId);
    if (r && r.ok) cancelled += 1;
  }
  batch.status = 'CANCELLED';
  return { ok: true, batchId: batch.id, cancelled };
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json({ ok: true, service: 'background-research', queue: 'existing parallel_runner', batches: batches.size }));
  router.post('/start', (req, res) => res.json(start(req.body || {})));
  router.get('/progress/:id', (req, res) => {
    const r = progress(req.params.id);
    res.status(r.ok ? 200 : 404).json(r);
  });
  router.get('/collect/:id', (req, res) => {
    const r = collect(req.params.id);
    res.status(r.ok ? 200 : 404).json(r);
  });
  router.post('/cancel', (req, res) => res.json(cancel((req.body || {}).batchId)));
  return router;
}

module.exports = { STATUS: { ok: true, service: 'background-research', queue: 'existing parallel_runner' }, start, progress, collect, cancel, createRouter };
