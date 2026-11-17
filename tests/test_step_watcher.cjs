'use strict';
// Phase 29: settle-aware step watcher. Pure logic, no display or network.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const mod = require(path.join(DIST, 'step_watcher.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const f1 = mod.fingerprint(Buffer.from('a'.repeat(9000)));
  const f2 = mod.fingerprint(Buffer.from('a'.repeat(9000)));
  const f3 = mod.fingerprint(Buffer.from('b'.repeat(9000)));
  check('fingerprint is deterministic', !!f1 && f1 === f2 && f1.length === 16);
  check('different image changes fingerprint', f1 !== f3);
  const b64 = Buffer.from('hello world').toString('base64');
  check('base64 input accepted', mod.fingerprint(b64) === mod.fingerprint(Buffer.from('hello world')));
  check('bad input rejected', mod.fingerprint(42) === null);

  const events = [];
  const bus = { emit: (type, payload) => events.push({ type, payload }) };
  const w = mod.createStepWatcher({ settleMs: 25, eventBus: bus });

  const first = w.observe({ step: 'open menu', fingerprint: f1 });
  check('first observation is a change', first.ok === true && first.changed === true && first.done === false);
  check('step name recorded', first.step === 'open menu');
  const quick = w.observe({ step: 'open menu', fingerprint: f1 });
  check('same frame before settle is not done', quick.ok === true && quick.changed === false && quick.done === false);
  const changed = w.observe({ step: 'open menu', fingerprint: f3 });
  check('new frame resets settle clock', changed.changed === true && changed.done === false);
  await sleep(40);
  const done = w.observe({ step: 'open menu', fingerprint: f3 });
  check('settled frame reports done', done.done === true && done.heldMs >= 25);
  check('step.done event emitted', events.some((e) => e.type === 'step.done'));
  check('status counts observations + completions', w.status().observes === 4 && w.status().completions === 1);

  const bad = w.observe({ step: 'x' });
  check('missing image is honest validation', bad.ok === false && bad.code === 'VALIDATION');
  check('reset clears state', w.reset().ok === true && w.status().lastHash === null && w.status().completions === 0);
  check('router builds', w.createRouter() === null || typeof w.createRouter().use === 'function');

  console.log('\nstep watcher tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
