'use strict';
/**
 * Step watcher (Phase 29) - settle-aware observation of task steps.
 * OS-agnostic: callers supply raw image bytes (or a base64 image); no screen code here.
 * Run: node tests\test_step_watcher.cjs
 */

const crypto = require('crypto');

function slice(v, n) { return String(v == null ? '' : v).slice(0, n); }

function fingerprint(input, opts) {
  const o = opts || {};
  let buf;
  if (Buffer.isBuffer(input)) buf = input;
  else if (typeof input === 'string') {
    try { buf = Buffer.from(input, 'base64'); }
    catch (e) { return null; }
  } else if (input && typeof input === 'object' && Buffer.isBuffer(input.data)) buf = input.data;
  else return null;
  if (!buf.length) return null;
  const stride = Math.max(1, Math.floor(buf.length / Number(o.samples || 2560)));
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < buf.length; i += stride) {
    h1 ^= buf[i]; h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + buf[i] + Math.imul(h2, 31)) >>> 0;
  }
  // Include total length so two different-size captures never collide trivially.
  h1 = (h1 ^ buf.length) >>> 0;
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'));
}

function createStepWatcher(opts) {
  const o = opts || {};
  const bus = o.eventBus || null;
  const settleMs = Number(o.settleMs) > 0 ? Number(o.settleMs) : 600;
  let lastHash = null;
  let changedAt = 0;
  let step = '';
  let observes = 0;
  let completions = 0;

  function emit(type, payload) {
    if (!bus || typeof bus.emit !== 'function') return;
    try { bus.emit(type, payload, { source: 'step-watcher' }); } catch (e) { /* ignore */ }
  }
  function observe(input) {
    const i = input || {};
    const hash = i.fingerprint ? slice(i.fingerprint, 80) : fingerprint(i.image);
    if (!hash) return { ok: false, code: 'VALIDATION', error: 'image or fingerprint is required' };
    observes++;
    const now = Date.now();
    step = slice(i.step, 120);
    if (hash !== lastHash) {
      lastHash = hash;
      changedAt = now;
      emit('step.changed', { step, hash });
      return { ok: true, changed: true, done: false, heldMs: 0, step, hash };
    }
    const heldMs = now - changedAt;
    const done = heldMs >= settleMs;
    if (done) completions++;
    emit(done ? 'step.done' : 'step.settling', { step, hash, heldMs });
    return { ok: true, changed: false, done, heldMs, step, hash };
  }
  function reset() { lastHash = null; changedAt = 0; step = ''; observes = 0; completions = 0; return { ok: true }; }
  function status() { return { ok: true, settleMs, lastHash, step, observes, completions, watching: !!lastHash }; }

  function createRouter() {
    let router = null;
    try { router = require('express').Router(); } catch (e) { return null; }
    router.post('/observe', (req, res) => res.json(observe(req.body || {})));
    router.get('/status', (req, res) => res.json(status()));
    router.post('/reset', (req, res) => res.json(reset()));
    return router;
  }

  return { fingerprint, observe, reset, status, createRouter };
}

const singleton = createStepWatcher({});

module.exports = { fingerprint, createStepWatcher, observe: singleton.observe, reset: singleton.reset, status: singleton.status, createRouter: singleton.createRouter };
