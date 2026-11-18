'use strict';
// Phase 2: capability registry truthfulness. No server, no network.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const reg = require(path.join(DIST, 'agi', 'capability_registry.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const allowed = ['UNAVAILABLE', 'NOT_CONFIGURED', 'DISCONNECTED', 'AUTH_REQUIRED', 'CONNECTING', 'CONNECTED', 'DEGRADED', 'ERROR', 'READY', 'RUNNING', 'PAUSED', 'DISABLED'];
  check('status enum is the universal model', allowed.every((s) => reg.STATUS[s] === s));
  check('no fake statuses in enum', !('ACTIVE' in reg.STATUS) && !('VERIFIED' in reg.STATUS) && !('OPERATIONAL' in reg.STATUS));

  const id = 'test_cap_' + Date.now().toString(36);
  reg.register({
    id, name: 'Test Capability', category: reg.CATEGORIES.CORE, version: '1.0.0',
    description: 'registry truthfulness test', capabilities: ['test.truth'], entryPoint: 'test.cjs',
    permissions: ['test.read'], tools: ['t1'], skills: ['s1'], providers: ['p1'], actions: ['a1'],
  });
  let v = reg.publicView(reg.get(id));
  check('unchecked capability has null latency', v.latencyMs === null && v.lastChecked === null);
  check('unchecked capability is NOT_CONFIGURED', v.status === 'NOT_CONFIGURED');
  check('public view has no functions/secrets', !Object.values(v).some((x) => typeof x === 'function'));
  check('public view carries declared metadata', v.permissions[0] === 'test.read' && v.tools[0] === 't1');

  reg.register({ ...reg.get(id), id: id + '_auth', authenticated: false });
  check('unauthenticated capability is AUTH_REQUIRED', reg.publicView(reg.get(id + '_auth')).status === 'AUTH_REQUIRED');

  const healthyId = id + '_ok';
  reg.register({
    id: healthyId, name: 'Healthy Test', category: reg.CATEGORIES.CORE, version: '1.0.0',
    description: 'health test', capabilities: ['test.health'], entryPoint: 'test.cjs',
    statusSource: 'health_check', healthCheck: async () => ({ state: 'healthy', detail: 'real check' }),
  });
  const h = await reg.checkEngineHealth(healthyId);
  v = reg.publicView(reg.get(healthyId));
  check('real health check yields READY', v.status === 'READY' && v.statusSource === 'health_check');
  check('latency comes from the real check', Number.isFinite(h.latencyMs) && v.latencyMs === h.latencyMs);
  check('lastChecked is a real timestamp', !!v.lastChecked && !Number.isNaN(Date.parse(v.lastChecked)));

  reg.disable(healthyId);
  check('disabled capability is DISABLED', reg.publicView(reg.get(healthyId)).status === 'DISABLED');
  reg.enable(healthyId);

  reg.registerCounter('skills_test', () => 7);
  reg.registerCounter('broken_test', () => { throw new Error('no backend'); });
  const summary = reg.getCapabilitySummary();
  check('live counter is used verbatim', summary.liveCounts.skills_test === 7);
  check('failing counter is null, never fabricated', summary.liveCounts.broken_test === null);
  check('summary counts derive from registry records', summary.total >= 3 && summary.byStatus.NOT_CONFIGURED >= 1);
  check('summary exposes status enum', summary.statusEnum.includes('AUTH_REQUIRED'));

  const router = reg.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes public + summary routes', paths.includes('/public') && paths.includes('/summary'));

  console.log('\ncapability registry tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
