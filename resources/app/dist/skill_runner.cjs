'use strict';
/**
 * MYRAA Skill Runner / bounded sandbox (advanced spec section 15).
 *
 * The existing skill_registry deliberately reports run:false. This module
 * implements the missing executor without fake status:
 *  - instruction-only skills cannot be "executed" -> NOT_EXECUTABLE
 *  - a manifest's hardcoded "status":"ACTIVE" is NEVER trusted; real status is
 *    recomputed from SKILL.md, manifest validity, script presence and tool bindings
 *  - scripts run with allowlisted interpreters, no shell, sanitised env, timeouts
 *  - HIGH/CRITICAL tools are gated by the REAL approval_manager (waiting->approved)
 *  - every run writes a redacted receipt; rollback only when a rollback script exists
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const discovery = require('./skill_discovery_engine.cjs');
const approval = require('./approval_manager.cjs');

const STATUS = Object.freeze([
  'AVAILABLE', 'PARTIAL', 'NOT_IMPLEMENTED', 'PERMISSION_REQUIRED',
  'APPROVAL_REQUIRED', 'VALIDATION_FAILED', 'DEPENDENCY_MISSING', 'FAILED', 'DENIED',
]);
const RUNNABLE = new Set(['.py', '.js', '.cjs', '.mjs', '.ps1', '.sh']);
const HIGH_TOOLS = new Set(['terminal', 'shell', 'execute', 'filesystem:write', 'filesystem:delete', 'delete', 'network', 'browser', 'git:push', 'publish', 'email']);
const MEDIUM_TOOLS = new Set(['filesystem:read', 'search', 'github:read', 'http:get']);

function receiptsDir() {
  const base = process.env.MYRAA_DATA_DIR || path.join(os.tmpdir(), 'myraa-skill-runner');
  const dir = path.join(base, 'skill-runner', 'receipts');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* best effort */ }
  return dir;
}

function which(name) {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const p = path.join(dir, name + ext);
      try { if (fs.existsSync(p)) return p; } catch (e) { /* skip */ }
    }
  }
  return null;
}

function redact(text) {
  return String(text || '').replace(
    /(api[_-]?key|token|password|secret|credential|authorization)\s*[:=]\s*["']?[^\s"',}]+/gi,
    '$1=[REDACTED]'
  );
}

function safeEnv() {
  const out = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/token|key|secret|password|credential|auth/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

function resolveSkill(input) {
  const i = input || {};
  if (i.skillPath) {
    let dir = path.resolve(i.skillPath);
    try { if (fs.statSync(dir).isFile()) dir = path.dirname(dir); } catch (e) { return { ok: false, error: 'SKILL_PATH_NOT_FOUND', detail: dir }; }
    return { ok: true, id: i.skillId || path.basename(dir), dir, explicit: true };
  }
  if (!i.skillId) return { ok: false, error: 'SKILL_ID_REQUIRED' };
  const entry = discovery.skillRegistry.get(i.skillId);
  if (!entry) return { ok: false, error: 'SKILL_NOT_FOUND', detail: i.skillId };
  let dir = entry.path ? path.resolve(entry.path) : null;
  if (!dir) return { ok: false, error: 'SKILL_PATH_MISSING' };
  try { if (fs.statSync(dir).isFile()) dir = path.dirname(dir); } catch (e) { return { ok: false, error: 'SKILL_PATH_NOT_FOUND', detail: dir }; }
  return { ok: true, id: i.skillId, dir, entry, explicit: false };
}

function readManifest(dir) {
  for (const name of ['manifest.json', 'skill.json']) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      try { return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')), source: name }; }
      catch (e) { return { ok: false, error: 'MANIFEST_INVALID', detail: name + ': ' + e.message }; }
    }
  }
  return { ok: false, error: 'MANIFEST_MISSING' };
}

function findScripts(dir) {
  const out = [];
  const sdir = path.join(dir, 'scripts');
  if (!fs.existsSync(sdir)) return out;
  try {
    for (const name of fs.readdirSync(sdir)) {
      const p = path.join(sdir, name);
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isFile() && RUNNABLE.has(path.extname(name).toLowerCase())) out.push(p);
    }
  } catch (e) { /* empty */ }
  return out.sort();
}

function riskFor(manifest) {
  const tools = (manifest && Array.isArray(manifest.tools_required)) ? manifest.tools_required.map(String) : [];
  if (tools.some((t) => HIGH_TOOLS.has(t.toLowerCase()))) return 'HIGH';
  if (tools.some((t) => MEDIUM_TOOLS.has(t.toLowerCase()))) return 'MEDIUM';
  return 'LOW';
}

