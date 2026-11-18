'use strict';
/**
 * Phase 11: persistent tasks with explicit state machine and real events.
 * Backed by an append-only JSONL file. No fake progress, no invented results.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const events = require('./event_bus.cjs');

const STATUSES = Object.freeze(['QUEUED', 'RUNNING', 'WAITING_FOR_APPROVAL', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED']);
const TRANSITIONS = Object.freeze({
  QUEUED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['WAITING_FOR_APPROVAL', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  WAITING_FOR_APPROVAL: ['RUNNING', 'CANCELLED', 'FAILED'],
  PAUSED: ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  FAILED: ['RUNNING'],
  CANCELLED: [],
});
function defaultStore() {
  const base = process.env.MYRAA_DATA_DIR || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'MYRAA');
  return process.env.MYRAA_TASK_DB || path.join(base, 'tasks.jsonl');
}
function slice(v, n) { return String(v == null ? '' : v).slice(0, n); }
function now() { return new Date().toISOString(); }

function createEngine(opts) {
  const o = opts || {};
  const file = o.storePath || defaultStore();
  function load() {
    try {
      const byId = new Map();
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)) {
        try {
          const task = JSON.parse(line);
          if (task && task.id) byId.set(task.id, task); // newest record per id wins
        } catch (e) { /* ignore bad line */ }
      }
      return Array.from(byId.values()).slice(-500);
    } catch (e) { return []; }
  }
  function append(task) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, JSON.stringify(task) + '\n', 'utf8');
    } catch (e) { /* in-memory state still usable */ }
  }
  function emit(type, payload) { try { events.emit('task.' + type, payload); } catch (e) {} }
  function byId(id) { return load().find((t) => t.id === String(id || '')) || null; }

  function create(input) {
    const i = input || {};
    const goal = slice(i.goal, 2000).trim();
    if (!goal) return { ok: false, code: 'VALIDATION', error: 'goal is required' };
    const task = {
      id: 'tsk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      goal,
      agent: slice(i.agent, 80) || 'MYRAA Core',
      status: 'QUEUED',
      steps: Array.isArray(i.steps) ? i.steps.slice(0, 50).map((s, n) => ({ id: n + 1, label: slice(s, 200), status: 'QUEUED' })) : [],
      approvals: [],
      tools: Array.isArray(i.tools) ? i.tools.slice(0, 50) : [],
      createdAt: now(),
      updatedAt: now(),
      result: null,
      error: null,
    };
    append(task);
    emit('created', { taskId: task.id, goal: task.goal });
    return { ok: true, task };
  }

  function transition(id, status, extra) {
    const t = byId(id);
    if (!t) return { ok: false, code: 'NOT_FOUND', error: 'unknown task' };
    if (!TRANSITIONS[t.status].includes(status)) {
      return { ok: false, code: 'INVALID_TRANSITION', error: t.status + ' -> ' + status + ' is not allowed', allowed: TRANSITIONS[t.status] };
    }
    t.status = status;
    t.updatedAt = now();
    if (extra && extra.result !== undefined) t.result = slice(JSON.stringify(extra.result), 4000);
    if (extra && extra.error) t.error = slice(extra.error, 400);
    append(t);
    emit(status.toLowerCase(), { taskId: t.id, status, error: t.error });
    return { ok: true, task: t };
  }

  function attachApproval(id, bindingId) {
    const t = byId(id);
    if (!t) return { ok: false, code: 'NOT_FOUND', error: 'unknown task' };
    t.approvals.push(slice(bindingId, 120));
    t.updatedAt = now();
    append(t);
    return { ok: true, task: t };
  }

  function list(opts) {
    const o2 = opts || {};
    let items = load();
    if (o2.status) items = items.filter((t) => t.status === o2.status);
    const limit = Math.min(100, Math.max(1, Number(o2.limit) || 50));
    return { ok: true, count: items.length, tasks: items.slice(-limit).reverse() };
  }
  function summary() {
    const items = load();
    const byStatus = {};
    for (const t of items) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    return { ok: true, total: items.length, byStatus, statuses: Object.keys(STATUSES) };
  }
  function createRouter() {
    let router = null;
    try { router = require('express').Router(); } catch (e) { return null; }
    router.get('/summary', (req, res) => res.json(summary()));
    router.get('/list', (req, res) => res.json(list(req.query)));
    router.post('/create', (req, res) => {
      const r = create(req.body || {});
      res.status(r.ok ? 200 : 400).json(r);
    });
    router.get('/:id', (req, res) => {
      const t = byId(req.params.id);
      res.status(t ? 200 : 404).json(t ? { ok: true, task: t } : { ok: false, code: 'NOT_FOUND' });
    });
    router.post('/:id/transition', (req, res) => {
      const b = req.body || {};
      const r = transition(req.params.id, b.status, b);
      res.status(r.ok ? 200 : 400).json(r);
    });
    router.post('/:id/approval', (req, res) => {
      const r = attachApproval(req.params.id, (req.body || {}).bindingId);
      res.status(r.ok ? 200 : 400).json(r);
    });
    return router;
  }
  return { STATUSES, TRANSITIONS, create, transition, attachApproval, get: byId, list, summary, createRouter, storePath: () => file };
}

const singleton = createEngine({});
module.exports = Object.assign({ STATUSES, TRANSITIONS, createEngine }, {
  create: singleton.create,
  transition: singleton.transition,
  attachApproval: singleton.attachApproval,
  get: singleton.get,
  list: singleton.list,
  summary: singleton.summary,
  createRouter: singleton.createRouter,
  storePath: singleton.storePath,
});
