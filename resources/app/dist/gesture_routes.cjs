'use strict';
/**
 * MYRAA Gesture — routes (Phase 15).
 * Thin HTTP over gesture_board.cjs. Board server + camera stay optional;
 * every endpoint degrades to honest offline/UNKNOWN states.
 */

const express = require('express');
const gesture = require('./gesture_board.cjs');

const router = express.Router();

router.post('/api/gesture/ring', (req, res) => {
  try {
    const b = req.body || {};
    const out = gesture.setRing(b.state, { mood: b.mood });
    if (!out.ok) return res.status(400).json(out);
    return res.json({ ok: true, state: out.state });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/gesture/ring', (req, res) => {
  try {
    return res.json(gesture.readRing());
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.post('/api/gesture/board', async (req, res) => {
  try {
    const out = await gesture.boardCmd((req.body && req.body.action) || req.body);
    if (!out.ok) {
      const code = out.code === 'VALIDATION' ? 400 : 502;
      return res.status(code).json(out);
    }
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/gesture/board-state', async (req, res) => {
  try {
    const out = await gesture.boardState();
    if (!out.ok) return res.status(502).json(out);
    return res.json({ ok: true, state: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

router.get('/api/gesture/status', async (req, res) => {
  try {
    return res.json(await gesture.status());
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

module.exports = router;
