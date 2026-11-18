'use strict';
// Parallel runner: bounded pool executing real module functions with a real job graph.

const path = require('path');
const os = require('os');
const fs = require('fs');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const pr = require(path.join(DIST, 'parallel_runner.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}
async function waitFor(pool, ids, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const states = ids.map((id) => { const j = pool.get(id); return j.ok ? j.job.status : 'MISSING'; });
    if (states.every((s) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(s))) return states;
    await new Promise((r) => setTimeout(r, 40));
  }
  return ids.map((id) => { const j = pool.get(id); return j.ok ? j.job.status : 'MISSING'; });
}

(async () => {
  const store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_parallel_')), 'runs.jsonl');
  const pool = pr.createPool({ concurrency: 3, storePath: store });
  const s = pool.status();
  check('pool reports real bounded config', s.ok && s.status === 'AVAILABLE' && s.concurrency === 3 && s.jobTypes.length >= 8);
  check('job types are real module functions', s.jobTypes.includes('video.status') && s.jobTypes.includes('app.detect') && s.jobTypes.includes('skill.validate'));
  check('honest note about sync modules', /no simulated results/.test(s.note));

  const bad = pool.submit({ type: 'teleport' });
  check('unknown job type rejected', !bad.ok && bad.code === 'UNKNOWN_JOB_TYPE');

  const ids = [];
  for (const type of ['video.status', 'skill.status', 'app.status', 'browser.capabilities']) {
    const r = pool.submit({ type });
    if (r.ok) ids.push(r.job.id);
  }
  check('four independent real jobs submitted', ids.length === 4);
  const states = await waitFor(pool, ids);
  check('all independent jobs completed', states.every((x) => x === 'COMPLETED'), states.join(','));
  const results = pool.results();
  check('result aggregation contains real outputs', results.completed >= 4 && !!results.results[ids[0]].result);
  const browserResult = pool.get(ids[3]).result;
  check('browser job result is real', browserResult && browserResult.playwrightAvailable === true);

  const jobs = ids.map((id) => pool.get(id).job);
  let overlap = false;
  for (let i = 0; i < jobs.length; i++) {
    for (let j = i + 1; j < jobs.length; j++) {
      if (jobs[i].startedAt && jobs[j].startedAt && jobs[i].finishedAt && jobs[j].finishedAt) {
        if (jobs[i].startedAt <= jobs[j].finishedAt && jobs[j].startedAt <= jobs[i].finishedAt) overlap = true;
      }
    }
  }
  check('scheduler started jobs concurrently', overlap);

  // dependency graph
  const a = pool.submit({ type: 'video.status', id: 'depA' });
  const b = pool.submit({ type: 'skill.status', dependsOn: [a.job.id] });
  const depStates = await waitFor(pool, [a.job.id, b.job.id]);
  const bJob = pool.get(b.job.id).job;
  check('dependency order respected', depStates.every((x) => x === 'COMPLETED') && bJob.startedAt >= pool.get(a.job.id).job.finishedAt);

  // dependency failure propagation
  const failed = pool.submit({ type: 'nonexistent_for_test', params: {} });
  check('bad type cannot be submitted (no fake failed job)', !failed.ok);
  const missingDep = pool.submit({ type: 'video.status', dependsOn: ['job_missing'] });
  check('missing dependency rejected at submit (no stuck job)', !missingDep.ok && missingDep.code === 'DEPENDENCY_NOT_FOUND' && missingDep.missing.includes('job_missing'));

  // cancellation
  const many = [];
  for (let i = 0; i < 5; i++) many.push(pool.submit({ type: 'app.status' }));
  const cancelTarget = many[many.length - 1];
  const c = pool.cancel(cancelTarget.job.id);
  check('queued job can be cancelled honestly', c.ok && c.job.status === 'CANCELLED' && /discarded/.test(c.note));
  const already = pool.cancel(cancelTarget.job.id);
  check('terminal job cannot be cancelled twice', !already.ok && already.code === 'TERMINAL');

  await waitFor(pool, many.map((m) => m.job.id));
  const final = pool.status();
  check('pool drains to idle', final.running === 0 && final.queueDepth === 0, JSON.stringify(final).slice(0, 160));
  check('append-only receipts written', fs.existsSync(store) && fs.readFileSync(store, 'utf8').split('\n').filter(Boolean).length >= 10);

  const router = pr.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes status/submit/jobs/results/cancel', ['/status', '/submit', '/jobs', '/results', '/cancel/:id'].every((p) => paths.includes(p)));

  pool.stop();
  try { fs.rmSync(path.dirname(store), { recursive: true, force: true }); } catch (e) { /* temp only */ }
  console.log('\nparallel runner tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.stack || e)); process.exit(1); });
