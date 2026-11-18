'use strict';
// Phase 5: connector statuses must be derived from real catalog + env, no fake badges.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const reg = require(path.join(DIST, 'connector_registry.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const list = reg.list();
  check('catalog is derived from connector market', list.length === 8 && list.every((c) => c.id && c.name));
  check('no fabricated vendor logos', list.every((c) => c.icon === null && c.vendor === null));
  check('no decorative status words', list.every((c) => !['ACTIVE', 'VERIFIED', 'CONNECTED', 'OPERATIONAL'].includes(c.status)));
  check('keyed connectors are not connected by default', list.filter((c) => c.authType === 'env_key').every((c) => ['NOT_CONFIGURED', 'DISCONNECTED'].includes(c.status)));
  check('public connectors are READY without keys', list.filter((c) => c.authType === 'none').every((c) => c.status === 'READY'));
  check('actions carry real params', list.some((c) => c.actions.length && c.actions[0].id.startsWith(c.id + '.')));
  check('statusSource is honest', list.every((c) => ['runtime', 'health_check'].includes(c.statusSource)));

  const bad = await reg.probe('not-a-connector');
  check('unknown probe is NOT_FOUND', bad.ok === false && bad.code === 'NOT_FOUND');
  const router = reg.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes list/probe/status', paths.includes('/list') && paths.includes('/probe') && paths.includes('/status'));

  console.log('\nconnector registry tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
