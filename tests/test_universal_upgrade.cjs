'use strict';
/**
 * Regression suite for the v9.8.0 universal desktop upgrade.
 * No network calls, no destructive actions, no user data writes outside temp.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'resources', 'app', 'dist');
const TMP = path.join(os.tmpdir(), 'opencode', `myraa-upgrade-test-${Date.now()}`);
process.env.MYRAA_WORKFLOW_SKILLS_DIR = path.join(TMP, 'workflow_skills');
process.env.MYRAA_USER_SKILLS_DIR = path.join(TMP, 'skills');
process.env.MYRAA_TRACE_DIR = path.join(TMP, 'traces');

const req = (name) => require(path.join(DIST, name));

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1; }
}
async function checkAsync(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1; }
}

(async () => {
  check('version sources agree', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources', 'app', 'package.json'), 'utf8'));
    const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources', 'app', 'version.json'), 'utf8'));
    assert.strictEqual(pkg.version, ver.version);
    assert.ok(/^\d+\.\d+\.\d+$/.test(ver.version));
  });

  check('client discovery reports missing values verbatim', () => {
    const cd = req('client_discovery.cjs');
    const r = cd.analyze({ companyName: 'Test' }, []);
    assert.strictEqual(r.record.website, cd.WEBSITE_NOT_FOUND);
    assert.strictEqual(r.record.phone, cd.PHONE_NOT_VERIFIED);
    assert.strictEqual(cd.toExcelRow(r.record).length, 17);
  });

  await checkAsync('legal research allowlist blocks arbitrary domains', async () => {
    const legal = req('legal_research.cjs');
    const r = await legal.fetchSource('https://example.com', 1000);
    assert.strictEqual(r.ok, false);
    assert.match(r.reason, /allowlist/);
  });

  check('VBA analyzer improves recorded macro', () => {
    const vba = req('vba_analyzer.cjs');
    const code = ['Sub header()', 'Range("H1").Select', 'Selection.NumberFormat = "@"',
      'ActiveCell.FormulaR1C1 = "PAN"', 'Range("I1").Select', 'Selection.NumberFormat = "@"',
      'ActiveCell.FormulaR1C1 = "Donation Onwer"', 'End Sub'].join('\n');
    const a = vba.analyze(code);
    assert.ok(a.review.findings.some((f) => f.type === 'LIKELY_SPELLING'));
    assert.strictEqual(a.improvement.generated, true);
    assert.match(a.improvement.code, /Donation Owner/);
    assert.doesNotMatch(a.improvement.code, /\.Select/);
  });

  check('reasoning frameworks are UNKNOWN by default', () => {
    const rf = req('reasoning_frameworks.cjs');
    for (const name of Object.keys(rf.FRAMEWORKS)) {
      const r = rf.invoke(name, {});
      assert.strictEqual(r.unknownCount, r.sections.length, name);
    }
    const legal = rf.legalAwareness({ jurisdiction: 'India' });
    assert.ok(legal.applicability.items.every((i) => i.applicable === 'Unclear'));
  });

  await checkAsync('workflow compiler requires approval before saving', async () => {
    const wf = req('workflow_skill_compiler.cjs');
    const candidate = { name: 'Test flow', steps: [{ app: 'EXCEL', control: 'A1' }, { app: 'EXCEL', control: 'B2' }] };
    const prepared = wf.compile(candidate, {});
    assert.strictEqual(prepared.code, 'APPROVAL_REQUIRED');
    assert.ok(prepared.token);
    const saved = wf.confirmPending(prepared.token);
    assert.strictEqual(saved.ok, true);
    const dry = wf.dryRun(saved.skill.id);
    assert.strictEqual(dry.noChangesMade, true);
  });

  await checkAsync('skill replay supports controls and fails unsupported actions closed', async () => {
    const sr = req('skill_replay.cjs');
    const started = sr.start('x', { skill: { id: 'x', steps: [
      { id: 's1', order: 1, action: 'wait', target: null, parameters: { ms: 1 } },
      { id: 's2', order: 2, action: 'unknown_action', target: 'x' },
    ] }, mode: 'step', requireConfirm: true });
    assert.strictEqual(started.ok, true);
    const guard = await sr.executeStep(started.sessionId, {});
    assert.strictEqual(guard.code, 'APPROVAL_REQUIRED');
    const first = await sr.executeStep(started.sessionId, { confirm: true });
    assert.strictEqual(first.trace.result, 'SUCCEEDED');
    assert.strictEqual(sr.pause(started.sessionId).ok, true);
    assert.strictEqual((await sr.executeStep(started.sessionId, { confirm: true })).code, 'PAUSED');
    assert.strictEqual(sr.resume(started.sessionId).ok, true);
    const second = await sr.executeStep(started.sessionId, { confirm: true });
    assert.strictEqual(second.code, 'SKIPPED_UNSUPPORTED');
    assert.ok(fs.existsSync(path.join(TMP, 'traces')));
  });

  check('system control matrix is honest', () => {
    const sm = req('system_control_matrix.cjs');
    const s = sm.status();
    assert.ok(s.controls.length >= 26);
    assert.strictEqual(sm.get('screenSharing').status, 'Not implemented');
    assert.strictEqual(sm.readState('mute').status, 'NOT_VERIFIED');
  });

  check('screen sharing is never enabled silently', () => {
    const share = req('screen_share_status.cjs');
    const s = share.status();
    assert.strictEqual(s.sharingState, 'NOT_VERIFIED');
    assert.strictEqual(s.neverEnablesSharing, true);
  });

  check('capability analyzer exposes new capabilities', () => {
    const cap = req('capability_gap_analyzer.cjs');
    const ids = cap.analyze('skill replay legal research bluetooth').capabilities.map((c) => c.id);
    for (const id of ['skill.replay', 'legal.research_adapter', 'system.controls']) assert.ok(ids.includes(id), id);
  });

  check('Action Center page is present', () => {
    const html = fs.readFileSync(path.join(DIST, 'action_center.html'), 'utf8');
    assert.match(html, /MYRAA Action Center/);
    assert.match(html, /api\/skill-replay\/sessions/);
    assert.doesNotMatch(html, /[\uD800-\uDBFF][\uDC00-\uDFFF]/);
  });

  console.log(`\n${passed} checks passed`);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* best effort */ }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
