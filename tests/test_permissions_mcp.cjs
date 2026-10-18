'use strict';
/**
 * Phase 24/25 tests: per-agent tool permissions + MCP manager (registry side; transport covered in test_mcp_transport.cjs).
 * Pure factory instances with temp stores; no env needed.
 * Run: NODE_PATH="<repo>\resources\app\node_modules" node tests\test_permissions_mcp.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p24_'));
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const permsMod = require(path.join(DIST, 'tool_permissions.cjs'));
const mcpMod = require(path.join(DIST, 'mcp_manager.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  // ======== permissions ========
  const permsPath = path.join(tmp, 'permissions.json');
  const perms = permsMod.createPermissions({ storePath: permsPath });

  const g1 = perms.grant({ agent: 'jarvis', tool: 'connector_invoke' });
  check('grant exact ok', g1.ok === true && g1.policy.allow.includes('connector_invoke'));
  const g2 = perms.grant({ agent: 'jarvis', tool: 'connector_*' });
  check('grant wildcard ok', g2.ok === true);

  check('check allow exact', perms.check({ agent: 'jarvis', tool: 'connector_invoke', risk: 'MEDIUM' }).allowed === true);
  check('check wildcard match', perms.check({ agent: 'jarvis', tool: 'connector_weather', risk: 'LOW' }).allowed === true);
  check('check unknown agent default deny', perms.check({ agent: 'nobody', tool: 'git_status' }).allowed === false);
  check('validation: bad agent name rejected', perms.grant({ agent: 'two words', tool: 'x' }).ok === false);
  check('validation: missing tool rejected', perms.grant({ agent: 'jarvis', tool: '' }).ok === false);

  const d1 = perms.setDefault({ agent: 'jarvis', mode: 'allow' });
  check('setDefault allow ok', d1.ok === true);
  check('default allow covers LOW unlisted', perms.check({ agent: 'jarvis', tool: 'git_status', risk: 'LOW' }).allowed === true);
  check('high risk beats default allow', perms.check({ agent: 'jarvis', tool: 'git_push', risk: 'HIGH' }).allowed === false);
  check('high risk with explicit allow passes', perms.check({ agent: 'jarvis', tool: 'connector_invoke', risk: 'HIGH' }).allowed === true);
  const g3 = perms.grant({ agent: 'jarvis', tool: '*' });
  check('bare wildcard not explicit for high risk', g3.ok === true && perms.check({ agent: 'jarvis', tool: 'git_push', risk: 'HIGH' }).allowed === false);

  const r1 = perms.revoke({ agent: 'jarvis', tool: 'connector_invoke' });
  check('revoke ok', r1.ok === true && !r1.policy.allow.includes('connector_invoke') && r1.policy.deny.includes('connector_invoke'));
  const c1 = perms.check({ agent: 'jarvis', tool: 'connector_invoke', risk: 'HIGH' });
  check('deny beats allow after revoke', c1.allowed === false && /denied by rule/.test(c1.reason));

  const perms2 = permsMod.createPermissions({ storePath: permsPath });
  check('permissions persist across instances', perms2.check({ agent: 'jarvis', tool: 'connector_invoke' }).allowed === false);

  const st1 = perms.status();
  check('status shape', st1.ok === true && st1.agents === 1 && st1.allowRules >= 1 && st1.denyRules >= 1);

  for (let i = 0; i < 210; i++) perms.grant({ agent: 'bulk', tool: 'tool_' + i });
  const st2 = perms.status();
  check('events capped at 200', st2.events <= 200);

  const pEngine = { registered: {}, register(name, spec) { this.registered[name] = spec; } };
  const preg = permsMod.createPermissions({ storePath: path.join(tmp, 'p2.json') }).registerAgiTools(pEngine);
  check('permission agi tools registered', preg.ok === true && preg.count === 2 && !!pEngine.registered.permissions_check && !!pEngine.registered.permissions_list);
  const pOut = await pEngine.registered.permissions_list.fn({});
  check('permissions_list fn returns agents', pOut.ok === true && Array.isArray(pOut.agents));
  const pRouter = perms.createRouter();
  check('permissions router builds or null', pRouter === null || typeof pRouter.use === 'function');

  // ======== mcp ========
  const mcpPath = path.join(tmp, 'servers.json');
  const mcp = mcpMod.createMcpManager({ storePath: mcpPath });

  const m1 = mcp.registerServer({ name: 'files', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-filesystem C:\\tmp' });
  check('register stdio ok', m1.ok === true && m1.server.status === 'registered' && m1.server.implemented === true);
  const m2 = mcp.registerServer({ name: 'bridge', transport: 'http', url: 'http://127.0.0.1:8777/mcp' });
  check('register http ok', m2.ok === true);
  check('bad transport rejected', mcp.registerServer({ name: 'x', transport: 'carrier-pigeon' }).ok === false);
  check('stdio without command rejected', mcp.registerServer({ name: 'y', transport: 'stdio' }).ok === false);
  check('http without url rejected', mcp.registerServer({ name: 'z', transport: 'http', url: 'ftp://nope' }).ok === false);

  mcp.registerServer({ name: 'files', transport: 'stdio', command: 'npx -y server-filesystem v2' });
  const ls = mcp.listServers();
  check('re-register updates, no duplicates', ls.count === 2 && /v2/.test(ls.servers.find((s) => s.name === 'files').command));

  const dis = mcp.disableServer({ name: 'bridge' });
  check('disable ok', dis.ok === true && dis.server.status === 'disabled');
  const en = mcp.enableServer({ name: 'bridge' });
  check('enable ok', en.ok === true && en.server.status === 'registered');

  const pr = await mcp.probe({ name: 'bridge' });
  check('http probe honest NOT_IMPLEMENTED', pr.ok === false && pr.code === 'NOT_IMPLEMENTED');
  const stm = mcp.status();
  check('mcp status shape + implemented map', stm.ok === true && stm.count === 2 && stm.byTransport.stdio === 1 && stm.byTransport.http === 1 && stm.implemented.stdio === true && stm.implemented.http === false);

  const mcp2 = mcpMod.createMcpManager({ storePath: mcpPath });
  check('mcp persists across instances', mcp2.listServers().count === 2);

  const mEngine = { registered: {}, register(name, spec) { this.registered[name] = spec; } };
  const mreg = mcpMod.createMcpManager({ storePath: path.join(tmp, 'm2.json') }).registerAgiTools(mEngine);
  check('mcp agi tools registered', mreg.ok === true && mreg.count === 4 && !!mEngine.registered.mcp_servers && !!mEngine.registered.mcp_status && !!mEngine.registered.mcp_probe && !!mEngine.registered.mcp_call);
  const mOut = await mEngine.registered.mcp_servers.fn({});
  check('mcp_servers fn returns list', mOut.ok === true && Array.isArray(mOut.servers));
  const mRouter = mcp.createRouter();
  check('mcp router builds or null', mRouter === null || typeof mRouter.use === 'function');

  console.log('');
  console.log('permissions + mcp tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
