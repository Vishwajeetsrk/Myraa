'use strict';
/**
 * MYRAA Compute — tests (Phase 7).
 * Run: node tests/test_compute.cjs (from repo root).
 * Pure logic + manager with stub store. No GPU, no network, no Python needed.
 */

const path = require('path');
const schema = require('../resources/app/dist/compute_schema.cjs');
const { createComputeManager, detectLocal } = require('../resources/app/dist/compute_manager.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}
const memStore = () => {
  const jobs = new Map(), workers = new Map(), events = [];
  return {
    saveJob: async (j) => { jobs.set(j.id, JSON.parse(JSON.stringify(j))); },
    loadJob: async (id) => { const j = jobs.get(String(id)); return j ? JSON.parse(JSON.stringify(j)) : null; },
    listJobs: async () => [...jobs.values()],
    saveWorker: async (w) => { workers.set(w.id, JSON.parse(JSON.stringify(w))); },
    loadWorker: async (id) => { const w = workers.get(String(id)); return w ? JSON.parse(JSON.stringify(w)) : null; },
    listWorkers: async () => [...workers.values()],
    addEvent: async (e) => { events.push(Object.assign({ at: new Date().toISOString() }, e)); },
    listEvents: async (jobId) => events.filter((e) => !jobId || e.job_id === jobId),
    _events: events,
  };
};

async function main() {
  console.log('== compute schema ==');
  const e8 = schema.estimateModelGB(8, 'fp16', 4096);
  ok('8B fp16 estimates ~21GB', e8.ok && e8.estimatedGB > 15 && e8.estimatedGB < 25, JSON.stringify(e8));
  const e70 = schema.estimateModelGB(70, 'int4', 4096);
  ok('70B int4 estimates ~40GB', e70.ok && e70.estimatedGB > 30 && e70.estimatedGB < 55, JSON.stringify(e70));
  ok('unknown model uncertain', schema.estimateModelGB(0, 'fp16').ok === false);

  const caps = { single_gpu_vram_gb: 14.56, aggregate_vram_gb: 29.12, multi_gpu: true };
  ok('10GB fits single T4', schema.placeModel(10, caps, {}).place === 'single');
  ok('14GB fits single T4', schema.placeModel(14, caps, {}).place === 'single');
  const p20 = schema.placeModel(20, caps, {});
  ok('20GB single refused without sharding', p20.place === 'refused' && p20.code === 'MODEL_VRAM_INSUFFICIENT', JSON.stringify(p20));
  const p20s = schema.placeModel(20, caps, { supportsSharding: true });
  ok('20GB allowed when sharding verified', p20s.place === 'sharded');
  ok('35GB refused even sharded', schema.placeModel(35, caps, { supportsSharding: true }).place === 'refused');

  const dirty = { prompt: 'hi', key: 'api_key=sk-abc123XYZ789', nested: { token: 'ghp_abcdefghij1234567890' } };
  const clean = schema.sanitizeSecrets(dirty);
  ok('sanitizer strips secrets', clean.redactions >= 2 && !/sk-abc|ghp_/.test(clean.text), clean.text.slice(0, 120));
  const v = schema.validateJobSpec({ jobType: 'LLM_INFERENCE', route: 'AUTO' });
  ok('accepts good spec', v.ok === true);
  ok('rejects bad type', schema.validateJobSpec({ jobType: 'NOPE' }).ok === false);

  console.log('== compute manager ==');
  process.env.MYRAA_DATA_DIR = require('os').tmpdir() + '/myraa-compute-test';
  process.env.KAGGLE_COMPUTE_ENABLED = '';
  const store = memStore();
  const mgr = createComputeManager(store);
  const local = mgr.getProviders().find((p) => p.provider === 'local');
  ok('local provider detected honestly (no GPU here)', local && local.gpu_count === 0 && local.status === 'online', JSON.stringify(local));
  ok('quota UNKNOWN by design', mgr.getQuota().gpu_hours_remaining === 'UNKNOWN');

  // Kaggle disabled -> refuse honestly, job still recorded
  const sub1 = await mgr.submitJob({ jobType: 'LLM_INFERENCE', route: 'KAGGLE', model: { id: 'phi-3-mini' }, input: { prompt: 'hi' } });
  ok('kaggle disabled refuses with code', sub1.ok === false && sub1.code === 'PROVIDER_DISABLED' && !!sub1.jobId, JSON.stringify(sub1).slice(0, 160));
  const j1 = await store.loadJob(sub1.jobId);
  ok('refused job persisted as CREATED', j1 && j1.status === 'CREATED');

  // Enable + heartbeat -> submit writes outbox, QUEUED
  process.env.KAGGLE_COMPUTE_ENABLED = '1';
  const hb = await mgr.heartbeat('kaggle-t4x2', { gpu_count: 2, gpus: [{ index: 0, model: 'Tesla T4', vram_gb: 14.56 }, { index: 1, model: 'Tesla T4', vram_gb: 14.56 }], single_gpu_vram_gb: 14.56, aggregate_vram_gb: 29.12, cuda_version: '12.8', pytorch_version: '2.11.0+cu128', multi_gpu: true });
  ok('heartbeat stored online', hb.status === 'online' && mgr.workerOnline(hb) === true);
  // phi-3-mini (3.8B fp16 ~10.7GB) fits one 14.56GB T4
  const sub2 = await mgr.submitJob({ jobType: 'LLM_INFERENCE', route: 'KAGGLE', model: { id: 'phi-3-mini' }, input: { prompt: 'hi' } });
  ok('kaggle submit QUEUED with placement', sub2.ok === true && sub2.placement && sub2.placement.place === 'single', JSON.stringify(sub2).slice(0, 160));
  const fs = require('fs');
  ok('outbox payload written', fs.existsSync(require('path').join(mgr.dirs.outbox, sub2.jobId + '.json')));
  const j2 = await store.loadJob(sub2.jobId);
  ok('job progress UNKNOWN until worker reports', j2 && j2.progress === 'UNKNOWN' && j2.status === 'QUEUED');

  // 8B fp16 (~20.8GB) refused on 14.56GB single GPU without sharding
  const subBig = await mgr.submitJob({ jobType: 'LLM_INFERENCE', route: 'KAGGLE', model: { id: 'llama-3-8b' }, input: { prompt: 'hi' } });
  ok('8B model refused without sharding', subBig.ok === false && subBig.code === 'MODEL_VRAM_INSUFFICIENT', JSON.stringify(subBig).slice(0, 140));
  // Unknown model -> accepted as uncertain (notebook does its own preflight)
  const sub3 = await mgr.submitJob({ jobType: 'LLM_INFERENCE', route: 'KAGGLE', model: { id: 'big-40b', gpuRequired: true }, input: {} });
  ok('unknown model accepted as uncertain', sub3.ok === true && sub3.estimate && sub3.estimate.uncertain === true, JSON.stringify(sub3).slice(0, 160));

  // Result import completes honestly
  const imp = await mgr.importResult('kaggle-t4x2', { jobId: sub2.jobId, status: 'COMPLETED', result: { text: 'hello' }, metrics: { tokens_per_second: 42 } });
  ok('result import completes', imp.ok === true && imp.status === 'COMPLETED');
  const j3 = await store.loadJob(sub2.jobId);
  ok('artifact recorded', j3.artifacts.length === 1 && j3.metrics.tokens_per_second === 42);

  // Failure import classifies
  const sub4 = await mgr.submitJob({ jobType: 'EMBEDDING', route: 'KAGGLE', input: { docs: ['a'] } });
  const impF = await mgr.importResult('kaggle-t4x2', { jobId: sub4.jobId, status: 'FAILED', error: 'CUDA out of memory', errorCode: 'GPU_OOM' });
  const j4 = await store.loadJob(sub4.jobId);
  ok('failure classified GPU_OOM retryable', impF.ok === true && j4.error.code === 'GPU_OOM' && j4.error.retryable === true);

  // Cancel works
  const sub5 = await mgr.submitJob({ jobType: 'EMBEDDING', route: 'KAGGLE', input: {} });
  const cx = await mgr.cancelJob(sub5.jobId);
  ok('cancel transitions', cx.status === 'CANCELLED');

  // Stale worker not online
  const stale = { id: 'old', provider: 'kaggle', status: 'online', last_seen: new Date(Date.now() - 3600e3).toISOString() };
  ok('stale heartbeat is offline', mgr.workerOnline(stale) === false);

  // Secret redaction on heartbeat/result paths
  const hb2 = await mgr.heartbeat('w2', { note: 'key sk-secret1234567890' });
  ok('heartbeat caps scrubbed', hb2.redactions >= 1 && !/sk-secret/.test(JSON.stringify(hb2.caps)));

  // Privacy: high + KAGGLE without override -> PRIVACY_REJECTED
  const subP = await mgr.submitJob({ jobType: 'LLM_INFERENCE', route: 'KAGGLE', privacy: 'high', model: { id: 'llama-3-8b' }, input: { prompt: 'secret project' } });
  ok('private+kaggle refused', subP.ok === false && subP.code === 'PRIVACY_REJECTED', JSON.stringify(subP).slice(0, 140));
  // Privacy: high + AUTO -> forced LOCAL (trivial job accepted locally)
  const subP2 = await mgr.submitJob({ jobType: 'EMBEDDING', privacy: 'high', input: { docs: ['x'] } });
  ok('private+AUTO forced LOCAL', subP2.ok === true && subP2.route === 'LOCAL', JSON.stringify(subP2).slice(0, 140));
  // Privacy override allows kaggle
  const subP3 = await mgr.submitJob({ jobType: 'EMBEDDING', route: 'KAGGLE', privacy: 'high', allowRemote: true, input: {} });
  ok('explicit allowRemote permits kaggle', subP3.ok === true, JSON.stringify(subP3).slice(0, 140));

  // Notebook-shape compatibility: caps without single/aggregate, job_id key
  const nbCaps = { provider: 'kaggle', pytorch: '2.11.0+cu128', cuda: '12.8',
    gpu_count: 2, gpus: [{ index: 0, name: 'Tesla T4', vram_gb: 14.56, compute_capability: '7.5' }, { index: 1, name: 'Tesla T4', vram_gb: 14.56, compute_capability: '7.5' }] };
  const hbN = await mgr.heartbeat('nb-worker', nbCaps);
  ok('notebook caps normalized (derived single+aggregate)', hbN.caps.single_gpu_vram_gb === 14.56 && hbN.caps.aggregate_vram_gb === 29.12 && hbN.caps.cuda_version === '12.8', JSON.stringify({ s: hbN.caps.single_gpu_vram_gb, a: hbN.caps.aggregate_vram_gb }));
  const subN = await mgr.submitJob({ jobType: 'LLM_INFERENCE', route: 'KAGGLE', model: { id: 'phi-3-mini' }, input: { prompt: 'x' } });
  ok('placement works off derived caps', subN.ok === true && subN.placement.place === 'single');
  const impN = await mgr.importResult('nb-worker', { job_id: subN.jobId, status: 'COMPLETED', result: { text: 'done', tokens_per_second: 30, runtime_seconds: 5 } });
  const jN = await store.loadJob(subN.jobId);
  ok('notebook result shape imports (job_id + metrics lift)', impN.ok === true && jN.metrics.tokens_per_second === 30 && jN.metrics.runtime_seconds === 5);
  const impNE = await mgr.importResult('nb-worker', { job_id: 'missing-nope', status: 'FAILED', error: { type: 'RuntimeError', message: 'boom' } });
  ok('unknown job id still 404s', impNE.ok === false && impNE.code === 'INVALID_JOB');
  // Worker notebook blocked/load_failed shapes map to FAILED with cause
  const subB = await mgr.submitJob({ jobType: 'LLM_INFERENCE', route: 'KAGGLE', model: { id: 'phi-3-mini' }, input: { prompt: 'x' } });
  const impB = await mgr.importResult('nb-worker', { job_id: subB.jobId, status: 'blocked', result: { model_sharding_verified: false }, error: null, reason: 'bitsandbytes cannot be imported' });
  const jB = await store.loadJob(subB.jobId);
  ok('blocked maps to FAILED', impB.ok === true && jB.status === 'FAILED' && /bitsandbytes/.test(jB.error.message));
  const subL = await mgr.submitJob({ jobType: 'LLM_INFERENCE', route: 'KAGGLE', model: { id: 'phi-3-mini' }, input: { prompt: 'x' } });
  const impL = await mgr.importResult('nb-worker', { job_id: subL.jobId, status: 'load_failed', error: { type: 'OutOfMemoryError', message: 'CUDA OOM' } });
  const jL = await store.loadJob(subL.jobId);
  ok('load_failed maps to MODEL_LOAD_FAILED', impL.ok === true && jL.error.code === 'MODEL_LOAD_FAILED');

  // Kaggle CLI transport unit checks (no credentials here -> honest refusal paths)
  const cli = require('../resources/app/dist/compute_kaggle_cli.cjs');
  ok('status map complete/failed/cancelled/unknown', cli.mapStatus('complete').state === 'COMPLETED'
    && cli.mapStatus('error').state === 'FAILED' && cli.mapStatus('cancelled').state === 'CANCELLED'
    && cli.mapStatus('weird-state-xyz').state === 'RUNNING');
  ok('accelerator allowlist defaults T4', cli.ACCELERATORS.includes('NvidiaTeslaT4') && cli.DEFAULT_ACCELERATOR === 'NvidiaTeslaT4');
  const kd = require('os').tmpdir() + '/myraa-kcli-test';
  const nb = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'resources', 'app', 'dist', 'kaggle_worker_template.ipynb'), 'utf8'));
  const rendered = cli.renderJobNotebook(nb, { job_id: 'gpu_test1', job_type: 'LLM_INFERENCE', input: { prompt: 'hi' } });
  ok('job notebook renders with embedded job', rendered.ok === true);
  const auth = cli.authorKernelDir(kd, { slug: 'user/myraa-test', title: 't', notebookJson: rendered.notebookJson, accelerator: 'NvidiaTeslaT4' });
  ok('kernel dir authored private+gpu', auth.ok === true);
  const meta = JSON.parse(require('fs').readFileSync(require('path').join(kd, 'kernel-metadata.json'), 'utf8'));
  ok('metadata honest flags', meta.is_private === 'true' && meta.enable_gpu === 'true' && meta.machine_shape === 'NvidiaTeslaT4');
  const avail = cli.availability();
  ok('CLI availability honest without creds', avail.ok === false || typeof avail.bin === 'string');
  // Sync on file-transport job refuses honestly
  const syncF = await mgr.syncKaggleJob(sub2.jobId);
  ok('sync refuses file-transport job', syncF.ok === false && syncF.code === 'INVALID_JOB', JSON.stringify(syncF).slice(0, 140));
  // Sync on missing job 404s
  const syncM = await mgr.syncKaggleJob('gpu_nope');
  ok('sync missing job 404s', syncM.ok === false && syncM.code === 'INVALID_JOB');

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS ERROR: ' + ((e && e.message) || e)); process.exit(1); });
