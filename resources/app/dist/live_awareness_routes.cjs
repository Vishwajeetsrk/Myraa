'use strict';
/**
 * MYRAA Live Awareness + Screen Session (Phase 5, extended).
 *
 * One session model over the EXISTING desktop stack:
 *   - window/monitor/focus primitives come from ui_automation_service.cjs
 *   - observation consent comes from screen_awareness_consent.json
 *   - workflow recording reuses passive_learning_service.cjs (explicit mode)
 *   - facts go to event_bus.cjs under screen/app/window/workflow namespaces
 *
 * Honesty rules:
 *   - L0 metadata works without consent; L1+ observation requires consent.
 *   - Private mode disables observation/learning and clears transient history.
 *   - No pixels are captured here. No raw selected text is persisted.
 *   - Workflow candidates are CANDIDATE only and never auto-created as skills.
 *   - Intent inference is NOT_IMPLEMENTED and reported as such.
 *
 * Event ring is in-memory (cap 200). DELETE clears it for real.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const uia = require('./ui_automation_service.cjs');

const router = express.Router();

const MODES = ['passive', 'assistive', 'active_tutor'];
const EVENT_CAP = 200;
const OBS_CAP = 400;
const ACTION_CAP = 300;
const SESSION_HISTORY_CAP = 20;

const eventsRing = [];

const session = {
  id: null,
  name: '',
  active: false,
  startedAt: null,
  endedAt: null,
  observations: [],
  actions: [],
  last: null,
  timer: null,
  intervalMs: 5000,
  samples: 0,
  emittedCandidates: new Set(),
};

function settingsDir() {
  const appData = process.env.APPDATA
    || (process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library/Application Support')
      : path.join(process.env.HOME || '', '.config'));
  return path.join(process.env.MYRAA_DATA_DIR || path.join(appData, 'MYRAA'), 'settings');
}
function myraaDataDir() {
  const appData = process.env.APPDATA
    || (process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library/Application Support')
      : path.join(process.env.HOME || '', '.config'));
  return path.join(process.env.MYRAA_DATA_DIR || path.join(appData, 'MYRAA'), 'awareness');
}
function consentFile() { return path.join(settingsDir(), 'screen_awareness_consent.json'); }
function modeFile() { return path.join(settingsDir(), 'awareness_mode.json'); }
function privateFile() { return path.join(settingsDir(), 'awareness_private.json'); }
function historyFile() { return path.join(myraaDataDir(), 'sessions.json'); }

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      return JSON.parse(raw);
    }
  } catch (e) { /* corrupt file falls back */ }
  return fallback;
}
function writeJson(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
    return true;
  } catch (e) { return false; }
}

