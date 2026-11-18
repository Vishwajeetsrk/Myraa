'use strict';
// Phase 15: diagnostics must run real checks and never fabricate PASS/healthy.

const path = require('path');
process.env.MYRAA_DATA_DIR = path.join(require('os').tmpdir(), 'myraa_diag_test');
process.env.DESKTOP_AGENT_URL = 'http://127.0.0.1:9';

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const dc = require(path.join(DIST, 'diagnostics_center.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  check('catalog covers all requested subsystems', ['frontend', 'backend', 'database', 'ai', 'voice', 'microphone', 'speaker', 'avatar', 'windows', 'python', 'browser', 'mcp', 'connectors', 'memory', 'vector', 'gpu', 'local_models', 'network'].every((id) => dc.CATALOG.some((c) => c[0] === id)));

  const r = await dc.runAll();
  check('runAll returns a real report', r.ok === true && Array.isArray(r.checks) && !!r.generatedAt);
  check('every check has an id/label/status/source', r.checks.every((c) => c.id && c.label && c.status && c.source));
  check('no fake PASS/ACTIVE/HEALTHY statuses', r.checks.every((c) => !['PASS', 'ACTIVE', 'OPERATIONAL', 'VERIFIED', 'HEALTHY'].includes(c.status)));
  check('statuses are from universal enum', r.checks.every((c) => Object.values(require(path.join(DIST, 'agi', 'capability_registry.cjs')).STATUS).includes(c.status)));
  check('every check has a real timestamp', r.checks.every((c) => !Number.isNaN(Date.parse(c.checkedAt))));
  check('unavailable checks explain why', r.checks.filter((c) => ['UNAVAILABLE', 'NOT_CONFIGURED', 'ERROR'].includes(c.status)).every((c) => typeof c.detail === 'string' && c.detail.length > 0));

  const mic = r.checks.find((c) => c.id === 'microphone');
  check('microphone is honestly UNAVAILABLE from Node', mic && mic.status === 'UNAVAILABLE' && /cannot be tested/.test(mic.detail));
  const gpu = r.checks.find((c) => c.id === 'gpu');
  check('GPU is not claimed READY without a probe', gpu && gpu.status === 'UNAVAILABLE');
  const avatar = r.checks.find((c) => c.id === 'avatar');
  check('avatar assets checked, not modified', avatar && ['READY', 'ERROR'].includes(avatar.status));
  check('byStatus derives from checks', Object.values(r.byStatus).reduce((a, b) => a + b, 0) === r.checks.length);

  const md = dc.report(r);
  check('report is markdown with real statuses', /^# MYRAA diagnostics/.test(md) && /UNAVAILABLE|NOT_CONFIGURED/.test(md) && /is fabricated/.test(md));
  check('getLast returns last real report', dc.getLast() && dc.getLast().generatedAt === r.generatedAt);

  const router = dc.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes catalog/run/report/last', ['/catalog', '/run', '/report', '/last'].every((p) => paths.includes(p)));

  console.log('\ndiagnostics center tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
