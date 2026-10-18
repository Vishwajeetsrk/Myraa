'use strict';
// Phase 21 safety broker tests. Isolated stores via env; fake engine; no network.

const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'myraa_phase21_' + process.pid);
fs.mkdirSync(TMP, { recursive: true });
process.env.MYRAA_BROKER_DB = path.join(TMP, 'broker_state.json');
process.env.MYRAA_WORKSPACE_DB = path.join(TMP, 'agent_workspace.json');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const brokerMod = require(path.join(DIST, 'safety_broker.cjs'));
const wsMod = require(path.join(DIST, 'agent_workspace.cjs'));

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass += 1; console.log('[OK] ' + name); }
  else { fail += 1; console.log('[X] ' + name + (extra ? ' :: ' + String(extra) : '')); }
}

const executions = [];
const fakeEngine = {
  execute: async (name, params, options) => {
    executions.push({ name, params, options });
    if (name === 'boom_tool') return { success: false, error: 'synthetic failure' };
    return { success: true, result: 'ran ' + name };
  },
};

const broker = brokerMod.createBroker({ storePath: process.env.MYRAA_BROKER_DB, engine: fakeEngine });
const ws = () => wsMod.createWorkspace({});

function decide(approvalId, decision) {
  return ws().decideApproval({ id: approvalId, decision, decidedBy: 'test' });
}

