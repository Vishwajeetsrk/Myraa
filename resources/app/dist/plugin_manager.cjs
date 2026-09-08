'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const PLUGIN_DIR = path.join(__dirname, '..', 'plugins');
const PLUGIN_STATE_FILE = path.join(__dirname, '..', '.myraa-data', 'plugin-state.json');

class PluginManager extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
    this.hooks = new Map();
    this.state = this._loadState();
    this._ensureDirs();
  }

  _ensureDirs() {
    if (!fs.existsSync(PLUGIN_DIR)) fs.mkdirSync(PLUGIN_DIR, { recursive: true });
    const stateDir = path.dirname(PLUGIN_STATE_FILE);
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
  }

  _loadState() {
    try {
      return JSON.parse(fs.readFileSync(PLUGIN_STATE_FILE, 'utf8'));
    } catch {
      return { enabled: {}, settings: {} };
    }
  }

  _saveState() {
    try {
      fs.writeFileSync(PLUGIN_STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch {}
  }

  discover() {
    const discovered = [];
    if (!fs.existsSync(PLUGIN_DIR)) return discovered;

    for (const name of fs.readdirSync(PLUGIN_DIR)) {
      const pluginDir = path.join(PLUGIN_DIR, name);
      if (!fs.statSync(pluginDir).isDirectory()) continue;

      const manifestPath = path.join(pluginDir, 'plugin.json');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest._dir = pluginDir;
        manifest._entry = path.join(pluginDir, manifest.main || 'index.cjs');
        manifest._enabled = this.state.enabled[name] !== false;
        discovered.push(manifest);
      } catch (e) {
        console.log(`[PluginManager] Failed to load manifest: ${name}: ${e.message}`);
      }
    }
    return discovered;
  }

  load(name) {
    const plugins = this.discover();
    const manifest = plugins.find(p => p.name === name);
    if (!manifest) return { ok: false, error: `Plugin not found: ${name}` };
    if (!manifest._enabled) return { ok: false, error: `Plugin disabled: ${name}` };

    try {
      const entry = manifest._entry;
      delete require.cache[require.resolve(entry)];
      const mod = require(entry);

      const plugin = {
        manifest,
        instance: mod,
        hooks: mod.hooks || {},
        tools: mod.tools || [],
        enabled: true,
        loadedAt: Date.now()
      };

      this.plugins.set(name, plugin);

      if (mod.tools && Array.isArray(mod.tools)) {
        for (const tool of mod.tools) {
          this.hooks.set(tool.name, { plugin: name, handler: tool.handler });
        }
      }

      if (mod.onLoad) mod.onLoad({ manifest, manager: this });

      console.log(`[PluginManager] Loaded: ${name} v${manifest.version || '?'}`);
      return { ok: true, plugin: { name, version: manifest.version, tools: (mod.tools || []).map(t => t.name) } };
    } catch (e) {
      console.log(`[PluginManager] Failed to load: ${name}: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  unload(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return { ok: false, error: `Not loaded: ${name}` };

    try {
      if (plugin.instance.onUnload) plugin.instance.onUnload();
      for (const tool of plugin.tools) {
        this.hooks.delete(tool.name);
      }
      this.plugins.delete(name);
      console.log(`[PluginManager] Unloaded: ${name}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  enable(name) {
    this.state.enabled[name] = true;
    this._saveState();
    return this.load(name);
  }

  disable(name) {
    this.state.enabled[name] = false;
    this._saveState();
    return this.unload(name);
  }

  getSetting(name, key, defaultVal) {
    return (this.state.settings[name] && this.state.settings[name][key]) || defaultVal;
  }

  setSetting(name, key, value) {
    if (!this.state.settings[name]) this.state.settings[name] = {};
    this.state.settings[name][key] = value;
    this._saveState();
  }

  executeTool(toolName, args) {
    const hook = this.hooks.get(toolName);
    if (!hook) return null;

    const plugin = this.plugins.get(hook.plugin);
    if (!plugin || !plugin.enabled) return null;

    try {
      return hook.handler(args, { plugin: plugin.manifest, manager: this });
    } catch (e) {
      return { ok: false, error: `Plugin ${hook.plugin} tool error: ${e.message}` };
    }
  }

  callHook(hookName, data) {
    const results = [];
    for (const [name, plugin] of this.plugins) {
      if (plugin.hooks[hookName]) {
        try {
          results.push({ plugin: name, result: plugin.hooks[hookName](data) });
        } catch (e) {
          results.push({ plugin: name, error: e.message });
        }
      }
    }
    return results;
  }

  list() {
    const discovered = this.discover();
    return discovered.map(d => ({
      name: d.name,
      version: d.version || '?',
      description: d.description || '',
      author: d.author || '',
      enabled: d._enabled,
      loaded: this.plugins.has(d.name),
      tools: this.plugins.has(d.name) ? (this.plugins.get(d.name).tools || []).map(t => t.name) : []
    }));
  }

  stats() {
    const all = this.discover();
    return {
      total: all.length,
      enabled: all.filter(d => d._enabled).length,
      loaded: this.plugins.size,
      tools: [...this.hooks.keys()]
    };
  }
}

module.exports = { PluginManager };
