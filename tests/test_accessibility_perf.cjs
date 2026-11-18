'use strict';
// Phase 17: performance hints + accessibility, still zero 3D/avatar changes.

const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const css = fs.readFileSync(path.join(DIST, 'ui_polish_phase14.css'), 'utf8');
const addon = fs.readFileSync(path.join(DIST, 'ui_accessibility_addon.js'), 'utf8');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  check('offscreen card rendering hint present', /content-visibility:\s*auto\s*!important/.test(css));
  check('intrinsic size reserved (no layout jump)', /contain-intrinsic-size/.test(css));
  check('long lists can opt into virtualization', /data-virtual="true"/.test(css));
  check('reduced-motion still honored', /prefers-reduced-motion/.test(css));
  check('focus rings still present', /:focus-visible/.test(css));

  check('screen-reader live region created', /myraa-a11y-live/.test(addon) && /setAttribute\('aria-live',\s*'polite'\)/.test(addon));
  check('live region has status role', /setAttribute\('role',\s*'status'\)/.test(addon));
  check('avatar state announced to assistive tech', /myraa:avatar-state/.test(addon) && /liveRegion\.textContent/.test(addon));
  check('addon still labels icon controls', /setAttribute\('aria-label'/.test(addon) && /setAttribute\('title'/.test(addon));
  check('addon has no 3D access', !/\.mesh|\.texture|\.shader|model\.pmx|EYES AUTO/i.test(addon));

  check('avatar addon loads before accessibility addon', html.indexOf('/avatar_state_addon.js') < html.indexOf('/ui_accessibility_addon.js'));
  check('all overlays still loaded', ['/ui_polish_phase14.css', '/avatar_state_addon.js', '/ui_accessibility_addon.js'].every((s) => html.includes(s)));

  console.log('\naccessibility + performance tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