function validate(input) {
  const r = resolveSkill(input);
  if (!r.ok) return { ok: false, ...r };
  const skillMd = path.join(r.dir, 'SKILL.md');
  const hasSkillMd = fs.existsSync(skillMd);
  const man = readManifest(r.dir);
  const scripts = findScripts(r.dir);
  const issues = [];
  if (!hasSkillMd) issues.push('SKILL.md missing');
  if (!man.ok) issues.push(man.error);
  if (man.ok) {
    for (const field of ['name', 'version', 'description']) {
      if (!man.data[field]) issues.push('manifest missing ' + field);
    }
  }
  const toolMissing = [];
  const tools = man.ok && Array.isArray(man.data.tools_required) ? man.data.tools_required.map(String) : [];
  for (const t of tools) {
    const low = t.toLowerCase();
    if ((low === 'terminal' || low === 'shell' || low === 'execute') && !which(process.platform === 'win32' ? 'cmd' : 'sh')) toolMissing.push(t);
    if (low === 'node' && !process.execPath) toolMissing.push(t);
  }
  const declared = man.ok ? man.data.status : null;
  const computedStatus = (!hasSkillMd || !man.ok) ? 'VALIDATION_FAILED'
    : scripts.length ? 'AVAILABLE' : 'PARTIAL';
  return {
    ok: issues.length === 0,
    id: r.id,
    path: r.dir,
    skillMd: hasSkillMd,
    manifest: man.ok ? { source: man.source, name: man.data.name, version: man.data.version, declaredStatus: declared || null } : null,
    executable: scripts.length > 0,
    scripts: scripts.map((p) => path.basename(p)),
    tools,
    risk: riskFor(man.ok ? man.data : {}),
    dependencies: { missing: toolMissing },
    issues,
    declaredStatusIsTrusted: false,
    status: computedStatus,
    note: declared && /active|ready|connected/i.test(String(declared))
      ? 'manifest declares "' + declared + '" but status is recomputed from runtime evidence'
      : 'status recomputed from runtime evidence',
  };
}

