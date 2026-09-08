'use strict';
const { PluginManager } = require('../plugin_manager.cjs');
const path = require('path');
const fs = require('fs');

// Clean state for clean test run
const stateFile = path.join(__dirname, '..', '.myraa-data', 'plugin-state.json');
try { fs.unlinkSync(stateFile); } catch {}

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
}

console.log('== Plugin Manager Tests ==\n');

const mgr = new PluginManager();

console.log('== 1. Discovery ==');
const discovered = mgr.discover();
t('discovers plugins', discovered.length > 0);
t('myraa-utils found', discovered.some(p => p.name === 'myraa-utils'));
const myraa = discovered.find(p => p.name === 'myraa-utils');
t('manifest has version', myraa && myraa.version);
t('manifest has main', myraa && myraa.main);

console.log('\n== 2. Load / Unload ==');
const loadResult = mgr.load('myraa-utils');
t('load returns ok', loadResult.ok);
t('load reports tools', loadResult.ok && loadResult.plugin.tools.length === 3);

const tools = mgr.list().find(p => p.name === 'myraa-utils');
t('list shows loaded', tools && tools.loaded);

console.log('\n== 3. Tool Execution ==');
const timeResult = mgr.executeTool('myraa_time', { timezone: 'Asia/Kolkata', format: 'iso' });
t('myraa_time returns ok', timeResult && timeResult.ok);
t('myraa_time has timezone', timeResult && timeResult.timezone === 'Asia/Kolkata');

const hashResult = mgr.executeTool('myraa_hash', { text: 'hello world', algorithm: 'sha256' });
t('myraa_hash returns hash', hashResult && hashResult.ok && hashResult.hash);
t('myraa_hash is correct', hashResult && hashResult.hash === 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');

const encodeResult = mgr.executeTool('myraa_encode', { text: 'Hello MYRAA', mode: 'encode' });
t('myraa_encode base64', encodeResult && encodeResult.ok && encodeResult.data === 'SGVsbG8gTVlSQUE=');

const decodeResult = mgr.executeTool('myraa_encode', { text: 'SGVsbG8gTVlSQUE=', mode: 'decode' });
t('myraa_decode base64', decodeResult && decodeResult.ok && decodeResult.data === 'Hello MYRAA');

const badResult = mgr.executeTool('nonexistent_tool', {});
t('unknown tool returns null', badResult === null);

console.log('\n== 4. Hooks ==');
const hookResults = mgr.callHook('onChat', { text: 'what time is it' });
t('onChat hook fires', hookResults.length > 0);
t('onChat returns inject', hookResults[0].result && hookResults[0].result.inject);

const normalHook = mgr.callHook('onChat', { text: 'hello' });
t('onChat no inject for normal text', normalHook.length === 0 || !normalHook[0].result);

console.log('\n== 5. Settings ==');
mgr.setSetting('myraa-utils', 'theme', 'dark');
t('getSetting returns value', mgr.getSetting('myraa-utils', 'theme') === 'dark');
t('getSetting returns default', mgr.getSetting('myraa-utils', 'missing', 'light') === 'light');

console.log('\n== 6. Stats ==');
const stats = mgr.stats();
t('stats.total > 0', stats.total > 0);
t('stats.tools > 0', stats.tools.length > 0);
t('stats.loaded > 0', stats.loaded > 0);

console.log('\n== 7. Unload ==');
const unloadResult = mgr.unload('myraa-utils');
t('unload returns ok', unloadResult.ok);
t('plugin no longer loaded', !mgr.plugins.has('myraa-utils'));
t('tools removed from hooks', mgr.hooks.size === 0 || !mgr.hooks.has('myraa_time'));

console.log('\n== 8. Enable/Disable ==');
mgr.enable('myraa-utils');
t('enable loads plugin', mgr.plugins.has('myraa-utils'));
mgr.disable('myraa-utils');
t('disable unloads plugin', !mgr.plugins.has('myraa-utils'));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
