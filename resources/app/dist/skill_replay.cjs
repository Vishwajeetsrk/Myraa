'use strict';
/**
 * MYRAA Skill Replay Engine
 * =============================================================================
 * Executes COMPILED skills step by step using EXISTING services only.
 * - unknown action names are reported SKIPPED_UNSUPPORTED, never faked
 * - pause / resume / stop are real state transitions
 * - every step emits events and writes an audit trace
 * - medium-risk actions need per-step confirmation unless explicitly disabled
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const TRACE_DIR = process.env.MYRAA_TRACE_DIR || path.join(appData, 'MYRAA', 'action_traces');

let uia = null;
try { uia = require('./ui_automation_service.cjs'); } catch (e) { uia = null; }
let desktop = null;
try { desktop = require('./desktopAutomation.cjs'); } catch (e) { desktop = null; }
let xl = null;
try { xl = require('./excel_bridge.cjs'); } catch (e) { xl = null; }
let compiler = null;
try { compiler = require('./workflow_skill_compiler.cjs'); } catch (e) { compiler = null; }

const sessions = new Map();

function emit(type, payload) {
  try {
    const bus = require('./event_bus.cjs');
    return bus.emit(type, payload);
  } catch (e) { return { ok: false, error: e.message }; }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, Math.max(0, Math.min(5000, ms || 0)))); }

function newSessionId() { return 'replay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

function resolveSkill(skillId, skillObject) {
  if (skillObject) return skillObject;
  if (!compiler) return null;
  return compiler.get(skillId);
}

function start(skillId, opts = {}) {
  const b = opts && typeof opts === 'object' ? opts : {};
  const skill = resolveSkill(skillId, b.skill);
  if (!skill) return { ok: false, code: 'NOT_FOUND', error: 'unknown skill candidate' };
  const steps = Array.isArray(skill.steps) ? skill.steps.slice() : [];
  if (!steps.length) return { ok: false, code: 'VALIDATION', error: 'skill has no steps' };
  const id = newSessionId();
  const session = {
    id,
    skillId: skill.id,
    skillName: skill.name,
    steps,
    index: 0,
    status: 'IDLE',
    mode: b.mode === 'step' ? 'step' : 'run',
    requireConfirm: b.requireConfirm !== false,
    stepDelayMs: Math.min(2000, Math.max(0, Number(b.stepDelayMs) || 0)),
    trace: [],
    startedAt: null,
    endedAt: null,
    error: null,
  };
  sessions.set(id, session);
  emit('skill.replay_started', { sessionId: id, skillId: skill.id, mode: session.mode });
  return {
    ok: true,
    sessionId: id,
    skillId: skill.id,
    status: 'IDLE',
    stepCount: steps.length,
    supportedActions: Object.keys(ACTION_HANDLERS),
    note: 'No action has run yet. Use /step for one action or /run to execute the sequence.',
  };
}

function persistTrace(session) {
  try {
    fs.mkdirSync(TRACE_DIR, { recursive: true });
    const file = path.join(TRACE_DIR, session.id + '.json');
    fs.writeFileSync(file, JSON.stringify({
      sessionId: session.id,
      skillId: session.skillId,
      skillName: session.skillName,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      error: session.error,
      trace: session.trace,
    }, null, 2), 'utf8');
    return file;
  } catch (e) { return null; }
}

function finish(session, status, error) {
  session.status = status;
  session.endedAt = new Date().toISOString();
  session.error = error || null;
  const file = persistTrace(session);
  emit(`skill.replay_${status.toLowerCase()}`, { sessionId: session.id, skillId: session.skillId, steps: session.trace.length, error: error || null });
  return { traceFile: file };
}

const ACTION_HANDLERS = {
  verify_window: {
    risk: 'LOW',
    run: async (step) => {
      if (!uia) return { ok: false, error: 'UIA service unavailable' };
      const r = uia.listVisibleWindows();
      const windows = Array.isArray(r) ? r : ((r && r.windows) || []);
      const needle = String(step.target || '').toLowerCase();
      const found = windows.find((w) => String(w.title || '').toLowerCase().includes(needle) || String(w.processName || '').toLowerCase().includes(needle));
      return { ok: !!found, verified: !!found, detail: found ? `${found.title}` : 'no matching window' };
    },
  },
  activate_window: {
    risk: 'LOW',
    run: async (step) => {
      if (!uia) return { ok: false, error: 'UIA service unavailable' };
      return uia.activateWindow(step.target || step.app || '');
    },
  },
  find_element: {
    risk: 'LOW',
    run: async (step) => {
      if (!uia) return { ok: false, error: 'UIA service unavailable' };
      return uia.findElement(step.target || '');
    },
  },
  open_url: {
    risk: 'LOW',
    run: async (step) => {
      if (!desktop) return { ok: false, error: 'desktop automation unavailable' };
      return desktop.openApplication(step.target || '');
    },
  },
  set_clipboard: {
    risk: 'LOW',
    run: async (step) => {
      if (!desktop) return { ok: false, error: 'desktop automation unavailable' };
      return desktop.setClipboard(String(step.parameters && step.parameters.value ? step.parameters.value : step.target || ''));
    },
  },
  wait: {
    risk: 'LOW',
    run: async (step) => { await sleep(Number(step.parameters && step.parameters.ms) || 200); return { ok: true, detail: 'waited' }; },
  },
  excel_write: {
    risk: 'MEDIUM',
    run: async (step) => {
      if (!xl) return { ok: false, error: 'Excel bridge unavailable' };
      const p = step.parameters || {};
      return xl.writeRange({ workbook: p.workbook, sheet: p.sheet, range: p.range || step.target, values: p.values });
    },
  },
  excel_read: {
    risk: 'LOW',
    run: async (step) => {
      if (!xl) return { ok: false, error: 'Excel bridge unavailable' };
      const p = step.parameters || {};
      return xl.readRange({ workbook: p.workbook, sheet: p.sheet, range: p.range || step.target });
    },
  },
  excel_save: {
    risk: 'MEDIUM',
    run: async (step) => {
      if (!xl) return { ok: false, error: 'Excel bridge unavailable' };
      return xl.save({ workbook: (step.parameters || {}).workbook });
    },
  },
};

async function executeStep(sessionId, opts = {}) {
  const session = sessions.get(String(sessionId || ''));
  if (!session) return { ok: false, code: 'NOT_FOUND', error: 'unknown replay session' };
  if (session.status === 'PAUSED') return { ok: false, code: 'PAUSED', error: 'session is paused' };
  if (['STOPPED', 'COMPLETED', 'FAILED'].includes(session.status)) return { ok: false, code: 'CLOSED', error: 'session is not active' };
  if (session.index >= session.steps.length) {
    finish(session, 'COMPLETED');
    return { ok: true, done: true, status: 'COMPLETED', traceFile: persistTrace(session) };
  }

  const step = session.steps[session.index];
  const b = opts && typeof opts === 'object' ? opts : {};
  if (session.requireConfirm && b.confirm !== true) {
    return {
      ok: false,
      code: 'APPROVAL_REQUIRED',
      stepId: step.id,
      action: step.action,
      target: step.target,
      risk: (ACTION_HANDLERS[step.action] || {}).risk || 'UNKNOWN',
      message: 'Confirm this step before it runs.',
    };
  }

  const started = Date.now();
  session.startedAt = session.startedAt || new Date().toISOString();
  session.status = 'RUNNING';
  emit('skill.step_started', { sessionId, skillId: session.skillId, stepId: step.id, action: step.action });

  const handler = ACTION_HANDLERS[step.action];
  let result;
  if (!handler) {
    result = { ok: false, code: 'SKIPPED_UNSUPPORTED', error: `action "${step.action}" is not implemented; nothing was attempted.` };
  } else {
    try { result = await handler.run(step); }
    catch (e) { result = { ok: false, code: 'STEP_ERROR', error: e.message }; }
  }

  const entry = {
    at: new Date().toISOString(),
    stepId: step.id,
    order: step.order,
    app: step.app || null,
    action: step.action,
    target: step.target || null,
    risk: handler ? handler.risk : 'UNKNOWN',
    result: result.ok === true ? 'SUCCEEDED' : 'FAILED',
    code: result.code || null,
    detail: String(result.detail || result.message || result.error || '').slice(0, 400),
    verified: result.verified === true,
    durationMs: Date.now() - started,
    retried: false,
    userIntervention: b.confirm === true ? 'confirmed' : 'none',
  };
  session.trace.push(entry);
  session.index += 1;
  emit(result.ok ? 'skill.step_completed' : 'skill.step_failed', { sessionId, skillId: session.skillId, stepId: step.id, action: step.action, code: entry.code || null });

  if (!result.ok && (result.code === 'SKIPPED_UNSUPPORTED' || result.code === 'STEP_ERROR')) {
    finish(session, 'FAILED', entry.detail);
    return { ok: false, code: entry.code, error: entry.detail, sessionId, trace: entry, status: 'FAILED' };
  }

  if (session.index >= session.steps.length) {
    finish(session, 'COMPLETED');
    return { ok: true, done: true, sessionId, trace: entry, status: 'COMPLETED', traceFile: persistTrace(session) };
  }

  if (session.mode === 'run' && session.stepDelayMs) await sleep(session.stepDelayMs);
  return { ok: true, done: false, sessionId, trace: entry, status: session.status, nextStep: session.steps[session.index] };
}

async function runAll(sessionId, opts = {}) {
  const session = sessions.get(String(sessionId || ''));
  if (!session) return { ok: false, code: 'NOT_FOUND', error: 'unknown replay session' };
  const b = opts && typeof opts === 'object' ? opts : {};
  const autoConfirm = b.autoConfirm === true;
  let last = null;
  let guard = 0;
  while (guard++ < 100) {
    const s = sessions.get(sessionId);
    if (!s || ['STOPPED', 'COMPLETED', 'FAILED', 'PAUSED'].includes(s.status)) break;
    last = await executeStep(sessionId, { confirm: autoConfirm, autoConfirm: true });
    if (!last.ok) break;
    if (last.done) break;
  }
  const s = sessions.get(sessionId);
  return { ok: s.status === 'COMPLETED', status: s.status, stepsExecuted: s.trace.length, error: s.error, last, traceFile: persistTrace(s) };
}

function pause(sessionId) {
  const s = sessions.get(String(sessionId || ''));
  if (!s) return { ok: false, code: 'NOT_FOUND' };
  if (['STOPPED', 'COMPLETED', 'FAILED'].includes(s.status)) return { ok: false, code: 'CLOSED', error: 'session is not active' };
  s.status = 'PAUSED';
  emit('skill.replay_paused', { sessionId });
  return { ok: true, status: 'PAUSED' };
}

function resume(sessionId) {
  const s = sessions.get(String(sessionId || ''));
  if (!s) return { ok: false, code: 'NOT_FOUND' };
  if (s.status !== 'PAUSED') return { ok: false, code: 'NOT_PAUSED', error: 'session is not paused' };
  s.status = 'IDLE';
  emit('skill.replay_resumed', { sessionId });
  return { ok: true, status: 'IDLE' };
}

function stop(sessionId, reason) {
  const s = sessions.get(String(sessionId || ''));
  if (!s) return { ok: false, code: 'NOT_FOUND' };
  const file = finish(s, 'STOPPED', String(reason || 'stopped by user').slice(0, 200));
  return { ok: true, status: 'STOPPED', stepsExecuted: s.trace.length, traceFile: file.traceFile };
}

function get(sessionId) {
  const s = sessions.get(String(sessionId || ''));
  if (!s) return null;
  return {
    ok: true,
    sessionId: s.id,
    skillId: s.skillId,
    skillName: s.skillName,
    status: s.status,
    index: s.index,
    stepCount: s.steps.length,
    trace: s.trace,
    error: s.error,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
  };
}

const STATUS = {
  ok: true,
  service: 'skill-replay',
  execution: 'real, opt-in, step-verified; unsupported actions are never faked',
  supportedActions: Object.keys(ACTION_HANDLERS),
  controls: ['start', 'step', 'run', 'pause', 'resume', 'stop'],
  traceDir: TRACE_DIR,
  policy: 'Medium-risk actions require confirm:true per step. Emergency stop always works.',
};

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json(STATUS));
  router.get('/sessions', (req, res) => res.json({
    ok: true,
    sessions: [...sessions.values()].map((s) => ({
      sessionId: s.id,
      skillId: s.skillId,
      skillName: s.skillName,
      status: s.status,
      index: s.index,
      stepCount: s.steps.length,
      traceCount: s.trace.length,
      lastAction: s.trace.length ? s.trace[s.trace.length - 1] : null,
    })),
  }));
  router.post('/start', (req, res) => {
    const b = req.body || {};
    res.status(b.skillId || b.skill ? 200 : 400).json(start(b.skillId || (b.skill && b.skill.id), b));
  });
  router.post('/step', async (req, res) => {
    const b = req.body || {};
    const r = await executeStep(b.sessionId, b);
    res.status(r.ok ? 200 : (r.code === 'APPROVAL_REQUIRED' ? 409 : 400)).json(r);
  });
  router.post('/run', async (req, res) => {
    const b = req.body || {};
    const r = await runAll(b.sessionId, b);
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.post('/pause', (req, res) => res.json(pause((req.body || {}).sessionId)));
  router.post('/resume', (req, res) => res.json(resume((req.body || {}).sessionId)));
  router.post('/stop', (req, res) => res.json(stop((req.body || {}).sessionId, (req.body || {}).reason)));
  router.get('/:id', (req, res) => {
    const s = get(req.params.id);
    res.status(s ? 200 : 404).json(s || { ok: false, code: 'NOT_FOUND' });
  });
  return router;
}

module.exports = { STATUS, TRACE_DIR, ACTION_HANDLERS, start, executeStep, runAll, pause, resume, stop, get, createRouter };
