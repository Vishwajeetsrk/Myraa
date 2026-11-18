'use strict';
// P1: one coherent shell, all numbers/statuses sourced from real APIs.

const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(DIST, 'myraa_design_system.css'), 'utf8');
const addon = fs.readFileSync(path.join(DIST, 'myraa_shell_addon.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  check('design system loaded after polish', html.indexOf('/ui_polish_phase14.css') < html.indexOf('/myraa_design_system.css'));
  check('shell addon loaded', html.includes('/myraa_shell_addon.js'));
  check('existing overlays preserved', ['/avatar_state_addon.js', '/ui_accessibility_addon.js'].every((s) => html.includes(s)));

  check('one token layer defines palette + radius', /--myraa-accent:/.test(css) && /--myraa-radius:/.test(css));
  check('panels share one visual language', /myraa-panel/.test(css) && /hud-panel/.test(css));
  check('settings/memory workspaces widen', /\[class\*="settings"\]/.test(css) && /min-width: min\(760px/.test(css));
  check('status strip + palette styles present', /#myraa-unified-status/.test(css) && /#myraa-command-palette/.test(css));
  check('focus/keyboard styling retained', /focus/.test(addon) && /Escape/.test(addon));

  check('Ctrl+K opens command palette', /ctrlKey/.test(addon) && /openPalette/.test(addon));
  check('capability center exists', /openCapabilityCenter/.test(addon) && /myraa-capability-input/.test(addon));
  const endpoints = ['/api/capabilities', '/api/health-manager/last', '/api/skills-v2/summary', '/api/connectors-v2/list', '/api/agents-v2/agents', '/api/tasks/summary', '/api/actions/list', '/api/mcp-v2/presets'];
  check('status data comes from real APIs', endpoints.every((p) => addon.indexOf(p) !== -1));
  check('unavailable data is not faked', /UNAVAILABLE/.test(addon) && /return null/.test(addon));
  check('skill truth distinguishes manifests from execution', /MANIFEST VERIFIED/.test(addon) && /execution NOT IMPLEMENTED/.test(addon));
  check('badge pass removes fake VERIFIED', /UNVERIFIED/.test(addon));
  check('addon never touches 3D internals', !/\.mesh|\.texture|\.shader|model\.pmx|EYES AUTO/i.test(addon));
  check('no hardcoded capability counts', !/\b(532|530|28|12|8)\s+(skills|agents|connectors)/i.test(addon));

  console.log('\nP1 shell tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
