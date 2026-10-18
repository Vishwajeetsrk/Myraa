'use strict';
/**
 * MYRAA Course Studio — HTTP routes (Phase 2 vertical slice).
 * Mounted in startServer() after myraa_v6_real_routes.cjs.
 *
 * Scope: topic/text/url/file sources -> course -> outline job (AI modules) ->
 * lesson-build job (AI scenes + narration TEXT + quiz) -> progress tracking.
 * Narration is TEXT for the EXISTING voice paths (speechSynthesis / /api/speak /
 * Gemini Live). No new TTS provider. No Fish Audio. No fake content: AI steps
 * fail honestly when the model returns invalid JSON or no provider is configured.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const schema = require('./course_studio_schema.cjs');
const { createJobService } = require('./course_studio_jobs.cjs');
const { csDb } = require('./course_studio_store.cjs');

const router = express.Router();

// ── key resolution (mirrors loadEnvFromFiles: secrets files fill env if unset)
function ensureEnvKeys() {
  try {
    const candidates = [];
    const appData = process.env.APPDATA || '';
    if (appData) candidates.push(path.join(appData, 'MYRAA', 'secrets.json'));
    candidates.push(path.join(process.cwd(), '.myraa-data', 'secrets.json'));
    for (const f of candidates) {
      try {
        if (!fs.existsSync(f)) continue;
        const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
        for (const [k, v] of Object.entries(parsed || {})) {
          if (typeof v === 'string' && v.trim() && !process.env[k]) process.env[k] = v.trim();
        }
      } catch (e) { /* ignore unreadable file */ }
    }
  } catch (e) { /* ignore */ }
}

function providersConfigured() {
  ensureEnvKeys();
  const env = process.env;
  const keys = ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GROQ_API_KEY',
    'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'XAI_API_KEY', 'DEEPSEEK_API_KEY'];
  return keys.some((k) => env[k] && String(env[k]).trim().length > 8);
}

