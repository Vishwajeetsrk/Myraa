'use strict';
/**
 * MYRAA Course Studio — durable job service (Phase 2 vertical slice).
 * Modelled on the research-job step pattern + GoalManager persistence semantics.
 * Zero dependencies; persistence injected ({save, load}) so tests use memory
 * and production uses the SQLite bridge (cs_job_save / cs_job_get).
 *
 * Progress is always computed (doneSteps / totalSteps) — never invented.
 */

const { makeId, nowIso, JOB_STATUSES } = require('./course_studio_schema.cjs');

function createJobService(store) {
  if (!store || typeof store.save !== 'function' || typeof store.load !== 'function') {
    throw new Error('createJobService requires {save(job), load(id)}');
  }
  const cancelFlags = new Map();

  function blankSteps(names) {
    return (names || []).map((n) => ({ name: String(n), status: 'PENDING', detail: '', startedAt: null, finishedAt: null }));
  }

  async function startJob(kind, refId, stepNames, meta) {
    const now = nowIso();
    const job = {
      id: makeId('job'),
      kind: String(kind || 'generic'),
      refId: String(refId || ''),
      status: 'queued',
      steps: blankSteps(stepNames),
      progress: 0,
      error: null,
      attempts: 0,
      meta: meta || {},
      createdAt: now,
      updatedAt: now,
    };
    await store.save(job);
    return job;
  }

  async function getJob(id) {
    return store.load(id);
  }

  async function cancelJob(id) {
    const job = await store.load(id);
    if (!job) return null;
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return job;
    cancelFlags.set(id, true);
    job.status = 'cancelled';
    job.error = 'Cancelled by user.';
    job.updatedAt = nowIso();
    await store.save(job);
    return job;
  }

  function computeProgress(job) {
    const total = job.steps.length;
    if (!total) return job.status === 'completed' ? 1 : 0;
    const done = job.steps.filter((s) => s.status === 'DONE').length;
    return Math.round((done / total) * 100) / 100;
  }

  // handlers: { [stepName]: async (job, api) => } ; api = { setDetail(text) }
  async function runJob(id, handlers) {
    let job = await store.load(id);
    if (!job) throw new Error('job not found: ' + id);
    if (job.status === 'running') throw new Error('job already running: ' + id);
    job.status = 'running';
    job.attempts = (job.attempts || 0) + 1;
    job.error = null;
    job.updatedAt = nowIso();
    await store.save(job);

    for (let i = 0; i < job.steps.length; i++) {
      if (cancelFlags.get(id)) {
        job.status = 'cancelled';
        job.updatedAt = nowIso();
        cancelFlags.delete(id);
        await store.save(job);
        return job;
      }
      const step = job.steps[i];
      const handler = handlers && handlers[step.name];
      step.status = 'ACTIVE';
      step.startedAt = nowIso();
      job.progress = computeProgress(job);
      job.updatedAt = nowIso();
      await store.save(job);
      const api = {
        setDetail: (text) => { step.detail = String(text || '').slice(0, 500); },
      };
      try {
        if (typeof handler !== 'function') throw new Error('no handler registered for step "' + step.name + '"');
        await handler(job, api);
        step.status = 'DONE';
        step.finishedAt = nowIso();
      } catch (err) {
        step.status = 'FAILED';
        step.finishedAt = nowIso();
        step.detail = String((err && err.message) || err).slice(0, 500);
        job.status = 'failed';
        job.error = step.detail;
        job.progress = computeProgress(job);
        job.updatedAt = nowIso();
        await store.save(job);
        return job;
      }
      job.progress = computeProgress(job);
      job.updatedAt = nowIso();
      await store.save(job);
    }

    if (cancelFlags.get(id)) {
      job.status = 'cancelled';
      cancelFlags.delete(id);
    } else {
      job.status = 'completed';
      job.progress = 1;
    }
    job.updatedAt = nowIso();
    await store.save(job);
    return job;
  }

  return { startJob, getJob, cancelJob, runJob, JOB_STATUSES };
}

module.exports = { createJobService };
