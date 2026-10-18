'use strict';
/**
 * MYRAA Course Studio — vertical-slice tests (Phase 2).
 * Convention: plain node, ok()/bad() counters, non-zero exit on failure.
 * Run: node tests/test_course_studio.cjs   (from the repo root)
 * Covers: schema validators + job lifecycle (memory store) + cancel + progress math.
 * AI/DB paths are NOT exercised here (they need keys + the running app).
 */

const path = require('path');
const schema = require('../resources/app/dist/course_studio_schema.cjs');
const { createJobService } = require('../resources/app/dist/course_studio_jobs.cjs');

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}
const memStore = () => {
  const m = new Map();
  return {
    save: async (j) => { m.set(j.id, JSON.parse(JSON.stringify(j))); },
    load: async (id) => { const j = m.get(String(id)); return j ? JSON.parse(JSON.stringify(j)) : null; },
  };
};
const tick = () => new Promise((r) => setTimeout(r, 5));

async function main() {
  console.log('== course_studio schema ==');

  ok('schema version is 1', schema.SCHEMA_VERSION === 1);
  ok('ids unique', schema.makeId('crs') !== schema.makeId('crs'));

  const goodCourse = { title: 'Intro to Testing', sourceKind: 'topic', status: 'draft' };
  ok('accepts good course', schema.validateCourse(goodCourse).ok === true);
  const badCourse = { title: '', sourceKind: 'telepathy', status: 'draft' };
  const bc = schema.validateCourse(badCourse);
  ok('rejects bad course (title + sourceKind)', bc.ok === false && bc.errors.length >= 2, bc.errors.join('|'));
  ok('accepts course with compute KAGGLE', schema.validateCourse({ title: 'T', sourceKind: 'topic', status: 'draft', compute: 'KAGGLE' }).ok === true);
  ok('rejects bad compute pref', schema.validateCourse({ title: 'T', sourceKind: 'topic', status: 'draft', compute: 'MOON' }).ok === false);

  const goodLesson = {
    title: 'L1', courseId: 'crs_x', status: 'ready',
    scenes: [
      { type: 'title', heading: 'Start', body: 'Welcome' },
      { type: 'text', heading: 'Idea', points: ['a', 'b'] },
      { type: 'code', heading: 'Example', code: 'print(1)' },
    ],
    narration: [
      { sceneIndex: 0, text: 'Welcome to the lesson' },
      { sceneIndex: 1, text: 'Here is the idea' },
      { sceneIndex: 2, text: 'Here is some code' },
    ],
    quiz: [{ type: 'mcq', prompt: 'What?', options: ['a', 'b', 'c'], answerIndex: 1, explanation: 'b' }],
  };
  ok('accepts good ready lesson', schema.validateLesson(goodLesson).ok === true);
  const badLesson = Object.assign({}, goodLesson, { narration: [
    { sceneIndex: 0, text: 'fine' },
    { sceneIndex: 1, text: 'fine' },
    { sceneIndex: 9, text: '' },
  ] });
  const bl = schema.validateLesson(badLesson);
  ok('rejects lesson with bad narration (range + empty)', bl.ok === false && bl.errors.length >= 2, bl.errors.join('|'));
  const shortNarr = Object.assign({}, goodLesson, { narration: [{ sceneIndex: 0, text: 'only one' }] });
  ok('rejects narration with wrong segment count', schema.validateLesson(shortNarr).ok === false);
  const badQuiz = Object.assign({}, goodLesson, { quiz: [{ type: 'mcq', prompt: 'Q', options: ['only-one'], answerIndex: 5 }] });
  const bq = schema.validateLesson(badQuiz);
  ok('rejects lesson with bad quiz', bq.ok === false, bq.errors.join('|'));
  const outlineLesson = { title: 'L2', courseId: 'crs_x', status: 'outline' };
  ok('outline lesson needs no scenes', schema.validateLesson(outlineLesson).ok === true);
  ok('narration estimate sane', schema.estimateNarrationSec('hello world, this is a test sentence for timing') >= 2);

  console.log('== course_studio jobs ==');
  const svc = createJobService(memStore());
  const job = await svc.startJob('demo', 'ref1', ['a', 'b', 'c']);
  ok('job starts queued with 0 progress', job.status === 'queued' && job.progress === 0);

  const seen = [];
  const done = await svc.runJob(job.id, {
    a: async (j, api) => { api.setDetail('doing a'); await tick(); seen.push('a'); },
    b: async () => { await tick(); seen.push('b'); },
    c: async () => { await tick(); seen.push('c'); },
  });
  ok('job completes with progress 1', done.status === 'completed' && done.progress === 1, done.status + '/' + done.progress);
  ok('steps ran in order', seen.join(',') === 'a,b,c', seen.join(','));
  ok('step details persisted', done.steps[0].detail === 'doing a' && done.steps.every((s) => s.status === 'DONE'));

  const svc2 = createJobService(memStore());
  const failJob = await svc2.startJob('demo', 'ref2', ['x', 'y']);
  const fdone = await svc2.runJob(failJob.id, { x: async () => { await tick(); }, y: async () => { throw new Error('boom-y'); } });
  ok('failing step marks job failed with error', fdone.status === 'failed' && /boom-y/.test(fdone.error || ''), fdone.status + '/' + fdone.error);
  ok('failed progress is partial (0.5)', fdone.progress === 0.5, String(fdone.progress));

  const svc3 = createJobService(memStore());
  const cjob = await svc3.startJob('demo', 'ref3', ['slow']);
  const running = svc3.runJob(cjob.id, { slow: async () => { await new Promise((r) => setTimeout(r, 120)); } });
  await tick();
  const cancelled = await svc3.cancelJob(cjob.id);
  await running;
  const after = await svc3.getJob(cjob.id);
  ok('cancel stops a running job', cancelled.status === 'cancelled' && after.status === 'cancelled', after.status);

  const missing = await svc3.getJob('job_nope');
  ok('unknown job returns null', missing === null);

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS ERROR: ' + ((e && e.message) || e)); process.exit(1); });
