'use strict';
/**
 * Screen Intelligence (spec phases 2-4, 6): one normalized observation over
 * EXISTING capture/OCR/UIA services. No new capture engine, no fake controls.
 * Sensitive data is never sent anywhere by this module.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const uia = require('./ui_automation_service.cjs');
const ocr = require('./ocr_engine.cjs');
const desktop = require('./desktopAutomation.cjs');
const registry = require('./agi/capability_registry.cjs');

function settingsDir() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(process.env.MYRAA_DATA_DIR || appData, 'MYRAA', 'settings');
}
function consentEnabled() {
  try {
    const p = path.join(settingsDir(), 'screen_awareness_consent.json');
    if (fs.existsSync(p)) {
      const v = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (typeof v.enabled === 'boolean') return v.enabled;
    }
  } catch (e) {}
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.MYRAA_ENABLE_SCREEN_AWARENESS || '').toLowerCase());
}
function safe(label, fn) {
  try {
    const value = fn();
    return Promise.resolve(value).then(
      (v) => ({ ok: true, label, value: v }),
      (e) => ({ ok: false, label, error: String(e && e.message).slice(0, 300) }),
    );
  } catch (e) { return Promise.resolve({ ok: false, label, error: String(e && e.message).slice(0, 300) }); }
}

function observation() {
  return {
    timestamp: new Date().toISOString(),
    activeWindow: { hwnd: null, title: null, process: null, executable: null, application: null, method: null },
    displays: [],
    screenshot: null,
    ocr: [],
    uiTree: [],
    focusedElement: null,
    selectedText: null,
    cursor: null,
    detectedObjects: [],
    detectedText: [],
    detectedControls: [],
    applicationContext: null,
    documentContext: null,
    browserContext: null,
    confidence: 0,
    sources: {},
  };
}

async function captureContext(opts) {
  const o = opts || {};
  const ctx = observation();
  if (!consentEnabled() && o.enforceConsent !== false) {
    return { ok: false, code: 'NEEDS_PERMISSION', error: 'screen-awareness consent is not enabled', context: ctx };
  }

  const [windows, foreground, focus, shot, ocrStatus] = await Promise.all([
    safe('windows', () => (typeof uia.listVisibleWindows === 'function' ? uia.listVisibleWindows() : null)),
    safe('foreground', () => (typeof uia.getForegroundWindow === 'function' ? uia.getForegroundWindow() : null)),
    safe('focus', () => (typeof uia.getFocusedElement === 'function' ? uia.getFocusedElement() : null)),
    safe('screenshot', () => (typeof desktop.takeScreenshot === 'function' ? desktop.takeScreenshot() : null)),
    Promise.resolve(safe('ocr', () => ocr.status())),
  ]);

  const windowList = Array.isArray(windows.value) ? windows.value : (windows.value && Array.isArray(windows.value.windows) ? windows.value.windows : []);
  ctx.sources.windows = { status: windows.ok && windowList.length ? registry.STATUS.READY : registry.STATUS.UNAVAILABLE, detail: windows.error || (windowList.length + ' windows') };
  ctx.sources.uia = { status: uiaStatus.ok ? registry.STATUS.READY : registry.STATUS.ERROR, detail: uiaStatus.error || 'UIA service available' };
  ctx.sources.screenshot = { status: shot.ok && shot.value && shot.value.image ? registry.STATUS.READY : registry.STATUS.UNAVAILABLE, detail: shot.error || 'no image bytes returned by capture layer' };
  ctx.sources.ocr = { status: ocrStatus.ok && ocrStatus.value && ocrStatus.value.installed ? registry.STATUS.READY : registry.STATUS.UNAVAILABLE, detail: ocrStatus.error || (ocrStatus.value && ocrStatus.value.detail) || 'unknown' };

  const fgWin = foreground && foreground.ok && foreground.value && foreground.value.window ? foreground.value.window : null;
  const list = windowList;
  if (fgWin) {
    ctx.activeWindow = {
      hwnd: fgWin.handle || null,
      title: fgWin.title || null,
      process: fgWin.processName || null,
      executable: null,
      application: null,
      state: fgWin.state || null,
      monitor: fgWin.monitor || null,
      bounds: fgWin.bounds || null,
      method: 'uia.getForegroundWindow (real foreground)',
    };
  } else if (list.length) {
    const first = list[0] || {};
    ctx.activeWindow = {
      hwnd: first.hwnd || first.handle || null,
      title: first.title || first.name || null,
      process: first.process || first.processName || null,
      executable: first.executable || null,
      application: first.application || null,
      method: 'uia.listVisibleWindows (first entry; foreground approximation)',
    };
  }

  const focusEl = focus && focus.ok && focus.value && focus.value.element ? focus.value.element : null;
  if (focusEl) {
    ctx.focusedElement = {
      name: focusEl.name || null,
      controlType: focusEl.controlType || null,
      automationId: focusEl.automationId || null,
      windowTitle: focusEl.windowTitle || null,
      isPassword: focusEl.isPassword === true,
      bounds: focusEl.rect || null,
    };
    ctx.selectedText = focusEl.isPassword ? null : (focusEl.selectedText || null);
  }

  if (ctx.activeWindow.title && typeof uia.getAppControlMap === 'function') {
    const controls = await safe('controlMap', () => uia.getAppControlMap(ctx.activeWindow.title, 300));
    ctx.sources.uia = {
      status: controls.ok && controls.value && controls.value.ok !== false ? registry.STATUS.READY : registry.STATUS.DEGRADED,
      detail: controls.error || (controls.value && controls.value.error) || 'control map requested',
    };
    const rows = (controls.value && (controls.value.controls || controls.value.elements || controls.value.data)) || [];
    if (Array.isArray(rows)) {
      ctx.uiTree = rows.slice(0, 300).map((r) => ({
        name: r.name || r.Name || null,
        automationId: r.automationId || r.AutomationId || null,
        controlType: r.controlType || r.ControlType || null,
        bounds: r.bounds || r.BoundingRectangle || r.rect || null,
        enabled: r.isEnabled !== false,
      }));
      ctx.detectedControls = ctx.uiTree.slice();
    }
  }

  if (o.ocr === true && shot.value && shot.value.image && ocrStatus.value && ocrStatus.value.installed) {
    const recognition = await safe('recognize', () => ocr.recognize(shot.value.image));
    ctx.sources.ocr.detail = recognition.error || 'OCR requested and executed';
    if (recognition.ok && recognition.value) {
      ctx.ocr = Array.isArray(recognition.value) ? recognition.value : (recognition.value.regions || []);
      ctx.detectedText = ctx.ocr.slice();
    }
  }

  // Confidence reflects only real sources present in this observation.
  const present = [ctx.activeWindow.title && 'window', ctx.uiTree.length && 'uia', ctx.ocr.length && 'ocr', ctx.screenshot && 'screenshot'].filter(Boolean);
  ctx.confidence = present.length === 0 ? 0 : Math.min(0.95, 0.35 + present.length * 0.2);
  return { ok: true, context: ctx };
}

function resolveTarget(input) {
  const i = input || {};
  const q = String(i.text || i.query || '').trim().toLowerCase();
  if (!q && !i.controlType && i.x == null) return { ok: false, code: 'VALIDATION', error: 'a text/query or coordinates are required' };
  const controls = Array.isArray(i.uiTree) ? i.uiTree : [];
  const exact = controls.find((c) => String(c.name || '').toLowerCase() === q);
  const partial = controls.find((c) => String(c.name || '').toLowerCase().includes(q) || String(c.automationId || '').toLowerCase().includes(q));
  const byType = !q && i.controlType ? controls.find((c) => String(c.controlType || '').toLowerCase() === String(i.controlType).toLowerCase()) : null;
  const found = exact || partial || byType;
  if (found) {
    return { ok: true, method: 'uia', target: found, confidence: exact ? 0.95 : partial ? 0.8 : 0.6, note: 'semantic control match from UIA' };
  }
  if (i.x != null && i.y != null) {
    return { ok: true, method: 'coordinate', target: { x: Number(i.x), y: Number(i.y) }, confidence: 0.4, note: 'coordinate fallback - no semantic match found' };
  }
  return { ok: false, code: 'NOT_FOUND', error: 'no semantic target matched; provide coordinates or a clearer label' };
}

// -------------------------------------------------- Screen Intelligence Engine (v9.8 Phase B)
const CATEGORY_RULES = [
  { category: 'button', types: ['Button', 'SplitButton', 'DropDownButton'] },
  { category: 'menu', types: ['MenuItem', 'MenuBar', 'Menu', 'ContextMenu'] },
  { category: 'form', types: ['Edit', 'ComboBox', 'CheckBox', 'RadioButton', 'List', 'ListItem'] },
  { category: 'table', types: ['DataGrid', 'DataItem', 'Table', 'TableItem', 'Cell'] },
  { category: 'text', types: ['Text', 'Hyperlink', 'Heading', 'Document'] },
  { category: 'image', types: ['Image', 'Graphic'] },
  { category: 'toolbar', types: ['ToolBar', 'StatusBar'] },
  { category: 'tab', types: ['Tab', 'TabItem'] },
  { category: 'dialog', types: ['Window', 'Pane', 'Group'] },
];
const INTERACTIVE = new Set(['button', 'menu', 'form', 'tab']);

function classifyElement(e) {
  const t = String(e.controlType || '').toLowerCase();
  const rule = CATEGORY_RULES.find((r) => r.types.some((x) => x.toLowerCase() === t));
  const category = rule ? rule.category : 'other';
  return {
    ...e,
    category,
    hasName: !!String(e.name || '').trim(),
    enabled: e.enabled !== false,
    interactive: INTERACTIVE.has(category),
  };
}

function buildSemanticTree(ctx) {
  const window = ctx.activeWindow || {};
  const elements = (ctx.uiTree || []).map(classifyElement);
  const byCategory = {};
  for (const e of elements) (byCategory[e.category] ||= []).push(e);
  const node = {
    type: 'Desktop',
    windows: [{
      title: window.title || null,
      process: window.process || null,
      hwnd: window.hwnd || null,
      application: window.application || null,
      method: window.method || 'uia.listVisibleWindows',
      children: [
        { type: 'Application', name: window.title || '(unnamed)', controls: elements },
      ],
    }],
  };
  return {
    ok: true,
    tree: node,
    elementCount: elements.length,
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v.length])),
    note: 'flat UIA control map grouped by real window metadata; deep visual hierarchy needs a vision model (NOT_IMPLEMENTED)',
  };
}

function rectOf(e) {
  const b = e.bounds || e.rect;
  if (!b || typeof b !== 'object') return null;
  const x = Number(b.x), y = Number(b.y), w = Number(b.width), h = Number(b.height);
  return [x, y, w, h].every(Number.isFinite) ? { x, y, w, h } : null;
}
function overlapArea(a, b) {
  const aw = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const ah = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return aw > 0 && ah > 0 ? aw * ah : 0;
}

function detectLayoutIssues(ctx) {
  const elements = (ctx.uiTree || []).map(classifyElement);
  const issues = [];
  for (const e of elements) {
    if (e.interactive && !e.hasName) {
      issues.push({ severity: 'MEDIUM', kind: 'unnamed-interactive-control', evidence: { controlType: e.controlType, automationId: e.automationId } });
    }
    const r = rectOf(e);
    if (r && (r.w > 0 && r.w < 16 || r.h > 0 && r.h < 16)) {
      issues.push({ severity: 'LOW', kind: 'tiny-control', evidence: { name: e.name, rect: r } });
    }
    if (r && (r.x < 0 || r.y < 0)) {
      issues.push({ severity: 'LOW', kind: 'offscreen-control', evidence: { name: e.name, rect: r } });
    }
  }
  const named = elements.filter((e) => e.interactive && e.hasName);
  const counts = {};
  for (const e of named) counts[String(e.name).toLowerCase()] = (counts[String(e.name).toLowerCase()] || 0) + 1;
  for (const [name, count] of Object.entries(counts)) {
    if (count > 1) issues.push({ severity: 'LOW', kind: 'duplicate-interactive-name', evidence: { name, count } });
  }
  const rects = elements.map((e) => ({ e, r: rectOf(e) })).filter((x) => x.r && x.r.w > 0 && x.r.h > 0);
  for (let i = 0; i < rects.length && issues.length < 60; i++) {
    for (let j = i + 1; j < rects.length && issues.length < 60; j++) {
      if (!rects[i].e.interactive || !rects[j].e.interactive) continue;
      const area = overlapArea(rects[i].r, rects[j].r);
      const smaller = Math.min(rects[i].r.w * rects[i].r.h, rects[j].r.w * rects[j].r.h);
      if (smaller > 0 && area / smaller > 0.6) {
        issues.push({ severity: 'MEDIUM', kind: 'overlapping-interactive-controls', evidence: { a: rects[i].e.name, b: rects[j].e.name, overlapRatio: Number((area / smaller).toFixed(2)) } });
      }
    }
  }
  return {
    ok: true,
    issueCount: issues.length,
    issues: issues.slice(0, 60),
    source: 'real UIA control metadata (names, types, bounds)',
    limitations: ['color contrast requires pixel/vision analysis - NOT_IMPLEMENTED', 'typography and visual hierarchy require rendered pixels - NOT_IMPLEMENTED'],
  };
}

async function analyzeScreen(opts = {}) {
  const cap = await captureContext(opts);
  if (!cap.ok) return cap;
  const ctx = cap.context;
  const tree = buildSemanticTree(ctx);
  const layout = detectLayoutIssues(ctx);
  let apps = { ok: false, detected: [] };
  try { apps = await require('./application_adapters.cjs').detect(); } catch (e) { /* best effort */ }
  const elements = (ctx.uiTree || []).map(classifyElement);
  const recommendations = layout.issues.slice(0, 8).map((i) => ({
    issue: i.kind,
    recommendation: i.kind === 'unnamed-interactive-control'
      ? 'assign an accessible name to the control'
      : i.kind === 'overlapping-interactive-controls'
        ? 'adjust layout so interactive targets do not overlap'
        : i.kind === 'duplicate-interactive-name'
          ? 'make control labels unique for accessibility'
          : 'review the control bounds',
  }));
  let possibleActions = [];
  try {
    const ar = require('./action_registry.cjs');
    const preview = typeof ar.preview === 'function' ? ar.preview({ context: ctx }) : null;
    possibleActions = (preview && preview.actions) || [];
  } catch (e) { /* action registry preview not available */ }
  return {
    ok: true,
    application: ctx.activeWindow && ctx.activeWindow.application || null,
    window: ctx.activeWindow && ctx.activeWindow.title || null,
    elements: elements.slice(0, 200),
    text: (ctx.detectedText || ctx.ocr || []).slice(0, 200),
    images: elements.filter((e) => e.category === 'image').slice(0, 50),
    tables: elements.filter((e) => e.category === 'table').slice(0, 50),
    layout: { issues: layout.issues, issueCount: layout.issueCount, tree: tree.byCategory },
    issues: layout.issues,
    recommendations,
    possibleActions,
    detectedApplications: apps.detected || [],
    confidence: ctx.confidence,
    sources: ctx.sources,
    limitations: [
      ...layout.limitations,
      'vision model semantic understanding NOT_IMPLEMENTED',
      'document structure (headings/paragraphs inside the document) requires application API - NOT_IMPLEMENTED',
    ],
    note: 'all elements come from real UIA/OCR/window data; nothing is inferred from a screenshot alone',
  };
}

