'use strict';
/**
 * MYRAA Unified Event Bus (Phase 22).
 * Append-only operational event log (JSONL) with in-process subscribers.
 * Foundation for the task timeline (Phase 23) and observability.
 *
 * Honesty + safety rules:
 *   - emit never throws and never blocks; if the log write fails the event is
 *     still returned with stored:false so callers stay honest
 *   - payloads are clamped (strings 200, depth 3, arrays 10, serialized 800)
 *     and secret-ish keys are redacted before anything is written
 *   - the file is compacted to the last EVENTS_CAP lines periodically
 * Env: MYRAA_EVENTS_DB (default %APPDATA%\MYRAA\events\events.jsonl)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const EVENTS_CAP = 2000;
const PAYLOAD_CAP = 800;
const SECRET_RE = /key|token|secret|password|credential|apikey|authorization/i;
const TYPE_RE = /^(system|task|tool|approval|broker|model|connector|evidence|investigation|routine|workspace|timeline|permission|mcp)\.[a-z0-9_.-]+$/;
const SEVERITIES = ['info', 'warn', 'error'];

function dataDir() {
  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(base, 'MYRAA', 'events');
}

function defaultStorePath() {
  return process.env.MYRAA_EVENTS_DB || path.join(dataDir(), 'events.jsonl');
}

function sliceText(v, n) { return String(v == null ? '' : v).slice(0, n); }
function nowIso() { return new Date().toISOString(); }

function sanitizeValue(v, depth) {
  if (depth > 3) return '[deep]';
  if (v == null) return v;
  const t = typeof v;
  if (t === 'string') return v.length > 200 ? v.slice(0, 200) + '...' : v;
  if (t === 'number' || t === 'boolean') return v;
  if (t === 'bigint') return String(v);
  if (Array.isArray(v)) return v.slice(0, 10).map((x) => sanitizeValue(x, depth + 1));
  if (t === 'object') {
    const out = {};
    const keys = Object.keys(v).slice(0, 12);
    for (const k of keys) out[k] = SECRET_RE.test(k) ? '[redacted]' : sanitizeValue(v[k], depth + 1);
    return out;
  }
  return '[unsupported]';
}

function sanitizePayload(payload, cap) {
  let s;
  try { s = sanitizeValue(payload === undefined ? {} : payload, 0); } catch (e) { return { error: 'payload not serializable' }; }
  let json;
  try { json = JSON.stringify(s); } catch (e) { return { error: 'payload not serializable' }; }
  if (json === undefined) return { error: 'payload not serializable' };
  if (json.length > cap) return { truncated: json.slice(0, cap) };
  return s;
}

function summarize(ev) {
  if (!ev || !ev.payload || typeof ev.payload !== 'object') return (ev && ev.type) || 'event';
  const p = ev.payload;
  const bits = [];
  if (typeof p.message === 'string' && p.message) bits.push(sliceText(p.message, 90));
  else if (typeof p.summary === 'string' && p.summary) bits.push(sliceText(p.summary, 90));
  if (p.intent) bits.push('intent ' + p.intent);
  if (p.tool) bits.push('tool ' + p.tool);
  if (p.lane) bits.push('lane ' + p.lane);
  if (p.ok === false) bits.push('FAILED');
  if (typeof p.durationMs === 'number') bits.push(p.durationMs + 'ms');
  return bits.join(' | ') || ev.type;
}

function createBus(opts) {
  const o = opts || {};
  const file = o.storePath || defaultStorePath();
  const cap = o.cap || EVENTS_CAP;
  const payloadCap = o.payloadCap || PAYLOAD_CAP;
  const compactEvery = o.compactEvery || 200;

  let ring = [];
  let seq = 0;
  let loaded = false;
  let appends = 0;
  const subscribers = new Set();

  function parseLine(line) {
    try {
      const ev = JSON.parse(line);
      return ev && typeof ev.seq === 'number' && typeof ev.type === 'string' ? ev : null;
    } catch (e) { return null; }
  }

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      const parsed = [];
      for (let i = Math.max(0, lines.length - cap); i < lines.length; i++) {
        const ev = parseLine(lines[i]);
        if (ev) parsed.push(ev);
      }
      ring = parsed;
      for (const ev of ring) if (ev.seq > seq) seq = ev.seq;
    } catch (e) { ring = []; }
  }

  function compact() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.' + Date.now() + '.tmp';
      fs.writeFileSync(tmp, ring.map((ev) => JSON.stringify(ev)).join('\n') + (ring.length ? '\n' : ''), 'utf8');
      fs.renameSync(tmp, file);
      return true;
    } catch (e) { return false; }
  }

  function append(ev) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, JSON.stringify(ev) + '\n', 'utf8');
      appends += 1;
      if (appends % compactEvery === 0) compact();
      return true;
    } catch (e) { return false; }
  }

  function emit(type, payload, emitOpts) {
    try {
      const t = sliceText(type, 80).trim();
      if (!TYPE_RE.test(t)) return { ok: false, code: 'VALIDATION', error: 'invalid event type (namespace.header, e.g. task.recognized)' };
      ensureLoaded();
      seq += 1;
      const sev = sliceText(emitOpts && emitOpts.severity, 10).toLowerCase();
      const ev = {
        seq,
        at: nowIso(),
        type: t,
        source: sliceText((emitOpts && emitOpts.source) || 'myraa', 60),
        severity: SEVERITIES.includes(sev) ? sev : 'info',
        payload: sanitizePayload(payload, payloadCap),
      };
      ring.push(ev);
      while (ring.length > cap) ring.shift();
      const stored = append(ev);
      for (const fn of subscribers) { try { fn(ev); } catch (e) {} }
      return { ok: true, stored, event: ev };
    } catch (e) {
      return { ok: false, code: 'EMIT_FAILED', error: String((e && e.message) || e) };
    }
  }

  function list(input) {
    ensureLoaded();
    const i = input || {};
    const limit = Math.min(200, Math.max(1, Number(i.limit) || 20));
    const since = Number(i.since) || 0;
    const type = sliceText(i.type, 80);
    let items = ring.filter((ev) => ev.seq > since);
    if (type) items = items.filter((ev) => ev.type === type || ev.type.startsWith(type + '.'));
    const total = items.length;
    items = items.slice(-limit).reverse();
    return { ok: true, total, events: items };
  }

  function tail(n) { return list({ limit: n || 20 }); }

  function status() {
    ensureLoaded();
    const counts = {};
    for (const ev of ring) {
      const ns = ev.type.split('.')[0];
      counts[ns] = (counts[ns] || 0) + 1;
    }
    return {
      ok: true,
      storePath: file,
      inMemory: ring.length,
      seq,
      subscribers: subscribers.size,
      namespaces: counts,
      policy: 'append-only JSONL, payloads clamped, secret-ish keys redacted, emit never throws and never blocks',
    };
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }

  function createRouter() {
    let express;
    try { express = require('express'); } catch (e) { express = null; }
    if (!express) return null;
    const router = express.Router();
    router.get('/', (req, res) => { res.json(status()); });
    router.get('/list', (req, res) => { res.json(list({ limit: req.query.limit, type: req.query.type, since: req.query.since })); });
    router.get('/tail', (req, res) => { res.json(tail(Number(req.query.n) || 20)); });
    router.post('/emit', (req, res) => {
      const body = req.body || {};
      const r = emit(body.type, body.payload, { source: body.source || 'api' });
      res.status(r.ok ? 200 : 400).json(r);
    });
    return router;
  }

  function registerAgiTools(engine) {
    if (!engine || typeof engine.register !== 'function') return { ok: false, count: 0, error: 'tool engine not available' };
    const names = [];
    engine.register('events_tail', {
      fn: async (params) => tail(Math.min(50, Number((params && params.limit) || 15))),
      risk: 'LOW',
      category: 'events',
      timeout: 5000,
      description: 'Read the last N entries of the unified event log (newest first).',
    });
    names.push('events_tail');
    return { ok: true, count: names.length, names };
  }

  return {
    emit, list, tail, status, subscribe, compact, createRouter, registerAgiTools,
    summarize, storePath: () => file,
    _reset: () => { ring = []; seq = 0; loaded = false; appends = 0; subscribers.clear(); },
  };
}

const singleton = createBus({});

module.exports = {
  EVENTS_CAP, PAYLOAD_CAP, dataDir, defaultStorePath, summarize, createBus,
  emit: singleton.emit,
  list: singleton.list,
  tail: singleton.tail,
  status: singleton.status,
  subscribe: singleton.subscribe,
  createRouter: singleton.createRouter,
  registerAgiTools: singleton.registerAgiTools,
};
