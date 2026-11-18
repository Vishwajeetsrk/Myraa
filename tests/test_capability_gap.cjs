'use strict';
// Capability gap analyzer: real checks, honest statuses, actionable plans.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const ga = require(path.join(DIST, 'capability_gap_analyzer.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  check('status vocabulary is honest', ['NOT_IMPLEMENTED', 'DEPENDENCY_MISSING', 'CONFIGURATION_REQUIRED', 'PERMISSION_REQUIRED'].every((s) => ga.STATUS.includes(s)));
  check('no fake ACTIVE/CONNECTED in vocabulary', !ga.STATUS.includes('ACTIVE') && !ga.STATUS.includes('CONNECTED'));

  const browser = ga.analyze('open a website and fill a form');
  check('request maps to real capability', browser.capabilities.some((c) => c.id === 'browser.automation'));
  check('status from runtime evidence', browser.capabilities.every((c) => ga.STATUS.includes(c.status) && !!c.reason && !!c.lastVerified));
  check('browser runtime is AVAILABLE with real Chrome', browser.capabilities.find((c) => c.id === 'browser.automation').status === 'AVAILABLE');

  const video = ga.analyze('trim this video and add subtitles');
  const v = video.capabilities.find((c) => c.id === 'video.engine');
  check('video gap is honestly classified', ['PARTIAL', 'DEPENDENCY_MISSING'].includes(v.status));
  check('gap includes implementation plan', video.gaps.some((g) => g.capability === 'video.engine' && g.required.length > 0 && g.implementation.steps.length > 0));
  check('plan includes verification', video.gaps.find((g) => g.capability === 'video.engine').implementation.verification.length > 20);

  const skill = ga.analyze('run a skill');
  const skillCap = skill.capabilities.find((c) => c.id === 'skills.execution');
  check('skill execution is PARTIAL with real runner evidence', skillCap.status === 'PARTIAL' && skillCap.evidence.executable > 0 && /NOT_IMPLEMENTED/.test(skillCap.reason));

  const mcp = ga.analyze('call an mcp tool');
  check('MCP status from real registry', mcp.capabilities.find((c) => c.id === 'mcp.stdio').status === 'AVAILABLE');
  check('analyzer never claims a fake success', !/fake|mock|simulated/i.test(JSON.stringify(browser.capabilities)));

  const router = ga.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes analyze + catalog', paths.includes('/analyze') && paths.includes('/catalog'));

  console.log('\ncapability gap tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
