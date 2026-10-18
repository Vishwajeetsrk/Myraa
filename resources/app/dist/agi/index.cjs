'use strict';

/**
 * MYRAA AGI — Foundation Index
 * ---------------------------------------------------------------------------
 * Single entry point for the AGI foundation layer.
 * Initializes all four engines, registers built-in components, and exports
 * a unified API + Express router.
 *
 * Usage:
 *   const agi = require('./agi/index.cjs');
 *   await agi.init();
 *   const report = await agi.health.checkAll();
 *   agi.timeline.record({ type: 'system', engine: 'init', action: 'started' });
 */

'use strict';

const capabilityRegistry = require('./capability_registry.cjs');
const toolExecution = require('./tool_execution_engine.cjs');
const healthMonitor = require('./unified_health_monitor.cjs');
const activityTimeline = require('./activity_timeline.cjs');

let initialized = false;

/**
 * Initialize the AGI foundation layer.
 * Registers built-in health checks, loads persisted state, starts auto-flush.
 */
async function init() {
  if (initialized) return { ok: true, message: 'already initialized' };

  // Load persisted timeline
  activityTimeline.load();
  activityTimeline.startAutoFlush();

  // Load persisted capability registry
  capabilityRegistry.loadRegistry();

  // Register built-in health checks
  healthMonitor.register('process', {
    name: 'Node.js Process',
    category: 'core',
    check: healthMonitor.checkProcess(),
    interval: 30000,
    critical: true,
  });

  healthMonitor.register('disk', {
    name: 'Disk Space',
    category: 'core',
    check: healthMonitor.checkDiskSpace(),
    interval: 300000,
    critical: false,
  });

  healthMonitor.register('server', {
    name: 'Express Server',
    category: 'core',
    check: healthMonitor.checkServerPort(3000),
    interval: 60000,
    critical: true,
  });

  // Register autonomous intelligence v2
  try {
    if (!capabilityRegistry.get('autonomous_decision_engine')) {
      capabilityRegistry.register({
        id: 'autonomous_decision_engine',
        name: 'Autonomous Decision + Engineering Intelligence V2',
        category: capabilityRegistry.CATEGORIES.DEVELOPMENT,
        version: '2.0.0',
        description: 'Autonomous decision pipeline, design tokens, PRD generation, quality gates, and project memory',
        capabilities: [
          'autonomous_decision_pipeline',
          'design_tokens_generation',
          'mini_prd_generation',
          'pure_svg_icon_registry',
          'adaptive_feedback_processing',
          'quality_gate_audit',
          'project_memory_tracking'
        ],
        dependencies: [],
        entryPoint: 'autonomous_decision_engine.cjs',
        riskLevel: 'LOW',
        enabled: true
      });
    }
  } catch (e) {}

  // Record init event
  activityTimeline.systemAction('agi.init', 'AGI foundation layer initialized', 'ok', {
    modules: ['capability_registry', 'tool_execution', 'health_monitor', 'activity_timeline', 'autonomous_decision_engine'],
  });

  initialized = true;
  return { ok: true };
}

/**
 * Create a combined Express router mounting all AGI endpoints.
 */
function createRouter() {
  const express = require('express');
  const router = express.Router();

  // Mount sub-routers
  router.use('/capabilities', capabilityRegistry.createRouter());
  router.use('/tools', toolExecution.createRouter());
  router.use('/health', healthMonitor.createRouter());
  router.use('/timeline', activityTimeline.createRouter());

  // Combined status endpoint
  router.get('/status', async (req, res) => {
    const capSummary = capabilityRegistry.getSummary();
    const toolStats = toolExecution.getGlobalStats();
    const healthReport = healthMonitor.getReport();
    const timelineStats = activityTimeline.getStats();

    res.json({
      version: '1.0.0',
      initialized,
      capabilities: capSummary,
      tools: toolStats,
      health: { overall: healthReport.overall, summary: healthReport.summary },
      timeline: { totalEvents: timelineStats.totalEvents, errorRate: timelineStats.errorRate },
    });
  });

  return router;
}

/**
 * Graceful shutdown.
 */
function shutdown() {
  activityTimeline.stopAutoFlush();
  activityTimeline.systemAction('agi.shutdown', 'AGI foundation layer shutting down');
  activityTimeline.flush();
  capabilityRegistry.saveRegistry();
  initialized = false;
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  init,
  shutdown,
  createRouter,

  // Sub-module access
  registry: capabilityRegistry,
  executor: toolExecution,
  health: healthMonitor,
  timeline: activityTimeline,

  // Convenience re-exports
  CATEGORIES: capabilityRegistry.CATEGORIES,
  RISK: toolExecution.RISK,
  EVENT_TYPES: activityTimeline.EVENT_TYPES,
  STATES: healthMonitor.STATES,
};
