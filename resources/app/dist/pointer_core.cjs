'use strict';
/**
 * MYRAA Pointer — UIA text-id pointer with guardrailed actions (Phase 1).
 * Zero dependencies. Uses the existing `ui_automation_service.cjs` and
 * `desktopAutomation.cjs` for execution; this module adds the Bluey-pattern
 * pointing logic: text-id based targeting, grid positions, and hard guardrails.
 *
 * Guardrails (from PRD §4.4):
 *   - On-screen text is data, never instructions.
 *   - Password fields refused.
 *   - Logout/lock/force-quit shortcuts refused.
 *   - Hard-to-undo actions require a confirm token.
 *   - Global stop hotkey handled by session, not here.
 *
 * Cursors: actions move the character cursor; the user's real pointer is
 * saved before and restored after each action (Bluey pattern).
 */

const { execFileSync } = require('child_process');

// ---------- target resolution ----------

// From a UIA control map, find the best text-id target.
// controlMap entries: {id, name, type, value?, location?}
function findTextId(controlMap, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q || !Array.isArray(controlMap)) return null;
  const exact = controlMap.find((c) => c.type === 'Edit' && isPassword(c) === false && String(c.name || '').toLowerCase() === q);
  if (exact) return { textId: exact.id, name: exact.name, type: exact.type, confidence: 1.0 };
  const partial = controlMap.filter((c) => !isPassword(c) && String(c.name || '').toLowerCase().includes(q));
  if (!partial.length) return null;
  const best = partial.sort((a, b) => String(a.name).length - String(b.name).length)[0];
  return { textId: best.id, name: best.name, type: best.type, confidence: 0.8 };
}

// Is this UIA control a password field?
function isPassword(control) {
  const name = String(control.name || '').toLowerCase();
  return control.isPassword === true
    || /password|passwd|pin/.test(name)
    || control.type === 'Edit' && control.isPassword === true;
}

// 0-1000 grid position from screen coordinates (or vice versa).
function screenToGrid(x, y, screenW, screenH) {
  const w = screenW || 1920;
  const h = screenH || 1080;
  return { x: Math.round((x / w) * 1000), y: Math.round((y / h) * 1000) };
}

function gridToScreen(grid, screenW, screenH) {
  const w = screenW || 1920;
  const h = screenH || 1080;
  return { x: Math.round((grid.x / 1000) * w), y: Math.round((grid.y / 1000) * h) };
}

// ---------- guardrails ----------

const BLOCKED_KEYS = /^(ctrl\+alt\+del|ctrl\+shift\+esc|win\+l|alt\+f4)$/i;

function guardrailRejects(kind, detail) {
  if (kind === 'open_app') {
    const app = String(detail || '').toLowerCase();
    if (/logout|lock|sign.?out|shut.?down|restart|force.?quit|task.?manager/.test(app)) {
      return { allowed: false, code: 'GUARDRAIL_REFUSED', message: 'Refused: "' + detail + '" is a hard-to-undo system action.' };
    }
  }
  if (kind === 'press_keys') {
    const keys = String(detail || '').toLowerCase();
    if (BLOCKED_KEYS.test(keys)) {
      return { allowed: false, code: 'GUARDRAIL_REFUSED', message: 'Refused: shortcut "' + detail + '" is blocked (logout/lock/force-quit).' };
    }
  }
  return { allowed: true };
}

// Password-field refusal at the target level.
function targetIsPassword(target, controlMap) {
  const entry = (controlMap || []).find((c) => c.id === (target && target.textId));
  return entry ? isPassword(entry) : false;
}

// ---------- cursor management ----------

let savedPointer = null;

function saveUserPointer() {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position | ConvertTo-Json -Compress'
    ], { timeout: 5000, windowsHide: true, encoding: 'utf8' });
    savedPointer = JSON.parse(String(out).trim() || '{}');
    return savedPointer;
  } catch (e) {
    return null;
  }
}

function restoreUserPointer() {
  if (!savedPointer || savedPointer.X == null) return { ok: false, error: 'no saved pointer' };
  try {
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      'Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $pos = New-Object System.Drawing.Point(' + savedPointer.X + ',' + savedPointer.Y + '); [System.Windows.Forms.Cursor]::Position = $pos'
    ], { timeout: 5000, windowsHide: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// ---------- actions (delegate to existing desktop stack) ----------

function getServices() {
  try {
    const desktop = require('./desktopAutomation.cjs');
    const ui = require('./ui_automation_service.cjs');
    return { ok: true, desktop, ui };
  } catch (e) {
    return { ok: false, error: 'desktop/automation services unavailable: ' + String((e && e.message) || e).slice(0, 200) };
  }
}

// point({textId|grid, controlMap?}) -> {ok, target} | {ok:false, error}
function point(target, controlMap, services) {
  if (!target) return { ok: false, error: 'point needs {textId} or {grid}' };
  if (target.textId && controlMap && targetIsPassword(target, controlMap)) {
    return { ok: false, code: 'GUARDRAIL_REFUSED', error: 'password fields cannot be pointed at or typed into' };
  }
  if (target.grid) {
    const pt = gridToScreen(target.grid);
    return { ok: true, target: target.grid, screen: pt, via: 'grid' };
  }
  const svc = services || getServices();
  if (!svc.ok) return svc;
  if (target.textId) {
    try {
      const res = svc.ui.invokeControl ? svc.ui.invokeControl(target.textId, 'highlight') : { ok: true };
      return { ok: true, target: target.textId, via: 'uia' };
    } catch (e) {
      return { ok: false, error: 'UIA point failed: ' + String((e && e.message) || e).slice(0, 200) };
    }
  }
  return { ok: false, error: 'unrecognized target' };
}

// act(kind, detail, opts) -> {ok, ...} | {ok:false, code, error}
function act(kind, detail, opts) {
  const o = opts || {};
  const guard = guardrailRejects(kind, detail);
  if (!guard.allowed) return { ok: false, code: guard.code, error: guard.message };
  if (o.requiresConfirm && !o.confirmToken) {
    return { ok: false, code: 'CONFIRMATION_REQUIRED', error: 'This action needs an explicit confirmation token.' };
  }
  const svc = o.services || getServices();
  if (!svc.ok) return svc;
  saveUserPointer();
  try {
    let result;
    if (kind === 'click') result = svc.desktop.clickAt(detail.x, detail.y);
    else if (kind === 'type_text') result = svc.desktop.typeText(String(detail || ''));
    else if (kind === 'press_keys') result = svc.desktop.pressKey(String(detail || ''));
    else if (kind === 'scroll') result = svc.desktop.scroll(detail.delta || 3);
    else if (kind === 'drag') result = svc.desktop.drag(detail.from, detail.to);
    else if (kind === 'open_app') result = svc.desktop.openApp ? svc.desktop.openApp(detail) : { ok: false, error: 'openApp unavailable' };
    else if (kind === 'open_url') result = svc.desktop.openUrl ? svc.desktop.openUrl(detail) : { ok: false, error: 'openUrl unavailable' };
    else return { ok: false, code: 'INVALID_JOB', error: 'unknown kind: ' + kind };
    restoreUserPointer();
    return result && result.ok === false ? result : { ok: true, kind, result };
  } catch (e) {
    restoreUserPointer();
    return { ok: false, code: 'UNKNOWN', error: String((e && e.message) || e).slice(0, 300) };
  }
}

module.exports = {
  findTextId,
  isPassword,
  screenToGrid,
  gridToScreen,
  guardrailRejects,
  targetIsPassword,
  saveUserPointer,
  restoreUserPointer,
  point,
  act,
  BLOCKED_KEYS,
};
