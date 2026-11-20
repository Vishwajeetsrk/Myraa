'use strict';
/**
 * MYRAA Workflow-to-Skill Compiler
 * =============================================================================
 * Turns a repeated workflow candidate (from live_awareness_routes.cjs or a
 * manual submission) into an EDITABLE skill candidate.
 *
 * It extends the EXISTING skill system:
 *   - candidate state lives in %APPDATA%\MYRAA\workflow_skills
 *   - publishing writes SKILL.md + manifest.json into %APPDATA%\MYRAA\skills
 *   - skill_discovery_engine.scanAndRegisterAll() registers the new skill
 *   - no second skill registry, runner or executor is created
 *
 * Honesty rules:
 *   - No skill is created without explicit confirm: true.
 *   - Steps record OBSERVED metadata; actions are NOT_INFERRED until edited.
 *   - Dry run changes nothing and says so.
 *   - Publishing requires a completed dry run; replay execution is separate.
 *   - Skills are instruction-only, so the existing runner will not pretend
 *     it can execute them.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const DATA_DIR = process.env.MYRAA_WORKFLOW_SKILLS_DIR || path.join(appData, 'MYRAA', 'workflow_skills');
const SKILLS_DIR = process.env.MYRAA_USER_SKILLS_DIR || path.join(appData, 'MYRAA', 'skills');
const STORE = path.join(DATA_DIR, 'candidates.json');

function readStore() {
  try {
    if (fs.existsSync(STORE)) {
      const raw = fs.readFileSync(STORE, 'utf8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) { /* corrupt store is treated as empty; original file is left in place */ }
  return [];
}

function writeStore(items) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
  fs.renameSync(tmp, STORE);
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Prepared-but-unsaved candidates. A token is returned with APPROVAL_REQUIRED
// so a later voice or UI confirmation saves exactly the candidate that was
// shown to the user, not a freshly generated one.
const pendingCandidates = new Map();

function confirmPending(token) {
  const skill = pendingCandidates.get(String(token || ''));
  if (!skill) return { ok: false, code: 'NOT_FOUND', error: 'No pending candidate for that token, or it was already used.' };
  const store = readStore();
  store.unshift(skill);
  writeStore(store.slice(0, 100));
  pendingCandidates.delete(String(token));
  return { ok: true, saved: true, skill, message: 'Skill candidate saved as DRAFT after explicit confirmation.' };
}

