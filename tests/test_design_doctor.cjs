'use strict';
// Design Doctor: findings must be real, evidenced, and never claim a visual pass.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const dd = require(path.join(DIST, 'design_doctor.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  check('WCAG contrast computes real ratios', dd.contrastHex('#ffffff', '#070b14') > 15);
  check('invalid colour returns null', dd.contrastHex('nope', '#070b14') === null);

  const a = dd.analyze();
  check('analysis is timestamped + static', a.ok === true && !!a.generatedAt && a.mode === 'static-ui-audit');
  check('findings are produced from real files', a.findings.length > 0);
  check('every finding has severity + category', a.findings.every((f) => dd.SEVERITY.includes(f.severity) && !!f.category));
  check('every finding has evidence or honest null', a.findings.every((f) => f.evidence === null || (f.evidence.file && f.evidence.line)));
  check('no finding claims an available action', a.findings.every((f) => f.actionAvailable === false));
  check('counts derive from findings', Object.values(a.counts).reduce((x, y) => x + y, 0) === a.findings.length);
  check('module does not claim a visual pass', /NOT seen a screenshot/.test(a.note));
  check('has typography findings from real CSS', a.findings.some((f) => f.category === 'typography'));
  check('has contrast measurements', a.findings.some((f) => 'measured' in f && f.measured === true));
  check('findings include source method', a.findings.every((f) => !!f.source));

  const md = dd.report(a);
  check('markdown report includes evidence', /^# MYRAA Design Doctor/.test(md) && /Evidence:/.test(md));
  check('report repeats honesty note', /screenshot/.test(md));

  const router = dd.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes report + json', paths.includes('/report') && paths.includes('/report-json'));

  console.log('\ndesign doctor tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
