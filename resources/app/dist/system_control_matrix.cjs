'use strict';
/**
 * MYRAA System Control Matrix
 * =============================================================================
 * ONE honest interface for Windows system controls. It orchestrates EXISTING
 * helpers in desktopAutomation.cjs instead of adding a second power/volume
 * implementation.
 *
 * Status vocabulary (never upgraded without evidence):
 *   Supported            - existing helper performs the action
 *   Partial              - opens the correct Windows settings page; state is
 *                          not toggled programmatically
 *   Requires confirmation - destructive/system-wide; needs a power token
 *   Requires elevation   - not exposed in the current user session
 *   Unsupported          - no reliable supported mechanism found
 *   Not implemented      - no code path exists
 *
 * Verification is reported separately from execution. "Opened settings" is
 * not the same as "Bluetooth is on".
 */

const desktop = require('./desktopAutomation.cjs');
let uia = null;
try { uia = require('./ui_automation_service.cjs'); } catch (e) { uia = null; }

const CONTROLS = [
  // Network
  { id: 'wifi', label: 'Wi-Fi', status: 'Partial', method: 'Windows Settings page (ms-settings:network-wifi)', canToggle: false, note: 'No reliable unprivileged toggle. Opens the correct settings page; user changes the state.' },
  { id: 'bluetooth', label: 'Bluetooth', status: 'Partial', method: 'Windows Settings page (ms-settings:bluetooth)', canToggle: false, note: 'Opens Bluetooth settings. State toggle is not programmatically verified.' },
  { id: 'airplaneMode', label: 'Airplane mode', status: 'Partial', method: 'Windows Settings page (ms-settings:network-airplanemode)', canToggle: false, note: 'Opens the page; does not change radio state.' },
  { id: 'mobileHotspot', label: 'Mobile hotspot', status: 'Partial', method: 'Windows Settings page (ms-settings:network-mobilehotspot)', canToggle: false, note: 'Requires an eligible network adapter; settings page only.' },
  { id: 'batterySaver', label: 'Battery saver', status: 'Partial', method: 'Windows Settings page (ms-settings:batterysaver)', canToggle: false, note: 'Settings page only; state is not toggled programmatically.' },
  // Display
  { id: 'nightLight', label: 'Night light', status: 'Partial', method: 'Windows Settings page (ms-settings:display-nightlight)', canToggle: false, note: 'Settings page only.' },
  { id: 'brightness', label: 'Brightness', status: 'Partial', method: 'Windows Settings page (ms-settings:display)', canToggle: false, note: 'WMI brightness control is hardware-dependent; settings page is the reliable fallback.' },
  { id: 'displaySettings', label: 'Display settings', status: 'Supported', method: 'ms-settings:display', canToggle: true, note: 'Opens the display settings page.' },
  { id: 'cast', label: 'Cast / project', status: 'Partial', method: 'Windows Settings page (ms-settings:display-project)', canToggle: false, note: 'Opens projection settings; does not start casting.' },
  // Audio
  { id: 'volumeUp', label: 'Volume up', status: 'Supported', method: 'existing desktopAutomation.volumeUp', canToggle: true, note: 'Uses the existing keyboard-event helper.' },
  { id: 'volumeDown', label: 'Volume down', status: 'Supported', method: 'existing desktopAutomation.volumeDown', canToggle: true, note: 'Uses the existing keyboard-event helper.' },
  { id: 'setVolume', label: 'Set volume level', status: 'Supported', method: 'existing desktopAutomation.setVolume', canToggle: true, note: 'Accepts a level; readback verification is not available on this system.' },
  { id: 'mute', label: 'Mute / unmute', status: 'Supported', method: 'existing desktopAutomation.muteToggle', canToggle: true, note: 'Toggles mute; does not read back the resulting state.' },
  { id: 'microphone', label: 'Microphone controls', status: 'Partial', method: 'Windows Settings page (ms-settings:sound)', canToggle: false, note: 'Per-device microphone state is not exposed through a verified helper.' },
  { id: 'soundSettings', label: 'Sound settings', status: 'Supported', method: 'ms-settings:sound', canToggle: true, note: 'Opens sound settings.' },
  // Notifications and accessibility
  { id: 'notifications', label: 'Notifications', status: 'Partial', method: 'Windows Settings page (ms-settings:notifications)', canToggle: false, note: 'Settings page only.' },
  { id: 'focusAssist', label: 'Focus assist / Do not disturb', status: 'Partial', method: 'Windows Settings page (ms-settings:notifications)', canToggle: false, note: 'Settings page only.' },
  { id: 'liveCaptions', label: 'Live captions', status: 'Partial', method: 'Windows Settings page (ms-settings:easeofaccess-captions)', canToggle: false, note: 'Settings page only; no verified toggle.' },
  { id: 'nearbySharing', label: 'Nearby sharing', status: 'Partial', method: 'Windows Settings page (ms-settings:nearby)', canToggle: false, note: 'Settings page only.' },
  { id: 'accessibilitySettings', label: 'Accessibility settings', status: 'Supported', method: 'ms-settings:easeofaccess', canToggle: true, note: 'Opens accessibility settings.' },
  // Power
  { id: 'lock', label: 'Lock', status: 'Supported', method: 'existing power-token flow -> LockWorkStation', canToggle: true, requiresConfirmation: true, note: 'Two-step: requestPowerAction then executePowerAction.' },
  { id: 'signOut', label: 'Sign out', status: 'Requires confirmation', method: 'NOT_IMPLEMENTED in existing power helper', canToggle: false, requiresConfirmation: true, note: 'Not wired; no claim of support.' },
  { id: 'sleep', label: 'Sleep', status: 'Requires confirmation', method: 'existing power-token flow (implementation not tested here)', canToggle: true, requiresConfirmation: true, note: 'Two-step token flow. NOT_TESTED in this session to avoid suspending the machine.' },
  { id: 'hibernate', label: 'Hibernate', status: 'Requires elevation', method: 'powercfg /hibernate (elevation)', canToggle: false, requiresConfirmation: true, note: 'Requires elevated privilege and firmware support.' },
  { id: 'restart', label: 'Restart', status: 'Requires confirmation', method: 'existing power-token flow', canToggle: true, requiresConfirmation: true, note: 'Two-step token flow. NOT_TESTED in this session.' },
  { id: 'shutdown', label: 'Shutdown', status: 'Requires confirmation', method: 'existing power-token flow', canToggle: true, requiresConfirmation: true, note: 'Two-step token flow. NOT_TESTED in this session.' },
  // Privacy-sensitive
  { id: 'screenSharing', label: 'Screen sharing', status: 'Not implemented', method: 'none', canToggle: false, note: 'Never enabled silently. No verified sharing-state control exists in MYRAA.' },
];

