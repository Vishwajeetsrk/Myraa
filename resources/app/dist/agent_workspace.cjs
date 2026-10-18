'use strict';
/**
 * MYRAA Agent Workspace (Phase 18).
 * Durable agent roster, threads, natural-language routines and approval
 * cards. Pattern-level adoption only: OpenMausBot is Apache-2.0 and NO code
 * is copied; its documented model informed the shape (agents with identity,
 * memory, routines, approvals; threads with own context).
 *
 * Honesty rules:
 *   - routines only fire when something calls dueRoutines(now) (server tick
 *     integration is a later phase); nothing is run silently here
 *   - approvals never auto-execute anything; they only record decisions
 *   - every list is bounded; store is one JSON file written atomically
 *
 * Env: MYRAA_WORKSPACE_DB (default <dataDir>/workspace/agent_workspace.json)
 * where dataDir = MYRAA_DATA_DIR || APPDATA/MYRAA || ~/.config/MYRAA.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROUTINE_KINDS = ['daily', 'weekdays', 'weekly', 'once'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WORKSPACES = ['general', 'coding', 'research', 'business', 'course_studio', 'projects'];
const APPROVAL_SCOPES = ['READ', 'PLAN', 'PREPARE', 'EXECUTE'];
const AGENT_STATUS = ['active', 'paused', 'retired'];
const ROUTINE_STATUS = ['active', 'paused', 'done'];
const APPROVAL_STATUS = ['pending', 'approved', 'denied', 'expired'];
const CAPS = {
  agents: 50,
  threads: 100,
  messagesPerThread: 200,
  routines: 100,
  approvals: 200,
  listLimit: 50,
};

function dataDir() {
  if (process.env.MYRAA_DATA_DIR) return process.env.MYRAA_DATA_DIR;
  const base = process.env.APPDATA || path.join(os.homedir(), '.config');
  return path.join(base, 'MYRAA');
}

function defaultStorePath() {
  return process.env.MYRAA_WORKSPACE_DB || path.join(dataDir(), 'workspace', 'agent_workspace.json');
}

function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function nowIso() { return new Date().toISOString(); }

function sliceText(v, cap) {
  const s = String(v === undefined || v === null ? '' : v);
  return s.length > cap ? s.slice(0, cap) : s;
}

function parseTimeOfDay(s) {
  const m = String(s || '').match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) return null;
  return { hour, minute };
}

// Local-time next occurrence after `afterMs`. Routines run in the user's local
// clock; the ISO strings we store are UTC.
function nextRunFor(spec, afterMs) {
  const d = new Date(afterMs);
  let t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), spec.hour, spec.minute, 0, 0);
  if (spec.kind === 'daily') {
    if (t.getTime() <= afterMs) t = new Date(t.getTime() + 24 * 3600 * 1000);
    return t.toISOString();
  }
  if (spec.kind === 'weekdays') {
    while (t.getTime() <= afterMs || t.getDay() === 0 || t.getDay() === 6) {
      t = new Date(t.getTime() + 24 * 3600 * 1000);
    }
    return t.toISOString();
  }
  if (spec.kind === 'weekly') {
    const want = spec.weekday !== undefined ? Number(spec.weekday) : null;
    if (want === null || !(want >= 0 && want <= 6)) return null;
    while (t.getTime() <= afterMs || t.getDay() !== want) {
      t = new Date(t.getTime() + 24 * 3600 * 1000);
    }
    return t.toISOString();
  }
  return null; // 'once' routines only fire via runOnce
}

function defaultStore(storePath) {
  const p = storePath || defaultStorePath();
  let state = { agents: [], threads: [], messages: [], routines: [], approvals: [] };
  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const k of Object.keys(state)) if (Array.isArray(raw[k])) state[k] = raw[k];
    } catch (e) { /* fresh on missing/corrupt */ }
    return state;
  }
  function persist() {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      const tmp = p + '.' + Date.now() + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmp, p);
      return true;
    } catch (e) {
      const tmp2 = p + '.' + Date.now() + '.tmp';
      try { fs.unlinkSync(tmp2); } catch (e2) {}
      return false;
    }
  }
  return { load, persist, get state() { return state; }, set state(v) { state = v; }, path: p };
}

