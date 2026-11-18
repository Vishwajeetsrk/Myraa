'use strict';
// Skill runner: real bounded execution, recomputed status, real approval gate.

const fs = require('fs');
const os = require('os');
const path = require('path');

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_skillrun_'));
process.env.MYRAA_DATA_DIR = T; // must be set before requiring approval/broker/runners

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const sr = require(path.join(DIST, 'skill_runner.cjs'));
const approval = require(path.join(DIST, 'approval_manager.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}
function writeSkill(dir, manifest, withScript) {
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '# Test skill\n\nInstruction body.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  if (withScript) {
    fs.writeFileSync(path.join(dir, 'scripts', 'hello.cjs'),
      "console.log('MYRAA_SKILL_OK'); console.error('api_key=SUPERSECRET123');\n", 'utf8');
  }
}

(async () => {
  const st = sr.status();
  check('runner reports real discovery counts', st.ok && st.status === 'AVAILABLE' && st.discovered > 0, JSON.stringify(st).slice(0, 160));
  check('runner distinguishes executable vs instruction-only', typeof st.executable === 'number' && typeof st.instructionOnly === 'number');
  check('status vocabulary honest (no ACTIVE/CONNECTED)', !sr.STATUS.includes('ACTIVE') && !sr.STATUS.includes('CONNECTED'));

  // Executable skill with a lying manifest status
  const execDir = path.join(T, 'exec-skill');
  writeSkill(execDir, { id: 'exec_skill', name: 'Exec', version: '1.0.0', description: 'd', status: 'ACTIVE', tools_required: [] }, true);
  const v = sr.validate({ skillPath: execDir });
  check('validation recomputes status, ignores manifest ACTIVE', v.ok && v.status === 'AVAILABLE' && v.declaredStatusIsTrusted === false && /recomputed/i.test(v.note), JSON.stringify(v).slice(0, 220));
  check('validation detects the real script', v.executable && v.scripts.includes('hello.cjs'));

  const run = sr.execute({ skillPath: execDir, script: 'hello.cjs' });
  check('real script executed', run.ok && run.exitCode === 0 && /MYRAA_SKILL_OK/.test(run.stdout), JSON.stringify(run).slice(0, 220));
  check('receipt written', !!run.receiptPath && fs.existsSync(run.receiptPath));
  check('secret redacted from captured output', /\[REDACTED\]/.test(run.stderr) && !/SUPERSECRET123/.test(run.stderr), run.stderr);

  // Instruction-only skill
  const docDir = path.join(T, 'doc-skill');
  writeSkill(docDir, { id: 'doc_skill', name: 'Doc', version: '1.0.0', description: 'd', status: 'ACTIVE' }, false);
  const dv = sr.validate({ skillPath: docDir });
  check('instruction-only skill classified PARTIAL', dv.ok && !dv.executable && dv.status === 'PARTIAL');
  const dEx = sr.execute({ skillPath: docDir });
  check('instruction-only execution is NOT_EXECUTABLE (not faked)', !dEx.ok && dEx.code === 'NOT_EXECUTABLE' && dEx.status === 'NOT_IMPLEMENTED');

  // High-risk skill -> real approval gate
  const hiDir = path.join(T, 'hi-skill');
  writeSkill(hiDir, { id: 'hi_skill', name: 'Hi', version: '1.0.0', description: 'd', tools_required: ['terminal'] }, true);
  const hv = sr.validate({ skillPath: hiDir });
  check('terminal tool classified HIGH risk', hv.risk === 'HIGH');
  const first = sr.execute({ skillPath: hiDir, script: 'hello.cjs' });
  check('high-risk execution requires approval', !first.ok && first.code === 'APPROVAL_REQUIRED' && !!first.bindingId, JSON.stringify(first).slice(0, 240));
  const bindingId = first.bindingId;
  const decided = approval.decide({ bindingId, decision: 'approve', decidedBy: 'test' });
  check('real approval decision accepted', !!decided.ok, JSON.stringify(decided).slice(0, 200));
  const second = sr.execute({ skillPath: hiDir, script: 'hello.cjs', approvalBindingId: bindingId });
  check('approved execution proceeds', second.ok && second.exitCode === 0 && /MYRAA_SKILL_OK/.test(second.stdout), JSON.stringify(second).slice(0, 220));

  // Path traversal
  const trav = sr.execute({ skillPath: execDir, script: '../../evil.cjs' });
  check('path traversal rejected', !trav.ok && trav.code === 'PATH_TRAVERSAL');

  // Rollback honesty
  const rb = sr.rollback({ skillPath: execDir });
  check('rollback NOT_IMPLEMENTED when no rollback script', !rb.ok && rb.code === 'NOT_IMPLEMENTED');

  const router = sr.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes status/catalog/validate/execute/rollback', ['/status', '/catalog', '/validate', '/execute', '/rollback'].every((p) => paths.includes(p)));

  try { fs.rmSync(T, { recursive: true, force: true }); } catch (e) { /* temp only */ }
  console.log('\nskill runner tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.stack || e)); process.exit(1); });
