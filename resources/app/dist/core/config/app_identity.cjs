'use strict';
/* ===========================================================================
 * MYRAA — App Identity (single source of truth for all names)
 * ---------------------------------------------------------------------------
 * NEVER hardcode "MYRAA AI.exe", "MYRAA AI OS.exe", or exe names elsewhere.
 * Import this module instead. All naming is centralized here.
 * Syncs from: resources/app/version.json + package.json
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

let _identity = null;

function loadIdentity() {
  if (_identity) return _identity;
  try {
    const vjPath = path.join(__dirname, '..', '..', 'version.json');
    const pjPath = path.join(__dirname, '..', '..', 'package.json');
    const vj = fs.existsSync(vjPath) ? JSON.parse(fs.readFileSync(vjPath, 'utf8')) : {};
    const pj = fs.existsSync(pjPath) ? JSON.parse(fs.readFileSync(pjPath, 'utf8')) : {};
    _identity = {
      APP_NAME: 'MYRAA',
      PRODUCT_NAME: vj.productName || 'MYRAA AI',
      PRODUCT_NAME_FULL: vj.productNameFull || 'MYRAA AI Desktop Assistant',
      PUBLISHER: vj.publisher || 'MYRAA',
      PUBLISHER_URL: vj.publisherUrl || 'https://github.com/vishwajeetsrk/Myraa',
      COPYRIGHT: vj.copyright || 'Copyright \u00A9 2026 MYRAA',
      APP_ID: vj.appId || 'com.myraa.desktop',
      VERSION: vj.version || pj.version || '8.3.1',
      // ── Executable names (stable, never versioned) ────────────────────────
      EXECUTABLE_NAME: 'MYRAA.exe',
      LAUNCHER_NAME: 'MYRAA-Launcher.exe',
      UNINSTALLER_NAME: 'Uninstall MYRAA.exe',
      // Legacy names (for migration / detection of old installs)
      LEGACY_NAMES: ['MYRAA AI.exe', 'MYRAA AI OS.exe', 'MYRAA AI-runtime.exe'],
      // ── Installer names ───────────────────────────────────────────────────
      INSTALLER_PREFIX: 'MYRAA-Setup',
      PORTABLE_PREFIX: 'MYRAA-Portable',
      // ── Channels ──────────────────────────────────────────────────────────
      CHANNELS: ['stable', 'beta', 'development'],
      DEFAULT_CHANNEL: 'stable',
    };
  } catch (e) {
    _identity = {
      APP_NAME: 'MYRAA', PRODUCT_NAME: 'MYRAA AI', PRODUCT_NAME_FULL: 'MYRAA AI Desktop Assistant',
      PUBLISHER: 'MYRAA', PUBLISHER_URL: 'https://github.com/vishwajeetsrk/Myraa',
      COPYRIGHT: 'Copyright \u00A9 2026 MYRAA', APP_ID: 'com.myraa.desktop', VERSION: '8.3.1',
      EXECUTABLE_NAME: 'MYRAA.exe', LAUNCHER_NAME: 'MYRAA-Launcher.exe', UNINSTALLER_NAME: 'Uninstall MYRAA.exe',
      LEGACY_NAMES: ['MYRAA AI.exe', 'MYRAA AI OS.exe', 'MYRAA AI-runtime.exe'],
      INSTALLER_PREFIX: 'MYRAA-Setup', PORTABLE_PREFIX: 'MYRAA-Portable',
      CHANNELS: ['stable', 'beta', 'development'], DEFAULT_CHANNEL: 'stable',
    };
  }
  return _identity;
}

function getVersion() { return loadIdentity().VERSION; }
function getProductName() { return loadIdentity().PRODUCT_NAME; }

module.exports = { loadIdentity, getVersion, getProductName };
