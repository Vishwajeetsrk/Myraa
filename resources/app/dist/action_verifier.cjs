'use strict';
/**
 * Action -> Observe -> Verify (spec phases 7-8). Uses EXISTING systems only:
 * Screen Intelligence for observation, approval_manager for risky actions,
 * the UIA service for execution, action_receipts for audit, event_bus for facts.
 * An action is "verified" only when a real post-action observation changed.
 */
const screen = require('./screen_intelligence.cjs');
const approvals = require('./approval_manager.cjs');
const receipts = require('./action_receipts.cjs');
const events = require('./event_bus.cjs');
const uia = require('./ui_automation_service.cjs');

const MUTATING = new Set(['uia.invokeControl', 'uia.setControlValue', 'desktop.click', 'desktop.type']);
function slice(v, n) { return String(v == null ? '' : v).slice(0, n); }

function snapshot(ctx) {
  if (!ctx) return null;
  return {
    at: ctx.timestamp,
    window: ctx.activeWindow && ctx.activeWindow.title ? ctx.activeWindow.title : null,
    controls: Array.isArray(ctx.uiTree) ? ctx.uiTree.map((c) => ({ name: c.name, type: c.controlType, automationId: c.automationId })) : [],
    confidence: ctx.confidence,
  };
}
function compare(beforeCtx, afterCtx) {
  const a = snapshot(beforeCtx);
  const b = snapshot(afterCtx);
  if (!a || !b) return { ok: false, code: 'NO_OBSERVATION', changes: [] };
  const changes = [];
  if (a.window !== b.window) changes.push({ what: 'activeWindow', from: a.window, to: b.window });
  const names = (list) => (list || []).map((c) => c.name + '|' + (c.automationId || '')).sort().join(';');
  const beforeNames = names(a.controls);
  const afterNames = names(b.controls);
  if (beforeNames !== afterNames) changes.push({ what: 'uiTree', from: beforeNames.slice(0, 300), to: afterNames.slice(0, 300) });
  return { ok: true, changes, verified: changes.length > 0, before: a, after: b };
}

async function run(input) {
  const i = input || {};
  const action = slice(i.action, 80);
  if (!action) return { ok: false, code: 'VALIDATION', error: 'action is required' };
  if (MUTATING.has(action) && !i.bindingId) {
    return { ok: false, code: 'APPROVAL_REQUIRED', error: 'mutating actions require an approved binding' };
  }
  if (i.bindingId) {
    const binding = approvals.find({ bindingId: i.bindingId });
    if (!binding.ok) return binding;
    if (binding.binding.status !== 'approved') {
      return { ok: false, code: 'NOT_APPROVED', error: 'binding is ' + binding.binding.status };
    }
  }

  const before = await screen.captureContext({});
  if (!before.ok) return { ok: false, code: before.code, error: before.error };

  let execution;
  const started = receipts.start({ tool: action, risk: i.bindingId ? 'HIGH' : 'LOW', decision: i.bindingId ? 'approved' : 'auto', params: { query: i.query, target: i.target } });
  try {
    if (action === 'uia.invokeControl') {
      if (!i.query) return { ok: false, code: 'VALIDATION', error: 'query is required for invokeControl' };
      const raw = uia.invokeControl(i.windowTitle || before.context.activeWindow.title, i.query);
      execution = Promise.resolve(raw).then((v) => ({ ok: !v || v.ok !== false, result: v }));
    } else if (action === 'screen.observe') {
      execution = Promise.resolve({ ok: true, result: { observed: true } });
    } else {
      execution = Promise.resolve({ ok: false, code: 'NOT_IMPLEMENTED', error: 'executor for ' + action + ' is not implemented' });
    }
    const exec = await execution;
    if (!exec.ok) {
      receipts.finish(started.receipt.id, { ok: false, outcome: slice(exec.error || 'execution failed', 300) });
      return { ok: false, code: exec.code || 'EXECUTION_FAILED', error: exec.error };
    }

    const after = await screen.captureContext({});
    if (!after.ok) {
      receipts.finish(started.receipt.id, { ok: false, outcome: 'post-action observation failed: ' + after.code });
      return { ok: false, code: 'POST_OBSERVATION_FAILED', error: after.error };
    }
    const diff = compare(before.context, after.context);
    receipts.finish(started.receipt.id, {
      ok: true,
      outcome: diff.verified ? 'action verified by real observation' : 'action executed but no observable change',
      evidence: { changes: diff.changes.length, confidenceAfter: after.context.confidence },
    });
    try { events.emit('action.verified', { action, verified: diff.verified, changes: diff.changes.length }); } catch (e) {}
    return {
      ok: true,
      verified: diff.verified,
      action,
      before: diff.before,
      after: diff.after,
      changes: diff.changes,
      receiptId: started.receipt.id,
      note: diff.verified ? 'verified by real observation' : 'NOT verified - no observed change (never claiming success)',
    };
  } catch (e) {
    receipts.finish(started.receipt.id, { ok: false, outcome: slice(e && e.message, 300) });
    return { ok: false, code: 'EXECUTION_ERROR', error: slice(e && e.message, 300) };
  }
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.post('/run', async (req, res) => res.json(await run(req.body || {})));
  router.post('/compare', (req, res) => res.json(compare((req.body || {}).before, (req.body || {}).after)));
  router.get('/history', (req, res) => res.json(receipts.list({ tool: req.query.tool, limit: 50 })));
  return router;
}

module.exports = { MUTATING, snapshot, compare, run, createRouter };
