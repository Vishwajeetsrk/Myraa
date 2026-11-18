'use strict';
/**
 * MYRAA Application Adapter Registry (advanced spec section 6).
 *
 * Detection is ALWAYS from live window metadata (ui_automation_service), never
 * a hardcoded "active" flag. Inspect/read/locate/verify use real UIA data.
 * Methods that need app-specific editing bridges are reported NOT_IMPLEMENTED.
 */
const uia = require('./ui_automation_service.cjs');
const screen = require('./screen_intelligence.cjs');

const STATUS = Object.freeze(['AVAILABLE', 'PARTIAL', 'NOT_IMPLEMENTED', 'UNAVAILABLE', 'NOT_RUNNING', 'FAILED']);

// classMatch is checked first (strong signal); titleMatch disambiguates browsers.
const ADAPTERS = [
  { id: 'excel', name: 'Microsoft Excel', classes: ['XLMAIN'], titles: [/- excel$/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 1, execute: 0 } },
  { id: 'word', name: 'Microsoft Word', classes: ['OpusApp'], titles: [/- word$/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 1, execute: 0 } },
  { id: 'powerpoint', name: 'Microsoft PowerPoint', classes: ['PPTFrameClass'], titles: [/- powerpoint$/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 1, execute: 0 } },
  { id: 'outlook', name: 'Microsoft Outlook', classes: ['rctrl_renwnd32'], titles: [/outlook/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'onenote', name: 'Microsoft OneNote', classes: [], titles: [/onenote/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'vscode', name: 'Visual Studio Code', classes: ['Chrome_WidgetWin_1'], titles: [/visual studio code/i], titleRequired: true, methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'chrome', name: 'Google Chrome', classes: ['Chrome_WidgetWin_1'], titles: [/google chrome/i], titleRequired: true, methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'edge', name: 'Microsoft Edge', classes: ['Chrome_WidgetWin_1'], titles: [/microsoft edge/i], titleRequired: true, methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'firefox', name: 'Mozilla Firefox', classes: ['MozillaWindowClass'], titles: [/firefox/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'explorer', name: 'File Explorer', classes: ['CabinetWClass', 'ExploreWClass'], titles: [], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'notepad', name: 'Notepad', classes: ['Notepad'], titles: [/notepad/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'terminal', name: 'Windows Terminal', classes: ['CASCADIA_HOSTING_WINDOW_CLASS'], titles: [/terminal/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'taskmanager', name: 'Task Manager', classes: ['TaskManagerWindow'], titles: [/task manager/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'photoshop', name: 'Adobe Photoshop', classes: ['Photon'], titles: [/adobe photoshop/i], methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'figma', name: 'Figma', classes: [], titles: [/figma/i], titleRequired: true, methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
  { id: 'canva', name: 'Canva', classes: [], titles: [/canva/i], titleRequired: true, methods: { detect: 1, inspect: 1, read: 1, locate: 1, verify: 1, edit: 0, create: 0, execute: 0 } },
];

function visibleWindows() {
  try {
    const r = uia.listVisibleWindows();
    const windows = r && Array.isArray(r.windows) ? r.windows : (Array.isArray(r) ? r : []);
    return { ok: !r || r.ok !== false, windows };
  } catch (e) { return { ok: false, windows: [], error: e.message }; }
}

function matches(adapter, win) {
  const cls = String(win.className || '');
  const title = String(win.title || '');
  const byTitle = adapter.titles.some((re) => re.test(title));
  // Chromium/Electron share Chrome_WidgetWin_1; className alone cannot identify
  // Chrome vs VS Code vs any Electron app. Those adapters require a title hit.
  if (adapter.titleRequired) {
    return byTitle ? { matched: true, via: 'title', confidence: 0.85 } : { matched: false };
  }
  if (adapter.classes.some((c) => cls.toLowerCase() === c.toLowerCase())) return { matched: true, via: 'className', confidence: 0.9 };
  if (byTitle) return { matched: true, via: 'title', confidence: 0.75 };
  return { matched: false };
}

function list() {
  return {
    ok: true,
    adapters: ADAPTERS.map((a) => ({
      id: a.id,
      name: a.name,
      detection: { classes: a.classes, titlePatterns: a.titles.map(String) },
      methods: Object.fromEntries(Object.entries(a.methods).map(([k, v]) => [k, v ? 'AVAILABLE' : 'NOT_IMPLEMENTED'])),
    })),
    note: 'method availability is declared; detect() still requires a live window to be AVAILABLE',
  };
}

async function detect(opts = {}) {
  const w = visibleWindows();
  if (!w.ok) return { ok: false, code: 'UIA_UNAVAILABLE', error: w.error, status: 'UNAVAILABLE' };
  const detected = [];
  const unmatched = [];
  for (const win of w.windows) {
    const hits = ADAPTERS.map((a) => ({ adapter: a, m: matches(a, win) })).filter((h) => h.m.matched);
    if (!hits.length) {
      if (opts.includeUnmatched) unmatched.push({ title: win.title, className: win.className, handle: win.handle });
      continue;
    }
    // Most specific: className beats title; then first declared adapter.
    hits.sort((x, y) => (y.m.confidence - x.m.confidence));
    const top = hits[0];
    detected.push({
      appId: top.adapter.id,
      appName: top.adapter.name,
      title: win.title,
      className: win.className,
      handle: win.handle,
      confidence: top.m.confidence,
      via: top.m.via,
      alsoMatches: hits.slice(1).map((h) => h.adapter.id),
      status: 'DETECTED',
    });
  }
  const byApp = {};
  for (const d of detected) (byApp[d.appId] ||= []).push(d);
  return {
    ok: true,
    source: 'ui_automation.listVisibleWindows',
    windowCount: w.windows.length,
    detected,
    byApp,
    unmatched,
    installed: ADAPTERS.map((a) => ({ id: a.id, status: byApp[a.id] ? 'DETECTED' : 'NOT_RUNNING' })),
  };
}

function findAdapter(appId) { return ADAPTERS.find((a) => a.id === appId) || null; }
function assertMethod(appId, method) {
  const a = findAdapter(appId);
  if (!a) return { ok: false, code: 'ADAPTER_NOT_FOUND' };
  if (!a.methods[method]) return { ok: false, code: 'NOT_IMPLEMENTED', reason: a.name + ' ' + method + ' requires an app-specific bridge that is not implemented' };
  return { ok: true, adapter: a };
}

async function resolveWindow(input) {
  const i = input || {};
  if (i.windowTitle) return { ok: true, title: i.windowTitle };
  if (i.appId) {
    const d = await detect();
    const hit = d.detected && d.detected.find((x) => x.appId === i.appId);
    if (!hit) return { ok: false, code: 'APP_NOT_RUNNING', reason: i.appId + ' has no visible window' };
    return { ok: true, title: hit.title, win: hit };
  }
  return { ok: false, code: 'WINDOW_REQUIRED', reason: 'provide appId or windowTitle' };
}

async function inspect(input) {
  const chk = assertMethod((input || {}).appId, 'inspect');
  if (!chk.ok) return chk;
  const w = await resolveWindow(input);
  if (!w.ok) return w;
  const max = Math.min(300, Math.max(1, Number((input || {}).maxElements) || 120));
  let r = await uia.getAppControlMap(w.title, max);
  // UIA/PowerShell can fail transiently under load; bounded retries with backoff.
  for (let attempt = 0; (!r || r.ok === false) && attempt < 2; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    r = await uia.getAppControlMap(w.title, max);
  }
  return { ok: !!r && r.ok !== false, appId: input.appId, ...(r || {}) };
}

async function read(input) {
  const i = await inspect(input);
  if (!i.ok) return i;
  const controls = (i.controls || []).filter((c) => c.name && String(c.name).trim()).map((c) => ({
    name: c.name, controlType: c.controlType, automationId: c.automationId, className: c.className, enabled: c.isEnabled,
  }));
  return { ok: true, appId: i.appId, target: i.target, totalControls: i.totalControls, namedControls: controls.length, controls: controls.slice(0, 200) };
}

async function locate(input) {
  const chk = assertMethod((input || {}).appId, 'locate');
  if (!chk.ok) return chk;
  const w = await resolveWindow(input);
  if (!w.ok) return w;
  const cap = await screen.captureContext({ titleHint: w.title });
  if (!cap.ok) return cap;
  const ctx = cap.context;
  const target = screen.resolveTarget({ query: (input || {}).query || (input || {}).text, uiTree: ctx.uiTree || [] });
  return { ok: !!target.ok, appId: input.appId, window: w.title, ...target, consent: ctx.consent !== undefined ? ctx.consent : (require('./screen_intelligence.cjs').status().consent) };
}

function verify(input) {
  const i = input || {};
  const before = Array.isArray(i.before) ? i.before : (i.before && i.before.controls) || [];
  const after = Array.isArray(i.after) ? i.after : (i.after && i.after.controls) || [];
  const key = (c) => String(c.name || '') + '|' + String(c.controlType || '') + '|' + String(c.automationId || '');
  const b = new Set(before.map(key));
  const a = new Set(after.map(key));
  const added = [...a].filter((k) => !b.has(k));
  const removed = [...b].filter((k) => !a.has(k));
  const changed = (i.after && i.after.totalControls) != null && (i.before && i.before.totalControls) != null
    ? Number(i.after.totalControls) !== Number(i.before.totalControls) : false;
  return {
    ok: true,
    verdict: changed || added.length || removed.length ? 'CHANGED' : 'UNCHANGED',
    beforeCount: before.length,
    afterCount: after.length,
    added,
    removed,
    method: 'UIA control-map diff (real before/after snapshots)',
    note: 'pass real control maps from inspect(); this function never fabricates a change',
  };
}

async function status() {
  const w = visibleWindows();
  let d = { detected: [] };
  try { d = await detect(); } catch (e) { /* best effort */ }
  return {
    ok: w.ok,
    status: w.ok ? 'AVAILABLE' : 'UNAVAILABLE',
    adapters: ADAPTERS.length,
    detectedApps: (d.detected || []).length,
    windowCount: w.windowCount != null ? w.windowCount : w.windows.length,
    uiaSource: 'ui_automation_service.cjs',
    honestMethods: { detect: 'live windows', inspect: 'real UIA control map', read: 'real UIA names', locate: 'UIA semantic target', verify: 'real before/after diff', edit: 'NOT_IMPLEMENTED', execute: 'NOT_IMPLEMENTED' },
    note: 'no adapter is marked active without a real detected window',
  };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/status', async (req, res) => res.json(await status()));
  router.get('/catalog', (req, res) => res.json(list()));
  router.get('/detect', async (req, res) => res.json(await detect({ includeUnmatched: req.query.includeUnmatched === 'true' })));
  router.post('/inspect', async (req, res) => res.json(await inspect(req.body || {})));
  router.post('/read', async (req, res) => res.json(await read(req.body || {})));
  router.post('/locate', async (req, res) => res.json(await locate(req.body || {})));
  router.post('/verify', (req, res) => res.json(verify(req.body || {})));
  return router;
}

module.exports = { STATUS, ADAPTERS, list, detect, inspect, read, locate, verify, status, createRouter, matches };
