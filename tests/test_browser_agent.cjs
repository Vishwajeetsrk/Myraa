'use strict';
// Browser Agent must actually launch a real browser and navigate - no fake success.

const fs = require('fs');
const path = require('path');
const os = require('os');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const BrowserAgent = require(path.join(DIST, 'browser_agent.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const agent = new BrowserAgent();
  await agent._playwrightReady;
  check('browser runtime detected', agent.playwrightAvailable === true, JSON.stringify(agent.getCapabilities()));
  check('runtime + executable are real', ['playwright', 'playwright-core'].includes(agent.runtimeSource) && (agent.runtimeSource === 'playwright' || !!agent.executablePath));
  check('capabilities expose real runtime', agent.getCapabilities().runtimeSource === agent.runtimeSource);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_browser_'));
  agent.screenshotDir = tmp;
  const started = await agent.start(true);
  check('real browser launched headless', started.active === true && agent.isActive === true);
  check('page created', !!agent.page && typeof agent.page.url === 'function');

  const result = await agent.navigate('data:text/html,<title>MYRAA Test Page</title><h1>OK</h1>');
  check('navigation returned real title', /MYRAA Test Page/.test(result.title || ''), JSON.stringify(result));
  check('page URL is real data URL', /^data:text\/html/.test(result.url || ''));

  const shot = await agent.screenshot();
  const shotPath = shot && (shot.filepath || shot.path);
  check('screenshot produced a real file', !!shotPath && fs.existsSync(shotPath), JSON.stringify(shot));
  const state = agent.getState();
  check('state reflects real page', !!state && (state.isActive === true || state.active === true));

  const stopped = await agent.stop();
  check('browser stopped cleanly', stopped.active === false && agent.isActive === false);
  check('history records real actions', agent.actionHistory.length >= 2);

  console.log('\nbrowser agent tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
