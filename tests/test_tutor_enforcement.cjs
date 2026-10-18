'use strict';
/**
 * MYRAA Tutor enforcement — tests (Phase 10).
 * Run: node tests/test_tutor_enforcement.cjs (from repo root).
 */
const tutor = require('../resources/app/dist/tutor_enforcement.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

const T = 1700000000000;
const strongCtx = { intentConfidence: 0.9, contextConfidence: 0.8, value: 0.8, cost: 0.3, busy: false };

// Passive never speaks
let r = tutor.shouldSpeakAbout('passive', 'topic-a', strongCtx, tutor.createNudgeTracker(), T);
ok('passive never speaks', r.speak === false && /passive/.test(r.reasons[0]));

// Assistive strong case speaks + records nudge
let tracker = tutor.createNudgeTracker();
r = tutor.shouldSpeakAbout('assistive', 'topic-a', strongCtx, tracker, T);
ok('assistive speaks on strong case', r.speak === true);
ok('nudge recorded', tracker.lastNudgeAt === T && tracker.sameTopicNudges === 1);

// Same topic again -> cooldown blocks
r = tutor.shouldSpeakAbout('assistive', 'topic-a', strongCtx, tracker, T + 60000);
ok('cooldown blocks repeat', r.speak === false && /cooldown/.test(r.reasons[0]));

// After cooldown, same topic -> nag guard (2nd repeat)
r = tutor.shouldSpeakAbout('assistive', 'topic-a', strongCtx, tracker, T + 6 * 60000);
ok('second repeat allowed (nag=1)', r.speak === true && tracker.sameTopicNudges === 2);
r = tutor.shouldSpeakAbout('assistive', 'topic-a', strongCtx, tracker, T + 12 * 60000);
ok('third repeat blocked by nag guard', r.speak === false && /nag/.test(r.reasons[0]));

// Different topic allowed (nag guard is same-topic only)
r = tutor.shouldSpeakAbout('assistive', 'topic-b', strongCtx, tracker, T + 18 * 60000);
ok('topic switch allowed (nag is same-topic only)', r.speak === true && tracker.sameTopicNudges === 1 && tracker.lastTopic === 'topic-b');

// Busy blocks even in tutor mode
r = tutor.shouldSpeakAbout('active_tutor', 'topic-c', Object.assign({}, strongCtx, { busy: true }), tutor.createNudgeTracker(), T);
ok('busy blocks tutor mode', r.speak === false && /busy/.test(r.reasons[0]));

// Tutor mode lower bars
r = tutor.shouldSpeakAbout('active_tutor', 'topic-d', { intentConfidence: 0.55, contextConfidence: 0.45, value: 0.5, cost: 0.2, busy: false }, tutor.createNudgeTracker(), T);
ok('tutor mid case speaks', r.speak === true);

// Value <= cost blocks (value above assistive bar 0.6 but below cost)
r = tutor.shouldSpeakAbout('assistive', 'topic-e', { intentConfidence: 0.9, contextConfidence: 0.8, value: 0.65, cost: 0.7, busy: false }, tutor.createNudgeTracker(), T);
ok('value<=cost blocks', r.speak === false && /cost/.test(r.reasons[0]));

// Unknown mode -> passive
r = tutor.shouldSpeakAbout('hyper', 'topic-f', strongCtx, tutor.createNudgeTracker(), T);
ok('unknown mode treated passive', r.speak === false);

// buildScoreInput shape
const inp = tutor.buildScoreInput('assistive', strongCtx, { lastNudgeAt: T - 1000, sameTopicNudges: 0 }, 'topic-x', T);
ok('score input shape correct', inp.mode === 'assistive' && inp.intentConfidence === 0.9 && inp.lastNudgeAt === T - 1000 && inp.topic === 'topic-x');

console.log('');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
