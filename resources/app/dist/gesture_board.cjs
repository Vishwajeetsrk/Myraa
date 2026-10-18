'use strict';
/**
 * MYRAA Gesture board bridge (Phase 15).
 * Protocol-level integration with a barehands-style board. No vendored code:
 * MYRAA talks to the board's documented protocol (state files + HTTP cmd).
 *
 * Ring (face): write idle|listening|thinking|speaking to <stateDir>/state.
 *   Optional mood.json / wave.json passthrough. Server treats untouched state
 *   as stale after its own timeout; we never fake freshness.
 * Board (stage): POST {a, ...} to <baseUrl>/cmd. Actions restricted to the
 *   board's own allowlist. board-state.sh equivalent: GET <baseUrl>/board-state
 *   with graceful fallback to UNKNOWN (endpoint varies by board version).
 * Env: MYRAA_BAREHANDS_URL (default http://127.0.0.1:8794),
 *      MYRAA_BAREHANDS_STATE (default <cwd>/barehands/state).
 */

const fs = require('fs');
const path = require('path');

const RING_STATES = ['idle', 'listening', 'thinking', 'speaking'];
const BOARD_ACTIONS = ['present', 'add_card', 'add_img', 'hand', 'explode', 'assemble', 'yank', 'hover', 'reset'];
const GESTURE_INTENTS = ['gesture_select', 'gesture_clear', 'gesture_dismiss', 'gesture_present', 'gesture_status'];

function baseUrl() {
  return (process.env.MYRAA_BAREHANDS_URL || 'http://127.0.0.1:8794').replace(/\/+$/, '');
}

function stateDir() {
  return process.env.MYRAA_BAREHANDS_STATE || path.join(process.cwd(), 'barehands', 'state');
}

function setRing(state, opts) {
  if (!RING_STATES.includes(state)) {
    return { ok: false, code: 'VALIDATION', error: 'state must be one of: ' + RING_STATES.join(', ') };
  }
  const dir = (opts && opts.stateDir) || stateDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'state'), state, 'utf8');
    if (opts && opts.mood !== undefined) fs.writeFileSync(path.join(dir, 'mood.json'), JSON.stringify(opts.mood).slice(0, 2000), 'utf8');
    return { ok: true, state, dir };
  } catch (e) {
    return { ok: false, code: 'ARTIFACT_ERROR', error: 'ring write failed: ' + String((e && e.message) || e).slice(0, 200) };
  }
}

function readRing(opts) {
  const dir = (opts && opts.stateDir) || stateDir();
  try {
    const f = path.join(dir, 'state');
    if (!fs.existsSync(f)) return { ok: true, state: 'UNKNOWN', reason: 'no state file (board idle or absent)' };
    return { ok: true, state: String(fs.readFileSync(f, 'utf8')).trim() || 'UNKNOWN' };
  } catch (e) {
    return { ok: false, code: 'ARTIFACT_ERROR', error: String((e && e.message) || e).slice(0, 200) };
  }
}

function validateBoardAction(action) {
  if (!action || typeof action !== 'object') return { ok: false, error: 'action must be an object' };
  if (!BOARD_ACTIONS.includes(action.a)) return { ok: false, error: 'a must be one of: ' + BOARD_ACTIONS.join(', ') };
  if (action.src !== undefined && typeof action.src !== 'string') return { ok: false, error: 'src must be a string path inside the media airlock' };
  if (action.src && (action.src.includes('..') || path.isAbsolute(action.src))) {
    return { ok: false, error: 'src must be a relative path inside the media airlock (no .., no absolute)' };
  }
  return { ok: true };
}

async function boardCmd(action, opts) {
  const v = validateBoardAction(action);
  if (!v.ok) return { ok: false, code: 'VALIDATION', error: v.error };
  const url = ((opts && opts.baseUrl) || baseUrl()) + '/cmd';
  const fetchFn = (opts && opts.fetchFn) || fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, (opts && opts.timeoutMs) || 15000);
  try {
    const r = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, code: 'NETWORK_ERROR', error: 'board HTTP ' + r.status + ': ' + text.slice(0, 200) };
    return { ok: true, response: text.slice(0, 2000) };
  } catch (e) {
    return { ok: false, code: 'WORKER_OFFLINE', error: 'board unreachable at ' + url + ' (' + String((e && e.message) || e).slice(0, 160) + ')' };
  } finally {
    clearTimeout(timer);
  }
}

async function boardState(opts) {
  const base = ((opts && opts.baseUrl) || baseUrl());
  const fetchFn = (opts && opts.fetchFn) || fetch;
  const paths = ['/board-state', '/state', '/api/board'];
  for (const p of paths) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 5000);
      const r = await fetchFn(base + p, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) continue;
      const text = await r.text();
      try {
        return { ok: true, items: JSON.parse(text), source: p };
      } catch (e) {
        return { ok: true, raw: text.slice(0, 2000), source: p };
      }
    } catch (e) { /* try next path */ }
  }
  return { ok: false, code: 'WORKER_OFFLINE', error: 'board state unreadable (tried ' + paths.join(', ') + ')' };
}

async function status(opts) {
  const fetchFn = (opts && opts.fetchFn) || fetch;
  const base = ((opts && opts.baseUrl) || baseUrl());
  let server = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 4000);
    const r = await fetchFn(base + '/stage.html', { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(timer);
    server = r.ok;
  } catch (e) { server = false; }
  const ring = readRing(opts);
  return {
    ok: true,
    server: server ? 'online' : 'offline',
    baseUrl: base,
    ring: ring.ok ? ring.state : 'UNKNOWN',
    cameraNote: 'Camera runs in the browser page ( MediaPipe client-side). MYRAA never sees raw video unless a session explicitly enables it.',
  };
}

module.exports = {
  RING_STATES, BOARD_ACTIONS, GESTURE_INTENTS,
  baseUrl, stateDir,
  setRing, readRing, validateBoardAction, boardCmd, boardState, status,
};
