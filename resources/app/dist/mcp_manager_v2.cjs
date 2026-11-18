'use strict';
/**
 * Phase 8: management facade over the EXISTING MCP manager. It adds discovery,
 * inspect, connect/disconnect and logs. Resources/prompts are reported as
 * NOT_IMPLEMENTED because the stdio client implements tools only - no fake data.
 */
const mcp = require('./mcp_manager.cjs');

function servers() {
  return mcp.listServers().servers.map((s) => ({
    id: s.id,
    name: s.name,
    transport: s.transport,
    status: s.status,
    implemented: s.implemented,
    preset: s.preset,
    command: s.command,
    url: s.url,
    toolsCount: s.toolsCount || (Array.isArray(s.tools) ? s.tools.length : 0),
    serverInfo: s.serverInfo || null,
    protocolVersion: s.protocolVersion || null,
    lastProbe: s.lastProbe || null,
  }));
}
async function connect(input) { return mcp.probe({ name: (input || {}).name }); }
function disconnect(input) { return mcp.disableServer({ name: (input || {}).name }); }
function enable(input) { return mcp.enableServer({ name: (input || {}).name }); }
async function inspect(input) {
  const name = (input || {}).name;
  const server = mcp.listServers().servers.find((s) => s.name === name);
  if (!server) return { ok: false, code: 'NOT_FOUND', error: 'unknown MCP server' };
  const tools = mcp.listTools({ name });
  return {
    ok: true,
    server,
    tools: tools.ok ? tools.tools : [],
    resources: { ok: false, code: 'NOT_IMPLEMENTED', error: 'stdio client implements tools only' },
    prompts: { ok: false, code: 'NOT_IMPLEMENTED', error: 'stdio client implements tools only' },
    note: 'run probe first to cache tools',
  };
}
function logs() {
  const s = mcp.status();
  return { ok: true, events: Array.isArray(s.events) ? s.events.slice(-100) : [], updatedAt: s.updatedAt || null };
}
function presets() { return mcp.listPresets(); }
function install(input) { return mcp.addPreset(input || {}); }
function permissions() {
  return { ok: false, code: 'NOT_IMPLEMENTED', error: 'use /api/permissions/check with the MCP tool name' };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/servers', (req, res) => res.json({ ok: true, servers: servers() }));
  router.post('/connect', async (req, res) => res.json(await connect(req.body || {})));
  router.post('/disconnect', (req, res) => res.json(disconnect(req.body || {})));
  router.post('/enable', (req, res) => res.json(enable(req.body || {})));
  router.get('/inspect/:name', async (req, res) => res.json(await inspect({ name: req.params.name })));
  router.get('/logs', (req, res) => res.json(logs()));
  router.get('/presets', (req, res) => res.json(presets()));
  router.post('/install', (req, res) => {
    const r = install(req.body || {});
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.post('/permissions', (req, res) => res.json(permissions()));
  return router;
}

module.exports = { servers, connect, disconnect, enable, inspect, logs, presets, install, permissions, createRouter };
