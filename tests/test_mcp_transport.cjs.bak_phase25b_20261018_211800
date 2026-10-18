'use strict';
/**
 * Phase 25 tests: MCP real stdio transport (probe / tools list / call).
 * Hermetic: spawns tests\fixtures\fake_mcp_server.cjs via node, no network.
 * Run: node tests\test_mcp_transport.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p25_'));
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const mcpMod = require(path.join(DIST, 'mcp_manager.cjs'));

const FIXTURE = path.join(__dirname, 'fixtures', 'fake_mcp_server.cjs');
const FIXTURE_CMD = 'node "' + FIXTURE + '"';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const mcpPath = path.join(tmp, 'servers.json');
  const mcp = mcpMod.createMcpManager({ storePath: mcpPath, probeTimeoutMs: 8000, callTimeoutMs: 8000 });

  // ---- registration + implemented flags ----
  const r1 = mcp.registerServer({ name: 'fake', transport: 'stdio', command: FIXTURE_CMD });
  check('register fake stdio ok', r1.ok === true && r1.server.status === 'registered');
  check('stdio view implemented true', r1.server.implemented === true);
  const r2 = mcp.registerServer({ name: 'httpy', transport: 'http', url: 'http://127.0.0.1:9/mcp' });
  check('http view implemented false', r2.ok === true && r2.server.implemented === false);
  check('fresh server has no tools', r1.server.toolsCount === 0);

  // ---- probe: handshake + tools/list ----
  const pr = await mcp.probe({ name: 'fake' });
  check('probe ok', pr.ok === true, JSON.stringify(pr).slice(0, 200));
  check('probe serverInfo from handshake', pr.ok === true && pr.serverInfo && pr.serverInfo.name === 'fake-mcp' && pr.serverInfo.version === '1.0.0');
  check('probe cached 4 tools', pr.ok === true && pr.tools.length === 4 && pr.tools.some((t) => t.name === 'echo'));
  check('probe marks reachable + lastProbe OK', pr.server.status === 'reachable' && pr.server.lastProbe && pr.server.lastProbe.result === 'OK' && pr.server.lastProbe.code === undefined);
  check('probe tolerant of stdout banner', pr.ok === true && pr.server.toolsCount === 4);
  check('protocolVersion recorded', pr.server.protocolVersion === '2025-06-18');

  // ---- listTools from cache ----
  const lt = mcp.listTools({ name: 'fake' });
  check('listTools returns cached tools', lt.ok === true && lt.count === 4 && lt.tools.some((t) => t.name === 'add'));
  check('listTools keeps inputSchema', lt.tools.find((t) => t.name === 'echo').inputSchema.type === 'object');
  const lt2 = mcp.listTools({ name: 'httpy' });
  check('listTools on http server: none cached + note', lt2.ok === true && lt2.count === 0 && /probe/.test(lt2.note));

  // ---- callTool ----
  const c1 = await mcp.callTool({ name: 'fake', tool: 'echo', args: { text: 'hi' } });
  check('callTool echo ok', c1.ok === true && c1.isError === false && c1.content[0].type === 'text' && c1.content[0].text === 'echo: hi', JSON.stringify(c1).slice(0, 200));
  const c2 = await mcp.callTool({ name: 'fake', tool: 'add', args: { a: 2, b: 3 } });
  check('callTool add 2+3', c2.ok === true && c2.content[0].text === '5');
  check('callTool returns latencyMs', typeof c1.latencyMs === 'number' && c1.latencyMs >= 0);

  const c3 = await mcp.callTool({ name: 'fake', tool: 'nope' });
  check('callTool unknown tool rejected from cache', c3.ok === false && c3.code === 'VALIDATION' && /unknown tool/.test(c3.error));

  const c4 = await mcp.callTool({ name: 'fake', tool: 'boom' });
  check('callTool json-rpc error honest', c4.ok === false && c4.code === 'RPC_ERROR' && /boom/.test(c4.error));

  const c5 = await mcp.callTool({ name: 'fake', tool: 'wait', args: { ms: 5000 }, timeoutMs: 700 });
  check('callTool timeout honest', c5.ok === false && c5.code === 'TIMEOUT');

  const pr2 = await mcp.probe({ name: 'fake' });
  check('manager still healthy after timeout kill', pr2.ok === true && pr2.tools.length === 4);

  // ---- honest failures ----
  mcp.registerServer({ name: 'broken', transport: 'stdio', command: 'node "' + path.join(tmp, 'no_such_script.cjs') + '"' });
  const pb = await mcp.probe({ name: 'broken' });
  check('broken command fails honestly', pb.ok === false && ['SERVER_EXITED', 'SPAWN_ERROR', 'PROTOCOL_ERROR'].includes(pb.code), 'code=' + pb.code);
  check('broken server marked error', pb.server.status === 'error' && pb.server.lastProbe.result === 'ERROR');

  mcp.registerServer({ name: 'off', transport: 'stdio', command: FIXTURE_CMD });
  mcp.disableServer({ name: 'off' });
  const pd = await mcp.probe({ name: 'off' });
  check('disabled probe rejected', pd.ok === false && pd.code === 'DISABLED');

  const ph = await mcp.probe({ name: 'httpy' });
  check('http probe honest NOT_IMPLEMENTED', ph.ok === false && ph.code === 'NOT_IMPLEMENTED');

  const c6 = await mcp.callTool({ name: 'httpy', tool: 'x' });
  check('http call honest NOT_IMPLEMENTED', c6.ok === false && c6.code === 'NOT_IMPLEMENTED');

  const pnf = await mcp.probe({ name: 'ghost' });
  check('probe unknown server NOT_FOUND', pnf.ok === false && pnf.code === 'NOT_FOUND');

  // ---- status + persistence ----
  const st = mcp.status();
  check('status implemented map', st.ok === true && st.implemented.stdio === true && st.implemented.http === false);
  check('status byStatus counts', st.byTransport.stdio === 3 && st.byTransport.http === 1 && st.byStatus.reachable === 1 && st.byStatus.error === 1 && st.byStatus.disabled === 1);
  check('events journaled', st.events >= 3);

  const mcp2 = mcpMod.createMcpManager({ storePath: mcpPath });
  const lt3 = mcp2.listTools({ name: 'fake' });
  check('tools persist across instances', lt3.ok === true && lt3.count === 4);

  // ---- agi tools ----
  const engine = { registered: {}, register(name, spec) { this.registered[name] = spec; } };
  const reg = mcp.registerAgiTools(engine);
  check('4 agi tools registered', reg.ok === true && reg.count === 4 && !!engine.registered.mcp_servers && !!engine.registered.mcp_status && !!engine.registered.mcp_probe && !!engine.registered.mcp_call);
  check('mcp_probe risk MEDIUM', engine.registered.mcp_probe.risk === 'MEDIUM');
  check('mcp_call risk HIGH', engine.registered.mcp_call.risk === 'HIGH');
  const out = await engine.registered.mcp_probe.fn({ name: 'fake' });
  check('agi mcp_probe fn works', out.ok === true && out.tools.length === 4);

  const router = mcp.createRouter();
  check('router builds or null', router === null || typeof router.use === 'function');

  console.log('');
  console.log('mcp transport tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
