'use strict';
/**
 * Phase 13: derive an avatar *state label* from real runtime signals.
 * This does NOT touch the 3D model, meshes, animations, eye tracking or camera.
 * It only publishes a state signal that UI/addons can read.
 */
const events = require('./event_bus.cjs');

const STATES = Object.freeze(['idle', 'listening', 'thinking', 'speaking', 'working', 'error', 'success', 'warning', 'happy', 'confused', 'interrupted']);
let current = 'idle';
let source = 'runtime';
const history = [];

function apply(state, from, detail) {
  if (!STATES.includes(state)) return { ok: false, code: 'VALIDATION', error: 'unknown avatar state' };
  current = state;
  source = String(from || 'runtime').slice(0, 80);
  history.unshift({ state, source, detail: String(detail || '').slice(0, 200), at: new Date().toISOString() });
  if (history.length > 100) history.pop();
  return { ok: true, state, source };
}

events.subscribe((evt) => {
  const type = String((evt && evt.type) || '');
  const p = (evt && evt.payload) || evt || {};
  if (type === 'task.voice_state') apply(p.state, p.source || 'voice', p.detail);
  else if (type === 'task.running' || type === 'task.created') apply('working', 'task', p.taskId);
  else if (type === 'task.completed') apply('success', 'task', p.taskId);
  else if (type === 'task.failed') apply('error', 'task', p.error);
  else if (type === 'safety.confirmation_required' || type === 'approval.required') apply('warning', 'approval', p.tool);
});

function state() { return { ok: true, state: current, source, history: history.slice(0, 30) }; }
function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/state', (req, res) => res.json(state()));
  router.get('/history', (req, res) => res.json({ ok: true, history: history.slice(0, 100) }));
  return router;
}

module.exports = { STATES, apply, state, createRouter };
