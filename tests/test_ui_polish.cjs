'use strict';
// Phase 14/17: UI polish overlays must be additive, accessible, and leave 3D alone.

const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const read = (f) => fs.readFileSync(path.join(DIST, f), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const html = read('index.html');
  check('polish CSS loaded after base styles', html.indexOf('/myraa_v6_styles.css') < html.indexOf('/ui_polish_phase14.css'));
  check('accessibility addon loaded', html.includes('/ui_accessibility_addon.js'));
  check('avatar state addon still loaded', html.includes('/avatar_state_addon.js'));
  check('existing app scripts preserved', html.includes('/myraa_v6_app.js') && html.includes('/universal-control-addon.js'));

  const css = read('ui_polish_phase14.css');
  check('visible focus ring', /:focus-visible[\s\S]{0,120}outline/.test(css));
  check('panels and modals can scroll', /overflow-y:\s*auto\s*!important/.test(css));
  check('header controls have hit area', /min-width:\s*32px\s*!important/.test(css));
  check('floating bar no longer overlaps header', /#myraa-uctrl-top-bar[\s\S]{0,160}top:\s*66px/.test(css));
  check('reduced motion respected', /prefers-reduced-motion/.test(css));

  const addon = read('ui_accessibility_addon.js');
  check('tiny inline text is raised', /MIN_PX\s*=\s*11/.test(addon) && /fontSize\s*=\s*MIN_PX/.test(addon));
  check('icon controls get aria-label', /setAttribute\('aria-label'/.test(addon));
  check('icon controls get tooltips', /setAttribute\('title'/.test(addon));
  check('addon watches dynamic DOM', /MutationObserver/.test(addon));
  check('addon never touches 3D internals', !/\.mesh|\.texture|\.shader|model\.pmx|EYES AUTO/i.test(addon));

  const floating = read('universal-control-addon.js');
  check('floating bar source moved below header', /top:66px/.test(floating) && /z-index:60/.test(floating));
  check('no 99998 overlay left', !/z-index:99998/.test(floating));
  check('no fake status literals in polish assets', !/CONNECTED|VERIFIED|OPERATIONAL/.test(css + addon));

  console.log('\nUI polish tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
