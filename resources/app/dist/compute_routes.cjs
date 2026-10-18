'use strict';
/**
 * MYRAA Compute — routes (Phase 7 vertical slice).
 * Provider-neutral API over ComputeManager. Kaggle transport is the file
 * outbox/inbox (no tunnel, no invented API). Quota is honestly UNKNOWN.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { createComputeManager } = require('./compute_manager.cjs');
const { csDb } = require('./course_studio_store.cjs');

const router = express.Router();

const store = {
  saveJob: async (j) => { const r = csDb('cp_job_save', j); if (!r || r.ok !== true) throw new Error('cp_job_save failed: ' + ((r && r.error) || 'unknown')); },
  loadJob: async (id) => { const r = csDb('cp_job_get', { id: String(id) }); return (r && r.ok === true) ? (r.job || null) : null; },
  listJobs: async () => { const r = csDb('cp_job_list', {}); return (r && r.ok === true) ? (r.jobs || []) : []; },
  saveWorker: async (w) => { const r = csDb('cp_worker_save', w); if (!r || r.ok !== true) throw new Error('cp_worker_save failed: ' + ((r && r.error) || 'unknown')); },
  loadWorker: async (id) => { const r = csDb('cp_worker_get', { id: String(id) }); return (r && r.ok === true) ? (r.worker || null) : null; },
  listWorkers: async () => { const r = csDb('cp_worker_list', {}); return (r && r.ok === true) ? (r.workers || []) : []; },
  addEvent: async (e) => { csDb('cp_event_add', e); },
  listEvents: async (jobId) => { const r = csDb('cp_event_list', { jobId: jobId || '' }); return (r && r.ok === true) ? (r.events || []) : []; },
};
const compute = createComputeManager(store);

router.get('/api/compute/providers', (req, res) => {
  try { return res.json({ ok: true, providers: compute.getProviders() }); }
  catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.get('/api/compute/workers', async (req, res) => {
  try {
    const workers = await compute.getWorkers();
    return res.json({ ok: true, workers: workers.map((w) => Object.assign({}, w, { online: compute.workerOnline(w) })) });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.get('/api/compute/capabilities', async (req, res) => {
  try {
    const providers = compute.getProviders();
    const workers = await compute.getWorkers();
    return res.json({ ok: true, providers, kaggleEnabled: compute.kaggleEnabled(), workers: workers.map((w) => Object.assign({}, w, { online: compute.workerOnline(w) })) });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.get('/api/compute/quota', (req, res) => {
  try { return res.json({ ok: true, quota: compute.getQuota() }); }
  catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.post('/api/compute/estimate', (req, res) => {
  try {
    const spec = req.body || {};
    const est = compute.estimate(spec);
    return res.json({ ok: est.ok, estimate: est });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.post('/api/compute/jobs', async (req, res) => {
  try {
    const out = await compute.submitJob(req.body || {});
    if (!out.ok && !out.jobId) return res.status(400).json({ ok: false, error: out.error, code: out.code || 'VALIDATION' });
    if (!out.ok) return res.status(422).json({ ok: false, error: out.error, code: out.code, jobId: out.jobId });
    return res.json({ ok: true, jobId: out.jobId, route: out.route, estimate: out.estimate, placement: out.placement, detail: out.detail });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.get('/api/compute/jobs', async (req, res) => {
  try { return res.json({ ok: true, jobs: await store.listJobs() }); }
  catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.get('/api/compute/jobs/:id', async (req, res) => {
  try {
    const job = await store.loadJob(String(req.params.id));
    if (!job) return res.status(404).json({ ok: false, error: 'job not found', code: 'NOT_FOUND' });
    const events = await store.listEvents(job.id);
    return res.json({ ok: true, job, events });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.post('/api/compute/jobs/:id/cancel', async (req, res) => {
  try {
    const job = await compute.cancelJob(String(req.params.id));
    if (!job) return res.status(404).json({ ok: false, error: 'job not found', code: 'NOT_FOUND' });
    return res.json({ ok: true, job });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.post('/api/compute/jobs/:id/sync', async (req, res) => {
  try {
    const out = await compute.syncKaggleJob(String(req.params.id));
    if (!out.ok && !out.jobId) return res.status(404).json({ ok: false, error: out.error, code: out.code });
    if (!out.ok) return res.status(502).json({ ok: false, error: out.error, code: out.code, jobId: out.jobId });
    const job = await store.loadJob(String(req.params.id));
    return res.json({ ok: true, jobId: out.jobId, status: out.status, detail: out.detail, job });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.get('/api/compute/jobs/:id/export', async (req, res) => {
  try {
    const job = await store.loadJob(String(req.params.id));
    if (!job) return res.status(404).json({ ok: false, error: 'job not found', code: 'NOT_FOUND' });
    const outPath = path.join(compute.dirs.outbox, job.id + '.json');
    if (!fs.existsSync(outPath)) return res.status(404).json({ ok: false, error: 'no outbox payload (job was not dispatched to Kaggle)', code: 'NOT_FOUND' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="' + job.id + '.json"');
    return res.send(fs.readFileSync(outPath, 'utf8'));
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.get('/api/compute/jobs/:id/artifacts', async (req, res) => {
  try {
    const job = await store.loadJob(String(req.params.id));
    if (!job) return res.status(404).json({ ok: false, error: 'job not found', code: 'NOT_FOUND' });
    const arts = (job.artifacts || []).map((a) => {
      let bytes = a.bytes || 0;
      let exists = false;
      try { exists = a.path && fs.existsSync(a.path); if (exists) bytes = fs.statSync(a.path).size; } catch (e) {}
      return { name: a.name, bytes, exists };
    });
    return res.json({ ok: true, jobId: job.id, artifacts: arts });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.post('/api/compute/workers/:id/heartbeat', async (req, res) => {
  try {
    const worker = await compute.heartbeat(String(req.params.id), (req.body && req.body.caps) || {});
    return res.json({ ok: true, worker, online: true });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

router.post('/api/compute/workers/:id/results', async (req, res) => {
  try {
    const out = await compute.importResult(String(req.params.id), req.body || {});
    if (!out.ok) return res.status(404).json({ ok: false, error: out.error, code: out.code });
    return res.json({ ok: true, jobId: out.jobId, status: out.status });
  } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
});

module.exports = router;
