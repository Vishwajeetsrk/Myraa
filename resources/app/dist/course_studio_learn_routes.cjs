'use strict';
/**
 * MYRAA Course Studio — learning routes (Phase 6).
 * Attempts + review queue over cs_concepts. Mounted alongside
 * course_studio_routes.cjs (same /api/course-studio prefix, already gated).
 */

const express = require('express');
const learn = require('./course_studio_learn.cjs');
const { csDb } = require('./course_studio_store.cjs');

const router = express.Router();

function rowFromDb(r) {
  return {
    courseId: r[0], concept: r[1], lessonId: r[2] || '',
    exposure: r[3] | 0, attempts: r[4] | 0, correct: r[5] | 0, hints: r[6] | 0,
    streak: r[7] | 0, mastery: Number(r[8]) || 0,
    nextReview: r[9] || '', updatedAt: r[10] || '',
  };
}

router.post('/api/course-studio/attempts', (req, res) => {
  try {
    const v = learn.validateAttemptInput(req.body || {});
    if (!v.ok) return res.status(400).json({ ok: false, error: v.errors.join(' | '), code: 'VALIDATION' });
    const b = req.body;
    const courseId = String(b.courseId);
    const concept = String(b.concept).slice(0, 200);
    const list = csDb('cs_concept_list_by_course', { courseId });
    const rows = (list && list.ok === true && Array.isArray(list.concepts))
      ? list.concepts.map(rowFromDb) : [];
    const existing = rows.find((r) => r.concept.toLowerCase() === concept.toLowerCase()) || null;
    const updated = learn.applyAttempt(existing, {
      courseId, concept, correct: b.correct === true,
      hintUsed: b.hintUsed === true, lessonId: b.lessonId || '',
    });
    const s = csDb('cs_concept_save', updated);
    if (!s || s.ok !== true) return res.status(500).json({ ok: false, error: 'persist failed: ' + ((s && s.error) || 'unknown') });
    return res.json({ ok: true, concept: updated });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/course-studio/reviews/:courseId', (req, res) => {
  try {
    const courseId = String(req.params.courseId || '');
    if (!courseId) return res.status(400).json({ ok: false, error: 'courseId is required', code: 'VALIDATION' });
    const list = csDb('cs_concept_list_by_course', { courseId });
    if (!list || list.ok !== true) return res.status(500).json({ ok: false, error: 'read failed: ' + ((list && list.error) || 'unknown') });
    const rows = (list.concepts || []).map(rowFromDb);
    const due = learn.dueQueue(rows);
    const weak = rows.filter(learn.isWeak);
    return res.json({ ok: true, courseId, due, dueCount: due.length, weak, total: rows.length, algorithm: 'streak4h/24h/72h/7d' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/course-studio/concepts/:courseId', (req, res) => {
  try {
    const courseId = String(req.params.courseId || '');
    const list = csDb('cs_concept_list_by_course', { courseId });
    if (!list || list.ok !== true) return res.status(500).json({ ok: false, error: 'read failed: ' + ((list && list.error) || 'unknown') });
    const rows = (list.concepts || []).map(rowFromDb);
    return res.json({ ok: true, courseId, concepts: rows, total: rows.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

module.exports = router;
