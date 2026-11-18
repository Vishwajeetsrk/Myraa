'use strict';
// Activity Center + Screen HUD: real aggregation, no invented events or counts.

const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const ac = require(path.join(DIST, 'activity_center.cjs'));
const css = fs.readFileSync(path.join(DIST, 'myraa_design_system.css'), 'utf8');
const hud = fs.readFileSync(path.join(DIST, 'myraa_screen_hud_addon.js'), 'utf8');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const s = ac.summary();
  check('summary is real and timestamped', s.ok === true && !!s.generatedAt);
  check('screen state is sourced', s.screen && typeof s.screen.consent === 'boolean');
  check('tasks/receipts/events are aggregated', s.activity && 'tasks' in s.activity && Array.isArray(s.activity.receipts) && Array.isArray(s.activity.events));
  check('approvals from real broker', s.approvals && typeof s.approvals.waiting === 'number');
  check('connector state from registry', s.connectors && typeof s.connectors === 'object');
  check('capability summary included', s.capabilities && typeof s.capabilities.total === 'number');
  check('health snapshot included or null', s.health === null || (s.health && typeof s.health.checks === 'number'));
  check('honest null policy documented', /null means unavailable/.test(s.note));

  check('HUD addon loaded', html.includes('/myraa_screen_hud_addon.js'));
  check('HUD reads activity API', /\/api\/activity-center\/summary/.test(hud));
  check('HUD is collapsible + accessible', /aria-expanded/.test(hud) && /myraa-hud-toggle/.test(hud));
  check('HUD prints UNAVAILABLE for missing data', /UNAVAILABLE/.test(hud));
  check('HUD does not touch 3D internals', !/\.mesh|\.texture|\.shader|model\.pmx/i.test(hud));
  check('HUD styling is compact and responsive', /#myraa-screen-hud/.test(css) && /max-width: 1100px/.test(css));

  const router = ac.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes summary', paths.includes('/summary'));

  console.log('\nactivity center tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
