'use strict';
/**
 * MYRAA Task Timeline (Phase 23).
 * Read-only chronological view that merges:
 *   - Phase 22 event bus entries (events / errors)
 *   - Phase 21 safety broker bindings (approvals / pending executions)
 *   - Phase 18 workspace approval cards still open (pending)
 *   - active routines' next run (scheduled, shown as "upcoming")
 * Derives only - it owns no store; every item carries its source and the
 * sources map reports which modules were reachable.
 * Env: none (delegates to each module's own env-configured store).
 */

const ITEM_CAP = 60;
const ROUTINE_CAP = 5;

function sliceText(v, n) { return String(v == null ? '' : v).slice(0, n); }
function safeRequire(rel) { try { return require(rel); } catch (e) { return null; } }
function isoOrNull(v) { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; }
function pad2(n) { return String(Number.isFinite(Number(n)) ? Number(n) : 0).padStart(2, '0'); }

function eventItems(limit) {
  const bus = safeRequire('./event_bus.cjs');
  if (!bus || typeof bus.list !== 'function') return { ok: false, items: [] };
  try {
    const r = bus.list({ limit: Math.min(200, Math.max(20, limit * 3)) });
    if (!r.ok) return { ok: false, items: [] };
    const items = r.events.map((ev) => ({
      at: ev.at,
      kind: ev.severity === 'error' ? 'error' : 'event',
      source: 'events',
      ref: ev.type + '#' + ev.seq,
      text: sliceText(ev.type + ': ' + bus.summarize(ev), 160),
    }));
    return { ok: true, items };
  } catch (e) { return { ok: false, items: [] }; }
}

function brokerItems() {
  const broker = safeRequire('./safety_broker.cjs');
  if (!broker || typeof broker.listBindings !== 'function') return { ok: false, items: [] };
  try {
    const r = broker.listBindings({ limit: 50 });
    if (!r.ok) return { ok: false, items: [] };
    const items = r.bindings.map((b) => ({
      at: isoOrNull(b.executedAt) || isoOrNull(b.decidedAt) || isoOrNull(b.approvedAt) || b.createdAt,
      kind: (b.status === 'waiting' || b.status === 'approved') ? 'pending' : 'approval',
      source: 'broker',
      ref: b.id,
      text: sliceText('tool ' + b.tool + ' [' + b.risk + '] ' + b.status + (b.lastError ? ' - ' + b.lastError : ''), 160),
    }));
    return { ok: true, items };
  } catch (e) { return { ok: false, items: [] }; }
}

function workspaceItems() {
  const wsMod = safeRequire('./agent_workspace.cjs');
  if (!wsMod || typeof wsMod.createWorkspace !== 'function') return { ok: false, items: [] };
  try {
    const ws = wsMod.createWorkspace({});
    const items = [];
    if (typeof ws.listApprovals === 'function') {
      const pending = ws.listApprovals({ openOnly: true });
      if (pending && pending.ok) {
        for (const a of pending.approvals) {
          items.push({
            at: a.createdAt,
            kind: 'pending',
            source: 'workspace',
            ref: a.id,
            text: sliceText('approval card [' + a.scope + '] ' + a.summary, 160),
          });
        }
      }
    }
    if (typeof ws.listRoutines === 'function') {
      const routines = ws.listRoutines();
      if (routines && routines.ok) {
        const now = Date.now();
        for (const r of routines.routines) {
          const t = Date.parse(r.nextRunAt);
          if (r.status === 'active' && Number.isFinite(t) && t > now) {
            items.push({
              at: new Date(t).toISOString(),
              kind: 'scheduled',
              source: 'routines',
              ref: r.id,
              text: sliceText('routine "' + r.phrase + '" next run [' + r.spec.kind + ' ' + pad2(r.spec.hour) + ':' + pad2(r.spec.minute) + ']', 160),
            });
          }
        }
      }
    }
    return { ok: true, items };
  } catch (e) { return { ok: false, items: [] }; }
}

