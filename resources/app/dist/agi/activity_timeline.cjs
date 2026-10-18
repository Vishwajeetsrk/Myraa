'use strict';

/**
 * MYRAA AGI — Activity Timeline
 * ---------------------------------------------------------------------------
 * Structured event stream replacing the flat append-only activity_log.json.
 *
 * Provides:
 *   - Typed events with structured metadata (not just strings)
 *   - Per-engine lineage (which engine produced which event)
 *   - Session tracking (group events by conversation/task session)
 *   - Query API: filter by engine, type, time range, session
 *   - Statistics: event counts, error rates, timeline density
 *   - Persistence: JSON WAL with fsync, capped at 5000 entries
 *   - SSE streaming for real-time dashboard updates
 *
 * Event Shape:
 *   {
 *     id:         string (nanoid-like)
 *     timestamp:  number (ms since epoch)
 *     type:       string (chat|tool|system|health|memory|error|user|agent)
 *     engine:     string (which engine produced this)
 *     action:     string (what happened)
 *     status:     'ok'|'error'|'warn'|'info'
 *     session:    string (session/conversation id)
 *     detail:     string (human-readable description)
 *     metadata:   object (structured data, tool params, results)
 *     duration:   number (ms, for timed operations)
 *     parent:     string (id of parent event, for nested traces)
 *   }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ── Configuration ──────────────────────────────────────────────────────────

const MAX_ENTRIES = 5000;
const FLUSH_INTERVAL_MS = 5000;
const BATCH_SIZE = 50;

// ── State ──────────────────────────────────────────────────────────────────

const events = [];
const emitter = new EventEmitter();
let dataDir = null;
let flushTimer = null;
let dirty = false;
let eventCounter = 0;

// ── Event Types ────────────────────────────────────────────────────────────

const EVENT_TYPES = {
  CHAT:    'chat',
  TOOL:    'tool',
  SYSTEM:  'system',
  HEALTH:  'health',
  MEMORY:  'memory',
  ERROR:   'error',
  USER:    'user',
  AGENT:   'agent',
  SKILL:   'skill',
  PLUGIN:  'plugin',
  UPDATE:  'update',
  LAUNCH:  'launch',
};

const STATUS = {
  OK:    'ok',
  ERROR: 'error',
  WARN:  'warn',
  INFO:  'info',
};

// ── Data Directory ─────────────────────────────────────────────────────────

function getDataDir() {
  if (dataDir) return dataDir;
  try {
    const appData = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
    dataDir = path.join(appData, 'MYRAA');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) { dataDir = '.'; }
  return dataDir;
}

// ── ID Generation ──────────────────────────────────────────────────────────

function generateId() {
  eventCounter++;
  const ts = Date.now().toString(36);
  const cnt = eventCounter.toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ts}-${cnt}-${rand}`;
}

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Record an event on the timeline.
 *
 * @param {object} event
 * @param {string} event.type     - Event type (from EVENT_TYPES)
 * @param {string} event.engine   - Source engine id
 * @param {string} event.action   - What happened
 * @param {string} event.status   - ok|error|warn|info
 * @param {string} event.session  - Session/conversation id
 * @param {string} event.detail   - Human-readable description
 * @param {object} event.metadata - Structured data
 * @param {number} event.duration - Duration in ms (for timed ops)
 * @param {string} event.parent   - Parent event id (for nested traces)
 * @returns {object} The recorded event with id and timestamp
 */
function record(event) {
  const entry = {
    id: generateId(),
    timestamp: Date.now(),
    type: event.type || EVENT_TYPES.SYSTEM,
    engine: event.engine || 'unknown',
    action: event.action || 'unknown',
    status: event.status || STATUS.INFO,
    session: event.session || null,
    detail: event.detail || '',
    metadata: event.metadata || {},
    duration: event.duration || 0,
    parent: event.parent || null,
  };

  events.push(entry);
  dirty = true;

  // Cap at max entries
  if (events.length > MAX_ENTRIES) {
    events.splice(0, events.length - MAX_ENTRIES);
  }

  // Emit for real-time listeners
  emitter.emit('event', entry);

  return entry;
}

