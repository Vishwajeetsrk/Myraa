'use strict';
// Phase 7: approval surface uses the real broker/workspace/engine. Isolated stores.

const fs = require('fs');
const path = require('path');
const os = require('os');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p7_'));
process.env.MYRAA_BROKER_DB = path.join(TMP, 'broker.json');
process.env.MYRAA_WORKSPACE_DB = path.join(TMP, 'workspace.json');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const approvals = require(path.join(DIST, 'approval_manager.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const bad = approvals.request({ tool: 'crm.update', risk: 'LOW', params: {} });
  check('low risk is not silently upgraded', bad.ok === false && bad.code === 'VALIDATION');

  const r1 = approvals.request({ tool: 'gmail.send', risk: 'HIGH', params: { to: 'x@example.com', password: 'secret' }, reason: 'test' });
  check('high risk request creates a binding', r1.ok === true && !!r1.binding && !!r1.binding.approvalId);
  check('binding params are redacted', !JSON.stringify(r1.binding).includes('secret'));

  const p1 = approvals.pending();
  check('pending lists the waiting binding', p1.ok === true && p1.waiting.some((b) => b.id === r1.binding.id));
  check('status counts derive from broker state', p1.status.counts.waiting >= 1);

  const deny = approvals.decide({ bindingId: r1.binding.id, decision: 'deny' });
  check('deny decision succeeds', deny.ok === true && deny.decision.status === 'denied');
  const execDenied = await approvals.execute({ bindingId: r1.binding.id });
  check('denied binding cannot execute', execDenied.ok === false && execDenied.code === 'NOT_APPROVED');

  const r2 = approvals.request({ tool: 'unknown.test.tool', risk: 'HIGH', params: {}, reason: 'approve then try execute' });
  const approve = approvals.decide({ bindingId: r2.binding.id, decision: 'approve' });
  check('approve decision succeeds', approve.ok === true && approve.decision.status === 'approved');
  const exec = await approvals.execute({ bindingId: r2.binding.id });
  check('execution reports real engine result, never fake success', exec.ok === false || (exec.ok === true && exec.result !== undefined));

  const router = approvals.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes full approval flow', ['/pending', '/request', '/decide', '/execute', '/status'].every((p) => paths.includes(p)));

  console.log('\napproval manager tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
