'use strict';
/**
 * MYRAA Course Studio learner model — tests (Phase 6).
 * Run: node tests/test_course_studio_learn.cjs (from repo root).
 * Pure algorithm tests with fixed dates; no DB, no AI.
 */

const learn = require('../resources/app/dist/course_studio_learn.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

const T0 = new Date('2026-01-01T00:00:00.000Z');
const plusH = (h) => new Date(T0.getTime() + h * 3600 * 1000).toISOString();

let r = learn.applyAttempt(null, { courseId: 'c', concept: 'loops', correct: true }, T0);
ok('first correct: streak 1, mastery 1', r.streak === 1 && r.mastery === 1, JSON.stringify(r));
ok('first correct: review in 24h', r.nextReview === plusH(24), r.nextReview);
ok('exposure/attempts counted', r.exposure === 1 && r.attempts === 1 && r.correct === 1);

r = learn.applyAttempt(r, { courseId: 'c', concept: 'loops', correct: false }, T0);
ok('wrong resets streak, mastery 0.5', r.streak === 0 && r.mastery === 0.5, r.streak + '/' + r.mastery);
ok('wrong: review in 4h', r.nextReview === plusH(4), r.nextReview);

r = learn.applyAttempt(r, { courseId: 'c', concept: 'loops', correct: true, hintUsed: true }, T0);
ok('hint counted, streak restarts', r.hints === 1 && r.streak === 1, JSON.stringify({ hints: r.hints, streak: r.streak }));

let s3 = { streak: 3 };
ok('delay table 0/1/2/3+', learn.delayHoursForStreak(0) === 4 && learn.delayHoursForStreak(1) === 24
  && learn.delayHoursForStreak(2) === 72 && learn.delayHoursForStreak(3) === 168 && learn.delayHoursForStreak(9) === 168);

ok('mastery 0 with no attempts', learn.computeMastery(0, 0) === 0);
ok('weak needs 3+ attempts and <0.6', learn.isWeak({ attempts: 4, mastery: 0.5 }) === true
  && learn.isWeak({ attempts: 2, mastery: 0 }) === false
  && learn.isWeak({ attempts: 5, mastery: 0.9 }) === false);

const rows = [
  { concept: 'b', nextReview: plusH(10) },
  { concept: 'a', nextReview: plusH(2) },
  { concept: 'future', nextReview: plusH(500) },
];
const due = learn.dueQueue(rows, new Date('2026-01-01T12:00:00.000Z'));
ok('due queue filters + sorts', due.length === 2 && due[0].concept === 'a' && due[1].concept === 'b', JSON.stringify(due.map((x) => x.concept)));

const v = learn.validateAttemptInput({ courseId: 'c', concept: 'x', correct: true });
ok('accepts good attempt', v.ok === true);
const v2 = learn.validateAttemptInput({ courseId: '', concept: '', correct: 'yes' });
ok('rejects bad attempt (3 errors)', v2.ok === false && v2.errors.length === 3, v2.errors.join('|'));

console.log('');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
