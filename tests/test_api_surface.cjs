'use strict';
// Phase 16: every new subsystem must export a working router AND be mounted.

const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const server = fs.readFileSync(path.join(DIST, 'server.cjs'), 'utf8');

const MODULES = {
  'action_receipts.cjs': '/api/action-receipts',
  'step_watcher.cjs': '/api/step-watcher',
  'response_tags.cjs': '/api/response-tags',
  'health_manager.cjs': '/api/health-manager',
  'ai_provider_manager.cjs': '/api/providers',
  'connector_registry.cjs': '/api/connectors-v2',
  'action_registry.cjs': '/api/actions',
  'approval_manager.cjs': '/api/approvals',
  'mcp_manager_v2.cjs': '/api/mcp-v2',
  'skill_registry.cjs': '/api/skills-v2',
  'agent_delegation.cjs': '/api/agents-v2',
  'task_engine.cjs': '/api/tasks',
  'project_index.cjs': '/api/projects-v2',
  'avatar_state_bridge.cjs': '/api/avatar',
  'diagnostics_center.cjs': '/api/diagnostics-center',
};

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  let mounted = 0;
  let routable = 0;
  for (const [file, mount] of Object.entries(MODULES)) {
    try {
      const mod = require(path.join(DIST, file));
      const router = typeof mod.createRouter === 'function' ? mod.createRouter() : null;
      if (router && typeof router.use === 'function') routable++;
    } catch (e) { /* counted as failure below */ }
    if (server.includes('"' + mount + '"')) mounted++;
  }
  check('all new modules export working routers', routable === Object.keys(MODULES).length, routable + '/' + Object.keys(MODULES).length);
  check('all new APIs are mounted in server', mounted === Object.keys(MODULES).length, mounted + '/' + Object.keys(MODULES).length);

  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  check('avatar + accessibility overlays loaded', html.includes('/avatar_state_addon.js') && html.includes('/ui_accessibility_addon.js'));
  check('polish stylesheet loaded last', html.indexOf('/ui_polish_phase14.css') > html.indexOf('/myraa_v6_styles.css'));

  const sourceFiles = Object.keys(MODULES).map((f) => path.join(DIST, f)).concat([path.join(DIST, 'ui_accessibility_addon.js'), path.join(DIST, 'ui_polish_phase14.css')]);
  const combined = sourceFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const codeOnly = combined.split(/\r?\n/).filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
  check('no fake status literals in new code', !/\b(ACTIVE|VERIFIED|OPERATIONAL|STREAMING)\b/.test(codeOnly));
  check('no hardcoded version numbers in new code', !/\b9\.\d+\.\d+\b/.test(combined));
  check('no emoji in new code', !/[\u{1F000}-\u{1FAFF}]/u.test(combined));
  check('new modules document honesty', /NOT_IMPLEMENTED|UNAVAILABLE|null/.test(combined));

  console.log('\nAPI surface tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
