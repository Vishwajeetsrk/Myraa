'use strict';
/**
 * MYRAA Course Studio — learner model + spaced review (Phase 6).
 * Zero dependencies. The algorithm is explicit and documented here (no
 * invented precision):
 *
 *   exposure : times the concept was shown/practiced
 *   attempts : times the learner answered on the concept
 *   correct  : attempts judged correct
 *   hints    : attempts where a hint was used
 *   streak   : consecutive correct attempts (a wrong answer resets to 0)
 *   mastery  : correct/attempts rounded to 2 decimals (0 when attempts = 0)
 *   established: attempts >= 3 (mastery is noise before that)
 *   nextReview : ISO timestamp; delay depends on streak AFTER the attempt:
 *       streak 0 -> +4 hours | 1 -> +24h | 2 -> +72h | 3+ -> +168h (7 days)
 * A concept is DUE when next_review <= now. Review queue sorts by next_review.
 */

const REVIEW_DELAY_HOURS = [4, 24, 72, 168];
const ESTABLISHED_MIN_ATTEMPTS = 3;
const WEAK_MASTERY_BELOW = 0.6;

function nowIso(d) { return (d instanceof Date ? d : new Date()).toISOString(); }

function delayHoursForStreak(streak) {
  const s = Math.max(0, Math.min(3, streak | 0));
  return REVIEW_DELAY_HOURS[s];
}

function computeMastery(correct, attempts) {
  if (!attempts) return 0;
  return Math.round((correct / attempts) * 100) / 100;
}

function blankConcept(courseId, concept, lessonId) {
  const now = nowIso();
  return {
    courseId: String(courseId || ''), concept: String(concept || '').slice(0, 200),
    lessonId: String(lessonId || ''), exposure: 0, attempts: 0, correct: 0,
    hints: 0, streak: 0, mastery: 0, nextReview: now, updatedAt: now,
  };
}

// row: existing concept row or null. attempt: {correct:bool, hintUsed:bool, lessonId?}
// returns the updated row (does not persist).
function applyAttempt(row, attempt, atDate) {
  const now = atDate instanceof Date ? atDate : new Date();
  const r = row ? Object.assign({}, row) : null;
  const a = attempt || {};
  const correct = a.correct === true;
  const base = r || blankConcept(a.courseId || '', a.concept || '', a.lessonId || '');
  if (a.lessonId && !base.lessonId) base.lessonId = String(a.lessonId);
  base.exposure = (base.exposure | 0) + 1;
  base.attempts = (base.attempts | 0) + 1;
  if (correct) base.correct = (base.correct | 0) + 1;
  if (a.hintUsed === true) base.hints = (base.hints | 0) + 1;
  base.streak = correct ? ((base.streak | 0) + 1) : 0;
  base.mastery = computeMastery(base.correct, base.attempts);
  base.nextReview = new Date(now.getTime() + delayHoursForStreak(base.streak) * 3600 * 1000).toISOString();
  base.updatedAt = now.toISOString();
  return base;
}

function isDue(row, atDate) {
  if (!row || !row.nextReview) return true;
  const now = (atDate instanceof Date ? atDate : new Date()).toISOString();
  return String(row.nextReview) <= now;
}

function isWeak(row) {
  if (!row) return false;
  return (row.attempts | 0) >= ESTABLISHED_MIN_ATTEMPTS && Number(row.mastery) < WEAK_MASTERY_BELOW;
}

function dueQueue(rows, atDate) {
  return (rows || []).filter((r) => isDue(r, atDate))
    .sort((a, b) => String(a.nextReview || '').localeCompare(String(b.nextReview || '')));
}

function validateAttemptInput(b) {
  const errors = [];
  if (!b || typeof b !== 'object') return { ok: false, errors: ['body must be an object'] };
  if (typeof b.courseId !== 'string' || !b.courseId.trim()) errors.push('courseId is required');
  if (typeof b.concept !== 'string' || !b.concept.trim()) errors.push('concept is required');
  if (typeof b.correct !== 'boolean') errors.push('correct (boolean) is required');
  if (b.lessonId !== undefined && typeof b.lessonId !== 'string') errors.push('lessonId must be a string');
  if (b.hintUsed !== undefined && typeof b.hintUsed !== 'boolean') errors.push('hintUsed must be a boolean');
  return { ok: errors.length === 0, errors };
}

module.exports = {
  REVIEW_DELAY_HOURS, ESTABLISHED_MIN_ATTEMPTS, WEAK_MASTERY_BELOW,
  nowIso, delayHoursForStreak, computeMastery, blankConcept,
  applyAttempt, isDue, isWeak, dueQueue, validateAttemptInput,
};