/**
 * Convenience methods for common event types.
 */
function chatAction(action, detail, session, metadata) {
  return record({ type: EVENT_TYPES.CHAT, engine: 'chat', action, status: STATUS.OK, session, detail, metadata });
}

function toolAction(engine, action, detail, status, metadata, duration) {
  return record({ type: EVENT_TYPES.TOOL, engine, action, status, detail, metadata, duration });
}

function systemAction(action, detail, status, metadata) {
  return record({ type: EVENT_TYPES.SYSTEM, engine: 'system', action, status: status || STATUS.INFO, detail, metadata });
}

function errorAction(engine, action, error, metadata) {
  return record({ type: EVENT_TYPES.ERROR, engine, action, status: STATUS.ERROR, detail: error?.message || String(error), metadata: { ...metadata, stack: error?.stack } });
}

function healthAction(engine, action, state, detail) {
  return record({ type: EVENT_TYPES.HEALTH, engine, action, status: state === 'healthy' ? STATUS.OK : STATUS.WARN, detail });
}

function memoryAction(action, detail, metadata) {
  return record({ type: EVENT_TYPES.MEMORY, engine: 'memory', action, status: STATUS.OK, detail, metadata });
}

/**
 * Start a traced operation (returns a function to end the trace).
 */
function startTrace(engine, action, session, metadata) {
  const startMs = Date.now();
  const entry = record({ type: EVENT_TYPES.TOOL, engine, action, status: STATUS.INFO, session, detail: 'started', metadata });
  return (resultStatus, detail, resultMetadata) => {
    const duration = Date.now() - startMs;
    entry.duration = duration;
    entry.status = resultStatus || STATUS.OK;
    entry.detail = detail || 'completed';
    entry.metadata = { ...entry.metadata, ...(resultMetadata || {}) };
    emitter.emit('event', entry);
    dirty = true;
    return entry;
  };
}

// ── Query API ──────────────────────────────────────────────────────────────

/**
 * Query events with filters.
 */
function query(options = {}) {
  let results = events;

  if (options.type) {
    const types = Array.isArray(options.type) ? options.type : [options.type];
    results = results.filter(e => types.includes(e.type));
  }

  if (options.engine) {
    results = results.filter(e => e.engine === options.engine);
  }

  if (options.status) {
    results = results.filter(e => e.status === options.status);
  }

  if (options.session) {
    results = results.filter(e => e.session === options.session);
  }

  if (options.action) {
    const q = options.action.toLowerCase();
    results = results.filter(e => e.action.toLowerCase().includes(q));
  }

  if (options.search) {
    const q = options.search.toLowerCase();
    results = results.filter(e =>
      e.detail.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      e.engine.toLowerCase().includes(q)
    );
  }

  if (options.since) {
    const since = typeof options.since === 'number' ? options.since : new Date(options.since).getTime();
    results = results.filter(e => e.timestamp >= since);
  }

  if (options.until) {
    const until = typeof options.until === 'number' ? options.until : new Date(options.until).getTime();
    results = results.filter(e => e.timestamp <= until);
  }

  if (options.parent) {
    results = results.filter(e => e.parent === options.parent);
  }

  // Sort newest first by default
  results.sort((a, b) => b.timestamp - a.timestamp);

  // Pagination
  const offset = options.offset || 0;
  const limit = options.limit || 100;
  const total = results.length;
  results = results.slice(offset, offset + limit);

  return { events: results, total, offset, limit };
}

/**
 * Get children of a parent event.
 */
