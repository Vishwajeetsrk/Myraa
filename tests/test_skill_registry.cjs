'use strict';
// Phase 9: skill counts and health must come from real records + SKILL.md files.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const reg = require(path.join(DIST, 'skill_registry.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const s = reg.summary();
  check('catalogue count comes from discovery registry', s.catalogued >= 500 && s.catalogued === reg.all().length);
  check('installed count is derived from SKILL.md files', s.installed > 0 && s.installed <= s.catalogued);
  check('no hardcoded ACTIVE status', Object.keys(s.byStatus).every((k) => !['ACTIVE', 'VERIFIED', 'OPERATIONAL'].includes(k)));
  check('statuses come from universal enum', Object.keys(s.byStatus).every((k) => ['READY', 'UNAVAILABLE', 'ERROR', 'DEGRADED'].includes(k)));
  check('categories derived from records', Object.keys(s.categories).length > 3);
  check('summary note explains provenance', /derived from skill records/.test(s.note));

  const installed = reg.all().find((x) => x.local);
  check('installed skill has real path', !!installed && !!installed.path && require('fs').existsSync(installed.path));
  check('installed skill declares no run method', installed.methods.run === false && installed.methods.test === true);
  check('missing skill is UNAVAILABLE with error', reg.all().some((x) => !x.local && x.status === 'UNAVAILABLE' && !!x.error));

  const detail = reg.inspect(installed.id);
  check('inspect returns real SKILL.md content', detail.ok === true && /^---|name:/.test(detail.content));
  const t = reg.test(installed.id);
  check('test validates frontmatter without executing', t.ok === true && t.checks.file === true && t.checks.frontmatter === true);
  check('run is honestly NOT_IMPLEMENTED', reg.run().code === 'NOT_IMPLEMENTED');
  const bad = reg.inspect('not-a-skill');
  check('unknown skill is NOT_FOUND', bad.ok === false && bad.code === 'NOT_FOUND');

  const router = reg.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes summary/list/test/run', ['/summary', '/list', '/test', '/run'].every((p) => paths.includes(p)));

  console.log('\nskill registry tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
