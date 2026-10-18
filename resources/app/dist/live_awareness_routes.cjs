'use strict';
/**
 * MYRAA Live Awareness — routes (Phase 5).
 * Opt-in situational awareness over the EXISTING capture/desktop stack.
 * Consent: reuses the Phase-1 screen-awareness consent (screen_awareness_consent.json).
 *   L0 metadata  : no capture, always available.
 *   L1 app context: window list + foreground window via PowerShell, needs consent.
 *   L2 OCR        : needs consent + ocr_engine.cjs (Phase 4), on-demand only.
 *   L3 screenshots: the Phase-1 gated capture routes themselves, on-demand only.
 *   L4/L5         : NOT implemented — reported unavailable, never faked.
 * Modes (passive|assistive|active_tutor) are stored and reported; proactive
 * speech enforcement lands with the Tutor phase. Event ring (cap 100, in-memory
 * session scope) powers the timeline; DELETE clears it for real.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const router = express.Router();

const MODES = ['passive', 'assistive', 'active_tutor'];
const EVENT_CAP = 100;
const eventsRing = [];

function settingsDir() {
  const appData = process.env.APPDATA
    || (process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library/Application Support')
      : path.join(process.env.HOME || '', '.config'));
  return path.join(process.env.MYRAA_DATA_DIR || path.join(appData, 'MYRAA'), 'settings');
}
function consentFile() { return path.join(settingsDir(), 'screen_awareness_consent.json'); }
function modeFile() { return path.join(settingsDir(), 'awareness_mode.json'); }

function loadConsent() {
  try {
    if (fs.existsSync(consentFile())) {
      const p = JSON.parse(fs.readFileSync(consentFile(), 'utf8'));
      if (p && typeof p.enabled === 'boolean') return p.enabled;
    }
  } catch (e) {}
  const v = String(process.env.MYRAA_ENABLE_SCREEN_AWARENESS || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function loadMode() {
  try {
    if (fs.existsSync(modeFile())) {
      const p = JSON.parse(fs.readFileSync(modeFile(), 'utf8'));
      if (p && MODES.includes(p.mode)) return p.mode;
    }
  } catch (e) {}
  return 'passive';
}

function saveMode(mode) {
  const rec = { mode, updatedAt: new Date().toISOString() };
  try {
    fs.mkdirSync(settingsDir(), { recursive: true });
    fs.writeFileSync(modeFile(), JSON.stringify(rec, null, 2), 'utf8');
  } catch (e) {}
  return rec;
}

function logEvent(type, detail) {
  eventsRing.push({ at: new Date().toISOString(), type: String(type), detail: String(detail || '').slice(0, 300) });
  while (eventsRing.length > EVENT_CAP) eventsRing.shift();
}

function ocrAvailable() {
  try {
    require('./ocr_engine.cjs');
    return { available: true, reason: 'ocr_engine.cjs present (Phase 4).' };
  } catch (e) {
    return { available: false, reason: 'ocr_engine.cjs not installed — apply Phase 4. Vision-model OCR remains via /api/vision/analyze-frame.' };
  }
}

function levels(consent) {
  const ocr = ocrAvailable();
  return [
    { level: 0, name: 'No capture', available: true, reason: 'Metadata-free baseline; always on.' },
    { level: 1, name: 'App/window metadata', available: consent === true, reason: consent ? 'Window list + foreground window via PowerShell.' : 'Requires screen-awareness consent.' },
    { level: 2, name: 'OCR / accessibility', available: consent === true && ocr.available, reason: !consent ? 'Requires screen-awareness consent.' : ocr.reason },
    { level: 3, name: 'Low-frequency screenshots', available: consent === true, reason: consent ? 'On-demand via the consent-gated capture routes (rate-limited, LAN token required).' : 'Requires screen-awareness consent.' },
    { level: 4, name: 'Higher-frequency visual', available: false, reason: 'Not implemented — no continuous frame pipeline exists yet.' },
    { level: 5, name: 'Focused region analysis', available: false, reason: 'Not implemented — no region-capture path exists yet.' },
  ];
}

function runPowerShell(script, timeoutMs) {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: timeoutMs || 8000, windowsHide: true, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    return { ok: true, out: String(out || '') };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 200) };
  }
}

function readContext() {
  const winList = runPowerShell(
    "Get-Process | Where-Object { $_.MainWindowTitle.Length -gt 0 } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress -Depth 2"
  );
  let windows = [];
  if (winList.ok) {
    try {
      const parsed = JSON.parse(winList.out.trim() || '[]');
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      windows = arr.filter(Boolean).map((w) => ({ id: w.Id, process: w.ProcessName, title: w.MainWindowTitle }));
    } catch (e) { windows = []; }
  }
  const fg = runPowerShell(
    "$cs='using System;using System.Runtime.InteropServices;using System.Text;public static class FG{ [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern int GetWindowText(IntPtr h,StringBuilder t,int n); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);}';"
    + " Add-Type -TypeDefinition $cs -ErrorAction SilentlyContinue;"
    + " $h=[FG]::GetForegroundWindow(); $sb=New-Object Text.StringBuilder 512; [void][FG]::GetWindowText($h,$sb,512); $fgPid=0; [void][FG]::GetWindowThreadProcessId($h,[ref]$fgPid);"
    + " @{pid=$fgPid; title=$sb.ToString()} | ConvertTo-Json -Compress"
  );
  let foreground = null;
  if (fg.ok) {
    try {
      const p = JSON.parse(fg.out.trim() || '{}');
      if (p && (p.title || p.pid)) foreground = { pid: p.pid || null, title: p.title || '' };
    } catch (e) { foreground = null; }
  }
  return { windows, foreground, capturedAt: new Date().toISOString() };
}

// ── routes ───────────────────────────────────────────────────────────────────
router.get('/api/awareness/status', (req, res) => {
  try {
    const consent = loadConsent();
    return res.json({
      ok: true,
      consent: { enabled: consent },
      mode: loadMode(),
      modes: MODES,
      levels: levels(consent),
      policy: {
        interveneOnlyWhen: 'intervention_value > interruption_cost',
        passive: 'Watch context, never interrupt.',
        assistive: 'Occasional suggestions with confidence gating.',
        active_tutor: 'Continuous teaching (enforcement lands with the Tutor phase).',
      },
      events: eventsRing.length,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
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
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/awareness/context', (req, res) => {
  try {
    if (!loadConsent()) {
      return res.status(403).json({ ok: false, code: 'SCREEN_AWARENESS_CONSENT_REQUIRED', error: 'Awareness context needs consent. POST /api/screen-awareness/consent {"enabled": true}.' });
    }
    const ctx = readContext();
    logEvent('context.read', ctx.windows.length + ' windows' + (ctx.foreground && ctx.foreground.title ? ', fg=' + ctx.foreground.title.slice(0, 60) : ''));
    return res.json({ ok: true, level: 1, consent: true, mode: loadMode(), context: ctx });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/awareness/events', (req, res) => {
  try {
    return res.json({ ok: true, events: eventsRing.slice().reverse(), count: eventsRing.length, cap: EVENT_CAP });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.delete('/api/awareness/events', (req, res) => {
  try {
    const n = eventsRing.length;
    eventsRing.length = 0;
    return res.json({ ok: true, cleared: n });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

module.exports = router;
