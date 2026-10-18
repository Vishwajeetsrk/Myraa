'use strict';
/**
 * MYRAA Course Studio — compute preference execution (Phase 10b).
 * Reads a course's compute preference (AUTO/LOCAL/CLOUD/KAGGLE/MANUAL) and
 * routes GPU-batch workloads (transcription, embeddings, document processing)
 * through the compute manager. Never executes directly — always via jobs.
 *
 * Supported batch types:
 *   TRANSCRIPTION  — audio/video to text (GPU batch)
 *   EMBEDDING      — text to vectors (GPU batch)
 *   DOCUMENT_BATCH — PDF/docx extraction at scale (GPU batch)
 *
 * The course preference sets the DEFAULT route. Users can override per-job
 * via the compute API. AUTO routes to KAGGLE when enabled + worker online,
 * else LOCAL (Ollama) if available, else CLOUD.
 */

const schema = require('./compute_schema.cjs');

const BATCH_TYPES = ['TRANSCRIPTION', 'EMBEDDING', 'DOCUMENT_BATCH'];

function resolveRoute(preference, computeManager) {
  let pref = String(preference || 'AUTO').toUpperCase();
  if (!schema.COMPUTE_PREFS.includes(pref)) pref = 'AUTO';
  if (pref === 'MANUAL') return { route: 'MANUAL', reason: 'manual preference: user must submit jobs explicitly' };
  if (pref === 'KAGGLE') {
    const enabled = computeManager.kaggleEnabled();
    if (!enabled) return { route: 'KAGGLE', accepted: false, code: 'PROVIDER_DISABLED', reason: 'KAGGLE_COMPUTE_ENABLED not set' };
    const workers = computeManager.getWorkers().filter((w) => w.provider === 'kaggle' && computeManager.workerOnline(w));
    if (!workers.length) return { route: 'KAGGLE', accepted: false, code: 'WORKER_OFFLINE', reason: 'no fresh Kaggle worker heartbeat' };
    return { route: 'KAGGLE', accepted: true, worker: workers[0] };
  }
  if (pref === 'LOCAL') {
    const local = computeManager.getProviders().find((p) => p.provider === 'local');
    if (!local || !local.gpu_count) return { route: 'LOCAL', accepted: false, code: 'MODEL_VRAM_INSUFFICIENT', reason: 'no local GPU available' };
    return { route: 'LOCAL', accepted: true };
  }
  if (pref === 'CLOUD') {
    const cloud = computeManager.getProviders().find((p) => p.provider === 'cloud_api');
    if (!cloud || cloud.status !== 'online') return { route: 'CLOUD', accepted: false, code: 'PROVIDER_DISABLED', reason: 'no cloud provider keys' };
    return { route: 'CLOUD', accepted: true };
  }
  // AUTO
  const kaggleWorkers = computeManager.getWorkers().filter((w) => w.provider === 'kaggle' && computeManager.workerOnline(w));
  if (computeManager.kaggleEnabled() && kaggleWorkers.length) return { route: 'KAGGLE', accepted: true, worker: kaggleWorkers[0] };
  const local = computeManager.getProviders().find((p) => p.provider === 'local');
  if (local && local.gpu_count) return { route: 'LOCAL', accepted: true };
  const cloud = computeManager.getProviders().find((p) => p.provider === 'cloud_api');
  if (cloud && cloud.status === 'online') return { route: 'CLOUD', accepted: true };
  return { route: 'AUTO', accepted: false, code: 'EXECUTOR_PENDING', reason: 'no GPU executor available in AUTO mode' };
}

// Submit a batch job for a course. Returns {ok, jobId, route, detail} or {ok:false, error, code}.
async function submitBatchJob(computeManager, courseId, batchType, items, options) {
  const opts = options || {};
  if (!BATCH_TYPES.includes(batchType)) {
    return { ok: false, error: 'batchType must be one of: ' + BATCH_TYPES.join(', '), code: 'VALIDATION' };
  }
  if (!Array.isArray(items) || !items.length) {
    return { ok: false, error: 'items must be a non-empty array', code: 'VALIDATION' };
  }
  const course = opts.course || {};
  const pref = course.compute || 'AUTO';
  const routeInfo = resolveRoute(pref, computeManager);
  if (!routeInfo.accepted) {
    return { ok: false, error: routeInfo.reason, code: routeInfo.code || 'EXECUTOR_PENDING' };
  }
  const spec = {
    jobType: batchType,
    route: routeInfo.route,
    priority: opts.priority || 'normal',
    input: { items: items.slice(0, 64), courseId },
    privacy: opts.privacy || 'normal',
  };
  if (opts.model) spec.model = opts.model;
  return computeManager.submitJob(spec);
}

// Get batch job status with course context.
async function getBatchStatus(computeManager, jobId) {
  const job = await computeManager.getJob(jobId);
  if (!job) return { ok: false, error: 'job not found', code: 'NOT_FOUND' };
  const events = await computeManager.listEvents(jobId);
  return { ok: true, job, events };
}

module.exports = { BATCH_TYPES, resolveRoute, submitBatchJob, getBatchStatus };
