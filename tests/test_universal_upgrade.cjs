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
process.env.MYRAA_CONNECTIONS_STORE = path.join(TMP, 'connections.json');

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

  check('real Devicons render from the installed package', () => {
    const d = req('dev_icons_registry.cjs');
    const s = d.status();
    assert.ok(s.ok && s.icons > 1000);
    for (const name of ['_React', '_Vue', 'Nextjs']) {
      const r = d.svg(name, { size: 48 });
      assert.strictEqual(r.ok, true, name);
      assert.match(r.svg, /<svg/);
      assert.match(r.svg, /<path/);
      assert.ok(r.svg.length > 300, name + ' has real path data');
    }
    const react = d.svg('_React').svg;
    const vue = d.svg('_Vue').svg;
    const next = d.svg('Nextjs').svg;
    assert.match(react, /#00D8FF/i, 'React official cyan');
    assert.match(vue, /#41B883/i, 'Vue official green');
    assert.match(next, /#000/i, 'Next.js official black');
    assert.notStrictEqual(react, vue);
    assert.notStrictEqual(vue, next);
    assert.strictEqual(d.svg('not-a-real-icon-xyz').code, 'NOT_FOUND');
  });

  check('connections store secrets encrypted and silent', () => {
    const c = req('connections_manager.cjs');
    const secret = 'dummy-' + Date.now();
    const saved = c.save('figma', { token: secret });
    assert.strictEqual(saved.ok, true);
    const raw = fs.readFileSync(c.STORE, 'utf8');
    assert.strictEqual(raw.includes(secret), false);
    assert.strictEqual(JSON.stringify(c.status()).includes(secret), false);
    assert.strictEqual(c.remove('figma').ok, true);
  });

  check('sidebar overlay is loaded last and scoped', () => {
    const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(DIST, 'sidebar_design_v982.css'), 'utf8');
    const linkAt = html.indexOf('/sidebar_design_v982.css');
    const designAt = html.indexOf('/myraa_design_system.css');
    assert.ok(linkAt > designAt, 'sidebar overlay loads after the design system');
    assert.match(html, /sidebar_design_v982\.js/, 'late re-append script is present');
    assert.match(css, /#myraa-aceternity-sidebar/);
    assert.match(css, /\.myraa-sidebar-link \{/);
    assert.match(css, /--sb-item-h: 42px/);
    assert.match(css, /prefers-reduced-motion/);
    assert.strictEqual((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'balanced CSS blocks');
    assert.doesNotMatch(css, /z-index/);
    assert.doesNotMatch(css, /[\uD800-\uDBFF][\uDC00-\uDFFF]/);
  });

  console.log(`\n${passed} checks passed`);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* best effort */ }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
