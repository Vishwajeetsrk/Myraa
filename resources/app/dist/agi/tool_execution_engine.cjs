'use strict';

/**
 * MYRAA AGI — Tool Execution Engine
 * ---------------------------------------------------------------------------
 * Unified execution layer for all tools: run, retry, timeout, rollback, audit.
 *
 * Replaces ad-hoc `try { fn() } catch {}` patterns across 60+ engine files
 * with a single execution pipeline that provides:
 *   - Retry with exponential backoff
 *   - Configurable timeouts per tool
 *   - Automatic rollback on failure (if rollback fn provided)
 *   - Execution audit trail (who ran what, when, outcome)
 *   - Concurrency limiting (prevent resource exhaustion)
 *   - Risk gating (block CRITICAL tools without confirmation)
 *
 * Usage:
 *   const engine = require('./tool_execution_engine.cjs');
 *   engine.register('mouse_click', { fn: desktop.mouseClick, risk: 'MEDIUM', timeout: 5000 });
 *   const result = await engine.execute('mouse_click', { x: 100, y: 200 });
 */

'use strict';

const { EventEmitter } = require('events');

// ── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_CONCURRENT = 10;
const AUDIT_MAX_ENTRIES = 2000;

// ── Risk Levels ────────────────────────────────────────────────────────────

const RISK = {
  LOW:      { level: 0, label: 'LOW',      requiresConfirm: false },
  MEDIUM:   { level: 1, label: 'MEDIUM',   requiresConfirm: false },
  HIGH:     { level: 2, label: 'HIGH',     requiresConfirm: true },
  CRITICAL: { level: 3, label: 'CRITICAL', requiresConfirm: true },
};

// ── State ──────────────────────────────────────────────────────────────────

const tools = new Map();           // name → ToolDescriptor
const auditLog = [];               // circular buffer of execution records
let activeCount = 0;
const waitQueue = [];
const emitter = new EventEmitter();

// ── Tool Descriptor Shape ──────────────────────────────────────────────────
// {
//   name:        string
//   fn:          async function(params) => result
//   rollback:    async function(params, previousResult) => void  (optional)
//   risk:        'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'
//   timeout:     number (ms)
//   maxRetries:  number
//   retryDelay:  number (ms)
//   category:    string (for grouping in audit)
//   enabled:     boolean
//   preCheck:    async function(params) => boolean  (optional, gate before exec)
// }

// ── Registration ───────────────────────────────────────────────────────────

function register(name, descriptor) {
  if (!name || typeof name !== 'string') throw new Error('ToolExecution: name is required');
  if (!descriptor.fn || typeof descriptor.fn !== 'function') throw new Error('ToolExecution: fn is required');

  const tool = {
    name,
    fn: descriptor.fn,
    rollback: descriptor.rollback || null,
    risk: descriptor.risk || 'LOW',
    timeout: descriptor.timeout || DEFAULT_TIMEOUT_MS,
    maxRetries: descriptor.maxRetries !== undefined ? descriptor.maxRetries : DEFAULT_MAX_RETRIES,
    retryDelay: descriptor.retryDelay || DEFAULT_RETRY_DELAY_MS,
    category: descriptor.category || 'general',
    enabled: descriptor.enabled !== false,
    preCheck: descriptor.preCheck || null,
    executionCount: 0,
    errorCount: 0,
    totalDurationMs: 0,
    lastExecuted: 0,
    lastError: null,
  };

  tools.set(name, tool);
  return tool;
}

function registerAll(toolMap) {
  for (const [name, desc] of Object.entries(toolMap)) {
    register(name, desc);
  }
}

function get(name) {
  return tools.get(name) || null;
}

function listAll() {
  return Array.from(tools.values()).map(t => ({
    name: t.name,
    risk: t.risk,
    category: t.category,
    enabled: t.enabled,
    executionCount: t.executionCount,
    errorCount: t.errorCount,
    avgDurationMs: t.executionCount > 0 ? Math.round(t.totalDurationMs / t.executionCount) : 0,
    lastExecuted: t.lastExecuted,
    lastError: t.lastError,
  }));
}

function listByCategory(category) {
  return listAll().filter(t => t.category === category);
}

// ── Concurrency Control ────────────────────────────────────────────────────

function acquireSlot() {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise(resolve => waitQueue.push(resolve));
}

