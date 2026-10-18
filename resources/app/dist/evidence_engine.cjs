'use strict';
/**
 * MYRAA Evidence Engine (Phase 16).
 * Universal investigation record: sessions, findings, evidence, unknowns.
 * Rule adopted for REA-style binary work: target content is UNTRUSTED DATA
 * (we hash it, we never execute it).
 *
 * Schema:
 *   session : { id, label, subject, createdAt }
 *   finding : { id, sessionId, kind[observed|inferred], inference, confidence,
 *               sourceTool, evidenceIds[], createdAt }
 *   evidence: { id, findingId, kind[hash|text|path|note], value, sha256,
 *               provenance, createdAt }
 *   unknown : { id, sessionId, question, attemptedTools[], resolved,
 *               resolution, createdAt }
 *
 * Honesty rules (hard, validated):
 *   - kind=observed requires >= 1 evidence record
 *   - kind=inferred requires confidence in [0,1]
 *   - every list/read is bounded (default caps), never dumps raw evidence
 *   - store persists as one JSON file, written atomically
 * Env: MYRAA_EVIDENCE_DB (default <dataDir>/evidence/evidence_store.json)
 * where dataDir = MYRAA_DATA_DIR || APPDATA/MYRAA || ~/.config/MYRAA.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const FINDING_KINDS = ['observed', 'inferred'];
const EVIDENCE_KINDS = ['hash', 'text', 'path', 'note'];
const OUTPUT_CAPS = {
  sessions: 50,
  findings: 25,
  unknowns: 25,
  valueSlice: 400,
};

function dataDir() {
  if (process.env.MYRAA_DATA_DIR) return process.env.MYRAA_DATA_DIR;
  const base = process.env.APPDATA || path.join(os.homedir(), '.config');
  return path.join(base, 'MYRAA');
}

function defaultStorePath() {
  return process.env.MYRAA_EVIDENCE_DB || path.join(dataDir(), 'evidence', 'evidence_store.json');
}

function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function nowIso() { return new Date().toISOString(); }

function clampConfidence(n) {
  return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

function sliceText(v, cap) {
  const s = String(v === undefined || v === null ? '' : v);
  return s.length > cap ? s.slice(0, cap) : s;
}

function createStore(storePath) {
  const p = storePath || defaultStorePath();
  let state = { sessions: [], findings: [], evidence: [], unknowns: [] };

  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      state = {
        sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
        findings: Array.isArray(raw.findings) ? raw.findings : [],
        evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
        unknowns: Array.isArray(raw.unknowns) ? raw.unknowns : [],
      };
    } catch (e) { /* fresh store on missing/corrupt file */ }
    return state;
  }

  function save() {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.' + Date.now() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    try {
      fs.renameSync(tmp, p);
    } catch (e) {
      try { fs.renameSync(tmp, p); } catch (e2) {
        try { fs.unlinkSync(tmp); } catch (e3) {}
      }
      throw e;
    }
  }

  function persist() {
    try { save(); } catch (e) {
      return { ok: false, code: 'DB_ERROR', error: 'evidence store write failed: ' + String((e && e.errno !== undefined ? e.errno : (e && e.code)) || (e && e.message) || e).slice(0, 160) };
    }
    return { ok: true };
  }

  return { load, persist, get state() { return state; }, set state(v) { state = v; }, path: p };
}

