'use strict';
// Real brand icons only: sourced from the installed @thesvg/react package.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const icons = require(path.join(DIST, 'brand_icon_registry.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const status = icons.status();
  check('real icon package is installed', status.ok === true && status.icons > 1000, JSON.stringify(status));
  check('source is attributed', /@thesvg\/react/.test(status.source));

  for (const name of ['github', 'microsoft', 'figma', 'openai', 'anthropic', 'google', 'ollama', 'react', 'typescript', 'python', 'nodejs', 'visualstudiocode']) {
    check('icon exists: ' + name, !!icons.find(name));
  }
  const gh = icons.svg('github', 'mono');
  check('GitHub SVG parsed from real data', gh.ok === true && /<svg/.test(gh.svg) && /<path/.test(gh.svg));
  check('mono variant uses currentColor', gh.variant === 'mono' && /currentColor/.test(gh.svg));
  check('real path data present', /M12|M8/.test(gh.svg));
  check('SVG is attributed', /@thesvg\/react/.test(gh.source));

  const missing = icons.svg('definitely-not-a-real-brand-xyz');
  check('unknown brand is NOT_FOUND (no fake icon)', missing.ok === false && missing.code === 'NOT_FOUND');
  const search = icons.search('git', 20);
  check('catalog search is real', search.ok === true && search.icons.length > 0 && search.icons.every((n) => typeof n === 'string'));

  const router = icons.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes status/catalog/icon', ['/status', '/catalog', '/icon/:name'].every((p) => paths.includes(p)));

  console.log('\nbrand icon tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
