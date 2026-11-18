'use strict';
// Application Adapter Registry: detection from live windows, real UIA, honest gaps.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const aa = require(path.join(DIST, 'application_adapters.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const s = await aa.status();
  check('status from real UIA source', s.ok && s.status === 'AVAILABLE' && s.adapters >= 15 && /ui_automation/.test(s.uiaSource), JSON.stringify(s).slice(0, 180));
  check('no adapter marked active without detection note', /no adapter is marked active/i.test(s.note));

  const cat = aa.list();
  check('catalog exposes adapters', cat.ok && cat.adapters.length >= 15);
  check('edit/execute honestly NOT_IMPLEMENTED everywhere', cat.adapters.every((a) => a.methods.edit === 'NOT_IMPLEMENTED' && a.methods.execute === 'NOT_IMPLEMENTED'));

  // Deterministic disambiguation regression: shared Chromium class must not self-identify.
  const chromeAdapter = aa.ADAPTERS.find((a) => a.id === 'chrome');
  const vsAdapter = aa.ADAPTERS.find((a) => a.id === 'vscode');
  const electronWindow = { title: 'MYRAA AI OS Universal API Expansion', className: 'Chrome_WidgetWin_1' };
  const chromeWindow = { title: 'Razorpay Dashboard - Google Chrome', className: 'Chrome_WidgetWin_1' };
  check('Chromium class alone does not identify Chrome', !aa.matches(chromeAdapter, electronWindow).matched);
  check('Chromium class alone does not identify VS Code', !aa.matches(vsAdapter, electronWindow).matched);
  check('title identifies Chrome correctly', aa.matches(chromeAdapter, chromeWindow).matched && aa.matches(chromeAdapter, chromeWindow).via === 'title');
  check('Excel className is a strong signal', aa.matches(aa.ADAPTERS.find((a) => a.id === 'excel'), { title: 'payments - Excel', className: 'XLMAIN' }).confidence === 0.9);

  const d = await aa.detect({ includeUnmatched: true });
  check('detect uses real window list', d.ok && d.source === 'ui_automation.listVisibleWindows' && d.windowCount > 0, JSON.stringify(d).slice(0, 180));
  check('every detected app has real evidence', d.detected.every((x) => x.title && x.className && x.confidence >= 0.75 && x.status === 'DETECTED'));
  check('unmatched windows stay honest (not guessed)', d.unmatched.every((u) => u.title && u.className));
  check('installed list uses DETECTED/NOT_RUNNING only', d.installed.every((x) => ['DETECTED', 'NOT_RUNNING'].includes(x.status)));

  // Real UIA inspect when a known app is open; honest error otherwise.
  const target = d.detected[0];
  if (target) {
    const ins = await aa.inspect({ appId: target.appId, maxElements: 25 });
    check('inspect returns a real control map', ins.ok && Array.isArray(ins.controls) && ins.totalControls > 0, JSON.stringify(ins).slice(0, 180));
    const rd = await aa.read({ appId: target.appId, maxElements: 25 });
    check('read returns named UIA controls', rd.ok && typeof rd.namedControls === 'number');
  } else {
    const ins = await aa.inspect({ appId: 'excel' });
    check('inspect honest when app not running', !ins.ok && ins.code === 'APP_NOT_RUNNING');
  }

  const noAdapter = await aa.inspect({ appId: 'not_a_real_app' });
  check('unknown adapter rejected', !noAdapter.ok && noAdapter.code === 'ADAPTER_NOT_FOUND');

  const before = { controls: [{ name: 'A', controlType: 'Button', automationId: 'a' }], totalControls: 1 };
  const after = { controls: [{ name: 'A', controlType: 'Button', automationId: 'a' }, { name: 'B', controlType: 'Edit', automationId: 'b' }], totalControls: 2 };
  const v = aa.verify({ before, after });
  check('verify detects real change', v.ok && v.verdict === 'CHANGED' && v.added.length === 1, JSON.stringify(v).slice(0, 180));
  check('verify reports UNCHANGED for identical maps', aa.verify({ before, after: before }).verdict === 'UNCHANGED');

  const router = aa.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes status/catalog/detect/inspect/read/locate/verify', ['/status', '/catalog', '/detect', '/inspect', '/read', '/locate', '/verify'].every((p) => paths.includes(p)));

  console.log('\napplication adapters tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.stack || e)); process.exit(1); });