function createWorkspace(opts) {
  const store = (opts && opts.store) || defaultStore(opts && opts.storePath);
  store.load();

  function findAgent(id) { return store.state.agents.find((a) => a.id === id) || null; }
  function findThread(id) { return store.state.threads.find((t) => t.id === id) || null; }
  function findRoutine(id) { return store.state.routines.find((r) => r.id === id) || null; }
  function findApproval(id) { return store.state.approvals.find((r) => r.id === id) || null; }

  function undo(fn) {
    const snapshot = JSON.parse(JSON.stringify(store.state));
    const w = fn();
    if (w && w.ok !== true) { store.state = snapshot; return w; }
    if (!store.persist()) { store.state = snapshot; return { ok: false, code: 'DB_ERROR', error: 'workspace store write failed' }; }
    return w;
  }

  // ---- roster -------------------------------------------------------------
  function createAgent(input) {
    const name = sliceText(input && input.name, 80).trim().toLowerCase();
    const role = sliceText(input && input.role, 200).trim();
    if (!name || /\s/.test(name)) return { ok: false, code: 'VALIDATION', error: 'name is required and must be one word' };
    if (store.state.agents.some((a) => a.name === name)) return { ok: false, code: 'VALIDATION', error: 'agent name already exists' };
    if (store.state.agents.length >= CAPS.agents) return { ok: false, code: 'VALIDATION', error: 'roster cap reached' };
    const skills = Array.isArray(input && input.skills) ? input.skills.slice(0, 20).map((s) => sliceText(s, 100)).filter(Boolean) : [];
    const rec = { id: newId('agr'), name, role, skills, status: 'active', createdAt: nowIso(), jobs: [] };
    return undo(() => { store.state.agents.push(rec); return { ok: true, agent: rec }; });
  }

  function listAgents() {
    return { ok: true, agents: store.state.agents.slice(-CAPS.listLimit).reverse() };
  }

  function setAgentStatus(input) {
    const rec = store.state.agents.find((a) => a.name === sliceText(input && input.name, 80).toLowerCase() || a.id === (input && input.id));
    if (!rec) return { ok: false, code: 'VALIDATION', error: 'unknown agent (name or id)' };
    if (!AGENT_STATUS.includes(input.status)) return { ok: false, code: 'VALIDATION', error: 'status must be one of: ' + AGENT_STATUS.join(', ') };
    return undo(() => { rec.status = input.status; return { ok: true, agent: rec }; });
  }

  // ---- threads --------------------------------------------------------------
  function createThread(input) {
    const workspace = sliceText(input && input.workspace, 40).trim().toLowerCase() || 'general';
    if (!WORKSPACES.includes(workspace)) return { ok: false, code: 'VALIDATION', error: 'workspace must be one of: ' + WORKSPACES.join(', ') };
    if (store.state.threads.length >= CAPS.threads) return { ok: false, code: 'VALIDATION', error: 'thread cap reached' };
    const rec = {
      id: newId('thr'),
      workspace,
      title: sliceText(input && input.title, 200).trim() || workspace + ' thread',
      approvals: [],
      createdAt: nowIso(),
    };
    return undo(() => { store.state.threads.push(rec); return { ok: true, thread: rec }; });
  }

  function appendMessage(input) {
    const thread = findThread(input && input.threadId);
    if (!thread) return { ok: false, code: 'VALIDATION', error: 'unknown threadId' };
    const role = ['user', 'agent', 'system'].includes(input.role) ? input.role : 'agent';
    const text = sliceText(input && input.text, 4000).trim();
    if (!text) return { ok: false, code: 'VALIDATION', error: 'message text is required' };
    const count = store.state.messages.filter((m) => m.threadId === thread.id).length;
    if (count >= CAPS.messagesPerThread) return { ok: false, code: 'VALIDATION', error: 'thread message cap reached (' + CAPS.messagesPerThread + ')' };
    const rec = { id: newId('msg'), threadId: thread.id, role, text, createdAt: nowIso() };
    return undo(() => { store.state.messages.push(rec); return { ok: true, message: rec }; });
  }

  function listMessages(input) {
    const thread = findThread(input && input.threadId);
    if (!thread) return { ok: false, code: 'VALIDATION', error: 'unknown threadId' };
    const limit = Math.max(1, Math.min(CAPS.messagesPerThread, Number(input.limit) || 20));
    const items = store.state.messages.filter((m) => m.threadId === thread.id).slice(-limit).reverse();
    return { ok: true, threadId: thread.id, title: thread.title, messages: items };
  }

  function listThreads() {
    const out = store.state.threads.slice(-CAPS.listLimit).reverse().map((t) => ({
      id: t.id, workspace: t.workspace, title: t.title,
      approvals: t.approvals.slice(-5).reverse(),
      createdAt: t.createdAt,
    }));
    return { ok: true, threads: out };
  }

  // ---- routines -------------------------------------------------------------
  function createRoutine(input) {
    const spec = input && input.spec ? input.spec : null;
    if (!spec || !ROUTINE_KINDS.includes(spec.kind)) return { ok: false, code: 'VALIDATION', error: 'spec.kind must be one of: ' + ROUTINE_KINDS.join(', ') };
    const time = parseTimeOfDay(spec.time);
    if (!time) return { ok: false, code: 'VALIDATION', error: 'spec.time must be HH:MM (24h, local time)' };
    const instruction = sliceText(input && input.instruction, 1000).trim();
    if (!instruction) return { ok: false, code: 'VALIDATION', error: 'instruction is required (what should run)' };
    if (store.state.routines.length >= CAPS.routines) return { ok: false, code: 'VALIDATION', error: 'routine cap reached' };
    const phrase = sliceText(input && input.phrase, 500).trim() || instruction.slice(0, 200);
    const storeSpec = { kind: spec.kind, hour: time.hour, minute: time.minute };
    if (spec.kind === 'weekly') {
      const wd = String(spec.weekday || '').toLowerCase();
      const idx = WEEKDAYS.indexOf(wd);
      if (idx < 0) return { ok: false, code: 'VALIDATION', error: 'weekly routines need spec.weekday (monday..sunday)' };
      storeSpec.weekday = idx;
    }
    if (spec.kind === 'once') return { ok: false, code: 'VALIDATION', error: 'once routines are not supported yet (recorded as unknown work)' };
    const rec = {
      id: newId('rtr'),
      phrase,
      spec: storeSpec,
      instruction,
      status: 'active',
      nextRunAt: nextRunFor(storeSpec, Date.now()),
      lastRunAt: null,
      runCount: 0,
      reportThreadIds: [],
      createdAt: nowIso(),
    };
    if (rec.nextRunAt === null) return { ok: false, code: 'VALIDATION', error: 'computed nextRun is null (bad spec)' };
    return undo(() => { store.state.routines.push(rec); return { ok: true, routine: rec }; });
  }

  function listRoutines() {
    return { ok: true, routines: store.state.routines.slice(-CAPS.listLimit).reverse() };
  }

  function findRoutineByQuery(q) {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return null;
    return store.state.routines.find((r) => r.id === needle)
      || store.state.routines.find((r) => r.phrase.toLowerCase().includes(needle) || r.instruction.toLowerCase().includes(needle));
  }

  function setRoutineStatus(input) {
    const rec = findRoutineByQuery(input && input.query);
    if (!rec) return { ok: false, code: 'VALIDATION', error: 'unknown routine (id or text match)' };
    if (!ROUTINE_STATUS.includes(input.status)) return { ok: false, code: 'VALIDATION', error: 'status must be one of: ' + ROUTINE_STATUS.join(', ') };
    return undo(() => {
      rec.status = input.status;
      if (input.status === 'active') rec.nextRunAt = nextRunFor(rec.spec, Date.now());
      return { ok: true, routine: rec };
    });
  }

  function deleteRoutine(input) {
    const rec = findRoutineByQuery(input && input.query);
    if (!rec) return { ok: false, code: 'VALIDATION', error: 'unknown routine (id or text match)' };
    return undo(() => {
      store.state.routines = store.state.routines.filter((r) => r.id !== rec.id);
      return { ok: true, deleted: rec.id };
    });
  }

  // The ONLY place routines advance/fire. Caller supplies the executor;
  // missing executor => honest 'no executor' report, nothing hidden runs.
  function dueRoutines(nowMs, executor) {
    const now = nowMs || Date.now();
    const fired = [];
    const skipped = [];
    for (const r of store.state.routines) {
      if (r.status !== 'active') continue;
      const due = r.nextRunAt && Date.parse(r.nextRunAt) <= now;
      if (!due) continue;
      if (typeof executor !== 'function') {
        skipped.push({ id: r.id, phrase: r.phrase, reason: 'no executor wired for routines yet' });
        continue;
      }
      const out = undo(() => {
        r.lastRunAt = new Date(now).toISOString();
        r.runCount += 1;
        r.nextRunAt = nextRunFor(r.spec, now + 1000);
        if (r.nextRunAt === null) r.status = 'done';
        return { ok: true };
      });
      if (!out.ok) { skipped.push({ id: r.id, phrase: r.phrase, reason: out.error }); continue; }
      let run;
      try { run = executor(r); } catch (e) { run = { ok: false, error: String((e && e.message) || e) }; }
      fired.push({ id: r.id, phrase: r.phrase, spec: r.spec, result: run });
    }
    return { ok: true, fired, skipped };
  }

  // ---- approvals --------------------------------------------------------------
  function createApproval(input) {
    const scope = input && input.scope;
    if (!APPROVAL_SCOPES.includes(scope)) return { ok: false, code: 'VALIDATION', error: 'scope must be one of: ' + APPROVAL_SCOPES.join(', ') };
    const summary = sliceText(input && input.summary, 500).trim();
    if (!summary) return { ok: false, code: 'VALIDATION', error: 'summary is required' };
    if (store.state.approvals.length >= CAPS.approvals) return { ok: false, code: 'VALIDATION', error: 'approval cap reached' };
    let threadId = (input && input.threadId) || null;
    if (threadId && !findThread(threadId)) return { ok: false, code: 'VALIDATION', error: 'unknown threadId for approval' };
    const rec = {
      id: newId('apr'),
      threadId,
      scope,
      summary,
      status: 'pending',
      decidedBy: null,
      decisionNote: '',
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    };
    return undo(() => {
      store.state.approvals.push(rec);
      if (threadId) findThread(threadId).approvals.push(rec.id);
      return { ok: true, approval: rec };
    });
  }

  function pendingStatusOf(rec, now) {
    if (rec.status !== 'pending') return rec.status;
    return rec.expiresAt && Date.parse(rec.expiresAt) <= now ? 'expired' : 'pending';
  }

  function listApprovals(input) {
    const now = Date.now();
    const openOnly = (input && input.openOnly) === true;
    let items = store.state.approvals.slice(-CAPS.listLimit).reverse();
    items = items.map((r) => { const c = { ...r, effectiveStatus: pendingStatusOf(r, now) }; return c; });
    if (openOnly) items = items.filter((r) => r.effectiveStatus === 'pending');
    return { ok: true, approvals: items };
  }

  function decideApproval(input) {
    const rec = findApproval((input && input.id) || '');
    if (!rec) return { ok: false, code: 'VALIDATION', error: 'unknown approval id' };
    const decision = String((input && input.decision) || '').toLowerCase();
    if (!['approve', 'deny'].includes(decision)) return { ok: false, code: 'VALIDATION', error: 'decision must be approve or deny' };
    if (pendingStatusOf(rec, Date.now()) !== 'pending') {
      return { ok: false, code: 'VALIDATION', error: 'approval is ' + pendingStatusOf(rec, Date.now()) + ' (must decide while pending)' };
    }
    return undo(() => {
      rec.status = decision === 'approve' ? 'approved' : 'denied';
      rec.decidedBy = sliceText(input && input.decidedBy, 80) || 'user';
      rec.decisionNote = sliceText(input && input.note, 400);
      return { ok: true, approval: rec };
    });
  }

  function status() {
    return {
      ok: true,
      storePath: store.path,
      counts: {
        agents: store.state.agents.length,
        threads: store.state.threads.length,
        messages: store.state.messages.length,
        routines: store.state.routines.length,
        approvals: store.state.approvals.length,
      },
      caps: CAPS,
      workspaces: WORKSPACES,
    };
  }

  return {
    CAPS, ROUTINE_KINDS, WORKSPACES, APPROVAL_SCOPES,
    nextRunFor, parseTimeOfDay,
    createAgent, listAgents, setAgentStatus,
    createThread, appendMessage, listMessages, listThreads,
    createRoutine, listRoutines, setRoutineStatus, deleteRoutine, dueRoutines,
    createApproval, listApprovals, decideApproval,
    status,
    __path: store.path,
  };
}

module.exports = {
  ROUTINE_KINDS, WEEKDAYS, WORKSPACES, APPROVAL_SCOPES, AGENT_STATUS, ROUTINE_STATUS, APPROVAL_STATUS, CAPS,
  dataDir, defaultStorePath, parseTimeOfDay, nextRunFor, defaultStore, createWorkspace,
};
