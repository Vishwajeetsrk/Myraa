'use strict';
/**
 * MYRAA Tutor policy — tests (Phase 9).
 * Run: node tests/test_tutor_policy.cjs (from repo root).
 */
const tutor = require('../resources/app/dist/tutor_policy.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

const T = 1700000000000;
const strong = { mode: 'assistive', intentConfidence: 0.9, contextConfidence: 0.8, value: 0.8, cost: 0.3, busy: false, lastNudgeAt: null, sameTopicNudges: 0, nowMs: T };

let r = tutor.score(strong);
ok('assistive strong case intervenes', r.intervene === true, JSON.stringify(r.reasons));

r = tutor.score(Object.assign({}, strong, { mode: 'passive' }));
ok('passive never intervenes', r.intervene === false && /passive/.test(r.reasons[0]));

r = tutor.score(Object.assign({}, strong, { busy: true }));
ok('busy blocks', r.intervene === false && /busy/.test(r.reasons[0]));

r = tutor.score(Object.assign({}, strong, { lastNudgeAt: T - 60 * 1000 }));
ok('assistive 5-min cooldown blocks', r.intervene === false && /cooldown/.test(r.reasons[0]));

r = tutor.score(Object.assign({}, strong, { mode: 'active_tutor', lastNudgeAt: T - 61 * 1000 }));
ok('tutor 60s cooldown passes after 61s', r.intervene === true);

r = tutor.score(Object.assign({}, strong, { sameTopicNudges: 2, topic: 'a', lastTopic: 'a' }));
ok('nag guard blocks third repeat same topic', r.intervene === false && /nag/.test(r.reasons[0]));
r = tutor.score(Object.assign({}, strong, { sameTopicNudges: 2, topic: 'b', lastTopic: 'a' }));
ok('nag guard allows topic switch', r.intervene === true);

r = tutor.score(Object.assign({}, strong, { value: 0.65, cost: 0.7 }));
ok('value<=cost blocks', r.intervene === false && /cost/.test(r.reasons[0]), r.reasons.join('|'));

r = tutor.score(Object.assign({}, strong, { intentConfidence: 0.5 }));
ok('assistive intent bar 0.7 blocks 0.5', r.intervene === false && /intent/.test(r.reasons[0]));

r = tutor.score({ mode: 'active_tutor', intentConfidence: 0.55, contextConfidence: 0.45, value: 0.5, cost: 0.2, nowMs: T });
ok('tutor lower bars pass mid case', r.intervene === true);

r = tutor.score({ mode: 'weird', intentConfidence: 1, contextConfidence: 1, value: 1, cost: 0, nowMs: T });
ok('unknown mode treated as passive', r.intervene === false);

r = tutor.score({ mode: 'assistive', intentConfidence: 'high', contextConfidence: NaN, value: 1, cost: 0, nowMs: T });
ok('non-numeric clamped to 0 and blocked', r.intervene === false && r.scores.intent === 0);

console.log('');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
