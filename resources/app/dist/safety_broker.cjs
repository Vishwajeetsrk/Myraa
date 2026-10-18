'use strict';
/**
 * MYRAA Action Safety Broker (Phase 21).
 * Bridges agi/tool_execution_engine risk gates (HIGH/CRITICAL need
 * options.confirm) into real, user-visible approval cards in the Phase 18
 * agent workspace. Pattern-level adoption from OpenMausBot's permission
 * broker (Apache-2.0): concept only, no ported code.
 *
 * Honesty + safety rules:
 *   - a broker request NEVER executes on its own; an approval card decision
 *     (24h expiry enforced by the workspace store) is required first
 *   - deny or expiry closes the binding with zero executions
 *   - params are clamped and secret-ish keys REDACTED in every text form
 *   - every transition is journalled (bounded); 7d garbage collection
 *   - store is additive JSON at MYRAA_BROKER_DB or %APPDATA%\MYRAA\agent_broker
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const BROKER_RISKS = ['HIGH', 'CRITICAL'];
const EVENTS_CAP = 12;
const BINDINGS_CAP = 100;
const EXPIRE_MS = 7 * 24 * 3600 * 1000;
const SECRET_RE = /key|token|secret|password|credential|apikey/i;

function dataDir() {
  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(base, 'MYRAA', 'agent_broker');
}

function defaultStorePath() {
  return process.env.MYRAA_BROKER_DB || path.join(dataDir(), 'broker_state.json');
}

function nowIso() { return new Date().toISOString(); }

function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function sliceText(v, n) { return String(v == null ? '' : v).slice(0, n); }

function safeParams(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  try { return JSON.parse(JSON.stringify(p)); } catch (e) { return null; }
}

function paramSummary(params) {
  const src = safeParams(params) || {};
  const keys = Object.keys(src).slice(0, 8);
  const parts = keys.map((k) => {
    const v = src[k];
    const simple = (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && !SECRET_RE.test(k);
    return k + '=' + (simple ? sliceText(String(v), 80) : '[redacted]');
  });
  return parts.join(', ') || '(no params)';
}

function defaultStore(storePath) {
  const file = storePath || defaultStorePath();
  let state = { bindings: [], counter: 0 };

  function loadFromDisk() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!parsed || typeof parsed !== 'object') throw new Error('bad json');
      return {
        bindings: Array.isArray(parsed.bindings) ? parsed.bindings : [],
        counter: typeof parsed.counter === 'number' ? parsed.counter : 0,
      };
    } catch (e) {
      return { bindings: [], counter: 0 };
    }
  }

  function gc(now) {
    const before = state.bindings.length;
    state.bindings = state.bindings.filter((b) => {
      const terminal = b.status === 'executed' || b.status === 'denied' || b.status === 'expired';
      return !(terminal && now - Date.parse(b.createdAt || now) > EXPIRE_MS);
    });
    return before - state.bindings.length;
  }

  function load() { state = loadFromDisk(); gc(Date.now()); return state; }

  function persist() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.' + Date.now() + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ version: '21.0.0', ...state }, null, 2), 'utf8');
      fs.renameSync(tmp, file);
      return true;
    } catch (e) {
      return false;
    }
  }

  return { file, load, persist, gc, get: () => state, replace: (s) => { state = s; } };
}

function createBroker(opts) {
  const o = opts || {};
  const store = o.store || defaultStore(o.storePath);
  let engineOverride = o.engine || null;

  function activeEngine() {
    if (engineOverride) return engineOverride;
    try { return require('./agi/tool_execution_engine.cjs'); } catch (e) { return null; }
  }

  function setEngine(eng) { engineOverride = eng || null; }

  function journal(rec, action, note) {
    rec.journal = Array.isArray(rec.journal) ? rec.journal : [];
    rec.journal.push({ at: nowIso(), action, note: sliceText(note, 200) });
    while (rec.journal.length > EVENTS_CAP) rec.journal.shift();
  }

  function publicView(rec) {
    const copy = { ...rec };
    delete copy.params;
    return copy;
  }

  function mutate(fn) {
    store.load();
    const snapshot = JSON.parse(JSON.stringify(store.get()));
    const r = fn(store.get());
    if (r && r.ok === false) { store.replace(snapshot); return r; }
    if (!store.persist()) { store.replace(snapshot); return { ok: false, code: 'DB_ERROR', error: 'broker store write failed' }; }
    return r;
  }

  function commit(fn) {
    store.load();
    const snapshot = JSON.parse(JSON.stringify(store.get()));
    const r = fn(store.get());
    if (!store.persist()) { store.replace(snapshot); return { ok: false, code: 'DB_ERROR', error: 'broker store write failed' }; }
    return r;
  }

  function requestApproval(input) {
    const tool = sliceText(input && input.tool, 120).trim();
    const risk = (sliceText(input && input.risk, 12).toUpperCase() || 'HIGH');
    const reason = sliceText(input && input.reason, 400).trim();
    if (!tool) return { ok: false, code: 'VALIDATION', error: 'tool name is required' };
    if (!BROKER_RISKS.includes(risk)) return { ok: false, code: 'VALIDATION', error: 'broker covers risks: ' + BROKER_RISKS.join(', ') };
    const params = safeParams(input && input.params);
    const summary = paramSummary(params);
    return mutate((state) => {
      if (state.bindings.length >= BINDINGS_CAP) {
        state.bindings = state.bindings.filter((b) => b.status === 'waiting' || b.status === 'approved');
        if (state.bindings.length >= BINDINGS_CAP) return { ok: false, code: 'VALIDATION', error: 'broker bindings cap reached' };
      }
      let card;
      try {
        const ws = require('./agent_workspace.cjs').createWorkspace({});
        card = ws.createApproval({
          scope: 'EXECUTE',
          summary: 'tool ' + tool + ' [' + risk + '] ' + summary + (reason ? ' - ' + reason : ''),
          threadId: (input && input.threadId) || undefined,
        });
      } catch (e) {
        return { ok: false, code: 'WORKSPACE', error: 'workspace unavailable (' + (e.message || e) + ')' };
      }
      if (!card.ok) return { ok: false, code: card.code || 'WORKSPACE', error: 'approval card rejected: ' + (card.error || 'unknown') };
      state.counter += 1;
      const rec = {
        id: newId('bnk'),
        tool,
        risk,
        paramsSummary: summary,
        params,
        reason,
        status: 'waiting',
        approvalId: card.approval.id,
        threadId: (input && input.threadId) || null,
        attempts: 0,
        createdAt: nowIso(),
        approvedAt: null,
        decidedAt: null,
        executedAt: null,
        lastError: null,
        resultSummary: null,
        journal: [],
      };
      journal(rec, 'requested', 'card ' + card.approval.id);
      state.bindings.push(rec);
      return { ok: true, binding: publicView(rec) };
    });
  }

  function listBindings(input) {
    const limitRaw = (input && input.limit) || 50;
    const limit = Math.min(50, Math.max(1, Number(limitRaw) || 50));
    const status = input && input.status;
    store.load();
    let items = store.get().bindings.slice().reverse();
    if (status) items = items.filter((b) => b.status === status);
    return { ok: true, count: store.get().bindings.length, bindings: items.slice(0, limit).map(publicView) };
  }

  function findBinding(idOrApprovalId) {
    const needle = sliceText(idOrApprovalId, 120);
    if (!needle) return null;
    store.load();
    return store.get().bindings.find((b) => b.id === needle || b.approvalId === needle) || null;
  }

  function status() {
    store.load();
    const counts = { waiting: 0, approved: 0, denied: 0, executed: 0, expired: 0, other: 0 };
    for (const b of store.get().bindings) counts[b.status in counts ? b.status : 'other']++;
    const events = [];
    for (const b of store.get().bindings) {
      for (const j of (b.journal || [])) events.push({ at: j.at, id: b.id, tool: b.tool, action: j.action, note: j.note });
    }
    events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    return {
      ok: true,
      storePath: store.file,
      counts,
      events: events.slice(0, EVENTS_CAP),
      policy: 'HIGH/CRITICAL tool calls create workspace cards; nothing executes without an approve; deny or expiry closes the binding without running',
    };
  }

  function syncWithWorkspace() {
    let approvals;
    try {
      const ws = require('./agent_workspace.cjs').createWorkspace({});
      const list = ws.listApprovals({ openOnly: false });
      if (!list.ok) return { ok: false, code: 'WORKSPACE', error: list.error };
      approvals = list.approvals;
    } catch (e) {
      return { ok: false, code: 'WORKSPACE', error: 'workspace unavailable (' + (e.message || e) + ')' };
    }
    const byId = new Map(approvals.map((a) => [a.id, a]));
    return mutate((state) => {
      const transitions = [];
      for (const b of state.bindings) {
        if (b.status !== 'waiting' || !b.approvalId) continue;
        const ap = byId.get(b.approvalId);
        if (!ap) continue;
        const eff = ap.effectiveStatus || ap.status;
        if (eff === 'approved') {
          b.status = 'approved';
          b.approvedAt = nowIso();
          journal(b, 'approved', 'card ' + b.approvalId);
          transitions.push({ id: b.id, to: 'approved' });
        } else if (eff === 'denied') {
          b.status = 'denied';
          b.decidedAt = nowIso();
          journal(b, 'denied', 'card ' + b.approvalId);
          transitions.push({ id: b.id, to: 'denied' });
        } else if (eff === 'expired') {
          b.status = 'expired';
          b.decidedAt = nowIso();
          journal(b, 'expired', 'card ' + b.approvalId);
          transitions.push({ id: b.id, to: 'expired' });
        }
      }
      return { ok: true, transitions };
    });
  }

  async function executeBinding(id, runOpts) {
    const binding = findBinding(id);
    if (!binding) return { ok: false, code: 'NOT_FOUND', error: 'unknown binding: ' + sliceText(id, 60) };
    if (binding.status !== 'approved') {
      return { ok: false, code: 'NOT_APPROVED', error: 'binding is ' + binding.status + ' (an approve decision is required first)', status: binding.status };
    }
    const eng = (runOpts && runOpts.engine) || activeEngine();
    if (!eng || typeof eng.execute !== 'function') return { ok: false, code: 'ENGINE', error: 'tool execution engine unavailable' };
    let out;
    try {
      out = await eng.execute(binding.tool, binding.params || {}, { confirm: true, context: { brokerBinding: binding.id } });
    } catch (e) {
      out = { success: false, error: String((e && e.message) || e) };
    }
    const success = !!(out && out.success);
    return commit((state) => {
      const b = state.bindings.find((x) => x.id === binding.id);
      if (!b) return { ok: false, code: 'NOT_FOUND', error: 'binding vanished during execution' };
      b.attempts = (b.attempts || 0) + 1;
      if (success) {
        b.status = 'executed';
        b.executedAt = nowIso();
        b.lastError = null;
        b.resultSummary = sliceText(typeof out.result === 'string' ? out.result : JSON.stringify(out.result == null ? '' : out.result), 300);
        journal(b, 'executed', b.resultSummary);
        return { ok: true, binding: publicView(b), result: out.result };
      }
      b.lastError = sliceText((out && out.error) || 'execution failed', 300);
      journal(b, 'execute_failed', b.lastError);
      return { ok: false, code: 'EXECUTION', error: b.lastError, status: b.status, retryable: true };
    });
  }

  async function executeApproved(runOpts) {
    const sync = syncWithWorkspace();
    const dueIds = listBindings({ status: 'approved', limit: 50 }).bindings.map((b) => b.id);
    const results = [];
    for (const bid of dueIds) results.push({ id: bid, ...(await executeBinding(bid, runOpts)) });
    return { ok: true, attempted: results.length, results, syncTransitions: sync.ok ? sync.transitions.length : 0 };
  }

  return {
    requestApproval, listBindings, findBinding, status,
    syncWithWorkspace, executeBinding, executeApproved,
    setEngine, storeFile: () => store.file,
  };
}

const singleton = createBroker({});

module.exports = {
  BROKER_RISKS, EVENTS_CAP, BINDINGS_CAP, EXPIRE_MS,
  dataDir, defaultStorePath, paramSummary, createBroker,
  requestApproval: singleton.requestApproval,
  listBindings: singleton.listBindings,
  findBinding: singleton.findBinding,
  status: singleton.status,
  syncWithWorkspace: singleton.syncWithWorkspace,
  executeBinding: singleton.executeBinding,
  executeApproved: singleton.executeApproved,
  setEngine: singleton.setEngine,
};