function build(input) {
  const i = input || {};
  const sinceMs = Number(i.sinceMs) || 0;
  const limit = Math.min(ITEM_CAP, Math.max(1, Number(i.limit) || 30));
  const ev = eventItems(limit);
  const bk = brokerItems();
  const ws = workspaceItems();
  const sources = { events: ev.ok, broker: bk.ok, workspace: ws.ok };
  let all = [].concat(ev.items, bk.items, ws.items);
  if (sinceMs > 0) all = all.filter((x) => { const t = Date.parse(x.at); return Number.isFinite(t) && t >= sinceMs; });
  all.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  const upcoming = all.filter((x) => x.kind === 'scheduled')
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(0, ROUTINE_CAP);
  const recent = all.filter((x) => x.kind !== 'scheduled').slice(0, limit);
  return {
    ok: true,
    sources,
    windowStart: sinceMs > 0 ? new Date(sinceMs).toISOString() : null,
    count: recent.length,
    upcomingCount: upcoming.length,
    items: recent,
    upcoming,
  };
}

function summary(input) {
  const b = build(input);
  const counts = { events: 0, approvals: 0, pending: 0, errors: 0, scheduled: b.upcoming.length };
  for (const it of b.items) {
    if (it.kind === 'event') counts.events++;
    else if (it.kind === 'approval') counts.approvals++;
    else if (it.kind === 'pending') counts.pending++;
    else if (it.kind === 'error') counts.errors++;
  }
  return {
    ok: true,
    counts,
    sources: b.sources,
    windowStart: b.windowStart,
    count: b.count,
    sample: b.items.slice(0, 8).map((x) => x.text),
  };
}

function today() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return build({ sinceMs: start, limit: ITEM_CAP });
}

function render(b, maxLines) {
  const lines = [];
  const cap = Math.max(1, Number(maxLines) || 15);
  for (const it of ((b && b.items) || []).slice(0, cap)) {
    lines.push('- ' + sliceText(it.at, 16).replace('T', ' ') + ' [' + it.kind + '] ' + sliceText(it.text, 110));
  }
  for (const it of ((b && b.upcoming) || []).slice(0, 3)) {
    lines.push('- next ' + sliceText(it.at, 16).replace('T', ' ') + ' [' + it.kind + '] ' + sliceText(it.text, 110));
  }
  if (!lines.length) lines.push('- no activity recorded for this window');
  return lines;
}

function createRouter() {
  let express;
  try { express = require('express'); } catch (e) { express = null; }
  if (!express) return null;
  const router = express.Router();
  router.get('/', (req, res) => { res.json(summary({ limit: req.query.limit, sinceMs: Number(req.query.sinceMs) || 0 })); });
  router.get('/items', (req, res) => { res.json(build({ limit: req.query.limit, sinceMs: Number(req.query.sinceMs) || 0 })); });
  router.get('/today', (req, res) => {
    const b = today();
    res.json({ ok: b.ok, sources: b.sources, count: b.count, upcoming: b.upcoming, items: b.items.slice(0, 30) });
  });
  return router;
}

function registerAgiTools(engine) {
  if (!engine || typeof engine.register !== 'function') return { ok: false, count: 0, error: 'tool engine not available' };
  engine.register('timeline_summary', {
    fn: async () => summary({ limit: ITEM_CAP }),
    risk: 'LOW',
    category: 'timeline',
    timeout: 5000,
    description: 'Summarize the merged operational timeline: events, approvals, pending cards, scheduled routines.',
  });
  engine.register('timeline_today', {
    fn: async () => {
      const b = today();
      return { ok: b.ok, sources: b.sources, count: b.count, upcoming: b.upcoming, items: b.items.slice(0, 25) };
    },
    risk: 'LOW',
    category: 'timeline',
    timeout: 5000,
    description: 'Merged timeline of everything recorded since local midnight.',
  });
  return { ok: true, count: 2, names: ['timeline_summary', 'timeline_today'] };
}

module.exports = {
  ITEM_CAP,
  build,
  summary,
  today,
  render,
  createRouter,
  registerAgiTools,
};
