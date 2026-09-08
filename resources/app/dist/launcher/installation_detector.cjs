'use strict';
/* ===========================================================================
 * MYRAA — Installation Detector & Registry
 * ---------------------------------------------------------------------------
 * Reads/writes config/install.json (in userData). Validates on every startup:
 *   install_path, executable_path, version, channel, install_type.
 * Auto-detects moved installs and repairs the registry.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

function readRegistry() {
  try {
    const pm = require('../core/paths/path_manager.cjs');
    const regPath = pm.getInstallRegistryPath();
    if (!fs.existsSync(regPath)) return null;
    return JSON.parse(fs.readFileSync(regPath, 'utf8'));
  } catch (e) { return null; }
}

function writeRegistry(data) {
  try {
    const pm = require('../core/paths/path_manager.cjs');
    pm.ensureDataDirs();
    const regPath = pm.getInstallRegistryPath();
    const existing = readRegistry() || {};
    const merged = { ...existing, ...data, last_verified: new Date().toISOString() };
    fs.writeFileSync(regPath, JSON.stringify(merged, null, 2));
    return true;
  } catch (e) { return false; }
}

function detectInstallType(exePath) {
  if (!exePath) return 'unknown';
  const dir = path.dirname(exePath);
  // Portable: has .myraa-portable marker or lives outside Program Files
  try {
    if (fs.existsSync(path.join(dir, '.myraa-portable'))) return 'portable';
    if (fs.existsSync(path.join(dir, 'portable.json'))) return 'portable';
  } catch (e) {}
  const lower = dir.toLowerCase();
  if (lower.includes('program files')) return 'installer';
  if (lower.includes('appdata\\local\\programs')) return 'installer';
  return 'portable';
}

function validateInstallation() {
  const pm = require('../core/paths/path_manager.cjs');
  const { resolveExecutable } = require('./executable_resolver.cjs');
  const { loadIdentity } = require('../core/config/app_identity.cjs');
  const id = loadIdentity();

  const result = resolveExecutable();
  const reg = readRegistry();

  if (result.found) {
    const installPath = path.dirname(result.path);
    const installType = detectInstallType(result.path);
    // Update registry if changed
    if (!reg || reg.executable_path !== result.path || reg.install_path !== installPath) {
      writeRegistry({
        app_name: id.APP_NAME,
        product_name: id.PRODUCT_NAME,
        version: id.VERSION,
        install_path: installPath,
        executable_path: result.path,
        channel: (reg && reg.channel) || 'stable',
        install_type: installType,
        launcher_version: '1.0.0',
      });
    }
    return { ok: true, executable: result.path, installPath, installType, version: id.VERSION };
  }

  // Not found — try to give helpful diagnostics
  return {
    ok: false,
    executable: null,
    installPath: null,
    searched: result.candidates.slice(0, 8),
    hint: 'MYRAA executable not found. It may have been moved or uninstalled. Use Repair or browse to the new location.',
  };
}

module.exports = { readRegistry, writeRegistry, detectInstallType, validateInstallation };
