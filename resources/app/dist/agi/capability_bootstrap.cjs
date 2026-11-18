'use strict';
/**
 * Phase 2 bootstrap: register MYRAA's REAL subsystems into the existing
 * capability registry. Every descriptor is backed by a real file, process,
 * registry or credential check. No decorative statuses, no invented latency.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const registry = require('./capability_registry.cjs');

const DIST = path.dirname(__dirname);
let done = false;

function fromDist(rel) {
  try { return require(path.join(DIST, rel)); } catch (e) { return null; }
}
function dataDir() {
  return process.env.MYRAA_DATA_DIR || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'MYRAA');
}
function exists(p) { try { return !!p && fs.existsSync(p); } catch (e) { return false; } }
function appVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(DIST, '..', 'version.json'), 'utf8')).version || '0.0.0'; }
  catch (e) { return '0.0.0'; }
}
function ok(state, detail) { return { state, detail: String(detail || '').slice(0, 300) }; }

function ensureRegistered() {
  if (done) return true;
  done = true;
  const C = registry.CATEGORIES;
  const add = (descriptor) => {
    try { if (!registry.get(descriptor.id)) registry.register(descriptor); } catch (e) { /* duplicate is fine */ }
  };
  const base = { version: appVersion(), description: 'MYRAA subsystem registered from real runtime state', capabilities: [], entryPoint: 'server.cjs', local: true };

  const mcp = fromDist('mcp_manager.cjs');
  const pm = fromDist('tool_permissions.cjs');
  const cm = fromDist('connector_market.cjs');
  const skills = fromDist('skill_discovery_engine.cjs');
  const plugins = fromDist('plugin_manager.cjs');

  add({ ...base, id: 'backend', name: 'MYRAA Backend', category: C.CORE, statusSource: 'runtime',
    healthCheck: async () => exists(path.join(DIST, 'server.cjs')) ? ok('ok', 'backend entry point present') : ok('error', 'server.cjs missing') });

  add({ ...base, id: 'memory', name: 'Memory & Knowledge', category: C.MEMORY, entryPoint: 'sqlite_memory_bridge.py', statusSource: 'database',
    healthCheck: async () => {
      const db = path.join(dataDir(), 'memory', 'myraa_memory.db');
      return exists(db) ? ok('ok', 'SQLite memory database present') : ok('error', 'no SQLite memory database yet');
    } });

  add({ ...base, id: 'mcp', name: 'MCP Registry', category: C.MAINTENANCE, entryPoint: 'mcp_manager.cjs', statusSource: 'local_process',
    healthCheck: async () => {
      try {
        const s = mcp && mcp.status ? mcp.status() : null;
        return s && s.ok ? ok('ok', (s.count || 0) + ' registered MCP servers') : ok('error', 'MCP registry unavailable');
      } catch (e) { return ok('error', e.message); }
    } });

  add({ ...base, id: 'permissions', name: 'Tool Permissions & Safety', category: C.SECURITY, entryPoint: 'tool_permissions.cjs', statusSource: 'local_process',
    healthCheck: async () => {
      try {
        const s = pm && pm.status ? pm.status() : null;
        return s && s.ok ? ok('ok', 'permission engine reachable') : ok('error', 'permission engine unavailable');
      } catch (e) { return ok('error', e.message); }
    } });

  add({ ...base, id: 'connectors', name: 'Connector Market', category: C.CONNECTOR, entryPoint: 'connector_market.cjs', statusSource: 'runtime',
    healthCheck: async () => {
      try {
        const s = cm && cm.status ? cm.status() : null;
        return s ? ok('ok', (s.count || 0) + ' declarative connectors catalogued (auth not implied)') : ok('error', 'connector registry unavailable');
      } catch (e) { return ok('error', e.message); }
    } });

  add({ ...base, id: 'skills', name: 'Skill Registry', category: C.SKILL, entryPoint: 'skill_discovery_engine.cjs', statusSource: 'runtime',
    healthCheck: async () => {
      try {
        const s = skills && skills.getRegistrySummary ? skills.getRegistrySummary() : null;
        return s ? ok('ok', 'skill discovery registry reachable') : ok('error', 'skill registry unavailable');
      } catch (e) { return ok('error', e.message); }
    } });

  add({ ...base, id: 'plugins', name: 'Plugin Manager', category: C.PLUGIN, entryPoint: 'plugin_manager.cjs', statusSource: 'local_process',
    healthCheck: async () => exists(path.join(DIST, '..', 'plugins')) ? ok('ok', 'plugin directory present') : ok('error', 'plugin directory missing') });

  add({ ...base, id: 'voice', name: 'Voice Engine', category: C.MULTIMODAL, entryPoint: 'server.cjs', statusSource: 'runtime', local: false, requiresNetwork: true,
    healthCheck: async () => {
      const configured = !!(process.env.GEMINI_API_KEY || exists(path.join(process.env.APPDATA || '', 'MYRAA', 'secrets.json')));
      return configured ? ok('ok', 'voice credentials configured (live session state reported by /api/live/status)') : ok('error', 'no voice credentials configured');
    } });

  add({ ...base, id: 'screen', name: 'Screen Awareness', category: C.MULTIMODAL, entryPoint: 'ocr_engine.cjs', statusSource: 'runtime', requiresPermission: true,
    permissions: ['screen-recording'],
    healthCheck: async () => {
      const consentPath = path.join(dataDir(), 'settings', 'screen_awareness_consent.json');
      let enabled = false;
      try { enabled = JSON.parse(fs.readFileSync(consentPath, 'utf8')).enabled === true; } catch (e) {}
      return enabled ? ok('ok', 'screen-awareness consent enabled') : ok('error', 'screen-awareness consent not enabled');
    } });

  add({ ...base, id: 'desktop', name: 'Windows Control', category: C.DESKTOP, entryPoint: 'desktopAutomation.cjs', statusSource: 'local_process', requiresPermission: true,
    permissions: ['windows-automation'],
    healthCheck: async () => exists(path.join(DIST, 'desktopAutomation.cjs')) ? ok('ok', 'desktop automation module present') : ok('error', 'desktop automation module missing') });

  add({ ...base, id: 'browser', name: 'Browser Agent', category: C.WEB, entryPoint: 'browser_agent.cjs', statusSource: 'runtime', requiresNetwork: true,
    healthCheck: async () => exists(path.join(DIST, '..', 'node_modules', 'playwright'))
      ? ok('ok', 'playwright runtime present')
      : ok('error', 'playwright not installed - browser agent cannot start') });

  add({ ...base, id: 'events', name: 'Event Bus', category: C.CORE, entryPoint: 'event_bus.cjs', statusSource: 'database',
    healthCheck: async () => {
      const file = process.env.MYRAA_EVENTS_DB || path.join(dataDir(), 'events', 'events.jsonl');
      return exists(path.dirname(file)) ? ok('ok', 'event store directory present') : ok('error', 'event store not initialised');
    } });

  // Counts are supplied by the real registries only; never hardcoded.
  if (mcp && mcp.status) registry.registerCounter('mcpServers', () => { try { return mcp.status().count; } catch (e) { return null; } });
  if (skills && skills.getRegistrySummary) registry.registerCounter('skills', () => { try { return skills.getRegistrySummary().total || 0; } catch (e) { return null; } });
  if (cm && cm.status) registry.registerCounter('connectors', () => { try { return cm.status().count || 0; } catch (e) { return null; } });
  if (plugins && plugins.stats) registry.registerCounter('plugins', () => { try { return plugins.stats().total || 0; } catch (e) { return null; } });

  return true;
}

module.exports = { ensureRegistered, reset: () => { done = false; } };
