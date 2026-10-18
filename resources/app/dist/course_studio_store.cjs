'use strict';
/**
 * MYRAA Course Studio — SQLite bridge client (Phase 2 vertical slice).
 * Mirrors the memory_core_service.cjs spawn pattern: `python bridge.py <cmd> '<json>'`.
 * Falls back from `python` to `py`. Never throws — returns {ok:false,error}.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const BRIDGE_FILE = path.join(__dirname, 'sqlite_memory_bridge.py');
const TIMEOUT_MS = 8000;

function findPython() {
  for (const bin of ['python', 'py']) {
    try {
      const probe = spawnSync(bin, ['--version'], { timeout: 3000, windowsHide: true });
      if (probe.status === 0) return bin;
    } catch (e) { /* try next */ }
  }
  return null;
}

let cachedPython = null;
let probed = false;

function csDb(cmd, payload) {
  if (!probed) { cachedPython = findPython(); probed = true; }
  if (!cachedPython) return { ok: false, error: 'NOT_CONFIGURED: no Python runtime found (tried python, py).' };
  const args = [BRIDGE_FILE, String(cmd)];
  if (payload !== undefined) args.push(JSON.stringify(payload === null ? {} : payload));
  try {
    const r = spawnSync(cachedPython, args, { timeout: TIMEOUT_MS, windowsHide: true, encoding: 'utf8' });
    if (r.error) return { ok: false, error: 'bridge spawn failed: ' + String(r.error.message || r.error) };
    const out = String(r.stdout || '').trim();
    if (!out) return { ok: false, error: 'bridge returned empty output (exit ' + r.status + '): ' + String(r.stderr || '').slice(0, 300) };
    try {
      return JSON.parse(out);
    } catch (e) {
      return { ok: false, error: 'bridge returned non-JSON: ' + out.slice(0, 300) };
    }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

module.exports = { csDb, BRIDGE_FILE, TIMEOUT_MS };