const SETTINGS_URI = {
  wifi: 'ms-settings:network-wifi',
  bluetooth: 'ms-settings:bluetooth',
  airplaneMode: 'ms-settings:network-airplanemode',
  mobileHotspot: 'ms-settings:network-mobilehotspot',
  batterySaver: 'ms-settings:batterysaver',
  nightLight: 'ms-settings:display-nightlight',
  brightness: 'ms-settings:display',
  displaySettings: 'ms-settings:display',
  cast: 'ms-settings:display-project',
  microphone: 'ms-settings:sound',
  soundSettings: 'ms-settings:sound',
  notifications: 'ms-settings:notifications',
  focusAssist: 'ms-settings:notifications',
  liveCaptions: 'ms-settings:easeofaccess-captions',
  nearbySharing: 'ms-settings:nearby',
  accessibilitySettings: 'ms-settings:easeofaccess',
};

const POWER_ACTIONS = new Set(['lock', 'sleep', 'restart', 'shutdown']);
const VOLUME_ACTIONS = new Set(['volumeUp', 'volumeDown', 'setVolume', 'mute']);

function get(id) {
  return CONTROLS.find((c) => c.id === String(id || '')) || null;
}

function status() {
  const counts = {};
  for (const c of CONTROLS) counts[c.status] = (counts[c.status] || 0) + 1;
  return {
    ok: true,
    service: 'system-control-matrix',
    policy: 'No security bypass, no silent elevation, no silent power action. Partial means a settings page opened, not that the setting changed.',
    counts,
    controls: CONTROLS.map((c) => ({ ...c })),
    reuse: 'delegates to desktopAutomation.cjs (volume + token-gated power + settings bridge)',
  };
}

function verifySettingsOpened() {
  if (!uia || typeof uia.listVisibleWindows !== 'function') {
    return { verified: false, reason: 'UIA window list unavailable' };
  }
  try {
    const r = uia.listVisibleWindows();
    const windows = Array.isArray(r) ? r : ((r && r.windows) || []);
    const settings = windows.filter((w) => {
      const p = String(w.processName || '').toLowerCase();
      return p.includes('systemsettings') || /settings/i.test(String(w.title || ''));
    });
    return {
      verified: settings.length > 0,
      evidence: settings.slice(0, 5).map((w) => ({ title: w.title, process: w.processName })),
      reason: settings.length ? 'Settings window present' : 'Settings window not detected',
    };
  } catch (e) {
    return { verified: false, reason: e.message };
  }
}

