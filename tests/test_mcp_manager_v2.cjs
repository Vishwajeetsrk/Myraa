'use strict';
// Phase 8: MCP management facade. Isolated store, no real server spawn.

const fs = require('fs');
const path = require('path');
const os = require('os');
process.env.MYRAA_MCP_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p8_')), 'mcp.json');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const m = require(path.join(DIST, 'mcp_manager_v2.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  check('servers derived from manager', Array.isArray(m.servers()) && m.servers().length === 0);
  const p = m.presets();
  check('official presets are real', p.ok === true && p.count >= 8 && p.presets.some((x) => x.id === 'rea'));
  const add = m.install({ preset: 'rea' });
  check('preset install works', add.ok === true && add.server.name === 'rea');
  check('server view exposes honest fields', m.servers()[0].implemented === true && m.servers()[0].toolsCount === 0);

  const bad = await m.inspect({ name: 'not-there' });
  check('inspect unknown is NOT_FOUND', bad.ok === false && bad.code === 'NOT_FOUND');
  const ok = await m.inspect({ name: 'rea' });
  check('resources are NOT_IMPLEMENTED, not fabricated', ok.ok === true && ok.resources.code === 'NOT_IMPLEMENTED');
  check('prompts are NOT_IMPLEMENTED, not fabricated', ok.prompts.code === 'NOT_IMPLEMENTED');
  check('inspect tells caller to probe first', /probe first/.test(ok.note));

  const dis = m.disconnect({ name: 'rea' });
  check('disconnect changes status honestly', dis.ok === true && dis.server.status === 'disabled');
  const en = m.enable({ name: 'rea' });
  check('enable restores status', en.ok === true && en.server.status === 'registered');

  check('permissions points to real permission API', m.permissions().code === 'NOT_IMPLEMENTED');
  check('logs derived from manager events', Array.isArray(m.logs().events));
  const router = m.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes management routes', ['/servers', '/connect', '/disconnect', '/inspect/:name', '/presets', '/install'].every((p2) => paths.includes(p2)));

  console.log('\nMCP manager v2 tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