function diffScreens(before, after) {
  const flatten = (x) => {
    const arr = Array.isArray(x) ? x : ((x && x.elements) || (x && x.context && x.context.uiTree) || []);
    return arr.map(classifyElement);
  };
  const b = flatten(before), a = flatten(after);
  const key = (e) => String(e.name || '') + '|' + String(e.controlType || '') + '|' + String(e.automationId || '');
  const bm = new Map(b.map((e) => [key(e), e])), am = new Map(a.map((e) => [key(e), e]));
  const added = [...am.keys()].filter((k) => !bm.has(k)).map((k) => am.get(k));
  const removed = [...bm.keys()].filter((k) => !am.has(k)).map((k) => bm.get(k));
  const changed = [...am.keys()].filter((k) => bm.has(k) && JSON.stringify(bm.get(k).bounds) !== JSON.stringify(am.get(k).bounds)).map((k) => ({ before: bm.get(k), after: am.get(k) }));
  return {
    ok: true,
    beforeCount: b.length,
    afterCount: a.length,
    added,
    removed,
    changed,
    verdict: added.length || removed.length || changed.length ? 'CHANGED' : 'UNCHANGED',
    method: 'real UIA element identity + bounds comparison',
  };
}

function planScreenAction(input) {
  const i = input || {};
  if (!i.intent || !i.target) return { ok: false, code: 'VALIDATION', error: 'intent and target are required' };
  const editIntent = /\b(bold|italic|color|font|change|edit|delete|replace|format|move|resize|click|type|submit|send)\b/i.test(String(i.intent));
  return {
    ok: true,
    action: i.intent,
    target: i.target,
    reason: 'planned from a real semantic target; not executed by this endpoint',
    risk: editIntent ? 'MEDIUM' : 'LOW',
    requiresApproval: editIntent,
    rollbackAvailable: false,
    verification: 're-observe with /api/screen/verify and compare before/after element state',
    note: 'this endpoint only plans; execution goes through the action registry + approval manager',
  };
}

