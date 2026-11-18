'use strict';
// Action -> Observe -> Verify: success requires a real observed change.

const fs = require('fs');
const path = require('path');
const os = require('os');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_verify_action_'));
process.env.MYRAA_BROKER_DB = path.join(TMP, 'broker.json');
process.env.MYRAA_WORKSPACE_DB = path.join(TMP, 'workspace.json');
process.env.MYRAA_ACTION_RECEIPTS_DB = path.join(TMP, 'receipts.jsonl');
process.env.MYRAA_EVENTS_DB = path.join(TMP, 'events.jsonl');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const verifier = require(path.join(DIST, 'action_verifier.cjs'));
const screen = require(path.join(DIST, 'screen_intelligence.cjs'));
const approvals = require(path.join(DIST, 'approval_manager.cjs'));
const uia = require(path.join(DIST, 'ui_automation_service.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

function ctx(flipped) {
  return {
    timestamp: new Date().toISOString(),
    activeWindow: { title: flipped ? 'Saved - Word' : 'Draft - Word' },
    uiTree: [{ name: flipped ? 'Saved' : 'Unsaved', controlType: 'Text', automationId: 'status' }],
    confidence: 0.75,
  };
}

(async () => {
  let flipped = false;
  const origCapture = screen.captureContext;
  const origInvoke = uia.invokeControl;
  screen.captureContext = async () => ({ ok: true, context: ctx(flipped) });
  uia.invokeControl = () => { flipped = true; return { ok: true }; };

  const noApproval = await verifier.run({ action: 'uia.invokeControl', query: 'Save' });
  check('mutating action requires approval', noApproval.ok === false && noApproval.code === 'APPROVAL_REQUIRED');

  const observe = await verifier.run({ action: 'screen.observe' });
  check('read-only action runs', observe.ok === true);
  check('no change is never claimed verified', observe.verified === false && /NOT verified/.test(observe.note));
  check('receipt recorded for executed action', !!observe.receiptId);

  const req = approvals.request({ tool: 'uia.invokeControl', risk: 'HIGH', params: { query: 'Save' } });
  const dec = approvals.decide({ bindingId: req.binding.id, decision: 'approve' });
  check('approval prepared', req.ok === true && dec.ok === true);
  const done = await verifier.run({ action: 'uia.invokeControl', query: 'Save', bindingId: req.binding.id });
  check('approved action executed', done.ok === true);
  check('real observation verified the change', done.verified === true && done.changes.some((c) => c.what === 'activeWindow'));
  check('evidence includes before/after snapshots', !!done.before && !!done.after && done.before.window !== done.after.window);

  flipped = true;
  const again = await verifier.run({ action: 'uia.invokeControl', query: 'Save', bindingId: req.binding.id });
  check('stable state is honestly NOT verified', again.ok === true && again.verified === false);

  const cmp = verifier.compare(ctx(false), ctx(true));
  check('compare derives changes from real observations', cmp.verified === true && cmp.changes.length >= 1);
  check('missing observation is NO_OBSERVATION', verifier.compare(null, ctx(true)).code === 'NO_OBSERVATION');

  screen.captureContext = origCapture;
  uia.invokeControl = origInvoke;
  const router = verifier.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes run/compare/history', ['/run', '/compare', '/history'].every((p) => paths.includes(p)));

  console.log('\naction verifier tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