// (opts.engine is test hook: pass a pre-made store to reuse state)
function createEngine(opts) {
  const store = (opts && opts.engine instanceof Object && opts.engine.state ? opts.engine : null)
    || createStore(opts && opts.storePath);
  store.load();

  function getSessionRecord(id) {
    return store.state.sessions.find((s) => s.id === id) || null;
  }

  function createSession(input) {
    const label = sliceText(input && input.label, 200).trim();
    const subject = sliceText(input && input.subject, 400).trim();
    if (!label) return { ok: false, code: 'VALIDATION', error: 'label is required' };
    const session = {
      id: newId('evs'),
      label,
      subject,
      createdAt: nowIso(),
    };
    store.state.sessions.push(session);
    const w = store.persist();
    if (!w.ok) { store.state.sessions.pop(); return w; }
    return { ok: true, session };
  }

  function listSessions(max) {
    const limit = Math.max(1, Math.min(OUTPUT_CAPS.sessions, Number(max) || OUTPUT_CAPS.sessions));
    return { ok: true, sessions: store.state.sessions.slice(-limit).reverse(), note: 'session fields are bounded; ask for findings per session' };
  }

  function buildEvidence(input) {
    let items = (input && Array.isArray(input.evidence)) ? input.evidence : null;
    if (!items && input && input.findingId !== undefined) {
      items = [{ kind: input.kind, value: input.value, hashValue: input.hashValue, provenance: input.provenance }];
    }
    if (!items) items = [];
    const out = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') return { ok: false, error: 'each evidence item must be an object' };
      const kind = String(item.kind || 'text');
      if (!EVIDENCE_KINDS.includes(kind)) return { ok: false, error: 'evidence.kind must be one of: ' + EVIDENCE_KINDS.join(', ') };
      const value = sliceText(item.value, OUTPUT_CAPS.valueSlice);
      if (!value) return { ok: false, error: 'evidence.value is required' };
      const rec = {
        id: '',
        findingId: '',
        kind,
        value,
        sha256: sha256(item.hashValue !== undefined ? item.hashValue : value),
        provenance: sliceText(item.provenance, 400),
        createdAt: nowIso(),
      };
      out.push(rec);
    }
    return { ok: true, records: out };
  }

  function addFinding(input) {
    const sessionId = (input && input.sessionId) || '';
    const session = getSessionRecord(sessionId);
    if (!session) return { ok: false, code: 'VALIDATION', error: 'unknown sessionId (create a session first)' };
    const kind = input && input.kind;
    if (!FINDING_KINDS.includes(kind)) return { ok: false, code: 'VALIDATION', error: 'kind must be one of: ' + FINDING_KINDS.join(', ') };
    const inference = sliceText(input && input.inference, 1000).trim();
    if (!inference) return { ok: false, code: 'VALIDATION', error: 'inference text is required' };
    const sourceTool = sliceText(input && input.sourceTool, 200).trim() || 'unknown';

    if (kind === 'observed' && !(Array.isArray(input.evidence) && input.evidence.length >= 1)) {
      return { ok: false, code: 'VALIDATION', error: 'observed findings require at least one evidence record ("I think" is a kind=observed claim, not prose)' };
    }
    let confidence = clampConfidence(input && input.confidence);
    if (input && input.confidence !== undefined && input.confidence !== null && input.confidence !== '') {
      const n = Number(input.confidence);
      if (!(typeof n === 'number' && isFinite(n) && n >= 0 && n <= 1)) {
        return { ok: false, code: 'VALIDATION', error: 'confidence must be a number in [0,1]' };
      }
      confidence = n;
    }
    if (kind === 'inferred' && confidence === null) {
      return { ok: false, code: 'VALIDATION', error: 'inferred findings require confidence in [0,1] (pass a number)' };
    }

    const ev = buildEvidence(input);
    if (!ev.ok) return { ok: false, code: 'VALIDATION', error: ev.error };

    const finding = {
      id: newId('evf'),
      sessionId,
      kind,
      inference,
      confidence,
      sourceTool,
      evidenceIds: [],
      createdAt: nowIso(),
    };
    for (const rec of ev.records) {
      rec.id = newId('eve');
      rec.findingId = finding.id;
      finding.evidenceIds.push(rec.id);
      store.state.evidence.push(rec);
    }
    store.state.findings.push(finding);
    const w = store.persist();
    if (!w.ok) {
      store.state.findings.pop();
      for (const rec of ev.records) {
        const idx = store.state.evidence.indexOf(rec);
        if (idx >= 0) store.state.evidence.splice(idx, 1);
      }
      return w;
    }
    return { ok: true, finding, evidence: ev.records };
  }

  function addEvidence(input) {
    const finding = store.state.findings.find((f) => f.id === ((input && input.findingId) || ''));
    if (!finding) return { ok: false, code: 'VALIDATION', error: 'unknown findingId' };
    const ev = buildEvidence(input);
    if(!ev.ok) return { ok: false, code: 'VALIDATION', error: ev.error };
    const placed = [];
    try {
      const i = store.state.findings.indexOf(finding);
      if (i < 0) return { ok: false, code: 'VALIDATION', error: 'unknown findingId (state raced)' };
      for (const rec of ev.records) {
        rec.id = newId('eve');
        rec.findingId = finding.id;
        finding.evidenceIds.push(rec.id);
        store.state.evidence.push(rec);
        placed.push(rec);
      }
      finding.evidenceIds = Array.from(new Set(finding.evidenceIds));
    } catch (err) {
      for (const rec of placed) {
        const idx = store.state.evidence.indexOf(rec);
        if (idx >= 0) store.state.evidence.splice(idx, 1);
      }
      return { ok: false, code: 'VALIDATED', error: String((err && err.message) || err) };
    }
    const w = store.persist();
    if (!w.ok) {
      for (const rec of placed) {
        const idx = store.state.evidence.indexOf(rec);
        if (idx >= 0) store.state.evidence.splice(idx, 1);
      }
      finding.evidenceIds = finding.evidenceIds.filter((id) => !ev.records.some((r) => r.id === id));
      return w;
    }
    return { ok: true, evidence: placed };
  }

  function listEvidence(input) {
    const findingId = String((input && input.findingId) || (input && input.query) || (input && input.id) || '');
    const finding = store.state.findings.find((f) => f.id === findingId);
    if (!finding) return { ok: false, code: 'VALIDATION', error: 'unknown findingId' };
    const items = store.state.evidence.filter((r) => r.findingId === findingId);
    const limit = Math.max(1, Math.min(OUTPUT_CAPS.unknowns, Number(input.limit) || OUTPUT_CAPS.unknowns));
    return { ok: true, findingId, evidence: items.slice(-limit).reverse(), note: 'values truncated to ' + OUTPUT_CAPS.valueSlice + ' chars; sha256 always full' };
  }

  function addUnknown(input) {
    const sessionId = (input && input.sessionId) || '';
    const session = getSessionRecord(sessionId);
    if (!session) return { ok: false, code: 'VALIDATION', error: 'unknown sessionId' };
    const question = sliceText(input && input.question, 500).trim();
    if (!question) return { ok: false, code: 'VALIDATION', error: 'question is required' };
    const rec = {
      id: newId('evu'),
      sessionId,
      question,
      attemptedTools: Array.isArray(input.attemptedTools) ? input.attemptedTools.slice(0, 12).map((x) => sliceText(x, 100)) : [],
      resolved: false,
      resolution: '',
      createdAt: nowIso(),
    };
    store.state.unknowns.push(rec);
    const w = store.persist();
    if (!w.ok) { store.state.unknowns.pop(); return w; }
    return { ok: true, unknown: rec };
  }

  function resolveUnknown(input) {
    const id = (input && input.id) || '';
    const rec = store.state.unknowns.find((u) => u.id === id);
    if (!rec) return { ok: false, code: 'VALIDATION', error: 'unknown unknown id (check /list)' };
    if (rec.resolved) return { ok: true, unknown: rec, alreadyResolved: true };
    rec.resolution = sliceText(input && input.resolution, 1000).trim();
    if (!rec.resolution) return { ok: false, code: 'VALIDATION', error: 'resolution text is required' };
    rec.resolved = true;
    const w = store.persist();
    if (!w.ok) { rec.resolved = false; rec.resolution = ''; return w; }
    return { ok: true, unknown: rec };
  }

  function listUnknowns(input) {
    const sessionId = String((input && input.sessionId) || '');
    const openOnly = (input && input.openOnly) === true;
    let items = store.state.unknowns;
    if (sessionId) items = items.filter((u) => u.sessionId === sessionId);
    if (openOnly) items = items.filter((u) => u.resolved === false);
    const limit = Math.max(1, Math.min(OUTPUT_CAPS.unknowns, Number(input.limit) || OUTPUT_CAPS.unknowns));
    return { ok: true, unknowns: items.slice(-limit).reverse() };
  }

  function listFindings(input) {
    const sessionId = String((input && input.sessionId) || (input && input.session) || (input && input.query) || '');
    let items = store.state.findings;
    if (sessionId) items = items.filter((f) => f.sessionId === sessionId);
    const limit = Math.max(1, Math.min(OUTPUT_CAPS.findings, Number(input.limit) || OUTPUT_CAPS.findings));
    const byId = new Map(store.state.evidence.map((r) => [r.id, r]));
    const projected = items.slice(-limit).reverse().map((f) => ({
      id: f.id,
      sessionId: f.sessionId,
      kind: f.kind,
      inference: f.inference,
      confidence: f.kind === 'inferred' ? f.confidence : undefined,
      sourceTool: f.sourceTool,
      evidence: (f.evidenceIds || []).map((id) => {
        const r = byId.get(id);
        return r ? { id: r.id, kind: r.kind, sha256: r.sha256, provenance: r.provenance } : { id, lost: true };
      }),
      createdAt: f.createdAt,
    }));
    return { ok: true, findings: projected, capped: items.length > limit };
  }

  function compareSessions(input) {
    const a = String((input && input.a) || '');
    const b = String((input && input.b) || '');
    if (!a || !b) return { ok: false, code: 'VALIDATION', error: 'providerId and compareId (a and b) are both required' };
    if (!getSessionRecord(a)) return { ok: false, code: 'VALIDATION', error: 'session a not found' };
    if (!getSessionRecord(b)) return { ok: false, code: 'VALIDATION', error: 'session b not found' };
    const fa = store.state.findings.filter((f) => f.sessionId === a);
    const fb = store.state.findings.filter((f) => f.sessionId === b);
    const hashIn = (f) => (f.evidenceIds || []).map((id) => {
      const r = store.state.evidence.find((e) => e.id === id);
      return r ? r.sha256 : null;
    }).filter(Boolean).sort();
    const keyOf = (f) => f.inference + '::' + hashIn(f).join(',');
    const mapB = new Map(fb.map((f) => [keyOf(f), f]));
    const added = [], removed = [], present = [];
    for (const f of fa) {
      if (mapB.has(keyOf(f))) present.push({ aId: f.id, bId: mapB.get(keyOf(f)).id, inference: f.inference });
      else added.push(f);
    }
    const keysA = new Set(fa.map(keyOf));
    const seen = new Map();
    for (const f of fb) {
      const k = keyOf(f);
      if (!keysA.has(k) && !seen.has(k)) { seen.set(k, true); removed.push(f); }
    }
    return {
      ok: true,
      a, b,
      summary: { onlyInA: added.length, onlyInB: removed.length, shared: present.length },
      onlyInA: added.slice(0, OUTPUT_CAPS.findings),
      onlyInB: removed.slice(0, OUTPUT_CAPS.findings),
    };
  }

  function status() {
    const last = store.state.sessions[store.state.sessions.length - 1] || null;
    return {
      ok: true,
      storePath: store.path,
      counts: {
        sessions: store.state.sessions.length,
        findings: store.state.findings.length,
        evidence: store.state.evidence.length,
        unknowns: store.state.unknowns.length,
      },
      lastSession: last ? { id: last.id, label: last.label } : null,
      caps: OUTPUT_CAPS,
    };
  }

  return {
    createSession, listSessions, addFinding, addEvidence,
    listEvidence, addUnknown, resolveUnknown, listUnknowns,
    listFindings, compareSessions, status,
    __path: store.path,
  };
}

module.exports = {
  FINDING_KINDS, EVIDENCE_KINDS, OUTPUT_CAPS,
  dataDir, defaultStorePath, sha256,
  createStore, createEngine,
};

