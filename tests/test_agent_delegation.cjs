'use strict';
// Phase 10: delegation uses the real 28-agent orchestrator; model call is stubbed in tests only.

const fs = require('fs');
const path = require('path');
const os = require('os');
process.env.MYRAA_EVENTS_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p10_')), 'events.jsonl');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const delegation = require(path.join(DIST, 'agent_delegation.cjs'));
const orchestrator = require(path.join(DIST, 'multi_agent_orchestrator.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const agents = delegation.agents();
  check('agents come from the real orchestrator', agents.length === 28 && agents.every((a) => a.id && a.name && a.role));
  check('agent statuses are runtime-derived', agents.every((a) => a.status === 'READY' && a.statusSource === 'runtime'));
  check('specialist map resolves to real agents', delegation.resolve('Coder').id === 'developer' && delegation.resolve('Researcher').id === 'research');
  check('unknown specialist resolves to null', delegation.resolve('Not A Real Agent') === null);

  const bad = await delegation.delegate({ goal: '' });
  check('empty goal is VALIDATION', bad.ok === false && bad.code === 'VALIDATION');
  const unknown = await delegation.delegate({ goal: 'do something', specialist: 'Not A Real Agent' });
  check('unknown specialist is honest', unknown.ok === false && unknown.code === 'SPECIALIST_UNAVAILABLE' && unknown.task.status === 'FAILED');

  const original = orchestrator.runAgent;
  orchestrator.runAgent = async () => ({ output: 'stubbed finding', provider: 'stub', model: 'stub-model', timestamp: new Date().toISOString() });
  const ok = await delegation.delegate({ goal: 'inspect the repo', specialist: 'Coder', context: { test: true } });
  check('delegate returns structured success', ok.ok === true && ok.task.status === 'COMPLETED');
  check('result has required structured fields', ['task', 'status', 'agent', 'findings', 'artifacts', 'actions', 'errors', 'evidence', 'nextSteps'].every((k) => k in ok.task.result));
  check('findings carry real stub output', /stubbed finding/.test(ok.task.result.findings));
  orchestrator.runAgent = async () => { throw new Error('synthetic provider failure'); };
  const failed = await delegation.delegate({ goal: 'failing task', specialist: 'Researcher' });
  check('execution failure is honest', failed.ok === false && failed.code === 'DELEGATION_FAILED' && /synthetic provider failure/.test(failed.task.error));
  orchestrator.runAgent = original;

  check('task lookup works', delegation.get(ok.task.id).status === 'COMPLETED');
  check('history is derived from real tasks', delegation.history().length >= 3);
  const router = delegation.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes agents/delegate/task/history', ['/agents', '/delegate', '/task/:id', '/history'].every((p) => paths.includes(p)));

  console.log('\nagent delegation tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
