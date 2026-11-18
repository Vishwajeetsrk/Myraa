'use strict';
// P0 upgrade invariants: unified chat, privileged routes, Electron permissions,
// no duplicate route mounts, no hardcoded version fallbacks.

const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const server = fs.readFileSync(path.join(DIST, 'server.cjs'), 'utf8');
const sec = fs.readFileSync(path.join(DIST, 'server_security.cjs'), 'utf8');
const electron = fs.readFileSync(path.join(__dirname, '..', 'resources', 'app', 'electron', 'main.cjs'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const start = server.indexOf('app.post("/api/chat"');
  const end = server.indexOf('app.use(import_express.default.static', start);
  const chatBlock = server.slice(start, end);
  check('/api/chat uses the provider abstraction', /providerMod\.chat\(/.test(chatBlock));
  check('/api/chat no longer calls the Gemini SDK directly', !/new import_genai2\.GoogleGenAI/.test(chatBlock));
  check('/api/chat reports provider + model truthfully', /provider: out\.provider/.test(chatBlock) && /model: out\.model/.test(chatBlock));
  check('/api/chat has an honest offline fallback', /offline_fallback/.test(chatBlock) && /no AI provider is configured/.test(chatBlock));

  for (const p of ['/api/mcp/call', '/api/plugins/execute', '/api/browser/', '/api/approvals/execute', '/api/terminal/run']) {
    check('LAN token required for ' + p, sec.includes("'" + p + "'"));
  }
  check('Electron permissions use an explicit allowlist', /ALLOWED_WEB_PERMISSIONS/.test(electron));
  check('Electron no longer grants every permission', !/Unconditionally grant/.test(electron) && !/setPermissionCheckHandler[\s\S]{0,200}return true;/.test(electron));
  check('unknown permissions are denied', /DENIED \(not in allowlist\)/.test(electron));

  check('apex routes mounted once', (server.match(/app\.use\(apexRoutes\)/g) || []).length === 1);
  check('no hardcoded version fallbacks in server', !/let ver = "9\.\d+\.\d+"/.test(server) && !/MYRAA v9\.\d+\.\d+ server started/.test(server));
  check('no hardcoded version fallbacks in Electron', !/'8\.3\.2'/.test(electron) && !/'9\.3\.0'/.test(electron));

  const pm = require(path.join(DIST, 'ai_provider_manager.cjs'));
  check('Gemini adapter is executable', pm.listAdapters().find((a) => a.id === 'gemini').implemented.chat === true);

  console.log('\nP0 security tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