function interpreterFor(script) {
  const ext = path.extname(script).toLowerCase();
  if (ext === '.js' || ext === '.cjs' || ext === '.mjs') return { bin: process.execPath, args: [] };
  if (ext === '.py') {
    const bin = which('python') || which('python3');
    return bin ? { bin, args: [] } : { error: 'DEPENDENCY_MISSING', detail: 'python not found on PATH' };
  }
  if (ext === '.ps1') {
    const bin = which('powershell') || which('pwsh');
    return bin ? { bin, args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File'] } : { error: 'DEPENDENCY_MISSING', detail: 'powershell not found' };
  }
  if (ext === '.sh') {
    const bin = which('bash') || which('sh');
    return bin ? { bin, args: [] } : { error: 'DEPENDENCY_MISSING', detail: 'bash/sh not found' };
  }
  return { error: 'UNSUPPORTED_SCRIPT', detail: ext };
}

function approvalState(bindingId) {
  if (!bindingId) return { ok: false, reason: 'NO_BINDING' };
  const f = approval.find({ bindingId });
  if (!f.ok) return { ok: false, reason: 'BINDING_NOT_FOUND' };
  const b = f.binding;
  if (b.status === 'approved' || b.status === 'executed') return { ok: true, binding: b };
  if (b.status === 'denied' || b.status === 'rejected') return { ok: false, reason: 'DENIED', binding: b };
  return { ok: false, reason: 'APPROVAL_REQUIRED', binding: b };
}

function execute(input) {
  const i = input || {};
  const v = validate(i);
  if (!v.ok) return { ok: false, code: 'VALIDATION_FAILED', validation: v };
  if (!v.executable) {
    return {
      ok: false,
      code: 'NOT_EXECUTABLE',
      status: 'NOT_IMPLEMENTED',
      reason: 'instruction-only skill: no runnable script in scripts/; execution is not implemented for prompt/manifest skills',
      validation: v,
    };
  }
  if (v.risk === 'HIGH' || v.risk === 'CRITICAL') {
    const g = approvalState(i.approvalBindingId);
    if (!g.ok) {
      if (g.reason === 'DENIED') return { ok: false, code: 'DENIED', reason: 'approval was denied', binding: g.binding };
      const req = approval.request({
        tool: 'skill.execute',
        params: { skillId: v.id, script: i.script || v.scripts[0] },
        risk: v.risk,
        reason: 'execute skill ' + v.id + ' (tools: ' + v.tools.join(', ') + ')',
      });
      return {
        ok: false,
        code: 'APPROVAL_REQUIRED',
        bindingId: req.binding && req.binding.id,
        reason: 'high-risk skill needs a real approval decision before execution',
        request: req,
      };
    }
  }

  const scriptName = i.script || v.scripts[0];
  const script = path.resolve(v.path, 'scripts', scriptName);
  if (!script.startsWith(path.resolve(v.path) + path.sep)) return { ok: false, code: 'PATH_TRAVERSAL', detail: script };
  if (!fs.existsSync(script)) return { ok: false, code: 'SCRIPT_NOT_FOUND', detail: script };
  const interp = interpreterFor(script);
  if (interp.error) return { ok: false, code: interp.error, detail: interp.detail };
  const timeout = Math.min(300000, Math.max(1000, Number(i.timeoutMs) || 30000));
  const args = [...interp.args, script, ...(Array.isArray(i.args) ? i.args.map(String) : [])];
  const started = Date.now();
  let r;
  try {
    r = spawnSync(interp.bin, args, {
      cwd: v.path,
      env: safeEnv(),
      windowsHide: true,
      encoding: 'utf8',
      timeout,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (e) { return { ok: false, code: 'SPAWN_ERROR', detail: e.message }; }
  const durationMs = Date.now() - started;
  if (r.error) return { ok: false, code: r.error.code || 'SPAWN_ERROR', detail: r.error.message };
  const receipt = {
    id: 'rcpt_' + crypto.randomBytes(6).toString('hex'),
    at: new Date().toISOString(),
    skillId: v.id,
    script: scriptName,
    risk: v.risk,
    approvedVia: i.approvalBindingId || null,
    exitCode: r.status,
    signal: r.signal,
    durationMs,
    stdout: redact(r.stdout).slice(0, 8000),
    stderr: redact(r.stderr).slice(0, 8000),
  };
  const receiptPath = path.join(receiptsDir(), receipt.id + '.json');
  try { fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), 'utf8'); } catch (e) { /* receipt best effort */ }
  return {
    ok: r.status === 0,
    code: r.status === 0 ? 'OK' : 'SCRIPT_FAILED',
    skillId: v.id,
    script: scriptName,
    exitCode: r.status,
    durationMs,
    stdout: receipt.stdout,
    stderr: receipt.stderr,
    receiptPath,
    approvalBindingId: i.approvalBindingId || null,
  };
}

function rollback(input) {
  const r = resolveSkill(input);
  if (!r.ok) return { ok: false, ...r };
  const sdir = path.join(r.dir, 'scripts');
  try {
    const rb = fs.readdirSync(sdir).find((n) => /^rollback\./i.test(n) && RUNNABLE.has(path.extname(n).toLowerCase()));
    if (!rb) return { ok: false, code: 'NOT_IMPLEMENTED', reason: 'no rollback script declared by this skill' };
    return execute({ ...(input || {}), skillPath: r.dir, script: rb });
  } catch (e) { return { ok: false, code: 'NOT_IMPLEMENTED', reason: 'no scripts/ directory' }; }
}

function status() {
  const all = Array.from(discovery.skillRegistry.values());
  let withScripts = 0;
  for (const e of all) {
    let dir = e.path ? path.resolve(e.path) : null;
    if (!dir) continue;
    try { if (fs.statSync(dir).isFile()) dir = path.dirname(dir); } catch (er) { continue; }
    if (findScripts(dir).length) withScripts++;
  }
  let receiptCount = 0;
  try { receiptCount = fs.readdirSync(receiptsDir()).filter((n) => n.endsWith('.json')).length; } catch (e) { /* empty */ }
  return {
    ok: true,
    status: 'AVAILABLE',
    discovered: all.length,
    executable: withScripts,
    instructionOnly: all.length - withScripts,
    receipts: receiptCount,
    riskPolicy: { HIGH: 'approval required via approval_manager', MEDIUM: 'allowed', LOW: 'allowed' },
    guarantees: ['no shell', 'allowlisted interpreters', 'sanitised env', 'timeout', 'redacted receipts', 'recomputed status'],
    note: 'manifest status:ACTIVE is never trusted; execution only for skills with real scripts',
  };
}

function catalog(opts) {
  const o = opts || {};
  const items = [];
  for (const e of discovery.skillRegistry.values()) {
    let dir = e.path ? path.resolve(e.path) : null;
    if (!dir) continue;
    try { if (fs.statSync(dir).isFile()) dir = path.dirname(dir); } catch (er) { continue; }
    const scripts = findScripts(dir);
    items.push({ id: e.id, name: e.name, executable: scripts.length > 0, scripts: scripts.map(path.basename), risk: riskFor(e) });
  }
  const limit = Math.min(1000, Math.max(1, Number(o.limit) || 100));
  const filtered = o.executable === true ? items.filter((x) => x.executable) : items;
  return { ok: true, total: filtered.length, skills: filtered.slice(0, limit) };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/status', (req, res) => res.json(status()));
  router.get('/catalog', (req, res) => res.json(catalog(req.query)));
  router.post('/validate', (req, res) => res.json(validate(req.body || {})));
  router.post('/execute', (req, res) => res.json(execute(req.body || {})));
  router.post('/rollback', (req, res) => res.json(rollback(req.body || {})));
  router.get('/receipts', (req, res) => {
    try { res.json({ ok: true, files: fs.readdirSync(receiptsDir()).filter((n) => n.endsWith('.json')) }); }
    catch (e) { res.json({ ok: true, files: [] }); }
  });
  return router;
}

module.exports = { STATUS, status, catalog, validate, execute, rollback, createRouter };