function stripFences(t) {
  return String(t || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

async function aiJson(messages, label) {
  if (!providersConfigured()) {
    throw new Error('NOT_CONFIGURED: no AI provider key found (checked secrets.json + env for Gemini/Groq/OpenRouter/Anthropic/OpenAI/xAI/DeepSeek).');
  }
  let gateway;
  try {
    gateway = require('./ai_gateway_service.cjs');
  } catch (e) {
    throw new Error('AI gateway unavailable: ' + String((e && e.message) || e));
  }
  let res;
  try {
    res = await gateway.call({ messages });
  } catch (e) {
    throw new Error(label + ': all providers failed: ' + String((e && e.message) || e).slice(0, 300));
  }
  const text = stripFences(res && res.text);
  try {
    return { data: JSON.parse(text), provider: res.provider, model: res.model, usage: res.usage || null };
  } catch (e) {
    throw new Error(label + ': model did not return valid JSON (first 200 chars): ' + text.slice(0, 200));
  }
}

// ── durable job store via SQLite bridge ──────────────────────────────────────
const jobStore = {
  save: async (job) => {
    const r = csDb('cs_job_save', job);
    if (!r || r.ok !== true) throw new Error('job persist failed: ' + ((r && r.error) || 'unknown'));
  },
  load: async (id) => {
    const r = csDb('cs_job_get', { id: String(id) });
    if (!r || r.ok !== true || !r.job) return null;
    return r.job;
  },
};
const jobs = createJobService(jobStore);

function dbCourseGet(id) {
  const r = csDb('cs_course_get', { id: String(id) });
  if (!r || r.ok !== true || !r.course) return null;
  return r.course;
}

// ── OUTLINE job ─────────────────────────────────────────────────────────────
const OUTLINE_STEPS = ['plan-modules', 'create-lessons', 'validate'];

function outlineHandlers() {
  return {
    'plan-modules': async (job, api) => {
      api.setDetail('generating curriculum with AI');
      const course = dbCourseGet(job.refId);
      if (!course) throw new Error('course not found: ' + job.refId);
      const src = String(course.sourceText || course.sourceRef || '').slice(0, 4000);
      const { data, provider, model } = await aiJson([
        { role: 'system', content: 'You are a curriculum designer. Return JSON ONLY, no markdown fences. Shape: {"modules":[{"title":"...","objective":"...","lessons":[{"title":"...","objective":"..."}]}]}. Max 4 modules, max 4 lessons per module.' },
        { role: 'user', content: 'Course: ' + course.title + '\nObjective: ' + (course.objective || 'general understanding') + '\nAudience: ' + (course.audience || 'general') + '\nSource material:\n' + (src || '(no source text provided — design from the topic)') },
      ], 'outline.plan-modules');
      const modules = Array.isArray(data.modules) ? data.modules.slice(0, 4) : [];
      if (!modules.length) throw new Error('outline.plan-modules: model returned zero modules.');
      job.meta.modules = modules;
      job.meta.provider = provider;
      job.meta.model = model;
      api.setDetail(modules.length + ' modules via ' + provider);
    },
    'create-lessons': async (job, api) => {
      const modules = job.meta.modules || [];
      let created = 0;
      for (let mi = 0; mi < modules.length && created < 12; mi++) {
        const m = modules[mi] || {};
        const lessons = Array.isArray(m.lessons) ? m.lessons.slice(0, 4) : [];
        for (let li = 0; li < lessons.length && created < 12; li++) {
          const l = lessons[li] || {};
          const lesson = {
            id: schema.makeId('les'),
            courseId: job.refId,
            idx: created,
            title: String(l.title || ('Lesson ' + (created + 1))).slice(0, 200),
            objective: String(l.objective || '').slice(0, 1000),
            moduleTitle: String(m.title || ('Module ' + (mi + 1))).slice(0, 200),
            scenes: [],
            narration: [],
            quiz: [],
            summary: '',
            status: 'outline',
            createdAt: schema.nowIso(),
            updatedAt: schema.nowIso(),
          };
          const r = csDb('cs_lesson_save', lesson);
          if (!r || r.ok !== true) throw new Error('create-lessons: lesson persist failed: ' + ((r && r.error) || 'unknown'));
          created++;
        }
      }
      if (!created) throw new Error('create-lessons: no lessons produced.');
      job.meta.lessonCount = created;
      api.setDetail(created + ' lessons created');
    },
    validate: async (job, api) => {
      const r = csDb('cs_lesson_list_by_course', { courseId: job.refId });
      const lessons = (r && r.ok === true && Array.isArray(r.lessons)) ? r.lessons : [];
      if (!lessons.length) throw new Error('validate: no lessons found for course.');
      const course = dbCourseGet(job.refId);
      if (course) {
        course.status = 'outline-ready';
        course.updatedAt = schema.nowIso();
        csDb('cs_course_save', course);
      }
      api.setDetail(lessons.length + ' lessons validated');
    },
  };
}

// ── LESSON-BUILD job ────────────────────────────────────────────────────────
const LESSON_STEPS = ['build-scenes', 'build-narration', 'build-quiz', 'validate-store'];

function lessonHandlers() {
  return {
    'build-scenes': async (job, api) => {
      api.setDetail('generating scenes with AI');
      const lr = csDb('cs_lesson_get', { id: job.refId });
      const lesson = (lr && lr.ok === true) ? lr.lesson : null;
      if (!lesson) throw new Error('lesson not found: ' + job.refId);
      const course = dbCourseGet(lesson.courseId);
      const { data, provider, model } = await aiJson([
        { role: 'system', content: 'You are a visual lesson author. Return JSON ONLY, no markdown fences. Shape: {"scenes":[{"type":"title|text|code|diagram|comparison|exercise|recap","heading":"...","body":"...","code":"...(code type only)","points":["..."]}],"summary":"..."}. 4 to 8 scenes. Plain text, no markdown inside fields.' },
        { role: 'user', content: 'Course: ' + (course ? course.title : '') + '\nLesson: ' + lesson.title + '\nObjective: ' + (lesson.objective || '') + '\nModule: ' + (lesson.moduleTitle || '') },
      ], 'lesson.build-scenes');
      const scenes = Array.isArray(data.scenes) ? data.scenes.slice(0, 8) : [];
      if (scenes.length < 2) throw new Error('lesson.build-scenes: model returned fewer than 2 scenes.');
      const errs = [];
      scenes.forEach((s, i) => { schema.validateScene(s, i).forEach((e) => errs.push(e)); });
      if (errs.length) throw new Error('lesson.build-scenes: invalid scenes: ' + errs.slice(0, 4).join(' | '));
      job.meta.scenes = scenes;
      job.meta.summary = String(data.summary || '').slice(0, 2000);
      job.meta.provider = provider;
      job.meta.model = model;
      api.setDetail(scenes.length + ' scenes via ' + provider);
    },
    'build-narration': async (job, api) => {
      api.setDetail('generating narration text with AI');
      const scenes = job.meta.scenes || [];
      const { data } = await aiJson([
        { role: 'system', content: 'You are a narration writer for a spoken lesson. Return JSON ONLY, no markdown fences. Shape: {"segments":[{"sceneIndex":0,"text":"..."}]}. Exactly one segment per scene, in order. Spoken style, plain text, no markdown, no stage directions.' },
        { role: 'user', content: 'Write one narration segment per scene:\n' + scenes.map((s, i) => 'Scene ' + i + ' [' + s.type + '] ' + s.heading + ': ' + (s.body || (s.points || []).join(' ') || '').slice(0, 600)).join('\n') },
      ], 'lesson.build-narration');
      const segments = Array.isArray(data.segments) ? data.segments : [];
      if (segments.length !== scenes.length) {
        throw new Error('lesson.build-narration: got ' + segments.length + ' segments for ' + scenes.length + ' scenes.');
      }
      const errs = [];
      segments.forEach((seg, i) => { schema.validateNarrationSegment(seg, i, scenes.length).forEach((e) => errs.push(e)); });
      if (errs.length) throw new Error('lesson.build-narration: invalid segments: ' + errs.slice(0, 4).join(' | '));
      job.meta.narration = segments.map((seg) => ({
        sceneIndex: seg.sceneIndex,
        text: seg.text,
        estimatedSec: schema.estimateNarrationSec(seg.text),
      }));
      api.setDetail(segments.length + ' narration segments');
    },
    'build-quiz': async (job, api) => {
      api.setDetail('generating quiz with AI');
      const scenes = job.meta.scenes || [];
      const { data } = await aiJson([
        { role: 'system', content: 'You are an assessment designer. Return JSON ONLY, no markdown fences. Shape: {"questions":[{"type":"mcq|short","prompt":"...","options":["..."],"answerIndex":0,"sampleAnswer":"...(short only)","explanation":"..."}]}. 3 to 5 questions grounded in the lesson. mcq needs 3-4 options. Include a short "concept" label (2-5 words) on every question.' },
        { role: 'user', content: 'Lesson scenes:\n' + scenes.map((s, i) => 'Scene ' + i + ' ' + s.heading + ': ' + (s.body || '').slice(0, 400)).join('\n') },
      ], 'lesson.build-quiz');
      const questions = Array.isArray(data.questions) ? data.questions.slice(0, 5) : [];
      if (!questions.length) throw new Error('lesson.build-quiz: model returned zero questions.');
      const errs = [];
      questions.forEach((q, i) => { schema.validateQuestion(q, i).forEach((e) => errs.push(e)); });
      if (errs.length) throw new Error('lesson.build-quiz: invalid questions: ' + errs.slice(0, 4).join(' | '));
      job.meta.quiz = questions;
      api.setDetail(questions.length + ' questions');
    },
    'validate-store': async (job, api) => {
      const lr = csDb('cs_lesson_get', { id: job.refId });
      const lesson = (lr && lr.ok === true) ? lr.lesson : null;
      if (!lesson) throw new Error('lesson not found: ' + job.refId);
      lesson.scenes = job.meta.scenes || [];
      lesson.narration = job.meta.narration || [];
      lesson.quiz = job.meta.quiz || [];
      lesson.summary = job.meta.summary || '';
      lesson.status = 'ready';
      lesson.updatedAt = schema.nowIso();
      const v = schema.validateLesson(lesson);
      if (!v.ok) throw new Error('validate-store: ' + v.errors.slice(0, 5).join(' | '));
      const r = csDb('cs_lesson_save', lesson);
      if (!r || r.ok !== true) throw new Error('validate-store: persist failed: ' + ((r && r.error) || 'unknown'));
      const course = dbCourseGet(lesson.courseId);
      if (course && course.status !== 'ready') {
        const lr2 = csDb('cs_lesson_list_by_course', { courseId: lesson.courseId });
        const all = (lr2 && lr2.ok === true) ? (lr2.lessons || []) : [];
        if (all.length && all.every((l) => l.status === 'ready')) {
          course.status = 'ready';
          course.updatedAt = schema.nowIso();
          csDb('cs_course_save', course);
        }
      }
      api.setDetail('lesson ready');
    },
  };
}

function launchJob(promise, jobId) {
  promise.then(() => {}).catch(async (e) => {
    try {
      const job = await jobStore.load(jobId);
      if (job && job.status !== 'cancelled') {
        job.status = 'failed';
        job.error = String((e && e.message) || e).slice(0, 500);
        job.updatedAt = schema.nowIso();
        await jobStore.save(job);
      }
    } catch (e2) { /* persistence already broken; nothing more to do */ }
  });
}

// ── routes ──────────────────────────────────────────────────────────────────
router.post('/api/course-studio/courses', (req, res) => {
  try {
    const b = req.body || {};
    const course = {
      id: schema.makeId('crs'),
      title: String(b.title || '').slice(0, 200),
      objective: String(b.objective || '').slice(0, 2000),
      audience: String(b.audience || '').slice(0, 500),
      sourceKind: String(b.sourceKind || 'topic'),
      sourceRef: String(b.sourceRef || '').slice(0, 2000),
      sourceText: String(b.sourceText || '').slice(0, 20000),
      compute: schema.COMPUTE_PREFS.includes(b.compute) ? b.compute : 'AUTO',
      status: 'draft',
      createdAt: schema.nowIso(),
      updatedAt: schema.nowIso(),
    };
    const v = schema.validateCourse(course);
    if (!v.ok) return res.status(400).json({ ok: false, error: v.errors.join(' | '), code: 'VALIDATION' });
    const r = csDb('cs_course_save', course);
    if (!r || r.ok !== true) return res.status(500).json({ ok: false, error: 'persist failed: ' + ((r && r.error) || 'unknown') });
    return res.json({ ok: true, course });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/course-studio/courses', (req, res) => {
  try {
    const r = csDb('cs_course_list', {});
    const courses = (r && r.ok === true) ? (r.courses || []) : [];
    return res.json({ ok: true, courses });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/course-studio/courses/:id', (req, res) => {
  try {
    const course = dbCourseGet(req.params.id);
    if (!course) return res.status(404).json({ ok: false, error: 'course not found', code: 'NOT_FOUND' });
    const r = csDb('cs_lesson_list_by_course', { courseId: course.id });
    const lessons = (r && r.ok === true) ? (r.lessons || []) : [];
    return res.json({ ok: true, course, lessons });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/course-studio/courses/:id/outline', async (req, res) => {
  try {
    const course = dbCourseGet(req.params.id);
    if (!course) return res.status(404).json({ ok: false, error: 'course not found', code: 'NOT_FOUND' });
    const job = await jobs.startJob('outline', course.id, OUTLINE_STEPS, { title: course.title, compute: course.compute || 'AUTO' });
    launchJob(jobs.runJob(job.id, outlineHandlers()), job.id);
    return res.json({ ok: true, jobId: job.id, steps: OUTLINE_STEPS });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/course-studio/lessons/:id/build', async (req, res) => {
  try {
    const lr = csDb('cs_lesson_get', { id: String(req.params.id) });
    const lesson = (lr && lr.ok === true) ? lr.lesson : null;
    if (!lesson) return res.status(404).json({ ok: false, error: 'lesson not found', code: 'NOT_FOUND' });
    lesson.status = 'building';
    lesson.updatedAt = schema.nowIso();
    csDb('cs_lesson_save', lesson);
    const courseOfLesson = dbCourseGet(lesson.courseId);
    const job = await jobs.startJob('lesson-build', lesson.id, LESSON_STEPS, { title: lesson.title, compute: (courseOfLesson && courseOfLesson.compute) || 'AUTO' });
    launchJob(jobs.runJob(job.id, lessonHandlers()), job.id);
    return res.json({ ok: true, jobId: job.id, steps: LESSON_STEPS });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/course-studio/lessons/:id', (req, res) => {
  try {
    const lr = csDb('cs_lesson_get', { id: String(req.params.id) });
    const lesson = (lr && lr.ok === true) ? lr.lesson : null;
    if (!lesson) return res.status(404).json({ ok: false, error: 'lesson not found', code: 'NOT_FOUND' });
    const parsed = Object.assign({}, lesson);
    for (const k of ['scenes', 'narration', 'quiz']) {
      if (typeof parsed[k] === 'string') {
        try { parsed[k] = JSON.parse(parsed[k]); } catch (e) { parsed[k] = []; }
      }
    }
    return res.json({ ok: true, lesson: parsed });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/course-studio/jobs/:id', async (req, res) => {
  try {
    const job = await jobs.getJob(String(req.params.id));
    if (!job) return res.status(404).json({ ok: false, error: 'job not found', code: 'NOT_FOUND' });
    return res.json({ ok: true, job });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/course-studio/jobs/:id/cancel', async (req, res) => {
  try {
    const job = await jobs.cancelJob(String(req.params.id));
    if (!job) return res.status(404).json({ ok: false, error: 'job not found', code: 'NOT_FOUND' });
    return res.json({ ok: true, job });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/course-studio/progress', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.courseId || typeof b.courseId !== 'string') {
      return res.status(400).json({ ok: false, error: 'courseId is required', code: 'VALIDATION' });
    }
    const r = csDb('cs_progress_save', {
      courseId: String(b.courseId).slice(0, 120),
      lessonId: String(b.lessonId || '').slice(0, 120),
      mastery: b.mastery !== undefined ? b.mastery : {},
    });
    if (!r || r.ok !== true) return res.status(500).json({ ok: false, error: 'persist failed: ' + ((r && r.error) || 'unknown') });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/course-studio/progress/:courseId', (req, res) => {
  try {
    const r = csDb('cs_progress_get', { courseId: String(req.params.courseId) });
    if (!r || r.ok !== true) return res.status(500).json({ ok: false, error: 'read failed: ' + ((r && r.error) || 'unknown') });
    return res.json({ ok: true, progress: r.progress || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

module.exports = router;