function loadConsent() {
  const p = readJson(consentFile(), null);
  if (p && typeof p.enabled === 'boolean') return p.enabled;
  const v = String(process.env.MYRAA_ENABLE_SCREEN_AWARENESS || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
function loadMode() {
  const p = readJson(modeFile(), null);
  return p && MODES.includes(p.mode) ? p.mode : 'passive';
}
function saveMode(mode) {
  const rec = { mode, updatedAt: new Date().toISOString() };
  writeJson(modeFile(), rec);
  return rec;
}
function loadPrivate() {
  const p = readJson(privateFile(), null);
  return !!(p && p.enabled === true);
}
function savePrivate(enabled) {
  const rec = { enabled: !!enabled, updatedAt: new Date().toISOString() };
  writeJson(privateFile(), rec);
  return rec;
}

function logEvent(type, detail) {
  eventsRing.push({ at: new Date().toISOString(), type: String(type), detail: String(detail || '').slice(0, 300) });
  while (eventsRing.length > EVENT_CAP) eventsRing.shift();
}

function busEmit(type, payload) {
  try {
    const bus = require('./event_bus.cjs');
    return bus.emit(type, payload);
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

function ocrAvailable() {
  try {
    require('./ocr_engine.cjs');
    return { available: true, reason: 'ocr_engine.cjs present (Phase 4).' };
  } catch (e) {
    return { available: false, reason: 'ocr_engine.cjs not installed; vision-model OCR remains via /api/vision/analyze-frame.' };
  }
}

function levels(consent) {
  const ocr = ocrAvailable();
  return [
    { level: 0, name: 'Window awareness', available: true, reason: 'Metadata snapshot; no capture.' },
    { level: 1, name: 'UI awareness', available: consent, reason: consent ? 'UIA control maps and focused element via ui_automation_service.' : 'Requires screen-awareness consent.' },
    { level: 2, name: 'Content awareness', available: consent && ocr.available, reason: !consent ? 'Requires screen-awareness consent.' : ocr.reason },
    { level: 3, name: 'Task awareness', available: consent, reason: consent ? 'Rule-based inference from real foreground + focus metadata.' : 'Requires screen-awareness consent.' },
    { level: 4, name: 'Workflow awareness', available: consent, reason: consent ? 'Repeated session signatures + passive learning recordings.' : 'Requires screen-awareness consent.' },
    { level: 5, name: 'Intent awareness', available: false, reason: 'NOT_IMPLEMENTED — intent is never guessed or claimed.' },
  ];
}

// ── observation primitives ───────────────────────────────────────────────────

async function sampleState(opts = {}) {
  const [fg, monitors, focus] = await Promise.all([
    typeof uia.getForegroundWindow === 'function' ? uia.getForegroundWindow() : Promise.resolve({ ok: false, window: null }),
    typeof uia.getMonitors === 'function' ? uia.getMonitors() : Promise.resolve({ ok: false, monitors: [] }),
    typeof uia.getFocusedElement === 'function' ? uia.getFocusedElement() : Promise.resolve({ ok: false, element: null }),
  ]);
  const listed = typeof uia.listVisibleWindows === 'function' ? uia.listVisibleWindows() : { windows: [] };
  const windows = ((listed && listed.windows) || []).map((w) => ({
    handle: w.handle,
    title: w.title,
    processName: w.processName,
    className: w.className,
    state: w.state,
    monitor: w.monitor,
    isForeground: w.isForeground === true,
    bounds: w.bounds || null,
  }));
  const f = focus && focus.ok && focus.element ? focus.element : null;
  const selectionAllowed = opts.captureSelection === true && f && f.isPassword !== true;
  return {
    at: new Date().toISOString(),
    foreground: fg && fg.ok && fg.window ? {
      handle: fg.window.handle,
      title: fg.window.title,
      processName: fg.window.processName,
      className: fg.window.className,
      state: fg.window.state,
      monitor: fg.window.monitor,
      bounds: fg.window.bounds || null,
    } : null,
    monitors: ((monitors && monitors.monitors) || []).map((m) => ({
      index: m.index, device: m.device, primary: m.primary === true, bounds: m.bounds, workingArea: m.workingArea,
    })),
    focus: f ? {
      name: f.name || null,
      controlType: f.controlType || null,
      automationId: f.automationId || null,
      windowTitle: f.windowTitle || null,
      isPassword: f.isPassword === true,
      hasSelection: f.hasSelection === true,
      selectionLength: f.selectedText ? String(f.selectedText).length : 0,
      selectedText: selectionAllowed ? String(f.selectedText || '').slice(0, 500) : null,
      bounds: f.rect || null,
    } : null,
    windows,
  };
}

function parseDocument(state) {
  const fg = state.foreground || {};
  const title = String(fg.title || '');
  const proc = String(fg.processName || '').toLowerCase();
  const m = title.match(/^(.*?)\s+-\s+(Excel|Word|PowerPoint|Outlook|Notepad|Visual Studio Code|Google Chrome|Microsoft Edge|Firefox)\s*$/i);
  const base = (m ? m[1] : title).trim();

  if (proc.includes('excel')) {
    return { kind: 'spreadsheet', application: 'Microsoft Excel', title: base || null, workbook: base || null, worksheet: null, method: 'window title; worksheet and cell need the Excel bridge' };
  }
  if (proc.includes('winword')) {
    return { kind: 'document', application: 'Microsoft Word', title: base || null, method: 'window title' };
  }
  if (proc.includes('powerpnt')) {
    return { kind: 'presentation', application: 'Microsoft PowerPoint', title: base || null, method: 'window title' };
  }
  if (proc.includes('outlook')) {
    return { kind: 'mail', application: 'Microsoft Outlook', title: base || null, method: 'window title' };
  }
  if (proc.includes('chrome') || proc.includes('msedge') || proc.includes('firefox')) {
    return { kind: 'web', application: fg.processName || 'Browser', title: base || null, url: null, method: 'window title; URL needs the browser adapter or a focused omnibox read' };
  }
  if (proc.includes('code')) {
    return { kind: 'code', application: 'Visual Studio Code', title: base || null, method: 'window title' };
  }
  if (proc.includes('explorer')) {
    return { kind: 'files', application: 'File Explorer', title: base || null, method: 'window title' };
  }
  if (proc.includes('terminal') || proc.includes('windowsterminal') || proc.includes('powershell')) {
    return { kind: 'terminal', application: fg.processName || 'Terminal', title: base || null, method: 'window title' };
  }
  return { kind: 'application', application: fg.processName || null, title: base || null, method: 'window title' };
}

function signatureOf(state, doc) {
  const fg = state.foreground || {};
  const f = state.focus || {};
  return [
    String(fg.processName || '').toLowerCase(),
    String((doc && doc.title) || '').slice(0, 80),
    String(f.controlType || ''),
    String(f.name || '').slice(0, 60),
  ].join('|');
}

function diffObservation(prev, next) {
  if (!prev) return { first: true, foreground: true, focus: true, selection: false, windowsAdded: [], windowsRemoved: [] };
  const prevHandles = new Set((prev.windows || []).map((w) => String(w.handle)));
  const nextHandles = new Set((next.windows || []).map((w) => String(w.handle)));
  const added = (next.windows || []).filter((w) => !prevHandles.has(String(w.handle))).map((w) => ({ title: w.title, processName: w.processName }));
  const removed = (prev.windows || []).filter((w) => !nextHandles.has(String(w.handle))).map((w) => ({ title: w.title, processName: w.processName }));
  const pfg = (prev.foreground && prev.foreground.handle) || null;
  const nfg = (next.foreground && next.foreground.handle) || null;
  const pf = prev.focus || {};
  const nf = next.focus || {};
  const focusChanged = String(pf.name || '') !== String(nf.name || '') || String(pf.controlType || '') !== String(nf.controlType || '');
  const selectionChanged = pf.hasSelection !== nf.hasSelection || (pf.selectionLength || 0) !== (nf.selectionLength || 0);
  return { first: false, foreground: pfg !== nfg, focus: focusChanged, selection: selectionChanged, windowsAdded: added, windowsRemoved: removed };
}

function inferActivity(state, doc) {
  const fg = state.foreground || {};
  const focus = state.focus || null;
  const proc = String(fg.processName || '').toLowerCase();
  const evidence = [];
  let task = 'Unknown activity';
  let confidence = 0.35;

  if (proc.includes('excel')) {
    task = 'Spreadsheet work';
    confidence = 0.82;
    evidence.push('foreground process is EXCEL');
    if (focus && focus.name) evidence.push('focused control is ' + focus.name);
    if (focus && focus.controlType) evidence.push('focused control type is ' + focus.controlType);
  } else if (proc.includes('winword')) {
    task = 'Document editing';
    confidence = 0.8;
    evidence.push('foreground process is WINWORD');
  } else if (proc.includes('powerpnt')) {
    task = 'Presentation editing';
    confidence = 0.8;
    evidence.push('foreground process is POWERPNT');
  } else if (proc.includes('chrome') || proc.includes('msedge') || proc.includes('firefox')) {
    task = 'Web browsing';
    confidence = 0.7;
    evidence.push('foreground process is a browser');
    if (focus && /address|search/i.test(String(focus.name || ''))) evidence.push('address bar has focus');
  } else if (proc.includes('code')) {
    task = 'Coding';
    confidence = 0.78;
    evidence.push('foreground process is Visual Studio Code');
  } else if (proc.includes('explorer')) {
    task = 'File management';
    confidence = 0.7;
    evidence.push('foreground process is File Explorer');
  } else if (proc.includes('terminal') || proc.includes('powershell')) {
    task = 'Terminal work';
    confidence = 0.72;
    evidence.push('foreground process is a terminal');
  } else if (proc.includes('outlook')) {
    task = 'Email work';
    confidence = 0.75;
    evidence.push('foreground process is Outlook');
  } else if (proc) {
    task = 'Using ' + fg.processName;
    confidence = 0.45;
    evidence.push('foreground process is ' + fg.processName);
  }

  return {
    ok: true,
    task,
    application: fg.processName || null,
    windowTitle: fg.title || null,
    object: (doc && doc.title) || fg.title || null,
    document: doc || null,
    focus: focus ? { name: focus.name, controlType: focus.controlType, hasSelection: focus.hasSelection } : null,
    evidence,
    confidence,
    intent: 'NOT_INFERRED',
    method: 'rule-based over real foreground + focus metadata',
    limitations: ['task labels are heuristics, not model inference', 'intent inference is NOT_IMPLEMENTED', 'Excel worksheet/cell require the Excel bridge'],
  };
}

// ── workflow candidates (no auto-creation) ───────────────────────────────────

function hashKey(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function detectWorkflows() {
  const sigs = [];
  for (const o of session.observations) {
    if (!o.signature) continue;
    if (sigs.length && sigs[sigs.length - 1].signature === o.signature) continue;
    sigs.push(o);
  }
  const recent = sigs.slice(-120);
  const found = new Map();

  for (let n = 3; n <= 6; n++) {
    const counts = new Map();
    for (let i = 0; i + n <= recent.length; i++) {
      const win = recent.slice(i, i + n);
      const unique = new Set(win.map((x) => x.signature));
      if (unique.size < 3) continue;
      const key = win.map((x) => x.signature).join('>');
      const rec = counts.get(key) || { count: 0, win };
      rec.count += 1;
      counts.set(key, rec);
    }
    for (const [key, rec] of counts) {
      if (rec.count < 2) continue;
      const steps = rec.win.map((x) => ({
        app: (x.app && x.app.processName) || null,
        windowTitle: (x.app && x.app.title) || null,
        control: (x.focus && x.focus.name) || null,
        controlType: (x.focus && x.focus.controlType) || null,
        document: (x.document && x.document.title) || null,
      }));
      const uniqueSteps = new Set(steps.map((s) => `${s.app}|${s.control}|${s.document}`)).size;
      if (uniqueSteps < 3) continue;
      const confidence = Math.min(0.9, 0.45 + rec.count * 0.12 + n * 0.02);
      const candidate = {
        id: 'wf_candidate_' + hashKey(key),
        name: `${steps[0].app || 'Desktop'} workflow (${n} steps)`,
        steps,
        stepCount: n,
        occurrences: rec.count,
        confidence: Number(confidence.toFixed(2)),
        status: 'CANDIDATE',
        requiresConfirmation: true,
        source: 'awareness.session',
        firstSeenAt: rec.win[0].at,
        lastSeenAt: rec.win[n - 1].at,
        key,
      };
      const prior = found.get(candidate.id);
      if (!prior || candidate.occurrences > prior.occurrences || (candidate.occurrences === prior.occurrences && candidate.stepCount > prior.stepCount)) {
        found.set(candidate.id, candidate);
      }
    }
  }

  return [...found.values()]
    .sort((a, b) => (b.occurrences - a.occurrences) || (b.confidence - a.confidence))
    .slice(0, 5);
}

// ── session lifecycle ────────────────────────────────────────────────────────

async function recordObservation(state, trigger, opts = {}) {
  const doc = parseDocument(state);
  const obs = {
    at: state.at,
    trigger,
    app: state.foreground ? {
      handle: state.foreground.handle,
      processName: state.foreground.processName,
      title: state.foreground.title,
      className: state.foreground.className,
      state: state.foreground.state,
      monitor: state.foreground.monitor,
    } : null,
    document: doc,
    focus: state.focus ? {
      name: state.focus.name,
      controlType: state.focus.controlType,
      automationId: state.focus.automationId,
      windowTitle: state.focus.windowTitle,
      isPassword: state.focus.isPassword,
      hasSelection: state.focus.hasSelection,
      selectionLength: state.focus.selectionLength,
      selectedText: opts.captureSelection === true ? state.focus.selectedText : null,
    } : null,
    monitors: state.monitors,
    windowCount: state.windows.length,
    signature: signatureOf(state, doc),
  };

  const prev = session.last;
  obs.changed = diffObservation(prev, obs);

  // A manual observation while no session is recording is ephemeral: it is
  // returned to the caller but never stored, logged or emitted.
  const store = session.active || opts.store === true;
  if (!store) return obs;

  session.observations.push(obs);
  while (session.observations.length > OBS_CAP) session.observations.shift();
  session.last = obs;
  session.samples += 1;

  if (obs.changed.first || obs.changed.foreground) {
    logEvent('window.activated', (obs.app && obs.app.title) || 'unknown window');
    busEmit('window.activated', {
      title: (obs.app && obs.app.title) || null,
      process: (obs.app && obs.app.processName) || null,
      handle: (obs.app && obs.app.handle) || null,
    });
  }
  for (const w of obs.changed.windowsAdded) {
    logEvent('app.opened', `${w.processName || 'app'}: ${w.title || ''}`.slice(0, 120));
    busEmit('app.opened', { title: w.title || null, process: w.processName || null });
  }
  for (const w of obs.changed.windowsRemoved) {
    logEvent('app.closed', `${w.processName || 'app'}: ${w.title || ''}`.slice(0, 120));
    busEmit('app.closed', { title: w.title || null, process: w.processName || null });
  }
  if (!obs.changed.first && obs.changed.focus) {
    logEvent('screen.focus', `${(obs.focus && obs.focus.controlType) || 'control'}: ${(obs.focus && obs.focus.name) || ''}`.slice(0, 120));
    busEmit('screen.focus', {
      control: (obs.focus && obs.focus.name) || null,
      controlType: (obs.focus && obs.focus.controlType) || null,
      windowTitle: (obs.focus && obs.focus.windowTitle) || null,
    });
  }
  if (!obs.changed.first && obs.changed.selection) {
    logEvent('desktop.selection', `${(obs.focus && obs.focus.selectionLength) || 0} chars`);
    busEmit('desktop.selection', {
      control: (obs.focus && obs.focus.name) || null,
      length: (obs.focus && obs.focus.selectionLength) || 0,
    });
  }

  const candidates = detectWorkflows();
  for (const c of candidates) {
    if (session.emittedCandidates.has(c.id)) continue;
    session.emittedCandidates.add(c.id);
    logEvent('workflow.detected', `${c.name} (x${c.occurrences}, confidence ${c.confidence})`);
    busEmit('workflow.detected', { name: c.name, occurrences: c.occurrences, confidence: c.confidence, stepCount: c.stepCount });
  }

  return obs;
}

async function startSession(name, intervalMs, opts = {}) {
  if (loadPrivate()) {
    return { ok: false, code: 'PRIVATE_MODE', error: 'Private mode is enabled; observation and learning are disabled.' };
  }
  if (!loadConsent()) {
    return { ok: false, code: 'SCREEN_AWARENESS_CONSENT_REQUIRED', error: 'Screen awareness consent is required. POST /api/screen-awareness/consent {"enabled": true}.' };
  }
  if (session.active) {
    return { ok: true, alreadyActive: true, sessionId: session.id, name: session.name, intervalMs: session.intervalMs, startedAt: session.startedAt, status: 'RECORDING' };
  }

  session.id = 'aw_' + Date.now();
  session.name = String(name || 'Screen session').slice(0, 120);
  session.active = true;
  session.startedAt = new Date().toISOString();
  session.endedAt = null;
  session.observations = [];
  session.actions = [];
  session.last = null;
  session.samples = 0;
  session.emittedCandidates = new Set();

  const ms = Math.min(60000, Math.max(2000, Number(intervalMs) || 5000));
  session.intervalMs = ms;
  session.timer = setInterval(async () => {
    if (!session.active) return;
    // Consent revocation or private mode must halt capture immediately, even
    // though the session was started earlier.
    if (!loadConsent() || loadPrivate()) { stopSession(); return; }
    try {
      const state = await sampleState({ captureSelection: opts.captureSelection === true });
      await recordObservation(state, 'interval', opts);
    } catch (e) { /* a failed sample never stops the session */ }
  }, ms);
  if (session.timer.unref) session.timer.unref();

  const first = await sampleState({ captureSelection: opts.captureSelection === true });
  await recordObservation(first, 'start', opts);

  return {
    ok: true,
    sessionId: session.id,
    name: session.name,
    intervalMs: session.intervalMs,
    startedAt: session.startedAt,
    status: 'RECORDING',
    message: 'Screen session started. Metadata only; no pixels are stored.',
  };
}

function summarizeSession() {
  const apps = {};
  for (const o of session.observations) {
    const k = (o.app && o.app.processName) || 'unknown';
    apps[k] = (apps[k] || 0) + 1;
  }
  return {
    ok: true,
    sessionId: session.id,
    name: session.name,
    active: session.active,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    intervalMs: session.intervalMs,
    samples: session.samples,
    observationCount: session.observations.length,
    actionCount: session.actions.length,
    applications: apps,
    last: session.last,
    candidates: detectWorkflows(),
  };
}

function persistSessionSummary(summary) {
  if (loadPrivate()) return { ok: false, code: 'PRIVATE_MODE' };
  const history = readJson(historyFile(), []);
  const list = Array.isArray(history) ? history : [];
  list.unshift({
    sessionId: summary.sessionId,
    name: summary.name,
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
    samples: summary.samples,
    applications: summary.applications,
    candidateCount: (summary.candidates || []).length,
    candidates: (summary.candidates || []).map((c) => ({ id: c.id, name: c.name, steps: c.steps, occurrences: c.occurrences, confidence: c.confidence })),
  });
  const capped = list.slice(0, SESSION_HISTORY_CAP);
  writeJson(historyFile(), capped);
  return { ok: true, stored: capped.length };
}

function stopSession() {
  const wasActive = session.active;
  if (session.timer) clearInterval(session.timer);
  session.timer = null;
  session.active = false;
  session.endedAt = new Date().toISOString();
  const summary = summarizeSession();
  if (wasActive) {
    logEvent('session.stopped', `${summary.observationCount} observations, ${(summary.candidates || []).length} candidates`);
    busEmit('screen.session_stopped', { sessionId: summary.sessionId, samples: summary.samples, candidates: (summary.candidates || []).length });
    persistSessionSummary(summary);
  }
  return { ...summary, wasActive, status: 'IDLE' };
}

function clearSession() {
  session.observations = [];
  session.actions = [];
  session.last = null;
  session.samples = 0;
  session.emittedCandidates = new Set();
  return { ok: true };
}

// ── guards ───────────────────────────────────────────────────────────────────

function gate(res) {
  if (loadPrivate()) {
    res.status(403).json({ ok: false, code: 'PRIVATE_MODE', error: 'Private mode is enabled; observation and learning are disabled.' });
    return false;
  }
  if (!loadConsent()) {
    res.status(403).json({ ok: false, code: 'SCREEN_AWARENESS_CONSENT_REQUIRED', error: 'Screen awareness consent is required. POST /api/screen-awareness/consent {"enabled": true}.' });
    return false;
  }
  return true;
}

function fail(res, e) {
  return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
}

// ── routes ───────────────────────────────────────────────────────────────────

router.get('/api/awareness/status', (req, res) => {
  try {
    const consent = loadConsent();
    const priv = loadPrivate();
    return res.json({
      ok: true,
      consent: { enabled: consent },
      privateMode: priv,
      mode: loadMode(),
      modes: MODES,
      levels: levels(consent),
      session: {
        id: session.id,
        name: session.name,
        active: session.active,
        startedAt: session.startedAt,
        intervalMs: session.intervalMs,
        samples: session.samples,
        observations: session.observations.length,
        actions: session.actions.length,
      },
      policy: {
        interveneOnlyWhen: 'intervention_value > interruption_cost',
        passive: 'Watch context, never interrupt.',
        assistive: 'Occasional suggestions with confidence gating.',
        active_tutor: 'Continuous teaching (enforcement lands with the Tutor phase).',
        privateMode: 'No observation, no learning, no persistent session history.',
        skills: 'Workflow candidates are never auto-created; confirmation is required.',
      },
      events: eventsRing.length,
    });
  } catch (e) { return fail(res, e); }
});

router.post('/api/awareness/mode', (req, res) => {
  try {
    const mode = req.body && req.body.mode;
    if (!MODES.includes(mode)) {
      return res.status(400).json({ ok: false, error: 'mode must be one of: ' + MODES.join(', '), code: 'VALIDATION' });
    }
    const rec = saveMode(mode);
    logEvent('mode.changed', mode);
    return res.json({ ok: true, mode: rec.mode, updatedAt: rec.updatedAt });
  } catch (e) { return fail(res, e); }
});

router.post('/api/awareness/private', (req, res) => {
  try {
    const enabled = !!(req.body && req.body.enabled === true);
    const rec = savePrivate(enabled);
    if (enabled) {
      stopSession();
      clearSession();
      eventsRing.length = 0;
      try {
        const pls = require('./passive_learning_service.cjs');
        if (typeof pls.discard === 'function') pls.discard('private-mode');
        else if (pls.getStatus && pls.getStatus().isActive) pls.stop();
      } catch (e) { /* passive learning not loaded */ }
    }
    logEvent('private.mode', enabled ? 'enabled' : 'disabled');
    return res.json({
      ok: true,
      privateMode: rec.enabled,
      cleared: enabled,
      note: enabled
        ? 'Private mode on. Observation and learning are disabled; transient history was cleared. Saved skills/workflows are untouched.'
        : 'Private mode off. Consent still gates observation.',
    });
  } catch (e) { return fail(res, e); }
});

router.get('/api/awareness/context', async (req, res) => {
  try {
    if (!gate(res)) return;
    const state = await sampleState({ captureSelection: req.query.includeSelection === 'true' });
    logEvent('context.read', state.windows.length + ' windows' + (state.foreground && state.foreground.title ? ', fg=' + state.foreground.title.slice(0, 60) : ''));
    return res.json({
      ok: true,
      level: 1,
      consent: true,
      mode: loadMode(),
      context: {
        windows: state.windows.map((w) => ({ id: w.handle, process: w.processName, title: w.title, className: w.className, state: w.state, monitor: w.monitor, isForeground: w.isForeground, bounds: w.bounds })),
        foreground: state.foreground ? { pid: null, title: state.foreground.title, process: state.foreground.processName, handle: state.foreground.handle, monitor: state.foreground.monitor, bounds: state.foreground.bounds } : null,
        monitors: state.monitors,
        focus: state.focus,
        capturedAt: state.at,
      },
    });
  } catch (e) { return fail(res, e); }
});

router.get('/api/awareness/activity', async (req, res) => {
  try {
    if (!gate(res)) return;
    const state = await sampleState();
    const doc = parseDocument(state);
    return res.json({ ...inferActivity(state, doc), sessionActive: session.active });
  } catch (e) { return fail(res, e); }
});

router.get('/api/awareness/session', (req, res) => {
  try {
    if (!gate(res)) return;
    const limit = Math.max(1, Math.min(OBS_CAP, Number(req.query.limit) || 50));
    const summary = summarizeSession();
    return res.json({
      ...summary,
      observations: session.observations.slice(-limit),
      actions: session.actions.slice(-limit),
      cap: { observations: OBS_CAP, actions: ACTION_CAP },
    });
  } catch (e) { return fail(res, e); }
});

router.post('/api/awareness/session/start', async (req, res) => {
  try {
    if (!gate(res)) return;
    const body = req.body || {};
    const r = await startSession(body.name, body.intervalMs, { captureSelection: body.captureSelection === true });
    return res.status(r.ok ? 200 : 403).json(r);
  } catch (e) { return fail(res, e); }
});

router.post('/api/awareness/session/stop', (req, res) => {
  try {
    // Stop is never gated: emergency stop must work with consent revoked.
    return res.json(stopSession());
  } catch (e) { return fail(res, e); }
});

router.delete('/api/awareness/session', (req, res) => {
  try {
    // Clearing transient history is never gated.
    const had = session.observations.length + session.actions.length;
    clearSession();
    logEvent('session.cleared', had + ' records');
    return res.json({ ok: true, cleared: had, active: session.active });
  } catch (e) { return fail(res, e); }
});

router.post('/api/awareness/observe', async (req, res) => {
  try {
    if (!gate(res)) return;
    const body = req.body || {};
    const state = await sampleState({ captureSelection: body.captureSelection === true });
    const doc = parseDocument(state);
    const obs = await recordObservation(state, 'manual', { captureSelection: body.captureSelection === true });
    return res.json({ ok: true, observation: obs, activity: inferActivity(state, doc) });
  } catch (e) { return fail(res, e); }
});

router.post('/api/awareness/action', (req, res) => {
  try {
    if (!gate(res)) return;
    const e = req.body || {};
    const isPassword = e.isPassword === true
      || /(password|passwd|pin|secret|passcode|token|credential)/i.test(String(e.controlType || ''))
      || /(password|passwd|pin|secret|passcode|token|credential)/i.test(String(e.controlName || ''))
      || /(password|passwd|pin|secret|passcode|token|credential)/i.test(String(e.automationId || ''));
    const action = {
      at: new Date().toISOString(),
      source: e.source === 'myraa' ? 'myraa' : 'user',
      type: String(e.type || 'action').slice(0, 40),
      app: e.app ? String(e.app).slice(0, 120) : ((session.last && session.last.app && session.last.app.processName) || null),
      controlName: e.controlName ? String(e.controlName).slice(0, 160) : null,
      controlType: e.controlType ? String(e.controlType).slice(0, 60) : null,
      automationId: e.automationId ? String(e.automationId).slice(0, 160) : null,
      value: isPassword ? '[REDACTED_PASSWORD]' : (e.value != null ? String(e.value).slice(0, 500) : null),
      hotkey: e.hotkey ? String(e.hotkey).slice(0, 80) : null,
      isPassword,
      redacted: isPassword,
    };
    session.actions.push(action);
    while (session.actions.length > ACTION_CAP) session.actions.shift();
    logEvent('user.action', `${action.source}:${action.type} ${action.controlName || ''}`.slice(0, 160));
    busEmit('desktop.action', { source: action.source, type: action.type, app: action.app, control: action.controlName });
    return res.json({ ok: true, action, totalActions: session.actions.length });
  } catch (e) { return fail(res, e); }
});

router.get('/api/awareness/workflows', (req, res) => {
  try {
    if (!gate(res)) return;
    const candidates = detectWorkflows();
    let recorded = [];
    try {
      const pls = require('./passive_learning_service.cjs');
      recorded = (pls.getSavedWorkflows() || []).map((w) => ({
        id: w.id, name: w.name, targetApp: w.targetApp, stepCount: (w.steps || []).length, createdAt: w.createdAt, finalizedAt: w.finalizedAt,
      }));
    } catch (e) { /* passive learning unavailable */ }
    return res.json({
      ok: true,
      candidates,
      recordedWorkflows: recorded,
      policy: {
        candidatesAreNotSkills: true,
        requiresConfirmation: true,
        minimumOccurrences: 2,
        minimumSteps: 3,
        note: 'Candidates come from repeated real session signatures. Nothing is auto-created.',
      },
    });
  } catch (e) { return fail(res, e); }
});

router.post('/api/awareness/learn/start', async (req, res) => {
  try {
    if (!gate(res)) return;
    const body = req.body || {};
    const name = body.name || 'Learned_Workflow';
    const pls = require('./passive_learning_service.cjs');
    const learning = pls.start(name);
    const recording = await startSession(name, body.intervalMs || 3000, { captureSelection: false });
    return res.json({ ok: true, learning, recording, message: 'Learn-from-me is active. Actions are recorded with password exclusion; session signatures build workflow candidates.' });
  } catch (e) { return fail(res, e); }
});

router.post('/api/awareness/learn/stop', (req, res) => {
  try {
    // Stop is never gated: a recording must always be stoppable.
    let learning = null;
    try { learning = require('./passive_learning_service.cjs').stop(); } catch (e) { learning = { ok: false, error: String((e && e.message) || e) }; }
    const recording = stopSession();
    return res.json({ ok: true, learning, recording, message: 'Learning stopped. Review candidates before creating any skill.' });
  } catch (e) { return fail(res, e); }
});

router.get('/api/awareness/history', (req, res) => {
  try {
    const history = readJson(historyFile(), []);
    return res.json({ ok: true, sessions: Array.isArray(history) ? history : [], cap: SESSION_HISTORY_CAP, privateMode: loadPrivate() });
  } catch (e) { return fail(res, e); }
});

router.get('/api/awareness/events', (req, res) => {
  try {
    return res.json({ ok: true, events: eventsRing.slice().reverse(), count: eventsRing.length, cap: EVENT_CAP });
  } catch (e) { return fail(res, e); }
});

router.delete('/api/awareness/events', (req, res) => {
  try {
    const n = eventsRing.length;
    eventsRing.length = 0;
    return res.json({ ok: true, cleared: n });
  } catch (e) { return fail(res, e); }
});

module.exports = router;
// Exported for tests only. The router is still the module contract.
module.exports.detectWorkflows = detectWorkflows;
module.exports.session = session;
module.exports.parseDocument = parseDocument;
module.exports.inferActivity = inferActivity;
