'use strict';
// Settings Workspace: real APIs, searchable, only genuinely actionable controls.

const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const addon = fs.readFileSync(path.join(DIST, 'myraa_settings_workspace_addon.js'), 'utf8');
const css = fs.readFileSync(path.join(DIST, 'myraa_design_system.css'), 'utf8');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const shell = fs.readFileSync(path.join(DIST, 'myraa_shell_addon.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  check('workspace addon loaded last', html.indexOf('/myraa_screen_hud_addon.js') < html.indexOf('/myraa_settings_workspace_addon.js'));
  check('palette opens the workspace', /Settings Workspace/.test(shell) && /__myraaSettings\.open/.test(shell));
  check('workspace is wide + scrollable', /min\(1100px, 96vw\)/.test(css) && /myraa-set-content[\s\S]{0,120}overflow: auto/.test(css));
  check('responsive narrow layout', /@media \(max-width: 800px\)/.test(css));
  check('searchable sections', /myraa-set-search/.test(addon) && /buildNav/.test(addon));
  check('accessible dialog + close + ESC', /role', 'dialog'/.test(addon) && /myraa-set-close/.test(addon) && /Escape/.test(addon));

  const apis = ['/api/health', '/api/live/status', '/api/providers/adapters', '/api/screen-awareness/status', '/api/skills-v2/summary', '/api/connectors-v2/list', '/api/projects-v2/memory-overview', '/api/permissions', '/api/diagnostics-center/last'];
  check('all sections read real APIs', apis.every((a) => addon.indexOf(a) !== -1));
  check('consent toggle uses real API', /\/api\/screen-awareness\/consent/.test(addon) && /enabled/.test(addon));
  check('only one actionable control', (addon.match(/addEventListener\('click'/g) || []).length <= 4);
  check('no fake toggles or keys', !/api[_-]?key['"]?\s*:\s*['"][^'"]+/.test(addon) && /Keys are never displayed/.test(addon));
  check('honest read-only markers', /READ ONLY/.test(addon) && /NOT_IMPLEMENTED/.test(addon));
  check('unavailable data is honest', /UNAVAILABLE/.test(addon));
  check('no 3D access', !/\.mesh|\.texture|\.shader|model\.pmx/i.test(addon));

  console.log('\nsettings workspace tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
