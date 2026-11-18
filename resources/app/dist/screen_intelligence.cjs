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

  const [windows, uiaStatus, shot, ocrStatus] = await Promise.all([
    safe('windows', () => (typeof uia.listVisibleWindows === 'function' ? uia.listVisibleWindows() : null)),
    safe('uia', () => null),
    safe('screenshot', () => (typeof desktop.takeScreenshot === 'function' ? desktop.takeScreenshot() : null)),
    Promise.resolve(safe('ocr', () => ocr.status())),
  ]);

  ctx.sources.windows = { status: windows.ok && windows.value ? registry.STATUS.READY : registry.STATUS.UNAVAILABLE, detail: windows.error || (Array.isArray(windows.value) ? windows.value.length + ' windows' : 'no data') };
  ctx.sources.uia = { status: uiaStatus.ok ? registry.STATUS.READY : registry.STATUS.ERROR, detail: uiaStatus.error || 'UIA service available' };
  ctx.sources.screenshot = { status: shot.ok && shot.value && shot.value.image ? registry.STATUS.READY : registry.STATUS.UNAVAILABLE, detail: shot.error || 'no image bytes returned by capture layer' };
  ctx.sources.ocr = { status: ocrStatus.ok && ocrStatus.value && ocrStatus.value.installed ? registry.STATUS.READY : registry.STATUS.UNAVAILABLE, detail: ocrStatus.error || (ocrStatus.value && ocrStatus.value.detail) || 'unknown' };

  const list = Array.isArray(windows.value) ? windows.value : [];
  if (list.length) {
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
        bounds: r.bounds || r.BoundingRectangle || null,
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

function status() {
  return { ok: true, consent: consentEnabled(), sources: ['screenshot', 'ocr', 'uia', 'window'], note: 'consent gates observation; no data leaves this process from this module' };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/status', (req, res) => res.json(status()));
  router.get('/context', async (req, res) => res.json(await captureContext(req.query)));
  router.post('/observe', async (req, res) => res.json(await captureContext(req.body || {})));
  router.post('/resolve-target', (req, res) => res.json(resolveTarget(req.body || {})));
  return router;
}

module.exports = { captureContext, resolveTarget, status, createRouter };
