'use strict';
/**
 * MYRAA Pointer voice session — tests (Phase 11 / Pointer Phase 2).
 * Run: node tests/test_pointer_voice.cjs (from repo root).
 */
const voice = require('../resources/app/dist/pointer_voice.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

const s = voice.createSession('ptr_voice_1');
ok('session starts idle', s.state === 'idle' && s.mode === 'push-to-talk');

const p1 = voice.pressStart(s);
ok('press starts listening', p1.ok === true && s.state === 'listening');

const p2 = voice.pressStart(s);
ok('double press rejected', p2.ok === false && p2.code === 'INVALID_STATE');

const r1 = voice.pressRelease(s);
ok('release goes to thinking', r1.ok === true && s.state === 'thinking');

const r2 = voice.reply(s, 'hello there');
ok('reply goes to speaking', r2.ok === true && s.state === 'speaking' && s.transcript.length === 1 && s.transcript[0].text === 'hello there');

const f1 = voice.finishSpeaking(s);
ok('finish returns to idle', f1.ok === true && s.state === 'idle');

const r3 = voice.reply(s, 'not thinking');
ok('reply outside thinking rejected', r3.ok === false && r3.code === 'INVALID_STATE');

const st = voice.stop(s);
ok('stop from any state ok', st.ok === true && st.stoppedFrom === 'idle');

const t1 = voice.transition(s, 'dancing');
ok('invalid transition rejected', t1.ok === false && t1.code === 'VALIDATION');

const chirp = voice.chirpScript(880, 120);
ok('chirp script is browser JS', chirp.indexOf('AudioContext') >= 0 && chirp.indexOf('880') >= 0);

const bubble = voice.bubbleHtml('<script>alert(1)</script>hi');
ok('bubble escapes HTML', bubble.indexOf('<script>') === -1 && bubble.indexOf('&lt;script&gt;') >= 0);

const s2 = voice.createSession('x', { provider: 'system_speech' });
ok('provider override works', s2.provider === 'system_speech');

console.log('');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
