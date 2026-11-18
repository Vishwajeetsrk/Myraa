'use strict';
/**
 * Activity Center (spec phases 25, 29-31): one read-only aggregation of REAL
 * runtime state. No fabricated event, status, duration or count.
 */
const events = require('./event_bus.cjs');
const tasks = require('./task_engine.cjs');
const receipts = require('./action_receipts.cjs');
const approvals = require('./approval_manager.cjs');
const screen = require('./screen_intelligence.cjs');
const connectors = require('./connector_registry.cjs');
const health = require('./health_manager.cjs');
const registry = require('./agi/capability_registry.cjs');
const capabilityBootstrap = require('./agi/capability_bootstrap.cjs');

function safe(label, fn) {
  try {
    const v = fn();
    return { ok: true, label, value: v };
  } catch (e) { return { ok: false, label, error: String(e && e.message).slice(0, 300) }; }
}

function summary() {
  const taskData = safe('tasks', () => tasks.summary());
  const receiptData = safe('receipts', () => receipts.list({ limit: 20 }));
  const approvalData = safe('approvals', () => approvals.pending());
  const connectorData = safe('connectors', () => connectors.status());
  const capData = safe('capabilities', () => {
    capabilityBootstrap.ensureRegistered();
    return registry.getCapabilitySummary();
  });
  const screenData = safe('screen', () => screen.status());
  const eventData = safe('events', () => events.tail ? events.tail(40) : events.list({ limit: 40 }));
  const healthData = health.getLast();

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    screen: screenData.ok ? screenData.value : { consent: null, error: screenData.error },
    activity: {
      events: eventData.ok
        ? (Array.isArray(eventData.value) ? eventData.value : (Array.isArray(eventData.value && eventData.value.events) ? eventData.value.events : []))
        : [],
      eventsError: eventData.error || null,
      tasks: taskData.ok ? taskData.value : null,
      tasksError: taskData.error || null,
      receipts: receiptData.ok ? receiptData.value.receipts : [],
      receiptsError: receiptData.error || null,
    },
    approvals: approvalData.ok ? {
      waiting: (approvalData.value.waiting || []).length,
      approved: (approvalData.value.approved || []).length,
      status: approvalData.value.status ? approvalData.value.status.counts : null,
    } : { waiting: null, approved: null, error: approvalData.error },
    connectors: connectorData.ok ? connectorData.value : { error: connectorData.error },
    capabilities: capData.ok ? capData.value : { error: capData.error },
    health: healthData ? { generatedAt: healthData.generatedAt, byStatus: healthData.byStatus, checks: healthData.checks.length } : null,
    note: 'all values are read from live registries; null means unavailable, never zero',
  };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/summary', (req, res) => res.json(summary()));
  return router;
}
module.exports = { summary, createRouter };
