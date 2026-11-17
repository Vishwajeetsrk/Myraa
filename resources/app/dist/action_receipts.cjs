'use strict';
/**
 * Action receipts (Phase 29) - verifiable, append-only records for consequential actions.
 * Additive only: never deletes or rewrites existing records, never stores raw secrets.
 * Run: node tests\test_action_receipts.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const CAP = 300;
const SECRET_KEY = /pass(word)?|secret|token|api[_-]?key|authorization|cookie|card|cvv|ssn|otp|credential|pin/i;

function dataDir() {
  return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'MYRAA');
}
function defaultStorePath() {
  return process.env.MYRAA_ACTION_RECEIPTS_DB || path.join(dataDir(), 'action_receipts.jsonl');
}
function nowIso() { return new Date().toISOString(); }
function slice(v, n) { return String(v == null ? '' : v).slice(0, n); }
function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
}

function redact(value, depth) {
  const d = Number(depth) || 0;
  if (d > 4) return '[DEPTH]';
  if (typeof value === 'string') {
    let s = slice(value, 4000);
    if (s.length === 4000) s += '...[TRUNCATED]';
    return s.replace(/\d{12,}/g, '[NUMBERS]');
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((x) => redact(x, d + 1));
  if (value && typeof value === 'object') {
    const out = {};
    const keys = Object.keys(value).slice(0, 50);
    for (const k of keys) out[k] = SECRET_KEY.test(k) ? '[REDACTED]' : redact(value[k], d + 1);
    if (Object.keys(value).length > keys.length) out._omitted = Object.keys(value).length - keys.length;
    return out;
  }
  return '[UNSERIALIZABLE]';
}

function createActionReceipts(opts) {
  const o = opts || {};
  const file = o.storePath || defaultStorePath();
  const bus = o.eventBus || null;
  const handlers = new Map();
  let items = [];
  try {
    if (fs.existsSync(file)) {
      const byId = new Map();
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)) {
        try { const rec = JSON.parse(line); if (rec && rec.id) byId.set(rec.id, rec); } catch (e) { /* ignore bad line */ }
      }
      items = Array.from(byId.values()).slice(-CAP);
    }
  } catch (e) { items = []; }

  function emit(type, payload) {
    if (!bus || typeof bus.emit !== 'function') return;
    try { bus.emit(type, payload, { source: 'action-receipts' }); } catch (e) { /* never break the action */ }
  }
  function append(rec) {
    const idx = items.findIndex((r) => r.id === rec.id);
    if (idx >= 0) items[idx] = rec;
    else items.push(rec);
    while (items.length > CAP) items.shift();
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, JSON.stringify(rec) + '\n', 'utf8');
    } catch (e) { /* storage is best effort; in-memory ring still works */ }
  }
  function find(id) { return items.find((r) => r.id === slice(id, 80)) || null; }

  function start(input) {
    const i = input || {};
    if (!slice(i.tool, 80).trim()) return { ok: false, code: 'VALIDATION', error: 'tool is required' };
    const rec = {
      id: newId('rcpt'),
      at: nowIso(),
      tool: slice(i.tool, 80),
      risk: slice(i.risk || 'UNSPECIFIED', 24),
      decision: slice(i.decision || 'auto', 40),
      actor: slice(i.actor || 'local', 60),
      note: slice(i.note, 200),
      params: redact(i.params || {}),
      status: 'running',
      startedMs: Date.now(),
      endedAt: null,
      durationMs: null,
      outcome: null,
      evidence: null,
      undoToken: null,
      undoneAt: null,
    };
    append(rec);
    emit('action.receipt.started', { id: rec.id, tool: rec.tool, risk: rec.risk });
    return { ok: true, receipt: rec };
  }

  function finish(id, out) {
    const rec = find(id);
    if (!rec) return { ok: false, code: 'NOT_FOUND', error: 'unknown receipt' };
    if (rec.endedAt) return { ok: false, code: 'ALREADY_DONE', error: 'receipt already finished' };
    const o2 = out || {};
    rec.status = o2.ok === false ? 'failed' : 'succeeded';
    rec.endedAt = nowIso();
    rec.durationMs = Date.now() - rec.startedMs;
    rec.outcome = slice(o2.outcome, 400);
    rec.evidence = redact(o2.evidence || {});
    if (o2.undoToken != null) rec.undoToken = slice(o2.undoToken, 200);
    append(Object.assign({}, rec));
    emit('action.receipt.finished', { id: rec.id, tool: rec.tool, status: rec.status, durationMs: rec.durationMs });
    return { ok: true, receipt: rec };
  }

  function registerUndo(tool, fn) {
    if (!slice(tool, 80).trim() || typeof fn !== 'function') return { ok: false, code: 'VALIDATION' };
    handlers.set(slice(tool, 80), fn);
    return { ok: true, tool: slice(tool, 80) };
  }

  function undo(id) {
    const rec = find(id);
    if (!rec) return { ok: false, code: 'NOT_FOUND', error: 'unknown receipt' };
    if (rec.status !== 'succeeded') return { ok: false, code: 'NOT_FINISHED', error: 'only succeeded receipts can be undone' };
    if (rec.undoneAt) return { ok: false, code: 'ALREADY_UNDONE', error: 'receipt was already undone' };
    const handler = handlers.get(rec.tool);
    if (!handler) return { ok: false, code: 'NO_HANDLER', error: 'no undo handler registered for ' + rec.tool };
    let result;
    try { result = handler(rec.undoToken, rec); }
    catch (e) { return { ok: false, code: 'UNDO_ERROR', error: slice(e && e.message, 300) }; }
    rec.undoneAt = nowIso();
    append(Object.assign({}, rec));
    emit('action.receipt.undone', { id: rec.id, tool: rec.tool });
    return { ok: true, receipt: rec, result: result || null };
  }

  function list(input) {
    const i = input || {};
    const limit = Math.max(1, Math.min(CAP, Number(i.limit) || 50));
    const tool = i.tool ? slice(i.tool, 80) : '';
    const found = items.filter((r) => !tool || r.tool === tool).slice().reverse().slice(0, limit);
    return { ok: true, count: found.length, receipts: found };
  }
  function status() {
    const byStatus = {};
    for (const r of items) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    return { ok: true, count: items.length, byStatus, storeFile: () => file, storePath: file };
  }

  function createRouter() {
    let router = null;
    try { router = require('express').Router(); } catch (e) { return null; }
    router.get('/status', (req, res) => res.json(status()));
    router.get('/receipts', (req, res) => res.json(list(req.query)));
    router.post('/receipts', (req, res) => {
      const r = start(req.body || {});
      res.status(r.ok ? 200 : 400).json(r);
    });
    router.post('/receipts/:id/finish', (req, res) => {
      const r = finish(req.params.id, req.body || {});
      res.status(r.ok ? 200 : 400).json(r);
    });
    router.get('/receipts/:id', (req, res) => {
      const rec = find(req.params.id);
      res.status(rec ? 200 : 404).json(rec ? { ok: true, receipt: rec } : { ok: false, code: 'NOT_FOUND' });
    });
    router.post('/receipts/:id/undo', (req, res) => {
      const r = undo(req.params.id);
      res.status(r.ok ? 200 : 400).json(r);
    });
    return router;
  }

  return { start, finish, undo, registerUndo, list, get: (id) => find(id), status, createRouter, storePath: () => file };
}

const singleton = createActionReceipts({});

module.exports = {
  CAP, dataDir, defaultStorePath, redact, createActionReceipts,
  start: singleton.start,
  finish: singleton.finish,
  undo: singleton.undo,
  registerUndo: singleton.registerUndo,
  list: singleton.list,
  get: singleton.get,
  status: singleton.status,
  createRouter: singleton.createRouter,
};
