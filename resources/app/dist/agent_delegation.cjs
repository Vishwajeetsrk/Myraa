'use strict';
/**
 * Phase 10: specialist delegation over the EXISTING 28-agent orchestrator.
 * No new agent runtime. Results are structured, events are real, failures
 * are honest. MYRAA Core stays the single user-facing identity.
 */
const orchestrator = require('./multi_agent_orchestrator.cjs');
const events = require('./event_bus.cjs');
const registry = require('./agi/capability_registry.cjs');

const SPECIALISTS = Object.freeze({
  'MYRAA Core': 'coordinator',
  'Researcher': 'research',
  'Coder': 'developer',
  'Debugger': 'debugging',
  'Browser Agent': 'browser',
  'Windows Agent': 'desktop',
  'Data Analyst': 'data_analyst',
  'Office Agent': 'document',
  'GitHub Agent': 'developer',
  'DevOps Agent': 'devops',
  'Security Analyst': 'security',
  'Designer': 'design',
  'Figma Agent': 'design',
  'Canva Agent': 'design',
  'CRM Agent': 'business',
  'Email Agent': 'coordinator',
  'Learning Coach': 'planner',
  'Course Creator': 'document',
  'Reverse Engineer': 'developer',
  'QA Agent': 'qa',
  'Project Manager': 'planner',
});

const tasks = new Map();
function slice(v, n) { return String(v == null ? '' : v).slice(0, n); }

function agents() {
  return orchestrator.listAgents().map((a) => ({
    id: a.id,
    name: a.name,
    role: slice(a.role, 300),
    status: registry.STATUS.READY,
    statusSource: 'runtime',
    source: 'multi_agent_orchestrator',
  }));
}
function resolve(name) {
  const key = slice(name, 80).trim();
  const id = SPECIALISTS[key] || key;
  return agents().find((a) => a.id === id) || null;
}

async function delegate(input) {
  const i = input || {};
  const goal = slice(i.goal, 2000).trim();
  if (!goal) return { ok: false, code: 'VALIDATION', error: 'goal is required' };
  const id = 'del_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const task = {
    id,
    goal,
    specialist: slice(i.specialist, 80) || 'MYRAA Core',
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
  };
  tasks.set(id, task);
  const emit = (type, payload) => { try { events.emit('task.' + type, payload); } catch (e) { /* events never throw */ } };
  emit('agent_started', { taskId: id, specialist: task.specialist });

  const agent = resolve(task.specialist);
  if (!agent) {
    task.status = 'FAILED';
    task.error = 'unknown specialist (no registered agent matches "' + task.specialist + '")';
    task.completedAt = new Date().toISOString();
    emit('agent_failed', { taskId: id, error: task.error });
    return { ok: false, code: 'SPECIALIST_UNAVAILABLE', task };
  }

  task.status = 'RUNNING';
  task.startedAt = new Date().toISOString();
  try {
    const raw = await Promise.race([
      orchestrator.runAgent(agent.id, goal, i.context || {}),
      new Promise((_, reject) => setTimeout(() => reject(new Error('delegation timed out after 120s')), 120000)),
    ]);
    task.status = 'COMPLETED';
    task.completedAt = new Date().toISOString();
    task.result = {
      task: id,
      status: 'COMPLETED',
      agent: agent.id,
      agentName: agent.name,
      findings: slice(raw && raw.output, 4000),
      artifacts: [],
      actions: [],
      errors: [],
      evidence: [
        raw && raw.provider ? { kind: 'provider', value: raw.provider } : null,
        raw && raw.model ? { kind: 'model', value: raw.model } : null,
        raw && raw.timestamp ? { kind: 'timestamp', value: raw.timestamp } : null,
      ].filter(Boolean),
      nextSteps: [],
    };
    emit('agent_completed', { taskId: id, specialist: agent.id });
    return { ok: true, task };
  } catch (e) {
    task.status = 'FAILED';
    task.completedAt = new Date().toISOString();
    task.error = slice(e && e.message, 400);
    emit('agent_failed', { taskId: id, error: task.error });
    return { ok: false, code: 'DELEGATION_FAILED', task };
  }
}

function get(id) { return tasks.get(String(id || '')) || null; }
function history(limit) {
  const n = Math.min(100, Math.max(1, Number(limit) || 50));
  return Array.from(tasks.values()).slice(-n).reverse();
}
function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/agents', (req, res) => res.json({ ok: true, count: agents().length, agents: agents() }));
  router.post('/delegate', async (req, res) => {
    const r = await delegate(req.body || {});
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.get('/task/:id', (req, res) => {
    const t = get(req.params.id);
    res.status(t ? 200 : 404).json(t ? { ok: true, task: t } : { ok: false, code: 'NOT_FOUND' });
  });
  router.get('/history', (req, res) => res.json({ ok: true, tasks: history(req.query.limit) }));
  return router;
}

module.exports = { SPECIALISTS, agents, resolve, delegate, get, history, createRouter };