function prepare(id, opts = {}) {
  const c = get(id);
  if (!c) return { ok: false, code: 'UNKNOWN_CONTROL', error: 'unknown control id' };
  if (POWER_ACTIONS.has(c.id)) {
    if (typeof desktop.requestPowerAction !== 'function') {
      return { ok: false, code: 'UNAVAILABLE', error: 'Existing power helper is not available.' };
    }
    const r = desktop.requestPowerAction(c.id);
    return { ...r, control: c.id, status: 'CONFIRMATION_REQUIRED', warning: c.note };
  }
  return {
    ok: false,
    code: 'NOT_APPLICABLE',
    error: 'This control does not use a confirmation token.',
    control: c.id,
  };
}

function execute(id, opts = {}) {
  const c = get(id);
  if (!c) return { ok: false, code: 'UNKNOWN_CONTROL', error: 'unknown control id' };
  const b = opts && typeof opts === 'object' ? opts : {};

  if (c.status === 'Not implemented' || c.status === 'Unsupported' || c.status === 'Requires elevation') {
    return { ok: false, code: c.status.toUpperCase().replace(/ /g, '_'), error: c.note, control: c.id };
  }

  if (POWER_ACTIONS.has(c.id)) {
    const token = b.confirmationToken || b.token;
    if (!token) {
      return { ok: false, code: 'APPROVAL_REQUIRED', error: 'Request a confirmation token first using /prepare.', control: c.id };
    }
    if (b.confirm !== true) {
      return { ok: false, code: 'APPROVAL_REQUIRED', error: 'confirm: true is required for a power action.', control: c.id };
    }
    const r = desktop.executePowerAction(token);
    return {
      ...r,
      control: c.id,
      verification: 'NOT_VERIFIED — no readback of system state was performed',
      safety: 'No system state was changed without a valid token.',
    };
  }

  if (VOLUME_ACTIONS.has(c.id)) {
    let r;
    if (c.id === 'volumeUp') r = desktop.volumeUp(b.steps || 2);
    else if (c.id === 'volumeDown') r = desktop.volumeDown(b.steps || 2);
    else if (c.id === 'setVolume') {
      if (b.level === undefined) return { ok: false, code: 'VALIDATION', error: 'level is required (0-100)' };
      r = desktop.setVolume(Math.max(0, Math.min(100, Number(b.level))));
    } else r = desktop.muteToggle();
    return {
      ok: r && r.ok !== false,
      result: r,
      control: c.id,
      verification: 'NOT_VERIFIED_BY_READBACK — the action was attempted; current volume/mute state was not read',
    };
  }

  const uri = SETTINGS_URI[c.id];
  if (!uri) {
    return { ok: false, code: 'NOT_IMPLEMENTED', error: 'No supported action path for this control.', control: c.id };
  }
  try {
    const opened = desktop.openApplication(uri);
    const verification = verifySettingsOpened();
    return {
      ok: !!(opened && opened.ok !== false),
      control: c.id,
      method: c.method,
      opened,
      verification,
      honestResult: verification.verified ? 'Settings window opened; setting itself was NOT changed.' : 'Settings launch attempted; window could not be verified.',
    };
  } catch (e) {
    return { ok: false, code: 'EXECUTION_ERROR', error: e.message, control: c.id };
  }
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json(status()));
  router.get('/:id', (req, res) => {
    const c = get(req.params.id);
    res.status(c ? 200 : 404).json(c ? { ok: true, control: c } : { ok: false, code: 'UNKNOWN_CONTROL' });
  });
  router.post('/prepare', (req, res) => {
    const r = prepare((req.body || {}).id, req.body || {});
    res.status(r.ok ? 200 : (r.code === 'UNKNOWN_CONTROL' ? 404 : 400)).json(r);
  });
  router.post('/execute', (req, res) => {
    const r = execute((req.body || {}).id, req.body || {});
    res.status(r.ok ? 200 : (r.code === 'UNKNOWN_CONTROL' ? 404 : (r.code === 'APPROVAL_REQUIRED' ? 409 : 400))).json(r);
  });
  return router;
}

const STATUS = {
  ok: true,
  service: 'system-control-matrix',
  controlCount: CONTROLS.length,
  policy: status().policy,
};

module.exports = { STATUS, CONTROLS, get, status, prepare, execute, createRouter };
