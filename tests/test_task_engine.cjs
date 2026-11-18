'use strict';
// Phase 11: durable task state machine, real events, no fake progress.

const fs = require('fs');
const path = require('path');
const os = require('os');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p11_'));
const store = path.join(TMP, 'tasks.jsonl');
process.env.MYRAA_TASK_DB = store;
process.env.MYRAA_EVENTS_DB = path.join(TMP, 'events.jsonl');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const engine = require(path.join(DIST, 'task_engine.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  check('status model is complete', ['QUEUED', 'RUNNING', 'WAITING_FOR_APPROVAL', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'].every((s) => engine.STATUSES.includes(s)));
  const bad = engine.create({});
  check('goal is required', bad.ok === false && bad.code === 'VALIDATION');

  const c = engine.create({ goal: 'review repo', agent: 'Coder', steps: ['scan', 'report'], tools: ['filesystem'] });
  check('task starts QUEUED', c.ok === true && c.task.status === 'QUEUED' && c.task.steps.length === 2);
  const invalid = engine.transition(c.task.id, 'COMPLETED');
  check('illegal transition rejected with allowed list', invalid.ok === false && invalid.code === 'INVALID_TRANSITION' && Array.isArray(invalid.allowed));
  check('QUEUED -> RUNNING works', engine.transition(c.task.id, 'RUNNING').ok === true);
  check('RUNNING -> WAITING_FOR_APPROVAL works', engine.transition(c.task.id, 'WAITING_FOR_APPROVAL').ok === true);
  check('approval binding attaches', engine.attachApproval(c.task.id, 'bnk_test_123').ok === true);
  check('resume to RUNNING works', engine.transition(c.task.id, 'RUNNING').ok === true);
  const done = engine.transition(c.task.id, 'COMPLETED', { result: { ok: true } });
  check('completion records result', done.ok === true && done.task.status === 'COMPLETED' && !!done.task.result);
  check('terminal state is final', engine.transition(c.task.id, 'RUNNING').code === 'INVALID_TRANSITION');

  const c2 = engine.create({ goal: 'will fail' });
  engine.transition(c2.task.id, 'RUNNING');
  engine.transition(c2.task.id, 'FAILED', { error: 'synthetic failure' });
  check('FAILED -> RUNNING retry allowed', engine.transition(c2.task.id, 'RUNNING').ok === true);
  engine.transition(c2.task.id, 'CANCELLED');
  check('CANCELLED is terminal', engine.transition(c2.task.id, 'RUNNING').code === 'INVALID_TRANSITION');

  const list = engine.list();
  check('list derives from store', list.count === 2 && list.tasks[0].goal === 'will fail');
  const s = engine.summary();
  check('summary counts from real tasks', s.total === 2 && s.byStatus.COMPLETED === 1 && s.byStatus.CANCELLED === 1);

  const reloaded = engine.createEngine({ storePath: store });
  check('tasks persist across instances', reloaded.get(c.task.id).status === 'COMPLETED');
  const events = require(path.join(DIST, 'event_bus.cjs'));
  check('task events are real', events.list({ type: 'task.created', limit: 20 }).events.length >= 2);
  const router = engine.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes task routes', ['/summary', '/list', '/create', '/:id', '/:id/transition', '/:id/approval'].every((p) => paths.includes(p)));

  console.log('\ntask engine tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
