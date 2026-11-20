'use strict';
/**
 * MYRAA Parallel Runner (advanced spec section 20).
 *
 * A bounded worker pool that executes REAL existing module functions. It adds
 * a durable job graph (dependencies, priority, retry, timeout, cancellation,
 * progress, result aggregation) on top of synchronously-implemented capabilities.
 * No job "succeeds" unless its underlying module returned a real result.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const STATUS = Object.freeze(['QUEUED', 'READY', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);
const D = __dirname;

const JOBS = Object.freeze({
  'video.status': { risk: 'LOW', run: () => require(path.join(D, 'video_engine.cjs')).status() },
  'video.probe': { risk: 'LOW', run: (p) => require(path.join(D, 'video_engine.cjs')).probe(p && p.input) },
  'video.analyze': { risk: 'LOW', run: (p) => require(path.join(D, 'video_engine.cjs')).analyze(p && p.input, p || {}) },
  'skill.status': { risk: 'LOW', run: () => require(path.join(D, 'skill_runner.cjs')).status() },
  'skill.validate': { risk: 'LOW', run: (p) => require(path.join(D, 'skill_runner.cjs')).validate(p || {}) },
  'app.detect': { risk: 'LOW', run: () => require(path.join(D, 'application_adapters.cjs')).detect() },
  'app.status': { risk: 'LOW', run: () => require(path.join(D, 'application_adapters.cjs')).status() },
  'browser.capabilities': { risk: 'LOW', run: () => new (require(path.join(D, 'browser_agent.cjs')))().getCapabilities() },
  'gap.analyze': { risk: 'LOW', run: (p) => require(path.join(D, 'capability_gap_analyzer.cjs')).analyze(p && p.request) },
  'system.health': { risk: 'LOW', run: () => require(path.join(D, 'health_manager.cjs')).runAll() },
  'research.probe': { risk: 'LOW', run: (p) => require(path.join(D, 'client_discovery.cjs')).probeWebsite(p && p.url, p && p.timeoutMs) },
  'research.analyze': { risk: 'LOW', run: (p) => require(path.join(D, 'client_discovery.cjs')).analyze(p && p.input, p && p.evidence) },
});

function defaultStore() {
  const base = process.env.MYRAA_DATA_DIR || path.join(os.tmpdir(), 'myraa-parallel');
  return path.join(base, 'parallel-runs.jsonl');
}

function createPool(opts = {}) {
  const o = opts || {};
  const concurrency = Math.min(8, Math.max(1, Number(o.concurrency) || 3));
  const storePath = o.storePath || defaultStore();
  const jobs = new Map();
  let seq = 0;
  let running = 0;
  let timer = null;

  function persist(record) {
    try {
      fs.mkdirSync(path.dirname(storePath), { recursive: true });
      fs.appendFileSync(storePath, JSON.stringify(record) + '\n', 'utf8');
    } catch (e) { /* receipts best effort */ }
  }
  function emit(type, payload) {
    try { require('./event_bus.cjs').emit('parallel.' + type, payload); } catch (e) { /* no bus */ }
  }
  function now() { return new Date().toISOString(); }

  function depsDone(job) {
    return (job.dependsOn || []).every((id) => {
      const dep = jobs.get(id);
      return dep && dep.status === 'COMPLETED';
    });
  }
  function depFailure(job) {
    return (job.dependsOn || []).map((id) => jobs.get(id)).find((d) => d && (d.status === 'FAILED' || d.status === 'CANCELLED'));
  }

  function schedule() {
    if (running >= concurrency) return;
    const ready = Array.from(jobs.values())
      .filter((j) => j.status === 'QUEUED' && depsDone(j))
      .sort((a, b) => (b.priority - a.priority) || (a.createdAt.localeCompare(b.createdAt)));
    for (const job of ready) {
      if (running >= concurrency) break;
      const blocked = depFailure(job);
      if (blocked) {
        job.status = 'FAILED';
        job.error = 'DEPENDENCY_FAILED';
        job.detail = blocked.id + ' is ' + blocked.status;
        job.finishedAt = now();
        persist(job);
        emit('failed', { id: job.id, error: job.error });
        continue;
      }
      job.status = 'RUNNING';
      job.startedAt = now();
      running++;
      emit('started', { id: job.id, type: job.type });
      execute(job).finally(() => {
        running--;
        schedule();
      });
    }
    const anyQueued = Array.from(jobs.values()).some((j) => j.status === 'QUEUED');
    if (!anyQueued && running === 0 && timer) { clearInterval(timer); timer = null; }
  }

  async function execute(job) {
    const def = JOBS[job.type];
    let attempt = 0;
    while (attempt <= job.retries && !job.cancelled) {
      attempt++;
      job.attempts = attempt;
      const controller = { timedOut: false };
      let timeoutHandle = null;
      try {
        const result = await Promise.race([
          (async () => { await new Promise((r) => setImmediate(r)); return def.run(job.params || {}); })(),
          new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => { controller.timedOut = true; reject(new Error('TIMEOUT')); }, job.timeoutMs);
          }),
        ]);
        if (job.cancelled) { job.status = 'CANCELLED'; }
        else {
          job.status = 'COMPLETED';
          job.result = result;
          job.ok = !!(result && result.ok !== false);
          job.finishedAt = now();
          emit('completed', { id: job.id, ok: job.ok });
        }
        persist(job);
        return;
      } catch (e) {
        job.lastError = e && e.message ? e.message : String(e);
        if (job.lastError === 'TIMEOUT' || attempt > job.retries) {
          job.status = 'FAILED';
          job.error = controller.timedOut ? 'TIMEOUT' : 'EXECUTION_FAILED';
          job.detail = job.lastError;
          job.finishedAt = now();
          persist(job);
          emit('failed', { id: job.id, error: job.error });
          return;
        }
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    }
  }

  function submit(input) {
    const i = input || {};
    if (!JOBS[i.type]) return { ok: false, code: 'UNKNOWN_JOB_TYPE', available: Object.keys(JOBS) };
    const depList = Array.isArray(i.dependsOn) ? i.dependsOn.slice(0, 50) : [];
    const missing = depList.filter((d) => !jobs.has(d));
    if (missing.length) return { ok: false, code: 'DEPENDENCY_NOT_FOUND', missing, note: 'dependencies must be submitted before dependants' };
    const id = 'job_' + (++seq) + '_' + Math.random().toString(36).slice(2, 7);
    const job = {
      id,
      type: i.type,
      priority: Math.max(-10, Math.min(10, Number(i.priority) || 0)),
      dependsOn: depList,
      params: i.params || {},
      retries: Math.min(3, Math.max(0, Number(i.retries) || 0)),
      timeoutMs: Math.min(120000, Math.max(500, Number(i.timeoutMs) || 30000)),
      risk: JOBS[i.type].risk,
      status: 'QUEUED',
      attempts: 0,
      createdAt: now(),
      cancelled: false,
    };
    jobs.set(id, job);
    persist(job);
    if (!timer) timer = setInterval(() => { if (running === 0) schedule(); }, 25);
    schedule();
    return { ok: true, job: view(job) };
  }

  function view(j) {
    return {
      id: j.id, type: j.type, status: j.status, priority: j.priority,
      dependsOn: j.dependsOn, risk: j.risk, attempts: j.attempts,
      ok: j.ok, error: j.error, detail: j.detail,
      createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt,
      hasResult: !!j.result,
    };
  }
  function get(id) {
    const j = jobs.get(id);
    return j ? { ok: true, job: view(j), result: j.result || null } : { ok: false, code: 'NOT_FOUND' };
  }
  function list() {
    const all = Array.from(jobs.values()).map(view);
    const byStatus = {};
    for (const j of all) byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    return { ok: true, total: all.length, byStatus, jobs: all };
  }
  function status() {
    const l = list();
    return {
      ok: true,
      status: 'AVAILABLE',
      concurrency,
      running,
      queueDepth: l.byStatus.QUEUED || 0,
      total: l.total,
      byStatus: l.byStatus,
      jobTypes: Object.keys(JOBS),
      guarantees: ['bounded concurrency', 'dependency graph', 'real timeout', 'bounded retry', 'honest cancellation', 'append-only receipts'],
      note: 'jobs call real module functions; no simulated results',
    };
  }
  function cancel(id) {
    const j = jobs.get(id);
    if (!j) return { ok: false, code: 'NOT_FOUND' };
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)) return { ok: false, code: 'TERMINAL', status: j.status };
    j.cancelled = true;
    j.status = 'CANCELLED';
    j.finishedAt = now();
    persist(j);
    emit('cancelled', { id });
    return { ok: true, job: view(j), note: 'queued/running flag set; underlying synchronous module may finish but its result is discarded' };
  }
  function results() {
    const out = {};
    for (const [id, j] of jobs) if (j.status === 'COMPLETED') out[id] = { type: j.type, ok: !!j.ok, result: j.result };
    return { ok: true, completed: Object.keys(out).length, results: out };
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  return { STATUS, submit, get, list, status, cancel, results, stop, JOBS };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  const pool = createPool();
  router.get('/status', (req, res) => res.json(pool.status()));
  router.get('/types', (req, res) => res.json({ ok: true, types: Object.keys(JOBS) }));
  router.post('/submit', (req, res) => res.json(pool.submit(req.body || {})));
  router.get('/jobs', (req, res) => res.json(pool.list()));
  router.get('/results', (req, res) => res.json(pool.results()));
  router.get('/job/:id', (req, res) => res.json(pool.get(req.params.id)));
  router.post('/cancel/:id', (req, res) => res.json(pool.cancel(req.params.id)));
  return router;
}

module.exports = { STATUS, JOBS, createPool, createRouter };
