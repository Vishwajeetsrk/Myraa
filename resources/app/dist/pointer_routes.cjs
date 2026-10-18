'use strict';
/**
 * MYRAA Pointer — routes + session (Phase 11 / Pointer Phase 1).
 * Mounted alongside existing routers. Session state is durable via the
 * SQLite bridge (pp_sessions, pp_actions); guardrails live in pointer_core.
 */

const express = require('express');
const pointer = require('./pointer_core.cjs');
const pairing = require('./pointer_pairing.cjs');
const notes = require('./pointer_notes.cjs');
const voice = require('./pointer_voice.cjs');
const { csDb } = require('./course_studio_store.cjs');

const router = express.Router();

function makeId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function nowIso() { return new Date().toISOString(); }

router.post('/api/pointer/session/start', (req, res) => {
  try {
    const b = req.body || {};
    const session = {
      id: makeId('ptr'),
      mode: b.mode || 'follow',
      guardrails: b.guardrails !== false,
      startedAt: nowIso(),
      endedAt: null,
    };
    const r = csDb('pp_session_save', session);
    if (!r || r.ok !== true) return res.status(500).json({ ok: false, error: 'persist failed: ' + ((r && r.error) || 'unknown') });
    return res.json({ ok: true, session });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/pointer/session/stop', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.id) return res.status(400).json({ ok: false, error: 'id is required', code: 'VALIDATION' });
    const r = csDb('pp_session_get', { id: String(b.id) });
    const session = (r && r.ok === true) ? r.session : null;
    if (!session) return res.status(404).json({ ok: false, error: 'session not found', code: 'NOT_FOUND' });
    session.endedAt = nowIso();
    csDb('pp_session_save', session);
    return res.json({ ok: true, session });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/pointer/session/:id', (req, res) => {
  try {
    const r = csDb('pp_session_get', { id: String(req.params.id) });
    const session = (r && r.ok === true) ? r.session : null;
    if (!session) return res.status(404).json({ ok: false, error: 'session not found', code: 'NOT_FOUND' });
    return res.json({ ok: true, session });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/pointer/point', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.sessionId) return res.status(400).json({ ok: false, error: 'sessionId is required', code: 'VALIDATION' });
    const out = pointer.point(b.target, b.controlMap);
    if (!out.ok) {
      return res.status(out.code === 'GUARDRAIL_REFUSED' ? 403 : 400).json(out);
    }
    csDb('pp_action_save', {
      id: makeId('act'), sessionId: String(b.sessionId),
      kind: 'point', target: JSON.stringify(b.target || {}), confirmed: false, createdAt: nowIso(),
    });
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/pointer/action', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.sessionId) return res.status(400).json({ ok: false, error: 'sessionId is required', code: 'VALIDATION' });
    if (!b.kind) return res.status(400).json({ ok: false, error: 'kind is required', code: 'VALIDATION' });
    const out = pointer.act(b.kind, b.detail, { requiresConfirm: b.requiresConfirm, confirmToken: b.confirmToken });
    if (!out.ok) {
      const code = out.code === 'GUARDRAIL_REFUSED' ? 403 : (out.code === 'CONFIRMATION_REQUIRED' ? 428 : 400);
      return res.status(code).json(out);
    }
    csDb('pp_action_save', {
      id: makeId('act'), sessionId: String(b.sessionId),
      kind: String(b.kind), target: JSON.stringify(b.detail || {}),
      confirmed: b.confirmToken ? true : false, createdAt: nowIso(),
    });
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/pointer/resolve-text-id', (req, res) => {
  try {
    const b = req.body || {};
    const target = pointer.findTextId(b.controlMap, b.query);
    if (!target) return res.status(404).json({ ok: false, error: 'no text-id target for query', code: 'NOT_FOUND' });
    return res.json({ ok: true, target });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

// ── Pairing ────────────────────────────────────────────────────────────────
const pairingStore = pairing.memoryStore();

router.post('/api/pairing/secret', (req, res) => {
  try {
    const b = req.body || {};
    const out = pairing.mintSecret(b.deviceId || 'unknown', {
      save: (rec) => { pairingStore._map.set(rec.id, Object.assign({}, rec)); },
      get: (id) => (pairingStore._map.has(id) ? JSON.parse(JSON.stringify(pairingStore._map.get(id))) : null),
    });
    return res.json({ ok: true, pairingId: out.pairingId, secret: out.secret, expiresAt: out.expiresAt, ttlSeconds: out.ttlSeconds });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/pairing/verify', (req, res) => {
  try {
    const b = req.body || {};
    const out = pairing.consumeSecret(String(b.pairingId || ''), String(b.secret || ''), pairingStore);
    if (!out.ok) {
      const code = out.code === 'NOT_FOUND' ? 404 : (out.code === 'EXPIRED' || out.code === 'ALREADY_USED' ? 410 : 403);
      return res.status(code).json(out);
    }
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/pairing/discover', (req, res) => {
  try {
    return res.json({ ok: true, discovery: pairing.discoveryInfo() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

// ── Meeting notes ─────────────────────────────────────────────────────────
router.post('/api/notes/session/start', (req, res) => {
  try {
    const b = req.body || {};
    const session = notes.createNotesSession({ date: b.date });
    return res.json({ ok: true, session });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/notes/chunk', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.sessionId || !b.audioPath) return res.status(400).json({ ok: false, error: 'sessionId and audioPath are required', code: 'VALIDATION' });
    const s = { id: b.sessionId, dir: b.dir || '', status: 'recording', chunks: [], transcript: null, speakers: 'UNKNOWN' };
    const out = notes.addChunk(s, b.index || 0, b.audioPath);
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

// Test-friendly chunk endpoint that records metadata without requiring the file.
router.post('/api/notes/chunk-meta', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.sessionId) return res.status(400).json({ ok: false, error: 'sessionId is required', code: 'VALIDATION' });
    const s = { id: b.sessionId, dir: b.dir || '', status: 'recording', chunks: [], transcript: null, speakers: 'UNKNOWN' };
    s.chunks.push({ index: b.index || 0, path: b.audioPath || ('chunk_' + (b.index || 0) + '.aac'), bytes: b.bytes || 0, at: new Date().toISOString() });
    return res.json({ ok: true, chunk: s.chunks[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/notes/session/stop', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.sessionId) return res.status(400).json({ ok: false, error: 'sessionId is required', code: 'VALIDATION' });
    const session = {
      id: b.sessionId,
      dir: b.dir || '',
      status: 'recording',
      chunks: (b.chunks || []).map((c, i) => ({ index: i, path: c, bytes: 0 })),
      transcript: null,
      speakers: 'UNKNOWN',
    };
    const out = await notes.stop(session, b.transcriber);
    if (!out.ok) return res.status(502).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/notes/:id', (req, res) => {
  try {
    const out = notes.readNotes(String(req.params.id));
    if (!out.ok) return res.status(404).json(out);
    return res.json({ ok: true, notes: out.notes, path: out.path });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/notes/:id/agent-prompt', (req, res) => {
  try {
    const out = notes.readNotes(String(req.params.id));
    if (!out.ok) return res.status(404).json(out);
    const session = { transcript: out.notes };
    return res.json({ ok: true, prompt: notes.agentPrompt(session) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

// ── Voice session ─────────────────────────────────────────────────────────
router.post('/api/pointer/voice/press', (req, res) => {
  try {
    const b = req.body || {};
    const session = voice.createSession(b.sessionId || 'ptr_voice');
    const out = voice.pressStart(session);
    if (!out.ok) return res.status(409).json(out);
    return res.json(Object.assign({ ok: true }, out, { state: session.state }));
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/pointer/voice/release', (req, res) => {
  try {
    const b = req.body || {};
    const session = voice.createSession(b.sessionId || 'ptr_voice');
    session.state = 'listening';
    const out = voice.pressRelease(session);
    if (!out.ok) return res.status(409).json(out);
    return res.json(Object.assign({ ok: true }, out, { state: session.state }));
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/pointer/voice/reply', (req, res) => {
  try {
    const b = req.body || {};
    const session = voice.createSession(b.sessionId || 'ptr_voice');
    session.state = 'thinking';
    const out = voice.reply(session, b.text);
    if (!out.ok) return res.status(409).json(out);
    return res.json(Object.assign({ ok: true }, out, { state: session.state, chirp: voice.chirpScript() }));
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/pointer/voice/bubble', (req, res) => {
  try {
    const text = req.query && req.query.text ? String(req.query.text) : '';
    return res.json({ ok: true, html: voice.bubbleHtml(text) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

module.exports = router;
