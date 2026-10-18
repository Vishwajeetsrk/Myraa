'use strict';
/**
 * MYRAA Evidence Engine - routes (Phase 16).
 * Thin HTTP over evidence_engine.cjs. Investigation records only:
 * no raw subject execution, bounded outputs everywhere.
 */

const express = require('express');
const engine = require('./evidence_engine.cjs');
const { createEngine } = engine;

const router = express.Router();
const eng = createEngine({});

router.post('/api/evidence/session', (req, res) => {
  try {
    const b = req.body || {};
    const out = eng.createSession({ label: b.label, subject: b.subject });
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/evidence/sessions', (req, res) => {
  try {
    return res.json(eng.listSessions(Number(req.query.limit) || undefined));
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/evidence/finding', (req, res) => {
  try {
    const b = req.body || {};
    const out = eng.addFinding({
      sessionId: b.sessionId,
      kind: b.kind,
      inference: b.inference,
      confidence: b.confidence,
      sourceTool: b.sourceTool,
      evidence: b.evidence,
    });
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/evidence/findings', (req, res) => {
  try {
    const out = eng.listFindings({
      sessionId: req.query.session || '',
      limit: Number(req.query.limit) || undefined,
    });
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/evidence/evidence', (req, res) => {
  try {
    const b = req.body || {};
    const out = eng.addEvidence({
      findingId: b.findingId,
      kind: b.kind,
      value: b.value,
      provenance: b.provenance,
    });
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/evidence/evidence', (req, res) => {
  try {
    const out = eng.listEvidence({ findingId: String(req.query.finding || '') });
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/evidence/unknowns', (req, res) => {
  try {
    const b = req.body || {};
    const out = eng.addUnknown({
      sessionId: b.sessionId,
      question: b.question,
      attemptedTools: b.attemptedTools,
    });
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/evidence/unknowns/resolve', (req, res) => {
  try {
    const b = req.body || {};
    const out = eng.resolveUnknown({ id: b.id, resolution: b.resolution });
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/evidence/unknowns', (req, res) => {
  try {
    const out = eng.listUnknowns({
      sessionId: String(req.query.session || ''),
      openOnly: req.query.open === '1' || req.query.open === 'true',
      limit: Number(req.query.limit) || undefined,
    });
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/evidence/compare', (req, res) => {
  try {
    const b = req.body || {};
    const out = eng.compareSessions({ a: b.a, b: b.b });
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/evidence/status', (req, res) => {
  try {
    return res.json(eng.status());
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

module.exports = router;
