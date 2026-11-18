'use strict';
// Screen Intelligence Engine: semantic tree, layout issues, diff, action plan, verification.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const si = require(path.join(DIST, 'screen_intelligence.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const s = si.status();
  check('engine exposes real capabilities', s.ok && s.engine === 'screen-intelligence-v2' && s.capabilities.includes('analyze') && s.capabilities.includes('verify'));

  const button = si.classifyElement({ name: 'Save', controlType: 'Button', bounds: { x: 0, y: 0, width: 80, height: 24 } });
  const text = si.classifyElement({ name: 'Heading', controlType: 'Text' });
  check('element classification from real UIA types', button.category === 'button' && button.interactive && text.category === 'text' && !text.interactive);

  const ctx = {
    activeWindow: { title: 'Document1 - Word', process: 'WINWORD', hwnd: 42, application: 'word' },
    uiTree: [
      { name: 'Save', controlType: 'Button', automationId: 'save', bounds: { x: 10, y: 10, width: 80, height: 24 } },
      { name: '', controlType: 'Button', automationId: 'unnamed', bounds: { x: 12, y: 12, width: 80, height: 24 } },
      { name: 'Body', controlType: 'Text', bounds: { x: 0, y: 50, width: 400, height: 20 } },
      { name: 'Save', controlType: 'Button', automationId: 'other', bounds: { x: 300, y: 10, width: 80, height: 24 } },
    ],
    detectedText: [{ text: 'Hello' }],
    ocr: [],
    confidence: 0.8,
    sources: { uia: { status: 'READY' } },
  };
  const tree = si.buildSemanticTree(ctx);
  check('semantic tree groups real window + controls', tree.ok && tree.tree.type === 'Desktop' && tree.tree.windows[0].title === 'Document1 - Word' && tree.elementCount === 4, JSON.stringify(tree.byCategory));
  check('tree categorises controls', tree.byCategory.button === 3 && tree.byCategory.text === 1);

  const issues = si.detectLayoutIssues(ctx);
  check('layout issues detected from real bounds/names', issues.ok && issues.issueCount >= 3, JSON.stringify(issues.issues).slice(0, 220));
  check('issues carry evidence', issues.issues.every((i) => i.kind && i.evidence));
  check('layout limitations are honest', issues.limitations.some((l) => /contrast|vision/.test(l) && /NOT_IMPLEMENTED/.test(l)));

  const before = [{ name: 'A', controlType: 'Button', automationId: 'a', bounds: { x: 0, y: 0, width: 10, height: 10 } }];
  const after = [
    { name: 'A', controlType: 'Button', automationId: 'a', bounds: { x: 5, y: 5, width: 10, height: 10 } },
    { name: 'B', controlType: 'Edit', automationId: 'b', bounds: { x: 20, y: 20, width: 10, height: 10 } },
  ];
  const d = si.diffScreens(before, after);
  check('diff finds real added/changed elements', d.ok && d.verdict === 'CHANGED' && d.added.length === 1 && d.changed.length === 1, JSON.stringify(d).slice(0, 200));
  check('diff reports UNCHANGED for identical observations', si.diffScreens(before, before).verdict === 'UNCHANGED');

  const plan = si.planScreenAction({ intent: 'make this heading bold', target: { name: 'Heading', controlType: 'Text' } });
  check('action plan has risk/approval/verification', plan.ok && plan.risk === 'MEDIUM' && plan.requiresApproval === true && /verify/.test(plan.verification));
  check('action planner refuses incomplete input', !si.planScreenAction({ intent: 'bold' }).ok);

  const v1 = si.verifyScreenAction({ before, after, expectation: { type: 'exists', name: 'B' } });
  check('verify passes when expected element exists', v1.ok && v1.passed === true);
  const v2 = si.verifyScreenAction({ before, after, expectation: { type: 'exists', name: 'MISSING' } });
  check('verify fails honestly when expectation not met', v2.ok && v2.passed === false);

  const a = await si.analyzeScreen({ enforceConsent: false, ocr: false });
  check('analyze returns real structured context', a.ok && !!a.window && Array.isArray(a.elements) && Array.isArray(a.issues), JSON.stringify(a).slice(0, 220));
  check('analyze does not claim vision understanding', a.limitations && a.limitations.some((l) => /vision model/.test(l) && /NOT_IMPLEMENTED/.test(l)));
  check('analyze recommendations map to issues', a.recommendations.every((r) => r.issue && r.recommendation));

  const noConsent = await si.analyzeScreen({});
  check('consent still gates real observation', noConsent.ok === false && noConsent.code === 'NEEDS_PERMISSION');

  const router = si.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes the visual understanding API', ['/analyze', '/elements', '/diff', '/inspect', '/action-plan', '/verify'].every((p) => paths.includes(p)));

  console.log('\nscreen intelligence v2 tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.stack || e)); process.exit(1); });