function slug(s) {
  return String(s || 'workflow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'workflow';
}

function stepsFromCandidate(steps) {
  const list = Array.isArray(steps) ? steps : [];
  return list.slice(0, 50).map((s, i) => {
    const observed = s && typeof s === 'object' ? s : { raw: s };
    const target = observed.control || observed.document || observed.windowTitle || observed.target || null;
    return {
      id: `s${i + 1}`,
      order: i + 1,
      app: observed.app || observed.processName || null,
      windowTitle: observed.windowTitle || null,
      document: observed.document || null,
      target,
      controlType: observed.controlType || null,
      action: observed.action && observed.action !== 'NOT_INFERRED' ? observed.action : 'NOT_INFERRED',
      parameters: observed.parameters || {},
      verification: {
        method: target ? 'UIA element presence' : 'NOT_DEFINED',
        expected: target || null,
        status: 'NOT_VERIFIED',
      },
      status: 'OBSERVED',
    };
  });
}

function compile(input = {}, opts = {}) {
  const c = input && typeof input === 'object' ? input : {};
  const steps = stepsFromCandidate(c.steps);
  if (steps.length < 2) {
    return { ok: false, code: 'VALIDATION', error: 'A workflow candidate needs at least 2 steps.' };
  }
  const apps = [...new Set(steps.map((s) => s.app).filter(Boolean))];
  const confidence = typeof c.confidence === 'number' ? c.confidence : null;
  const skill = {
    id: newId('wfskill'),
    name: String(c.name || 'Observed workflow').slice(0, 120),
    description: String(c.description || 'Workflow compiled from observed desktop actions. Review every step before publishing.').slice(0, 600),
    trigger: String(c.trigger || 'NOT_DEFINED').slice(0, 200),
    requiredApps: apps,
    requiredPermissions: Array.isArray(c.requiredPermissions) ? c.requiredPermissions.slice(0, 20) : [],
    inputs: Array.isArray(c.inputs) ? c.inputs.slice(0, 30) : [],
    outputs: Array.isArray(c.outputs) ? c.outputs.slice(0, 30) : [],
    steps,
    validationRules: [
      'Confirm the expected application is present before each step.',
      'Verify the target element or document after every navigation.',
      'Stop on the first failed verification; never continue a partially applied workflow.',
    ],
    failureHandling: 'Stop, report the failed step and the observed state, then ask before retrying.',
    rollbackStrategy: 'NOT_DEFINED — add before publishing',
    examples: Array.isArray(c.examples) ? c.examples.slice(0, 10) : [],
    dependencies: Array.isArray(c.dependencies) ? c.dependencies.slice(0, 20) : [],
    confidence,
    version: 1,
    createdDate: new Date().toISOString(),
    lastUsed: null,
    successRate: null,
    runCount: 0,
    failureCount: 0,
    dryRunCount: 0,
    status: 'CANDIDATE',
    requiresConfirmation: true,
    source: String(c.source || 'manual').slice(0, 120),
    occurrences: typeof c.occurrences === 'number' ? c.occurrences : null,
    history: [{ version: 1, at: new Date().toISOString(), note: 'Compiled from observed workflow.' }],
    executionMode: 'instruction-only',
  };

  if (opts.confirm !== true) {
    const token = newId('approval');
    pendingCandidates.set(token, skill);
    if (pendingCandidates.size > 50) pendingCandidates.delete(pendingCandidates.keys().next().value);
    return {
      ok: false,
      code: 'APPROVAL_REQUIRED',
      token,
      message: 'A skill candidate was prepared but NOT saved. Confirm with the token to save it.',
      candidate: skill,
      policy: 'No skill is created from accidental behaviour or without confirmation.',
    };
  }

  const store = readStore();
  store.unshift(skill);
  writeStore(store.slice(0, 100));
  return { ok: true, saved: true, skill, message: 'Skill candidate saved as DRAFT. Edit steps, then dry run before publishing.' };
}

function list() {
  const store = readStore();
  return {
    ok: true,
    count: store.length,
    skills: store.map((s) => ({
      id: s.id, name: s.name, status: s.status, version: s.version,
      steps: (s.steps || []).length, confidence: s.confidence,
      successRate: s.successRate, lastUsed: s.lastUsed, dryRunCount: s.dryRunCount,
    })),
  };
}

function get(id) {
  return readStore().find((s) => s.id === String(id || '')) || null;
}

function mutate(id, fn, note) {
  const store = readStore();
  const idx = store.findIndex((s) => s.id === String(id || ''));
  if (idx < 0) return { ok: false, code: 'NOT_FOUND', error: 'unknown skill candidate' };
  const copy = JSON.parse(JSON.stringify(store[idx]));
  const result = fn(copy);
  if (result && result.error) return result;
  copy.version += 1;
  copy.history = copy.history || [];
  copy.history.unshift({ version: copy.version, at: new Date().toISOString(), note: String(note || 'edited') });
  if (copy.status === 'CANDIDATE') copy.status = 'DRAFT';
  store[idx] = copy;
  writeStore(store);
  return { ok: true, skill: copy, version: copy.version };
}

function edit(id, input = {}) {
  const b = input && typeof input === 'object' ? input : {};
  return mutate(id, (s) => {
    if (b.name) s.name = String(b.name).slice(0, 120);
    if (b.description) s.description = String(b.description).slice(0, 600);
    if (b.trigger) s.trigger = String(b.trigger).slice(0, 200);
    if (b.rollbackStrategy) s.rollbackStrategy = String(b.rollbackStrategy).slice(0, 600);
    if (b.stepId) {
      const step = (s.steps || []).find((x) => x.id === String(b.stepId));
      if (!step) return { ok: false, code: 'STEP_NOT_FOUND', error: 'unknown step id' };
      for (const key of ['app', 'action', 'target', 'controlType', 'parameters']) {
        if (b.patch && b.patch[key] !== undefined) step[key] = b.patch[key];
      }
      if (b.patch && b.patch.verification) step.verification = { ...step.verification, ...b.patch.verification };
      step.status = 'EDITED';
    }
    if (b.removeStepId) {
      s.steps = (s.steps || []).filter((x) => x.id !== String(b.removeStepId));
      if (!s.steps.length) return { ok: false, code: 'VALIDATION', error: 'a skill must keep at least one step' };
      s.steps.forEach((x, i) => { x.order = i + 1; });
    }
    return null;
  }, 'edited skill definition');
}

function dryRun(id) {
  const s = get(id);
  if (!s) return { ok: false, code: 'NOT_FOUND', error: 'unknown skill candidate' };
  const steps = (s.steps || []).map((step) => ({
    order: step.order,
    wouldUseApp: step.app || 'NOT_DEFINED',
    wouldActOn: step.target || 'NOT_DEFINED',
    action: step.action,
    verification: step.verification && step.verification.method,
  }));
  const plan = {
    ok: true,
    skillId: s.id,
    name: s.name,
    version: s.version,
    steps,
    wouldModify: steps.filter((x) => x.action !== 'NOT_INFERRED').map((x) => x.wouldActOn),
    wouldCreate: [],
    systemSettingsChanged: 'none',
    noChangesMade: true,
    note: 'Simulation only. No application was opened, no file or cell was changed, no setting was touched.',
    limitation: 'Steps whose action is NOT_INFERRED cannot be simulated until edited; they are listed, not guessed.',
  };
  mutate(id, (copy) => { copy.dryRunCount += 1; return null; }, 'dry run completed');
  return plan;
}

function publish(id, opts = {}) {
  const s = get(id);
  if (!s) return { ok: false, code: 'NOT_FOUND', error: 'unknown skill candidate' };
  if (opts.confirm !== true) {
    return { ok: false, code: 'APPROVAL_REQUIRED', message: 'Publishing a skill requires confirm: true.' };
  }
  if (!s.dryRunCount) {
    return { ok: false, code: 'DRY_RUN_REQUIRED', message: 'Run a dry run before publishing.' };
  }
  if ((s.steps || []).some((x) => x.action === 'NOT_INFERRED')) {
    return {
      ok: false,
      code: 'STEPS_NOT_DEFINED',
      message: 'At least one step still has action NOT_INFERRED. Edit it before publishing.',
      steps: (s.steps || []).filter((x) => x.action === 'NOT_INFERRED').map((x) => x.id),
    };
  }
  if (/NOT_DEFINED/.test(s.rollbackStrategy)) {
    return { ok: false, code: 'ROLLBACK_REQUIRED', message: 'Define a rollback strategy before publishing.' };
  }

  const idDir = slug(s.name) + '-' + s.id.slice(-6);
  const target = path.join(SKILLS_DIR, idDir);
  if (fs.existsSync(target)) {
    return { ok: false, code: 'ALREADY_EXISTS', error: 'A skill directory with this id already exists; nothing was overwritten.' };
  }
  fs.mkdirSync(target, { recursive: true });
  const frontmatter = [
    '---',
    `name: ${idDir}`,
    `description: ${String(s.description).replace(/[\r\n]+/g, ' ').slice(0, 300)}`,
    `version: ${s.version}`,
    'category: workflow-automation',
    'status: ready',
    'risk: medium',
    `tools_required: ${JSON.stringify(s.requiredApps)}`,
    `permissions: ${JSON.stringify(s.requiredPermissions)}`,
    'execution_mode: instruction-only',
    '---',
    '',
    `# ${s.name}`,
    '',
    `Trigger: ${s.trigger}`,
    '',
    '## Steps',
    ...(s.steps || []).map((step, i) => `${i + 1}. [${step.app || 'unknown app'}] ${step.action} on ${step.target || 'NOT_DEFINED'} (verify: ${step.verification && step.verification.method})`),
    '',
    '## Validation',
    ...(s.validationRules || []).map((r) => `- ${r}`),
    '',
    `Rollback: ${s.rollbackStrategy}`,
    '',
    'This skill is instruction-only. The existing skill runner does not execute it automatically.',
  ].join('\n');
  fs.writeFileSync(path.join(target, 'SKILL.md'), frontmatter, 'utf8');
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify({
    id: idDir, name: s.name, version: s.version, category: 'workflow-automation',
    status: 'ready', executionMode: 'instruction-only', tools_required: s.requiredApps,
    permissions: s.requiredPermissions, steps: s.steps, rollbackStrategy: s.rollbackStrategy,
    sourceSkillId: s.id, publishedAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  let registered = false;
  try {
    const discovery = require('./skill_discovery_engine.cjs');
    if (typeof discovery.scanAndRegisterAll === 'function') {
      discovery.scanAndRegisterAll();
      registered = discovery.skillRegistry.has(idDir);
    }
  } catch (e) { registered = false; }

  mutate(id, (copy) => { copy.status = registered ? 'READY' : 'PUBLISHED_NOT_REGISTERED'; return null; }, 'published to user skills library');
  return {
    ok: true,
    published: true,
    registered,
    skillId: idDir,
    path: target,
    note: registered
      ? 'Skill is registered in the existing skill discovery registry.'
      : 'Files were written, but the registry did not pick up the skill in this process. It should appear after the next scan.',
  };
}

function recordRun(id, input = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const success = b.success === true;
  return mutate(id, (s) => {
    s.runCount += 1;
    s.lastUsed = new Date().toISOString();
    if (!success) s.failureCount += 1;
    const completed = s.runCount - s.failureCount;
    s.successRate = Number((completed / s.runCount).toFixed(3));
    if (s.failureCount > 0 && s.failureCount >= 2 && s.status === 'READY') s.status = 'NEEDS_REVIEW';
    return null;
  }, success ? 'run reported successful' : `run reported failure: ${String(b.error || '').slice(0, 120)}`);
}

function improve(id, input = {}) {
  const s = get(id);
  if (!s) return { ok: false, code: 'NOT_FOUND', error: 'unknown skill candidate' };
  const b = input && typeof input === 'object' ? input : {};
  if (!b.failure && !b.stepId) {
    return {
      ok: false,
      code: 'INSUFFICIENT_EVIDENCE',
      message: 'Provide a failed step id and the observed failure. No selector is changed on a guess.',
    };
  }
  return mutate(id, (copy) => {
    const step = (copy.steps || []).find((x) => x.id === String(b.stepId));
    if (step) {
      step.verification = { ...step.verification, lastFailure: String(b.failure || '').slice(0, 300), status: 'FAILED' };
      if (b.suggestedTarget) {
        step.target = String(b.suggestedTarget).slice(0, 300);
        step.verification.expected = step.target;
        step.verification.status = 'ADAPTED_NOT_VERIFIED';
      }
    }
    copy.status = 'NEEDS_REVIEW';
    return null;
  }, 'improvement applied from reported failure');
}

function saveCandidate(input = {}, opts = {}) { return compile(input, opts); }

const STATUS = {
  ok: true,
  service: 'workflow-skill-compiler',
  method: 'compiles observed workflow metadata into editable, instruction-only skill candidates',
  storage: DATA_DIR,
  publicationDir: SKILLS_DIR,
  reuse: 'publishes into the existing skill_discovery_engine registry; no second skill system',
  safety: {
    confirmationRequired: ['compile (save)', 'publish'],
    dryRunRequiredBeforePublish: true,
    executionImplemented: false,
    note: 'Replay execution is NOT implemented. Do not claim a workflow ran.',
  },
};

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json(STATUS));
  router.get('/list', (req, res) => res.json(list()));
  router.post('/compile', (req, res) => {
    const r = compile((req.body || {}).candidate || req.body || {}, req.body || {});
    res.status(r.ok ? 200 : (r.code === 'APPROVAL_REQUIRED' ? 409 : 400)).json(r);
  });
  router.post('/confirm', (req, res) => {
    const r = confirmPending((req.body || {}).token);
    res.status(r.ok ? 200 : 404).json(r);
  });
  router.post('/dry-run', (req, res) => {
    const r = dryRun((req.body || {}).id);
    res.status(r.ok ? 200 : 404).json(r);
  });
  router.post('/edit', (req, res) => res.status(req.body && req.body.id ? 200 : 400).json(edit((req.body || {}).id, req.body || {})));
  router.post('/publish', (req, res) => {
    const r = publish((req.body || {}).id, req.body || {});
    res.status(r.ok ? 200 : (r.code === 'APPROVAL_REQUIRED' ? 409 : 400)).json(r);
  });
  router.post('/run-record', (req, res) => res.json(recordRun((req.body || {}).id, req.body || {})));
  router.post('/improve', (req, res) => res.json(improve((req.body || {}).id, req.body || {})));
  router.get('/:id', (req, res) => {
    const s = get(req.params.id);
    res.status(s ? 200 : 404).json(s ? { ok: true, skill: s } : { ok: false, code: 'NOT_FOUND' });
  });
  return router;
}

module.exports = {
  STATUS, DATA_DIR, SKILLS_DIR,
  compile, saveCandidate, confirmPending, list, get, edit, dryRun, publish, recordRun, improve, createRouter,
};