function releaseSlot() {
  activeCount--;
  if (waitQueue.length > 0) {
    activeCount++;
    const next = waitQueue.shift();
    next();
  }
}

// ── Execution ──────────────────────────────────────────────────────────────

/**
 * Execute a registered tool with full pipeline.
 *
 * @param {string} name - Tool name
 * @param {object} params - Tool parameters
 * @param {object} options - { confirm: boolean, dryRun: boolean, context: object }
 * @returns {{ success, result, error, durationMs, attempts, rolledBack }}
 */
async function execute(name, params = {}, options = {}) {
  const tool = tools.get(name);
  if (!tool) {
    return { success: false, result: null, error: `Tool '${name}' not found`, durationMs: 0, attempts: 0, rolledBack: false };
  }

  if (!tool.enabled) {
    return { success: false, result: null, error: `Tool '${name}' is disabled`, durationMs: 0, attempts: 0, rolledBack: false };
  }

  // Risk gate
  const riskDef = RISK[tool.risk] || RISK.LOW;
  if (riskDef.requiresConfirm && !options.confirm) {
    return {
      success: false, result: null,
      error: `Tool '${name}' requires confirmation (risk: ${tool.risk})`,
      durationMs: 0, attempts: 0, rolledBack: false, needsConfirm: true,
    };
  }

  // Pre-check gate
  if (tool.preCheck) {
    try {
      const allowed = await tool.preCheck(params);
      if (!allowed) {
        return { success: false, result: null, error: `Pre-check failed for '${name}'`, durationMs: 0, attempts: 0, rolledBack: false };
      }
    } catch (e) {
      return { success: false, result: null, error: `Pre-check error: ${e.message}`, durationMs: 0, attempts: 0, rolledBack: false };
    }
  }

  // Dry run
  if (options.dryRun) {
    return { success: true, result: { dryRun: true, tool: name, params }, error: null, durationMs: 0, attempts: 0, rolledBack: false };
  }

  // Acquire concurrency slot
  await acquireSlot();

  const startTime = Date.now();
  let lastError = null;
  let result = null;
  let attempts = 0;
  let rolledBack = false;

  try {
    for (let attempt = 0; attempt <= tool.maxRetries; attempt++) {
      attempts++;
      const attemptStart = Date.now();

      try {
        // Execute with timeout
        result = await Promise.race([
          tool.fn(params, options.context),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${tool.timeout}ms`)), tool.timeout)
          ),
        ]);

        // Success
        const durationMs = Date.now() - startTime;
        tool.executionCount++;
        tool.totalDurationMs += durationMs;
        tool.lastExecuted = Date.now();
        tool.lastError = null;

        audit(name, 'success', params, result, durationMs, attempts, options);
        emitter.emit('executed', { name, success: true, durationMs, attempts });

        return { success: true, result, error: null, durationMs, attempts, rolledBack: false };

      } catch (err) {
        lastError = err;
        tool.lastError = err.message;

        // Wait before retry (exponential backoff)
        if (attempt < tool.maxRetries) {
          const delay = tool.retryDelay * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // All retries exhausted — attempt rollback
    if (tool.rollback) {
      try {
        await tool.rollback(params, result);
        rolledBack = true;
      } catch (rbErr) {
        emitter.emit('rollbackFailed', { name, error: rbErr.message });
      }
    }

    const durationMs = Date.now() - startTime;
    tool.errorCount++;
    tool.lastExecuted = Date.now();

    audit(name, 'error', params, null, durationMs, attempts, options, lastError?.message);
    emitter.emit('executed', { name, success: false, durationMs, attempts, error: lastError?.message });

    return {
      success: false,
      result: null,
      error: lastError?.message || 'Unknown error',
      durationMs,
      attempts,
      rolledBack,
    };

  } finally {
    releaseSlot();
  }
}

/**
 * Execute multiple tools in sequence (pipeline).
 * Each tool receives the result of the previous one.
 */
async function pipeline(steps, options = {}) {
  const results = [];
  let input = options.initialInput || {};

  for (const step of steps) {
    const result = await execute(step.name, { ...input, ...step.params }, options);
    results.push({ step: step.name, ...result });

    if (!result.success) {
      return { success: false, results, failedAt: step.name, error: result.error };
    }
    input = result.result || {};
  }

  return { success: true, results, finalOutput: input };
}

/**
 * Execute multiple tools in parallel.
 */
async function parallel(toolCalls, options = {}) {
  const promises = toolCalls.map(call => execute(call.name, call.params, options));
  const results = await Promise.allSettled(promises);

  return results.map((r, i) => ({
    step: toolCalls[i].name,
    ...(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
  }));
}

// ── Audit Trail ────────────────────────────────────────────────────────────

function audit(name, status, params, result, durationMs, attempts, options, error) {
  const entry = {
    timestamp: Date.now(),
    tool: name,
    status,
    params: sanitizeParams(params),
    result: result ? truncate(JSON.stringify(result), 500) : null,
    durationMs,
    attempts,
    context: options.context?.requestId || null,
    error: error || null,
  };

  auditLog.push(entry);
  if (auditLog.length > AUDIT_MAX_ENTRIES) {
    auditLog.shift();
  }
}

function getAuditLog(options = {}) {
  let entries = auditLog;
  if (options.tool) entries = entries.filter(e => e.tool === options.tool);
  if (options.status) entries = entries.filter(e => e.status === options.status);
  if (options.since) entries = entries.filter(e => e.timestamp >= options.since);
  if (options.limit) entries = entries.slice(-options.limit);
  return entries;
}

function getToolStats(name) {
  const tool = tools.get(name);
  if (!tool) return null;
  return {
    name: tool.name,
    executionCount: tool.executionCount,
    errorCount: tool.errorCount,
    successRate: tool.executionCount > 0
      ? ((tool.executionCount - tool.errorCount) / tool.executionCount * 100).toFixed(1) + '%'
      : 'N/A',
    avgDurationMs: tool.executionCount > 0 ? Math.round(tool.totalDurationMs / tool.executionCount) : 0,
    lastExecuted: tool.lastExecuted,
    lastError: tool.lastError,
  };
}

function getGlobalStats() {
  const allTools = Array.from(tools.values());
  const totalExec = allTools.reduce((s, t) => s + t.executionCount, 0);
  const totalErrors = allTools.reduce((s, t) => s + t.errorCount, 0);
  const totalDuration = allTools.reduce((s, t) => s + t.totalDurationMs, 0);
  return {
    totalTools: tools.size,
    enabledTools: allTools.filter(t => t.enabled).length,
    totalExecutions: totalExec,
    totalErrors,
    successRate: totalExec > 0 ? ((totalExec - totalErrors) / totalExec * 100).toFixed(1) + '%' : 'N/A',
    avgDurationMs: totalExec > 0 ? Math.round(totalDuration / totalExec) : 0,
    activeConcurrent: activeCount,
    queued: waitQueue.length,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sanitizeParams(params) {
  if (!params) return null;
  const clean = { ...params };
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'credential'];
  for (const key of Object.keys(clean)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      clean[key] = '***';
    }
  }
  return clean;
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// ── Enable / Disable ───────────────────────────────────────────────────────

function enable(name) {
  const t = tools.get(name);
  if (t) { t.enabled = true; return true; }
  return false;
}

function disable(name) {
  const t = tools.get(name);
  if (t) { t.enabled = false; return true; }
  return false;
}

// ── Events ─────────────────────────────────────────────────────────────────

function onExecuted(cb) { emitter.on('executed', cb); }
function onRollbackFailed(cb) { emitter.on('rollbackFailed', cb); }

// ── Express Router ─────────────────────────────────────────────────────────

function createRouter() {
  const express = require('express');
  const router = express.Router();

  router.get('/tools', (req, res) => {
    res.json({ tools: listAll(), stats: getGlobalStats() });
  });

  router.get('/tools/:name', (req, res) => {
    const stats = getToolStats(req.params.name);
    if (!stats) return res.status(404).json({ error: 'tool not found' });
    res.json(stats);
  });

  router.post('/tools/:name/execute', async (req, res) => {
    const result = await execute(req.params.name, req.body.params || {}, req.body.options || {});
    res.json(result);
  });

  router.get('/audit', (req, res) => {
    res.json({
      entries: getAuditLog({
        tool: req.query.tool,
        status: req.query.status,
        since: req.query.since ? Number(req.query.since) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      }),
    });
  });

  return router;
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  RISK,
  register,
  registerAll,
  get,
  listAll,
  listByCategory,
  execute,
  pipeline,
  parallel,
  getAuditLog,
  getToolStats,
  getGlobalStats,
  enable,
  disable,
  onExecuted,
  onRollbackFailed,
  createRouter,
};