function verifyScreenAction(input) {
  const i = input || {};
  const d = diffScreens(i.before, i.after);
  if (!d.ok) return d;
  const exp = i.expectation || {};
  let passed = false;
  const after = Array.isArray(i.after) ? i.after : ((i.after && i.after.elements) || []);
  if (exp.type === 'exists') passed = after.some((e) => String(e.name || '').toLowerCase().includes(String(exp.name || '').toLowerCase()));
  else if (exp.type === 'count') {
    const n = after.length;
    passed = exp.op === '>' ? n > Number(exp.value) : exp.op === '<' ? n < Number(exp.value) : n === Number(exp.value);
  } else passed = d.verdict === 'CHANGED';
  return {
    ok: true,
    passed,
    expected: exp,
    actual: { verdict: d.verdict, added: d.added.length, removed: d.removed.length, changed: d.changed.length },
    evidence: d,
    note: 'verdict from real before/after observations; no assumption of success',
  };
}

/**
 * Unified desktop metadata snapshot (L0/L1). Composes the existing window,
 * monitor, foreground and focus primitives. No screenshots, no OCR, no model
 * calls. Selection text is withheld unless includeSelection is explicitly set.
 */
async function desktopState(opts = {}) {
  const [fg, monitors, focus] = await Promise.all([
    typeof uia.getForegroundWindow === 'function' ? uia.getForegroundWindow() : Promise.resolve({ ok: false, window: null }),
    typeof uia.getMonitors === 'function' ? uia.getMonitors() : Promise.resolve({ ok: false, monitors: [] }),
    typeof uia.getFocusedElement === 'function' ? uia.getFocusedElement() : Promise.resolve({ ok: false, element: null }),
  ]);

  const listed = typeof uia.listVisibleWindows === 'function' ? uia.listVisibleWindows() : { windows: [] };
  const windows = (listed && listed.windows) || [];
  const applications = {};
  for (const w of windows) {
    const key = String(w.processName || 'unknown').toLowerCase();
    applications[key] = (applications[key] || 0) + 1;
  }

  const focusEl = focus && focus.ok && focus.element ? focus.element : null;
  const safeFocus = focusEl ? {
    name: focusEl.name || null,
    controlType: focusEl.controlType || null,
    automationId: focusEl.automationId || null,
    windowTitle: focusEl.windowTitle || null,
    isPassword: focusEl.isPassword === true,
    hasSelection: focusEl.hasSelection === true,
    bounds: focusEl.rect || null,
    selectedText: opts.includeSelection === true && focusEl.isPassword !== true ? (focusEl.selectedText || null) : null,
    selectionWithheld: focusEl.hasSelection === true && opts.includeSelection !== true,
  } : null;

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    consent: consentEnabled(),
    foreground: (fg && fg.ok && fg.window) || null,
    monitors: (monitors && monitors.monitors) || [],
    focus: safeFocus,
    windows,
    counts: {
      windows: windows.length,
      monitors: ((monitors && monitors.monitors) || []).length,
      applications: Object.keys(applications).length,
    },
    applications,
    levels: {
      L0_window: 'AVAILABLE',
      L1_ui: 'AVAILABLE_ON_DEMAND',
      L2_content: 'AVAILABLE_ON_DEMAND',
      L3_task: 'PARTIAL',
      L4_workflow: 'PARTIAL',
      L5_intent: 'NOT_IMPLEMENTED',
    },
    method: 'uia foreground + monitors + visible windows + focused element',
    limitations: [
      'desktopState never captures pixels; use /api/screen/context for a consent-gated observation',
      'L3/L4 come from live_awareness + passive_learning, not from this snapshot',
      'L5 intent inference is NOT_IMPLEMENTED',
    ],
  };
}

