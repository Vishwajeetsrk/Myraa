'use strict';
/**
 * MYRAA Course Studio — versioned schemas + validators (Phase 2 vertical slice).
 * Zero dependencies. Supabase-portable: TEXT ids, ISO-8601 TEXT timestamps,
 * JSON documents stored as TEXT (JSONB on migration).
 */

const SCHEMA_VERSION = 1;

const COURSE_STATUSES = ['draft', 'outline-ready', 'ready', 'failed'];
const LESSON_STATUSES = ['outline', 'building', 'ready', 'failed'];
const JOB_STATUSES = ['queued', 'running', 'paused', 'cancelled', 'failed', 'completed'];
const SCENE_TYPES = ['title', 'text', 'code', 'code-diff', 'diagram', 'image', 'comparison', 'quiz', 'exercise', 'recap'];
const SOURCE_KINDS = ['topic', 'text', 'url', 'file', 'repo'];
const QUESTION_TYPES = ['mcq', 'short'];
const COMPUTE_PREFS = ['AUTO', 'LOCAL', 'CLOUD', 'KAGGLE', 'MANUAL'];

function makeId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return prefix + '_' + Date.now().toString(36) + '_' + rand;
}

function nowIso() { return new Date().toISOString(); }

function isNonEmptyString(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && (!max || v.length <= max);
}

function validateCourse(c) {
  const errors = [];
  if (!c || typeof c !== 'object') return { ok: false, errors: ['course must be an object'] };
  if (!isNonEmptyString(c.title, 200)) errors.push('title is required (max 200 chars)');
  if (c.objective !== undefined && c.objective !== null && typeof c.objective !== 'string') errors.push('objective must be a string');
  if (c.audience !== undefined && c.audience !== null && typeof c.audience !== 'string') errors.push('audience must be a string');
  if (!SOURCE_KINDS.includes(c.sourceKind)) errors.push('sourceKind must be one of: ' + SOURCE_KINDS.join(', '));
  if (c.compute !== undefined && c.compute !== null && c.compute !== '' && !COMPUTE_PREFS.includes(c.compute)) {
    errors.push('compute must be one of: ' + COMPUTE_PREFS.join(', '));
  }
  if (!COURSE_STATUSES.includes(c.status)) errors.push('status must be one of: ' + COURSE_STATUSES.join(', '));
  return { ok: errors.length === 0, errors };
}

function validateScene(s, i) {
  const errors = [];
  const tag = 'scenes[' + i + ']';
  if (!s || typeof s !== 'object') return [tag + ' must be an object'];
  if (!SCENE_TYPES.includes(s.type)) errors.push(tag + '.type must be one of: ' + SCENE_TYPES.join(', '));
  if (!isNonEmptyString(s.heading, 200)) errors.push(tag + '.heading is required');
  if (s.type === 'code' || s.type === 'code-diff') {
    if (!isNonEmptyString(s.code, 6000)) errors.push(tag + '.code is required for code scenes');
  } else if (!isNonEmptyString(s.body, 4000) && !Array.isArray(s.points)) {
    errors.push(tag + ' needs body text or points[]');
  }
  return errors;
}

function validateNarrationSegment(seg, i, sceneCount) {
  const errors = [];
  const tag = 'narration[' + i + ']';
  if (!seg || typeof seg !== 'object') return [tag + ' must be an object'];
  if (!Number.isInteger(seg.sceneIndex) || seg.sceneIndex < 0 || seg.sceneIndex >= sceneCount) {
    errors.push(tag + '.sceneIndex out of range (0-' + (sceneCount - 1) + ')');
  }
  if (!isNonEmptyString(seg.text, 2000)) errors.push(tag + '.text is required (plain speech text, no markdown)');
  return errors;
}

function validateQuestion(q, i) {
  const errors = [];
  const tag = 'quiz[' + i + ']';
  if (!q || typeof q !== 'object') return [tag + ' must be an object'];
  if (!QUESTION_TYPES.includes(q.type)) errors.push(tag + '.type must be mcq or short');
  if (!isNonEmptyString(q.prompt, 1000)) errors.push(tag + '.prompt is required');
  if (q.type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
      errors.push(tag + '.options needs 2-6 entries');
    }
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || (Array.isArray(q.options) && q.answerIndex >= q.options.length)) {
      errors.push(tag + '.answerIndex is invalid');
    }
  } else if (q.type === 'short') {
    if (!isNonEmptyString(q.sampleAnswer, 2000)) errors.push(tag + '.sampleAnswer is required for short questions');
  }
  return errors;
}

function validateLesson(l) {
  const errors = [];
  if (!l || typeof l !== 'object') return { ok: false, errors: ['lesson must be an object'] };
  if (!isNonEmptyString(l.title, 200)) errors.push('title is required (max 200 chars)');
  if (!isNonEmptyString(l.courseId, 120)) errors.push('courseId is required');
  if (!LESSON_STATUSES.includes(l.status)) errors.push('status must be one of: ' + LESSON_STATUSES.join(', '));
  if (l.status === 'ready') {
    if (!Array.isArray(l.scenes) || l.scenes.length < 1 || l.scenes.length > 24) {
      errors.push('ready lessons need 1-24 scenes');
    } else {
      l.scenes.forEach((s, i) => { validateScene(s, i).forEach((e) => errors.push(e)); });
    }
    if (!Array.isArray(l.narration) || l.narration.length !== (Array.isArray(l.scenes) ? l.scenes.length : -1)) {
      errors.push('narration needs exactly one segment per scene');
    } else {
      l.narration.forEach((seg, i) => { validateNarrationSegment(seg, i, l.scenes.length).forEach((e) => errors.push(e)); });
    }
    if (!Array.isArray(l.quiz) || l.quiz.length < 1 || l.quiz.length > 12) {
      errors.push('ready lessons need 1-12 quiz questions');
    } else {
      l.quiz.forEach((q, i) => { validateQuestion(q, i).forEach((e) => errors.push(e)); });
    }
  }
  return { ok: errors.length === 0, errors };
}

function estimateNarrationSec(text) {
  const chars = String(text || '').trim().length;
  if (!chars) return 0;
  return Math.max(2, Math.round(chars / 14));
}

module.exports = {
  SCHEMA_VERSION,
  COURSE_STATUSES,
  LESSON_STATUSES,
  JOB_STATUSES,
  SCENE_TYPES,
  SOURCE_KINDS,
  QUESTION_TYPES,
  COMPUTE_PREFS,
  makeId,
  nowIso,
  validateCourse,
  validateScene,
  validateNarrationSegment,
  validateQuestion,
  validateLesson,
  estimateNarrationSec,
};
