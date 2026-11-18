'use strict';
/**
 * Phase 7: HTTP approval surface over the EXISTING safety broker, workspace
 * approval cards and tool execution engine. No new approval logic, no bypass.
 */
const broker = require('./safety_broker.cjs');
const engine = require('./agi/tool_execution_engine.cjs');
const workspaceModule = require('./agent_workspace.cjs');
function freshWorkspace() { return workspaceModule.createWorkspace({}); }

broker.setEngine(engine);

function request(input) {
  const i = input || {};
  const r = String(i.risk || 'HIGH').toUpperCase();
  if (!broker.BROKER_RISKS.includes(r)) {
    return { ok: false, code: 'VALIDATION', error: 'safety broker covers: ' + broker.BROKER_RISKS.join(', ') };
  }
  return broker.requestApproval({ tool: i.tool, params: i.params || {}, risk: r, reason: i.reason, threadId: i.threadId });
}
function pending() {
  const waiting = broker.listBindings({ status: 'waiting', limit: 50 });
  const approved = broker.listBindings({ status: 'approved', limit: 50 });
  return { ok: true, waiting: waiting.bindings, approved: approved.bindings, status: broker.status() };
}
function decide(input) {
  const i = input || {};
  const b = broker.findBinding(i.bindingId);
  if (!b) return { ok: false, code: 'NOT_FOUND', error: 'unknown binding' };
  const decision = String(i.decision || '').toLowerCase();
  if (!['approve', 'deny'].includes(decision)) return { ok: false, code: 'VALIDATION', error: 'decision must be approve or deny' };
  const d = freshWorkspace().decideApproval({ id: b.approvalId, decision, decidedBy: i.decidedBy || 'user', note: i.note });
  if (!d.ok) return d;
  const sync = broker.syncWithWorkspace();
  return { ok: true, decision: d.approval, sync };
}
async function execute(input) {
  const b = broker.findBinding((input || {}).bindingId);
  if (!b) return { ok: false, code: 'NOT_FOUND', error: 'unknown binding' };
  return broker.executeBinding(b.id, { engine });
}
function status() { return broker.status(); }

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/pending', (req, res) => res.json(pending()));
  router.post('/request', (req, res) => {
    const r = request(req.body || {});
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.post('/decide', (req, res) => {
    const r = decide(req.body || {});
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.post('/execute', async (req, res) => {
    const r = await execute(req.body || {});
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.get('/status', (req, res) => res.json(status()));
  return router;
}

module.exports = { request, pending, decide, execute, status, createRouter };
