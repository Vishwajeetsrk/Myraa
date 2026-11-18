'use strict';
// Phase 6: action registry is derived from real tool catalogs and carries risk.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const reg = require(path.join(DIST, 'action_registry.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const actions = reg.list();
  check('actions derived from multiple real sources', actions.length > 30 && new Set(actions.map((a) => a.source.split(':')[0])).size >= 3);
  check('every action has a schema', actions.every((a) => a.inputSchema && typeof a.inputSchema === 'object'));
  check('every action has a risk', actions.every((a) => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(a.risk)));
  check('approval required matches risk', actions.every((a) => a.confirmationRequired === (a.risk === 'HIGH' || a.risk === 'CRITICAL')));
  check('permissions match approval', actions.every((a) => a.confirmationRequired === (a.permissions.length > 0)));
  check('reversible is never claimed without undo', actions.every((a) => a.reversible === false));
  check('no verbose debug labels', actions.every((a) => !/TODO|DEBUG|MOCK|FAKE/.test(a.description)));

  const risky = actions.find((a) => a.confirmationRequired);
  check('high-risk check returns APPROVAL_REQUIRED', !!risky && reg.check(risky.id).decision === 'APPROVAL_REQUIRED');
  const safe = actions.find((a) => !a.confirmationRequired);
  check('low-risk check returns ALLOWED', !!safe && reg.check(safe.id).decision === 'ALLOWED');
  const bad = reg.check('nope.not.real');
  check('unknown action is NOT_FOUND', bad.ok === false && bad.code === 'NOT_FOUND');
  const router = reg.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes list/check', paths.includes('/list') && paths.includes('/check'));

  console.log('\naction registry tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
