'use strict';
// Phase 13: avatar states must follow real runtime events. 3D model untouched.

const fs = require('fs');
const path = require('path');
const os = require('os');
process.env.MYRAA_EVENTS_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p13_')), 'events.jsonl');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const bridge = require(path.join(DIST, 'avatar_state_bridge.cjs'));
const events = require(path.join(DIST, 'event_bus.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  check('state vocabulary is explicit', ['idle', 'listening', 'thinking', 'speaking', 'working', 'error', 'success', 'warning'].every((s) => bridge.STATES.includes(s)));
  check('starts idle', bridge.state().state === 'idle');
  check('invalid state rejected', bridge.apply('fake_state', 'test').ok === false);

  events.emit('task.voice_state', { state: 'listening', source: 'conversationEvent' });
  check('real listening event changes state', bridge.state().state === 'listening');
  events.emit('task.voice_state', { state: 'speaking', source: 'geminiLive' });
  check('real speaking event changes state', bridge.state().state === 'speaking');
  events.emit('task.voice_state', { state: 'idle', source: 'websocketClose' });
  check('real disconnect returns to idle', bridge.state().state === 'idle');

  events.emit('task.running', { taskId: 'tsk_test' });
  check('task activity maps to working', bridge.state().state === 'working');
  events.emit('task.completed', { taskId: 'tsk_test' });
  check('task completion maps to success', bridge.state().state === 'success');
  events.emit('task.failed', { error: 'boom' });
  check('task failure maps to error', bridge.state().state === 'error');
  events.emit('approval.required', { tool: 'gmail.send' });
  check('approval required maps to warning', bridge.state().state === 'warning');

  const s = bridge.state();
  check('history is real and bounded', Array.isArray(s.history) && s.history.length >= 7 && s.history.length <= 30);
  check('history entries have sources + timestamps', s.history.every((h) => !!h.source && !Number.isNaN(Date.parse(h.at))));
  check('source names the real signal', s.source === 'approval');

  const addon = fs.readFileSync(path.join(DIST, 'avatar_state_addon.js'), 'utf8');
  check('frontend addon reads API, never touches 3D internals', /\/api\/avatar\/state/.test(addon) && !/\.mesh|\.texture|\.shader|model\.pmx/i.test(addon));
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  check('addon is loaded from index.html', html.includes('/avatar_state_addon.js'));

  const router = bridge.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes state + history', paths.includes('/state') && paths.includes('/history'));

  console.log('\navatar state bridge tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
