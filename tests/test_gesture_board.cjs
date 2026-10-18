'use strict';
/**
 * MYRAA Gesture board bridge — tests (Phase 15).
 * Run: node tests/test_gesture_board.cjs (from repo root).
 * No camera, no board server needed: fs uses TEMP state dir, HTTP is stubbed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const gesture = require('../resources/app/dist/gesture_board.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

const tmpState = path.join(os.tmpdir(), 'myraa-gesture-test-' + Date.now());
const stubFetch = async (url) => {
  if (String(url).endsWith('/cmd')) {
    return { ok: true, status: 200, text: async () => '{"staged":true}' };
  }
  if (String(url).endsWith('/board-state')) {
    return { ok: true, status: 200, text: async () => JSON.stringify({ items: [{ title: 'HELLO' }] }) };
  }
  if (String(url).endsWith('/stage.html')) {
    return { ok: true, status: 200, text: async () => '<html></html>' };
  }
  return { ok: false, status: 404, text: async () => 'nope' };
};
const deadFetch = async () => { throw new Error('conn refused'); };

async function main() {
  console.log('== ring ==');
  const w = gesture.setRing('thinking', { stateDir: tmpState });
  ok('ring write ok', w.ok === true && fs.readFileSync(path.join(tmpState, 'state'), 'utf8') === 'thinking');
  const bad = gesture.setRing('dancing', { stateDir: tmpState });
  ok('ring rejects bad state', bad.ok === false && bad.code === 'VALIDATION');
  const rd = gesture.readRing({ stateDir: tmpState });
  ok('ring read back', rd.ok === true && rd.state === 'thinking');
  const rdMissing = gesture.readRing({ stateDir: path.join(os.tmpdir(), 'myraa-gesture-nope-' + Date.now()) });
  ok('ring missing dir is UNKNOWN not crash', rdMissing.ok === true && rdMissing.state === 'UNKNOWN');

  console.log('== board validation ==');
  ok('accepts present', gesture.validateBoardAction({ a: 'present', title: 'T' }).ok === true);
  ok('rejects unknown verb', gesture.validateBoardAction({ a: 'delete_everything' }).ok === false);
  ok('rejects absolute src', gesture.validateBoardAction({ a: 'add_img', src: '/etc/passwd' }).ok === false);
  ok('rejects traversal src', gesture.validateBoardAction({ a: 'add_img', src: '../secret.png' }).ok === false);
  ok('accepts airlock src', gesture.validateBoardAction({ a: 'add_img', src: 'misc/cat.png' }).ok === true);

  console.log('== board cmd (stubbed HTTP) ==');
  const c1 = await gesture.boardCmd({ a: 'present', title: 'HELLO' }, { fetchFn: stubFetch, baseUrl: 'http://x' });
  ok('cmd ok via stub', c1.ok === true);
  const c2 = await gesture.boardCmd({ a: 'nuke' }, { fetchFn: stubFetch, baseUrl: 'http://x' });
  ok('bad verb never reaches HTTP', c2.ok === false && c2.code === 'VALIDATION');
  const c3 = await gesture.boardCmd({ a: 'present' }, { fetchFn: deadFetch, baseUrl: 'http://x' });
  ok('dead board is WORKER_OFFLINE', c3.ok === false && c3.code === 'WORKER_OFFLINE');

  console.log('== board-state + status ==');
  const bs = await gesture.boardState({ fetchFn: stubFetch, baseUrl: 'http://x' });
  ok('board-state reads items', bs.ok === true && bs.items.items[0].title === 'HELLO');
  const bsDead = await gesture.boardState({ fetchFn: deadFetch, baseUrl: 'http://x' });
  ok('board-state dead is honest', bsDead.ok === false && bsDead.code === 'WORKER_OFFLINE');
  const st = await gesture.status({ fetchFn: stubFetch, baseUrl: 'http://x', stateDir: tmpState });
  ok('status online + ring thinking', st.ok === true && st.server === 'online' && st.ring === 'thinking');
  const stDead = await gesture.status({ fetchFn: deadFetch, baseUrl: 'http://x', stateDir: tmpState });
  ok('status offline honest', stDead.ok === true && stDead.server === 'offline');

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS ERROR: ' + ((e && e.message) || e)); process.exit(1); });