function status() {
  return { ok: true, consent: consentEnabled(), sources: ['screenshot', 'ocr', 'uia', 'window'], engine: 'screen-intelligence-v2', capabilities: ['analyze', 'elements', 'diff', 'action-plan', 'verify'], note: 'consent gates observation; no data leaves this process from this module' };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/status', (req, res) => res.json(status()));
  router.get('/desktop-state', async (req, res) => res.json(await desktopState({ includeSelection: req.query.includeSelection === 'true' })));
  router.get('/context', async (req, res) => res.json(await captureContext(req.query)));
  router.post('/observe', async (req, res) => res.json(await captureContext(req.body || {})));
  router.post('/resolve-target', (req, res) => res.json(resolveTarget(req.body || {})));
  router.post('/analyze', async (req, res) => res.json(await analyzeScreen(req.body || {})));
  router.post('/elements', async (req, res) => {
    const cap = await captureContext(req.body || {});
    if (!cap.ok) return res.json(cap);
    const tree = buildSemanticTree(cap.context);
    res.json({ ok: true, elements: (cap.context.uiTree || []).map(classifyElement), tree: tree.tree, byCategory: tree.byCategory });
  });
  router.post('/diff', (req, res) => res.json(diffScreens((req.body || {}).before, (req.body || {}).after)));
  router.post('/inspect', async (req, res) => res.json(await analyzeScreen(req.body || {})));
  router.post('/action-plan', (req, res) => res.json(planScreenAction(req.body || {})));
  router.post('/verify', (req, res) => res.json(verifyScreenAction(req.body || {})));
  return router;
}

module.exports = {
  captureContext, resolveTarget, status, createRouter,
  classifyElement, buildSemanticTree, detectLayoutIssues, analyzeScreen,
  diffScreens, planScreenAction, verifyScreenAction, desktopState,
};
