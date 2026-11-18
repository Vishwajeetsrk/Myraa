'use strict';
// Screen Intelligence phases 2-6: normalized context over real sources, stubbed only in tests.

const fs = require('fs');
const path = require('path');
const os = require('os');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_screen_'));
process.env.MYRAA_DATA_DIR = TMP;
const settings = path.join(TMP, 'MYRAA', 'settings');
fs.mkdirSync(settings, { recursive: true });
const consent = path.join(settings, 'screen_awareness_consent.json');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const si = require(path.join(DIST, 'screen_intelligence.cjs'));
const uia = require(path.join(DIST, 'ui_automation_service.cjs'));
const desktop = require(path.join(DIST, 'desktopAutomation.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const denied = await si.captureContext({});
  check('consent gates observation', denied.ok === false && denied.code === 'NEEDS_PERMISSION');

  fs.writeFileSync(consent, JSON.stringify({ enabled: true }));
  const origWindows = uia.listVisibleWindows;
  const origMap = uia.getAppControlMap;
  const origShot = desktop.takeScreenshot;
  uia.listVisibleWindows = () => [{ title: 'Project Proposal - Word', process: 'WINWORD.EXE', hwnd: '123' }];
  uia.getAppControlMap = () => ({ ok: true, controls: [
    { name: 'Save', automationId: 'btnSave', controlType: 'Button' },
    { name: 'Heading 1', automationId: 'h1', controlType: 'Text' },
  ] });
  desktop.takeScreenshot = () => ({ ok: true, image: null });

  const r = await si.captureContext({});
  check('context captured with consent', r.ok === true && !!r.context.timestamp);
  check('active window from real UIA source', r.context.activeWindow.title === 'Project Proposal - Word' && /uia/.test(r.context.activeWindow.method));
  check('UIA controls normalized', r.context.uiTree.length === 2 && r.context.detectedControls.length === 2);
  check('screenshot without bytes is honestly unavailable', r.context.screenshot === null && r.context.sources.screenshot.status === 'UNAVAILABLE');
  check('confidence reflects real sources', r.context.confidence > 0 && r.context.confidence <= 0.95);
  check('no fake confidence at full', r.context.confidence < 1);

  const tree = r.context.uiTree;
  const exact = si.resolveTarget({ text: 'Save', uiTree: tree });
  check('exact semantic target resolves via UIA', exact.ok === true && exact.method === 'uia' && exact.confidence >= 0.9);
  const partial = si.resolveTarget({ text: 'Head', uiTree: tree });
  check('partial target has lower confidence', partial.ok === true && partial.method === 'uia' && partial.confidence < 0.9);
  const coord = si.resolveTarget({ text: 'missing control', x: 100, y: 200, uiTree: tree });
  check('coordinate fallback is explicit and low confidence', coord.ok === true && coord.method === 'coordinate' && coord.confidence < 0.5);
  const none = si.resolveTarget({ text: 'missing control', uiTree: tree });
  check('unresolvable target is NOT_FOUND', none.ok === false && none.code === 'NOT_FOUND');

  uia.listVisibleWindows = origWindows;
  uia.getAppControlMap = origMap;
  desktop.takeScreenshot = origShot;

  const code = fs.readFileSync(path.join(DIST, 'screen_intelligence.cjs'), 'utf8');
  check('module never sends screen data anywhere', !/fetch\(|http\.request|axios/.test(code));
  check('module never touches 3D internals', !/\.mesh|\.texture|\.shader|model\.pmx/i.test(code));
  const router = si.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes context/observe/target/status', ['/context', '/observe', '/resolve-target', '/status'].every((p) => paths.includes(p)));

  console.log('\nscreen intelligence tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