(async () => {
  const r1 = broker.requestApproval({ tool: 'shell_exec', params: { cmd: 'echo hi' }, reason: 'test run', risk: 'HIGH' });
  check('request ok + waiting', r1.ok === true && r1.binding.status === 'waiting', JSON.stringify(r1));
  check('approval card id prefix', typeof r1.binding.approvalId === 'string' && r1.binding.approvalId.startsWith('apr_'));
  check('response hides params', r1.binding.params === undefined && typeof r1.binding.paramsSummary === 'string');

  const r2 = broker.requestApproval({ tool: 'api_call', params: { api_key: 'sk-123456', city: 'Austin', nested: { a: 1 } }, risk: 'HIGH' });
  check('secret key redacted', r2.ok === true && r2.binding.paramsSummary.includes('api_key=[redacted]'));
  check('visible value kept', r2.ok === true && r2.binding.paramsSummary.includes('city=Austin'));
  check('object value redacted', r2.ok === true && r2.binding.paramsSummary.includes('nested=[redacted]'));

  const r3 = broker.requestApproval({ tool: 'x', risk: 'LOW' });
  check('LOW risk rejected', r3.ok === false && r3.code === 'VALIDATION');
  const r4 = broker.requestApproval({ risk: 'HIGH' });
  check('missing tool rejected', r4.ok === false && r4.code === 'VALIDATION');
  const r5 = broker.requestApproval({ tool: 'y', risk: 'CRITICAL', params: 'not-an-object' });
  check('bad params tolerated as none', r5.ok === true && r5.binding.paramsSummary === '(no params)');

  const execBefore = executions.length;
  const e1 = await broker.executeBinding(r1.binding.id, {});
  check('execute while waiting refused', e1.ok === false && e1.code === 'NOT_APPROVED' && executions.length === execBefore);
  const e2 = await broker.executeBinding('bnk_missing', {});
  check('unknown binding refused', e2.ok === false && e2.code === 'NOT_FOUND');

  const d1 = decide(r1.binding.approvalId, 'approve');
  check('workspace approve ok', d1.ok === true, JSON.stringify(d1));
  const s1 = broker.syncWithWorkspace();
  check('sync marks approved', s1.ok === true && s1.transitions.some((t) => t.id === r1.binding.id && t.to === 'approved'), JSON.stringify(s1));
  const e3 = await broker.executeBinding(r1.binding.id, {});
  check('approved executes', e3.ok === true && e3.binding.status === 'executed', JSON.stringify(e3));
  const call1 = executions[executions.length - 1];
  check('engine got confirm:true', !!call1 && call1.options && call1.options.confirm === true && call1.name === 'shell_exec');
  check('resultSummary recorded', typeof e3.binding.resultSummary === 'string' && e3.binding.resultSummary.includes('ran shell_exec'));

  const d2 = decide(r2.binding.approvalId, 'deny');
  check('workspace deny ok', d2.ok === true);
  const s2 = broker.syncWithWorkspace();
  check('sync marks denied', s2.ok === true && s2.transitions.some((t) => t.id === r2.binding.id && t.to === 'denied'));
  const execBeforeDeny = executions.length;
  const e4 = await broker.executeBinding(r2.binding.id, {});
  check('denied never executes', e4.ok === false && e4.status === 'denied' && executions.length === execBeforeDeny);

  const r6 = broker.requestApproval({ tool: 'boom_tool', params: {}, risk: 'CRITICAL' });
  decide(r6.binding.approvalId, 'approve');
  broker.syncWithWorkspace();
  const e5 = await broker.executeBinding(r6.binding.id, {});
  check('engine failure surfaced', e5.ok === false && e5.code === 'EXECUTION' && e5.retryable === true);
  const afterFail = broker.findBinding(r6.binding.id);
  check('stays approved after failure', afterFail.status === 'approved' && afterFail.lastError === 'synthetic failure' && afterFail.attempts === 1);
  const e5b = await broker.executeBinding(r6.binding.id, {});
  check('retry counted', e5b.ok === false && broker.findBinding(r6.binding.id).attempts === 2);

  const r7 = broker.requestApproval({ tool: 'shell_exec', params: { cmd: 'ls' }, risk: 'HIGH' });
  decide(r7.binding.approvalId, 'approve');
  const sweep = await broker.executeApproved({});
  check('sweep attempts approved', sweep.ok === true && sweep.attempted >= 1 && sweep.results.some((x) => x.ok === true), JSON.stringify(sweep));

  const r8 = broker.requestApproval({ tool: 'late_tool', params: {}, risk: 'HIGH' });
  const wsFile = process.env.MYRAA_WORKSPACE_DB;
  const wsData = JSON.parse(fs.readFileSync(wsFile, 'utf8'));
  const card = wsData.approvals.find((a) => a.id === r8.binding.approvalId);
  card.expiresAt = new Date(Date.now() - 60000).toISOString();
  fs.writeFileSync(wsFile, JSON.stringify(wsData, null, 2), 'utf8');
  const s3 = broker.syncWithWorkspace();
  check('expired mirrored', s3.ok === true && broker.findBinding(r8.binding.id).status === 'expired', JSON.stringify(s3));

  check('find by approvalId', broker.findBinding(r1.binding.approvalId) !== null);
  const lb = broker.listBindings({});
  check('list hides params', lb.ok === true && lb.bindings.every((b) => b.params === undefined));
  const st = broker.status();
  check('status shape + counts', st.ok === true && st.counts.executed >= 1 && st.counts.denied >= 1 && st.counts.expired >= 1, JSON.stringify(st.counts));
  check('events capped', Array.isArray(st.events) && st.events.length <= 12);
  check('store path honored', st.storePath === process.env.MYRAA_BROKER_DB);

  const seeded = [];
  for (let i = 0; i < 100; i++) {
    seeded.push({
      id: 'bnk_seed_' + i, tool: 't', risk: 'HIGH', paramsSummary: '(no params)', params: null,
      reason: '', status: 'executed', approvalId: 'apr_seed_' + i, threadId: null, attempts: 1,
      createdAt: new Date().toISOString(), journal: [],
    });
  }
  fs.writeFileSync(process.env.MYRAA_BROKER_DB, JSON.stringify({ version: '21.0.0', counter: 100, bindings: seeded }, null, 2), 'utf8');
  const r9 = broker.requestApproval({ tool: 'fresh_tool', params: {}, risk: 'HIGH' });
  check('cap prunes terminal entries', r9.ok === true, JSON.stringify(r9));
  const st2 = broker.status();
  check('terminal pruned', st2.counts.executed === 0 && st2.counts.waiting === 1, JSON.stringify(st2.counts));

  console.log('');
  console.log('safety_broker tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('[X] test harness crashed: ' + ((e && e.stack) || e));
  process.exit(1);
});
