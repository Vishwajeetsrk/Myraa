'use strict';
// Phase 3: HealthManager must only report measured, sourced health. No network assumptions.

const path = require('path');
process.env.MYRAA_DATA_DIR = process.env.MYRAA_DATA_DIR || path.join(require('os').tmpdir(), 'myraa_health_test');
process.env.DESKTOP_AGENT_URL = 'http://127.0.0.1:9'; // guaranteed fast refusal, never a real call

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const hm = require(path.join(DIST, 'health_manager.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const report = await hm.runAll();
  check('runAll returns ok report', report.ok === true && Array.isArray(report.checks) && !!report.generatedAt);
  check('checks cover core services', ['capabilities', 'mcp', 'memory.db', 'browser.runtime', 'network.dns'].every((id) => report.checks.some((c) => c.serviceId === id)));

  const allowed = Object.values(hm.STATUS);
  check('all statuses are from the universal enum', report.checks.every((c) => allowed.includes(c.status)));
  check('no fake ACTIVE/VERIFIED/OPERATIONAL statuses', !report.checks.some((c) => /ACTIVE|VERIFIED|OPERATIONAL|STREAMING/.test(c.status)));
  check('every check has a measured latency', report.checks.every((c) => Number.isFinite(c.latencyMs) && c.latencyMs >= 0));
  check('every check has a real ISO timestamp', report.checks.every((c) => !Number.isNaN(Date.parse(c.checkedAt))));
  check('every check has a serviceId', report.checks.every((c) => typeof c.serviceId === 'string' && c.serviceId.length > 0));
  check('unavailable services carry an error reason', report.checks.filter((c) => c.status === 'UNAVAILABLE' || c.status === 'ERROR').every((c) => typeof c.error === 'string' && c.error.length > 0));
  check('ready services do not fake an error', report.checks.filter((c) => c.status === 'READY').every((c) => c.error === null));
  check('byStatus counts derive from checks', Object.values(report.byStatus).reduce((a, b) => a + b, 0) === report.checks.length);
  check('getLast returns the last real report', hm.getLast() && hm.getLast().generatedAt === report.generatedAt);
  const router = hm.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes run + last', paths.includes('/run') && paths.includes('/last'));

  console.log('\nhealth manager tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
