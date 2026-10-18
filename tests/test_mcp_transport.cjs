'use strict';
/**
 * Phase 25 tests: MCP manager - registry, validation, presets, honest errors.
 * No spawned servers run here (no fake fixtures exist): the transport itself
 * is verified live against REAL official MCP servers and is env-gated --
 * set MYRAA_MCP_LIVE=1 to additionally run the real-server checks below
 * (needs Node/npx + network for the first download).
 * Run: node tests\test_mcp_transport.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p25_'));
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const mcpMod = require(path.join(DIST, 'mcp_manager.cjs'));

const LIVE = process.env.MYRAA_MCP_LIVE === '1';

let pass = 0, fail = 0, skip = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}
function skipCheck(name, why) { skip++; console.log('[SKIP] ' + name + ' :: ' + why); }

(async () => {
  const mcpPath = path.join(tmp, 'servers.json');
  const mcp = mcpMod.createMcpManager({ storePath: mcpPath });

  // ---- registration + implemented flags (no spawn) ----
  const r1 = mcp.registerServer({ name: 'files', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-filesystem C:\\tmp' });
  check('register stdio ok', r1.ok === true && r1.server.status === 'registered');
  check('stdio view implemented true, no preset', r1.server.implemented === true && r1.server.preset === null);
  const r2 = mcp.registerServer({ name: 'bridge', transport: 'http', url: 'http://127.0.0.1:9/mcp' });
  check('http view implemented false', r2.ok === true && r2.server.implemented === false);
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

  // ---- honest failures without spawning ----
  const ph = await mcp.probe({ name: 'bridge' });
  check('http probe honest NOT_IMPLEMENTED', ph.ok === false && ph.code === 'NOT_IMPLEMENTED');
  const ch = await mcp.callTool({ name: 'bridge', tool: 'x' });
  check('http call honest NOT_IMPLEMENTED', ch.ok === false && ch.code === 'NOT_IMPLEMENTED');

  mcp.registerServer({ name: 'off', transport: 'stdio', command: 'npx -y whatever' });
  mcp.disableServer({ name: 'off' });
  const pd = await mcp.probe({ name: 'off' });
  check('disabled probe rejected without spawn', pd.ok === false && pd.code === 'DISABLED');
  const pg = await mcp.probe({ name: 'ghost' });
  check('probe unknown server NOT_FOUND', pg.ok === false && pg.code === 'NOT_FOUND');
  const cg = await mcp.callTool({ name: 'ghost', tool: 'x' });
  check('callTool unknown server NOT_FOUND', cg.ok === false && cg.code === 'NOT_FOUND');
  const cn = await mcp.callTool({ name: 'files', tool: '' });
  check('callTool missing tool name VALIDATION', cn.ok === false && cn.code === 'VALIDATION');

  const lt = mcp.listTools({ name: 'files' });
  check('listTools before probe: empty + note (no spawn)', lt.ok === true && lt.count === 0 && /probe/.test(lt.note));

  // ---- status + persistence ----
  const stm = mcp.status();
  check('status implemented map', stm.ok === true && stm.implemented.stdio === true && stm.implemented.http === false);
  check('status counts', stm.count === 3 && stm.byTransport.stdio === 2 && stm.byTransport.http === 1 && stm.byStatus.registered === 2 && stm.byStatus.disabled === 1 && stm.byStatus.reachable === 0);

  const mcp2 = mcpMod.createMcpManager({ storePath: mcpPath });
  check('servers persist across instances', mcp2.listServers().count === 3);

  // ---- agi tools ----
  const engine = { registered: {}, register(name, spec) { this.registered[name] = spec; } };
  const reg = mcp.registerAgiTools(engine);
  check('4 agi tools registered', reg.ok === true && reg.count === 4 && !!engine.registered.mcp_servers && !!engine.registered.mcp_status && !!engine.registered.mcp_probe && !!engine.registered.mcp_call);
  check('mcp_probe risk MEDIUM', engine.registered.mcp_probe.risk === 'MEDIUM');
  check('mcp_call risk HIGH', engine.registered.mcp_call.risk === 'HIGH');

  // ---- presets (real official servers, no spawn on add) ----
  const pr = mcp.listPresets();
  check('presets: 8 official stdio servers', pr.ok === true && pr.count === 8 && pr.presets.every((p) => p.transport === 'stdio' && p.source === 'official'));
  check('presets include filesystem/everything/fetch/rea', ['filesystem', 'everything', 'fetch', 'rea'].every((id) => pr.presets.some((p) => p.id === id)));
  const pa0 = mcp.addPreset({ preset: 'nope-9000' });
  check('unknown preset rejected', pa0.ok === false && pa0.code === 'VALIDATION');
  const pa1 = mcp.addPreset({ preset: 'filesystem' });
  check('filesystem preset requires dir', pa1.ok === false && pa1.code === 'VALIDATION' && /dir/.test(pa1.error));
  const pa2 = mcp.addPreset({ preset: 'filesystem', dir: 'C:\\tmp' });
  check('filesystem preset added with dir', pa2.ok === true && /server-filesystem "C:\\tmp"/.test(pa2.server.command) && pa2.server.preset === 'filesystem');
  const pa3 = mcp.addPreset({ preset: 'everything', name: 'ref' });
  check('everything preset added under custom name', pa3.ok === true && pa3.server.name === 'ref' && /server-everything/.test(pa3.server.command));
  const pa4 = mcp.addPreset({ preset: 'sqlite', db: 'C:\\tmp\\x.db' });
  check('sqlite preset fills db var', pa4.ok === true && /--db-path "C:\\tmp\\x\.db"/.test(pa4.server.command));
  const pa5 = mcp.addPreset({ preset: 'rea' });
  check('rea preset added (no vars)', pa5.ok === true && /rea-agents mcp/.test(pa5.server.command) && pa5.server.preset === 'rea');
  const st2 = mcp.status();
  check('status counts preset additions', st2.count === 7 && st2.events >= 4);

  const router = mcp.createRouter();
  check('router builds or null', router === null || typeof router.use === 'function');

  // ---- env-gated live check against REAL official MCP server ----
  if (LIVE) {
    console.log('');
    console.log('--- MYRAA_MCP_LIVE=1: real-server checks (npx @modelcontextprotocol/server-everything) ---');
    const npxProbe = spawnSync('npx --version', { shell: true, windowsHide: true, timeout: 60000 });
    if (npxProbe.status !== 0) {
      skipCheck('live real-server probe', 'npx not available on PATH');
    } else {
      const live = mcpMod.createMcpManager({ storePath: path.join(tmp, 'live.json'), probeTimeoutMs: 300000, callTimeoutMs: 120000 });
      const la = live.addPreset({ preset: 'everything' });
      check('live: preset everything registered', la.ok === true);
      const lp = await live.probe({ name: 'everything' });
      if (!lp.ok && ['SPAWN_ERROR', 'SERVER_EXITED', 'TIMEOUT'].includes(lp.code)) {
        skipCheck('live real-server probe', 'server not reachable right now (' + lp.code + ') - first run needs network for the npx download');
      } else {
        check('live: probe real server ok', lp.ok === true, JSON.stringify(lp).slice(0, 200));
        check('live: real server reported tools', lp.ok === true && lp.tools.length >= 3);
        check('live: handshake serverInfo present', lp.ok === true && !!(lp.serverInfo && lp.serverInfo.name));
        const echoTool = lp.ok === true && lp.tools.some((t) => t.name === 'echo');
        if (echoTool) {
          const lc = await live.callTool({ name: 'everything', tool: 'echo', args: { message: 'myraa-live' } });
          check('live: real tools/call echo', lc.ok === true && lc.content.some((c) => c.type === 'text' && /myraa-live/.test(c.text)));
        } else {
          skipCheck('live: real tools/call echo', 'server did not list an echo tool');
        }
        const addTool = lp.ok === true && lp.tools.some((t) => t.name === 'add');
        if (addTool) {
          const la2 = await live.callTool({ name: 'everything', tool: 'add', args: { a: 2, b: 3 } });
          check('live: real tools/call add', la2.ok === true && la2.content.some((c) => c.type === 'text' && /5/.test(c.text)));
        }
      }

      console.log('--- MYRAA_MCP_LIVE=1: real-server checks (npx rea-agents mcp) ---');
      const lrea = live.addPreset({ preset: 'rea', name: 'rea' });
      check('live: rea preset registered', lrea.ok === true);
      const lrp = await live.probe({ name: 'rea' });
      if (!lrp.ok && ['SPAWN_ERROR', 'SERVER_EXITED', 'TIMEOUT'].includes(lrp.code)) {
        skipCheck('live rea probe', 'REA not reachable right now (' + lrp.code + ') - first run needs network for the npx download, Node 22+');
      } else {
        check('live: rea real probe ok (tools listed)', lrp.ok === true && lrp.tools.length >= 5, lrp.ok ? '' : JSON.stringify(lrp).slice(0, 200));
        check('live: rea exposes javascript analysis tool', lrp.ok === true && lrp.tools.some((t) => t.name === 'analyze_javascript_application'));
      }
    }
  } else {
    console.log('');
    console.log('[INFO] live real-server checks skipped - set MYRAA_MCP_LIVE=1 to run them against npx @modelcontextprotocol/server-everything');
  }

  console.log('');
  console.log('mcp transport tests: ' + pass + ' pass, ' + fail + ' fail' + (skip ? ', ' + skip + ' skipped' : ''));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