function getChildren(parentId) {
  return events.filter(e => e.parent === parentId).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get timeline for a session.
 */
function getSessionTimeline(sessionId) {
  return events.filter(e => e.session === sessionId).sort((a, b) => a.timestamp - b.timestamp);
}

// ── Statistics ─────────────────────────────────────────────────────────────

function getStats(options = {}) {
  let dataset = events;
  if (options.since) {
    dataset = events.filter(e => e.timestamp >= options.since);
  }

  const byType = {};
  const byEngine = {};
  const byStatus = {};
  let totalDuration = 0;
  let durationCount = 0;

  for (const e of dataset) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    byEngine[e.engine] = (byEngine[e.engine] || 0) + 1;
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    if (e.duration > 0) {
      totalDuration += e.duration;
      durationCount++;
    }
  }

  const first = dataset[0];
  const last = dataset[dataset.length - 1];

  return {
    totalEvents: dataset.length,
    timeRange: {
      from: first?.timestamp || 0,
      to: last?.timestamp || 0,
      spanMs: last && first ? last.timestamp - first.timestamp : 0,
    },
    byType,
    byEngine,
    byStatus,
    avgDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    errorRate: dataset.length > 0
      ? ((byStatus.error || 0) / dataset.length * 100).toFixed(1) + '%'
      : 'N/A',
  };
}

/**
 * Get recent activity summary (last N minutes).
 */
function getRecentSummary(minutes = 30) {
  const since = Date.now() - (minutes * 60 * 1000);
  return getStats({ since });
}

// ── Persistence ────────────────────────────────────────────────────────────

function flush() {
  if (!dirty) return;
  try {
    const filePath = path.join(getDataDir(), 'agi_activity_timeline.json');
    // Keep only the most recent entries
    const toSave = events.slice(-MAX_ENTRIES);
    fs.writeFileSync(filePath, JSON.stringify(toSave, null, 0), 'utf8');
    dirty = false;
  } catch (e) {
    // Silently fail — timeline is non-critical
  }
}

function load() {
  try {
    const filePath = path.join(getDataDir(), 'agi_activity_timeline.json');
    if (!fs.existsSync(filePath)) return false;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(data)) {
      events.push(...data.slice(-MAX_ENTRIES));
      eventCounter = events.length;
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function startAutoFlush() {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

function stopAutoFlush() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flush(); // final flush
}

// ── SSE Streaming ──────────────────────────────────────────────────────────

/**
 * Create an SSE endpoint handler for real-time event streaming.
 */
function createSSEHandler() {
  return (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write('data: {"type":"connected"}\n\n');

    const handler = (event) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (e) {
        emitter.removeListener('event', handler);
      }
    };

    emitter.on('event', handler);

    req.on('close', () => {
      emitter.removeListener('event', handler);
    });
  };
}

// ── Express Router ─────────────────────────────────────────────────────────

function createRouter() {
  const express = require('express');
  const router = express.Router();

  // SSE stream
  router.get('/stream', createSSEHandler());

  // Query events
  router.get('/events', (req, res) => {
    res.json(query({
      type: req.query.type,
      engine: req.query.engine,
      status: req.query.status,
      session: req.query.session,
      action: req.query.action,
      search: req.query.search,
      since: req.query.since ? Number(req.query.since) : undefined,
      until: req.query.until ? Number(req.query.until) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : 0,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    }));
  });

  // Get event by id
  router.get('/events/:id', (req, res) => {
    const event = events.find(e => e.id === req.params.id);
    if (!event) return res.status(404).json({ error: 'event not found' });
    const children = getChildren(event.id);
    res.json({ event, children });
  });

  // Session timeline
  router.get('/session/:sessionId', (req, res) => {
    res.json({ events: getSessionTimeline(req.params.sessionId) });
  });

  // Statistics
  router.get('/stats', (req, res) => {
    res.json(getStats({ since: req.query.since ? Number(req.query.since) : undefined }));
  });

  // Recent summary
  router.get('/summary', (req, res) => {
    res.json(getRecentSummary(Number(req.query.minutes) || 30));
  });

  // Record an event (for manual/system use)
  router.post('/events', (req, res) => {
    const event = record(req.body);
    res.json(event);
  });

  return router;
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  EVENT_TYPES,
  STATUS,
  record,
  chatAction,
  toolAction,
  systemAction,
  errorAction,
  healthAction,
  memoryAction,
  startTrace,
  query,
  getChildren,
  getSessionTimeline,
  getStats,
  getRecentSummary,
  flush,
  load,
  startAutoFlush,
  stopAutoFlush,
  createSSEHandler,
  createRouter,
  onEvent: (cb) => emitter.on('event', cb),
};
