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

  // Phase A: capability intelligence layer
  const oauth = ga.analyze('connect my gmail account with oauth');
  check('OAuth detected as NOT_IMPLEMENTED', oauth.capabilities.find((c) => c.id === 'connector.oauth').status === 'NOT_IMPLEMENTED');
  const httpMcp = ga.analyze('use mcp http transport with resources');
  check('MCP http detected as NOT_IMPLEMENTED', httpMcp.capabilities.find((c) => c.id === 'mcp.http').status === 'NOT_IMPLEMENTED');

  const gd = ga.gapDetails('video.engine');
  check('gap schema has spec fields', gd.ok && Array.isArray(gd.dependencies) && Array.isArray(gd.availableAlternatives) && Array.isArray(gd.implementationPlan) && typeof gd.estimatedComplexity === 'string' && typeof gd.requiresUserAction === 'boolean' && typeof gd.safeToAutoImplement === 'boolean');
  check('gap lists reusable systems not arbitrary repos', gd.reusableSystems.includes('video_engine.cjs') && gd.candidateRepos.length === 0);

  const yes = ga.canDo('take a screenshot');
  check('canDo returns YES for healthy capability', yes.verdict === 'YES' && yes.capability === 'screen.observe', JSON.stringify(yes).slice(0, 160));
  const unsafe = ga.canDo('format disk c: and wipe system');
  check('canDo labels unsafe requests UNSAFE', unsafe.verdict === 'UNSAFE');
  const oauthVerdict = ga.canDo('connect my gmail account with oauth');
  check('canDo returns NO_YET with gap for OAuth', oauthVerdict.verdict === 'NO_YET' && !!oauthVerdict.gap && oauthVerdict.gap.requiresUserAction === true);
  const partial = ga.canDo('trim this video');
  check('canDo returns PARTIAL for video core', partial.verdict === 'PARTIAL');
  const unknown = ga.canDo('');
  check('canDo returns UNKNOWN for empty request', unknown.verdict === 'UNKNOWN');

  const task = ga.createImplementationTask('screen.ocr');
  check('auto task only for safe capabilities', task.ok === true && !!task.taskId, JSON.stringify(task).slice(0, 160));
  const blocked = ga.createImplementationTask('connector.oauth');
  check('OAuth task requires approval, not auto-created', !blocked.ok && blocked.code === 'APPROVAL_REQUIRED');
  const st = ga.selfTest();
  check('self-test reports every capability without hiding failures', st.passed + st.failed === ga.CATALOG.length && st.results.every((r) => typeof r.passed === 'boolean'));

  const router = ga.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes analyze + catalog', paths.includes('/analyze') && paths.includes('/catalog'));
  check('router exposes can-do/gaps/plan/self-test', ['/can-do', '/gaps', '/gap/:id', '/plan/:id', '/task/:id', '/self-test'].every((p) => paths.includes(p)));

  console.log('\ncapability gap tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
