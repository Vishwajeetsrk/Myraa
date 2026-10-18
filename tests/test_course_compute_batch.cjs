'use strict';
/**
 * MYRAA Course compute batch — tests (Phase 10b).
 * Run: node tests/test_course_compute_batch.cjs (from repo root).
 */
const path = require('path');
const batch = require('../resources/app/dist/course_compute_batch.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

// Stub compute manager
function stubMgr(overrides) {
  const base = {
    kaggleEnabled: () => false,
    getWorkers: () => [],
    getProviders: () => [
      { provider: 'local', status: 'online', gpu_count: 0, gpus: [] },
      { provider: 'cloud_api', status: 'online' },
    ],
    submitJob: async (spec) => ({ ok: true, jobId: 'gpu_test1', route: spec.route, detail: 'stub' }),
    getJob: async (id) => ({ id, status: 'QUEUED' }),
    listEvents: async () => [],
    workerOnline: (w) => w && w.status === 'online' && w.last_seen && (Date.now() - new Date(w.last_seen).getTime()) < 30 * 60 * 1000,
  };
  return Object.assign(base, overrides || {});
}

async function main() {
  console.log('== batch validation ==');
  let r = await batch.submitBatchJob(stubMgr(), 'c1', 'NOPE', ['a']);
  ok('rejects bad batchType', r.ok === false && r.code === 'VALIDATION');
  r = await batch.submitBatchJob(stubMgr(), 'c1', 'EMBEDDING', []);
  ok('rejects empty items', r.ok === false && r.code === 'VALIDATION');

  console.log('== route resolution ==');
  // AUTO -> no kaggle, no local GPU -> CLOUD
  r = await batch.submitBatchJob(stubMgr(), 'c1', 'EMBEDDING', ['a', 'b'], { course: { compute: 'AUTO' } });
  ok('AUTO falls through to CLOUD', r.ok === true && r.route === 'CLOUD', JSON.stringify(r).slice(0, 120));

  // LOCAL with no GPU -> refused
  r = await batch.submitBatchJob(stubMgr(), 'c1', 'EMBEDDING', ['a'], { course: { compute: 'LOCAL' } });
  ok('LOCAL without GPU refused', r.ok === false && r.code === 'MODEL_VRAM_INSUFFICIENT');

  // LOCAL with GPU -> accepted
  const gpuMgr = stubMgr({ getProviders: () => [{ provider: 'local', status: 'online', gpu_count: 1, gpus: [{ model: 'T4', vram_gb: 16 }] }] });
  r = await batch.submitBatchJob(gpuMgr, 'c1', 'EMBEDDING', ['a'], { course: { compute: 'LOCAL' } });
  ok('LOCAL with GPU accepted', r.ok === true && r.route === 'LOCAL');

  // KAGGLE disabled -> refused
  r = await batch.submitBatchJob(stubMgr(), 'c1', 'EMBEDDING', ['a'], { course: { compute: 'KAGGLE' } });
  ok('KAGGLE disabled refused', r.ok === false && r.code === 'PROVIDER_DISABLED');

  // KAGGLE enabled + worker online -> accepted
  const kaggleMgr = stubMgr({
    kaggleEnabled: () => true,
    getWorkers: () => [{ provider: 'kaggle', status: 'online', last_seen: new Date().toISOString() }],
  });
  r = await batch.submitBatchJob(kaggleMgr, 'c1', 'EMBEDDING', ['a'], { course: { compute: 'KAGGLE' } });
  ok('KAGGLE enabled + worker accepted', r.ok === true && r.route === 'KAGGLE');

  // MANUAL -> not auto-submitted
  r = await batch.submitBatchJob(stubMgr(), 'c1', 'EMBEDDING', ['a'], { course: { compute: 'MANUAL' } });
  ok('MANUAL not auto-submitted', r.ok === false && r.code === 'EXECUTOR_PENDING');

  // Invalid preference -> AUTO fallback
  r = await batch.submitBatchJob(stubMgr(), 'c1', 'EMBEDDING', ['a'], { course: { compute: 'MOON' } });
  ok('invalid pref falls back to AUTO', r.ok === true && r.route === 'CLOUD');

  // TRANSCRIPTION and DOCUMENT_BATCH accepted
  r = await batch.submitBatchJob(stubMgr(), 'c1', 'TRANSCRIPTION', ['audio1.mp3'], { course: { compute: 'CLOUD' } });
  ok('TRANSCRIPTION accepted', r.ok === true && r.route === 'CLOUD');
  r = await batch.submitBatchJob(stubMgr(), 'c1', 'DOCUMENT_BATCH', ['doc1.pdf'], { course: { compute: 'CLOUD' } });
  ok('DOCUMENT_BATCH accepted', r.ok === true && r.route === 'CLOUD');

  // getBatchStatus
  const st = await batch.getBatchStatus(stubMgr(), 'gpu_test1');
  ok('batch status returns job', st.ok === true && st.job.id === 'gpu_test1');

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS ERROR: ' + ((e && e.message) || e)); process.exit(1); });
