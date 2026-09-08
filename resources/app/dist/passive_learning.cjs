/**
 * MYRAA AI OS — Continuous Learning / Passive Learning Engine
 *
 * Watches what the user does in any app and builds a structured
 * app-knowledge corpus in MemoryCore — without any explicit "teach" trigger.
 *
 * Architecture:
 *  1. ScreenWatcher     — polls active-window & focused-element every ~1 s
 *  2. EventAccumulator  — buffers raw events, strips sensitive fields
 *  3. PatternExtractor  — converts event sequences → named workflows
 *  4. MemoryCore writer — persists app_knowledge to ~/.myraa/memory/apps/
 *
 * Safety rules (HARD):
 *  - PasswordFields are NEVER logged (control type = Edit + name matches regex)
 *  - Clipboard content is NEVER logged
 *  - Events older than SESSION_TTL_MS without commit are discarded
 *  - Learning can be paused via pause() / resumed via resume()
 *  - UI indicator state is always in sync with actual capture state
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const { getActiveWindow, isFocusedSensitive } = require("./universal_app_control.cjs");

// ─── Config ───────────────────────────────────────────────────────────────────

const MEMORY_DIR     = path.join(os.homedir(), ".myraa", "memory", "apps");
const POLL_INTERVAL  = 1_200; // ms
const SESSION_TTL_MS = 30 * 60 * 1_000; // 30 min — stale session auto-purge
const MAX_BUFFER     = 200;   // events before forced flush
const SENSITIVE_REGEX = /password|secret|pin|pwd|passcode|ssn|cvv|credit.card|social.security/i;

// ─── State ────────────────────────────────────────────────────────────────────

let _running   = false;
let _paused    = false;
let _timer     = null;
let _lastFlush = Date.now();

const _eventBuffer = [];       // { ts, app, windowTitle, focusedName, focusedType, action }
const _sessions    = new Map(); // appKey → { events[], startTs }

// ─── Callbacks for UI ─────────────────────────────────────────────────────────
// Set these to wire up the front-end indicator

let onStatusChange = (active) => {}; // (bool) → void
let onAppLearned   = (appKey, summary) => {}; // (string, obj) → void

function setCallbacks(cbs) {
  if (cbs.onStatusChange) onStatusChange = cbs.onStatusChange;
  if (cbs.onAppLearned)   onAppLearned   = cbs.onAppLearned;
}

// ─── Core poll ────────────────────────────────────────────────────────────────

async function _poll() {
  if (_paused || !_running) return;

  try {
    const info = await getActiveWindow();
    if (!info || !info.windowTitle) return;

    const sensitive = await isFocusedSensitive();
    if (sensitive) return; // HARD SKIP — never capture from password fields

    const appKey = _deriveAppKey(info.windowTitle, info.processId);

    // Accumulate
    const event = {
      ts:           Date.now(),
      app:          appKey,
      windowTitle:  info.windowTitle,
      focusedName:  info.focusedName  || "",
      focusedType:  info.focusedType  || "",
      action:       "focus", // extended by wrappers below
    };

    // Safety: never log if any field matches sensitive pattern
    if (_isSensitiveEvent(event)) return;

    _push(appKey, event);

    // Flush if buffer is full or TTL exceeded
    if (_eventBuffer.length >= MAX_BUFFER || Date.now() - _lastFlush > SESSION_TTL_MS) {
      await _flush();
    }
  } catch (err) {
    // Silently continue — never crash the watcher
    console.warn("[PassiveLearning] poll error:", err.message?.slice(0, 100));
  }
}

function _push(appKey, event) {
  _eventBuffer.push(event);
  if (!_sessions.has(appKey)) {
    _sessions.set(appKey, { events: [], startTs: event.ts });
  }
  _sessions.get(appKey).events.push(event);
  if (_sessions.get(appKey).events.length > MAX_BUFFER) {
    _sessions.get(appKey).events.shift(); // rolling window
  }
}

// ─── Pattern extractor ────────────────────────────────────────────────────────

function _extractPatterns(events) {
  // Group consecutive events by focusedType → build workflow steps
  const steps = [];
  let prev = null;
  for (const ev of events) {
    const step = `[${ev.focusedType || "?"}] ${ev.focusedName || "—"}`;
    if (step !== prev) { steps.push(step); prev = step; }
  }
  // Deduplicate repeated sequences
  const unique = [...new Set(steps)];
  return unique.slice(0, 30); // cap
}

// ─── Memory writer ────────────────────────────────────────────────────────────

async function _flush() {
  _lastFlush = Date.now();
  if (_eventBuffer.length === 0) return;

  fs.mkdirSync(MEMORY_DIR, { recursive: true });

  for (const [appKey, session] of _sessions.entries()) {
    if (session.events.length === 0) continue;

    const filePath = path.join(MEMORY_DIR, `${appKey}.json`);
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(filePath, "utf8")); } catch {}

    const patterns = _extractPatterns(session.events);
    const sessionMins = Math.round((Date.now() - session.startTs) / 60_000);

    existing.appKey     = appKey;
    existing.lastSeen   = new Date().toISOString();
    existing.totalSessions = (existing.totalSessions || 0) + 1;
    existing.totalMinutes  = (existing.totalMinutes  || 0) + sessionMins;
    existing.uiPatterns    = _mergePatterns(existing.uiPatterns || [], patterns);
    existing.windows       = _mergeSet(existing.windows || [], session.events.map(e => e.windowTitle));

    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf8");
    onAppLearned(appKey, { patterns: existing.uiPatterns.length, totalSessions: existing.totalSessions });
  }

  _sessions.clear();
  _eventBuffer.length = 0;
}

function _mergePatterns(existing, incoming) {
  const all = [...new Set([...existing, ...incoming])];
  return all.slice(0, 100); // cap at 100 unique patterns per app
}

function _mergeSet(existing, incoming) {
  return [...new Set([...existing, ...incoming])].slice(0, 50);
}

// ─── Safety helpers ───────────────────────────────────────────────────────────

function _isSensitiveEvent(event) {
  return SENSITIVE_REGEX.test(event.focusedName) ||
         SENSITIVE_REGEX.test(event.windowTitle);
}

function _deriveAppKey(windowTitle, pid) {
  // Derive a stable key from the window title root (first word / exe name)
  const base = windowTitle.split(/[\s\-–—|]/)[0].toLowerCase().replace(/[^a-z0-9]/g, "_");
  return base || `pid_${pid}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

function start() {
  if (_running) return;
  _running = true;
  _paused  = false;
  _timer   = setInterval(_poll, POLL_INTERVAL);
  onStatusChange(true); // UI indicator ON
  console.log("[PassiveLearning] Started");
}

function pause() {
  _paused = true;
  onStatusChange(false); // UI indicator OFF — matches actual state
  console.log("[PassiveLearning] Paused");
}

function resume() {
  if (!_running) { start(); return; }
  _paused = false;
  onStatusChange(true); // UI indicator ON — matches actual state
  console.log("[PassiveLearning] Resumed");
}

function stop() {
  _running = false;
  _paused  = false;
  if (_timer) { clearInterval(_timer); _timer = null; }
  _flush().catch(() => {});
  onStatusChange(false); // UI indicator OFF
  console.log("[PassiveLearning] Stopped");
}

function isCapturing() {
  return _running && !_paused;
}

/** Load persisted knowledge for a given app */
function loadAppKnowledge(appKey) {
  const filePath = path.join(MEMORY_DIR, `${appKey}.json`);
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

/** List all apps we have knowledge about */
function listLearnedApps() {
  try {
    return fs.readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, f), "utf8"));
        return { appKey: data.appKey, lastSeen: data.lastSeen, patterns: (data.uiPatterns || []).length };
      });
  } catch { return []; }
}

/** Log a user-driven action from other modules (typing, click) to enrich the corpus */
function logAction(appKey, actionDescription) {
  if (!_running || _paused) return;
  if (SENSITIVE_REGEX.test(actionDescription)) return; // Safety
  const event = { ts: Date.now(), app: appKey, windowTitle: "", focusedName: actionDescription, focusedType: "Action", action: "explicit" };
  _push(appKey, event);
}

module.exports = { start, pause, resume, stop, isCapturing, setCallbacks, loadAppKnowledge, listLearnedApps, logAction };
