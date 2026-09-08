'use strict';
/* ===========================================================================
 * MYRAA — Path Manager (central, dynamic, zero hardcoded user paths)
 * ---------------------------------------------------------------------------
 * Resolves ALL paths dynamically. Never use hardcoded user-specific paths.
 * Import this module instead — it uses os.homedir() and env vars.
 *
 * Data lives in OS-appropriate writable locations:
 *   Windows: %LOCALAPPDATA%\\MYRAA  or  %APPDATA%\\MYRAA  (via app.getPath)
 *   Portable: next to the executable (detected via MYRAA_PORTABLE flag)
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── App identity (lazy) ─────────────────────────────────────────────────────
let _identity = null;
function identity() {
  if (!_identity) {
    try { _identity = require('../config/app_identity.cjs').loadIdentity(); }
    catch (e) { _identity = { APP_NAME: 'MYRAA', VERSION: '8.3.1' }; }
  }
  return _identity;
}

// ── Base directories (all dynamic) ──────────────────────────────────────────

/** Where the Electron app lives (resources/app). Null in dev if not packaged. */
function getAppRoot() {
  try {
    const electron = require('electron');
    if (electron.app && electron.app.isPackaged) {
      return path.join(electron.app.getPath('exe') ? path.dirname(electron.app.getPath('exe')) : process.resourcesPath, '..');
    }
    // Dev: try process.resourcesPath, else __dirname
    if (process.resourcesPath) return path.join(process.resourcesPath, 'app');
  } catch (e) {}
  // Fallback: relative to this file
  return path.resolve(__dirname, '..', '..');
}

/** Writable per-user data dir (never Program Files). */
function getDataDir() {
  // 1) Explicit override (set by Electron main)
  if (process.env.MYRAA_DATA_DIR && fs.existsSync(process.env.MYRAA_DATA_DIR)) return process.env.MYRAA_DATA_DIR;
  // 2) Electron's userData (best — OS-correct, per-user, writable)
  try {
    const electron = require('electron');
    if (electron.app) return electron.app.getPath('userData');
  } catch (e) {}
  // 3) Fallback: %APPDATA% / %LOCALAPPDATA% / home
  const appData = process.env.APPDATA || process.env.LOCALAPPDATA || path.join(os.homedir(), '.myraa');
  return path.join(appData, 'MYRAA');
}

/** Executable dir (where MYRAA.exe lives). For portable, this IS the data dir. */
function getExecutableDir() {
  if (process.env.MYRAA_EXECUTABLE) return path.dirname(process.env.MYRAA_EXECUTABLE);
  try { return path.dirname(process.execPath); } catch (e) {}
  return getAppRoot();
}

/** Is this a portable install? Portable keeps data next to the exe. */
function isPortable() {
  if (process.env.MYRAA_PORTABLE === '1') return true;
  // Heuristic: if a .myraa-portable marker exists next to exe, it's portable
  try {
    const exeDir = getExecutableDir();
    if (fs.existsSync(path.join(exeDir, '.myraa-portable'))) return true;
    if (fs.existsSync(path.join(exeDir, 'portable.json'))) return true;
  } catch (e) {}
  return false;
}

// ── Derived paths ───────────────────────────────────────────────────────────

function getConfigDir() { return path.join(getDataDir(), 'config'); }
function getLogsDir() { return path.join(getDataDir(), 'logs'); }
function getCacheDir() { return path.join(getDataDir(), 'cache'); }
function getSkillsDir() { return path.join(getDataDir(), 'skills'); }
function getPluginsDir() { return path.join(getDataDir(), 'plugins'); }
function getConnectorsDir() { return path.join(getDataDir(), 'connectors'); }
function getUpdatesDir() { return path.join(getDataDir(), 'updates'); }
function getUpdatesDownloadDir() { return path.join(getUpdatesDir(), 'downloaded'); }
function getUpdatesStagedDir() { return path.join(getUpdatesDir(), 'staged'); }
function getBackupsDir() { return path.join(getUpdatesDir(), 'backups'); }
function getTempDir() { return path.join(getDataDir(), 'temp'); }
function getInstallRegistryPath() { return path.join(getConfigDir(), 'install.json'); }

// ── Ensure dirs exist (call once at startup) ────────────────────────────────
function ensureDataDirs() {
  const dirs = [getDataDir(), getConfigDir(), getLogsDir(), getCacheDir(), getUpdatesDir(), getUpdatesDownloadDir(), getUpdatesStagedDir(), getBackupsDir(), getTempDir()];
  for (const d of dirs) {
    try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
  }
}

// ── Startup diagnostics log ─────────────────────────────────────────────────
function writeStartupLog(entries) {
  try {
    const logPath = path.join(getLogsDir(), 'startup.log');
    const lines = [
      `[${new Date().toISOString()}] MYRAA Startup Diagnostics`,
      `  App: ${identity().PRODUCT_NAME} v${identity().VERSION}`,
      `  Install type: ${isPortable() ? 'portable' : 'installed'}`,
      `  Executable: ${process.execPath || '(unknown)'}`,
      `  App root: ${getAppRoot()}`,
      `  Data dir: ${getDataDir()}`,
      `  Config dir: ${getConfigDir()}`,
      `  Updates dir: ${getUpdatesDir()}`,
      ...entries.map(e => `  ${e}`),
      '',
    ];
    fs.appendFileSync(logPath, lines.join('\n'));
  } catch (e) {}
}

module.exports = {
  getAppRoot, getDataDir, getExecutableDir, isPortable,
  getConfigDir, getLogsDir, getCacheDir, getSkillsDir, getPluginsDir,
  getConnectorsDir, getUpdatesDir, getUpdatesDownloadDir, getUpdatesStagedDir,
  getBackupsDir, getTempDir, getInstallRegistryPath,
  ensureDataDirs, writeStartupLog,
};
