/* ===========================================================================
 * MYRAA — Electron updater (additive, Phase 2c)
 * ---------------------------------------------------------------------------
 * Wires electron-updater (already a dependency) to the GitHub provider
 * configured in electron-builder.v2.yml (publish.provider=github,
 * owner=vishwajeetsrk, repo=JARVIS-AI-OS). Safe defaults:
 *   - autoDownload: false   → user sees "Update available", decides.
 *   - autoInstallOnAppQuit: false → install only after explicit user action.
 *   - Manual check is exposed via IPC: myraa:update:check.
 *   - Partial progress + state are forwarded to the renderer as events.
 * No UI is changed; the renderer may subscribe when it wants.
 * ========================================================================== */

'use strict';

const { autoUpdater } = require('electron-updater');
const { ipcMain, app } = require('electron');
const fs = require('fs');

let logFile = null;
function slog(level, msg) {
  const line = `[updater:${level}] ${msg}`;
  try {
    if (!logFile) {
      const dir = app.getPath('userData');
      logFile = require('path').join(dir, 'logs', 'updater.log');
      fs.mkdirSync(require('path').dirname(logFile), { recursive: true });
    }
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`);
  } catch {}
  console.log(line);
}

const STATE = {
  idle: { state: 'idle', version: null },
  checking: { state: 'checking' },
  available: { state: 'available' },
  upToDate: { state: 'up-to-date' },
  downloading: { state: 'downloading', percent: 0, bytesPerSecond: 0 },
  ready: { state: 'ready' },
  error: { state: 'error', message: null },
  disabled: { state: 'disabled' },
};

let current = { ...STATE.idle };
const renderer = new Set(); // webContents that asked for events

function emit() {
  const payload = { ...current };
  for (const wc of renderer) {
    if (!wc.isDestroyed()) wc.send('myraa:update:state', payload);
  }
}

function setState(s) { current = s; emit(); }

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.disableWebInstaller = true;
autoUpdater.allowPrerelease = false;
autoUpdater.fullChangelog = false;

autoUpdater.on('checking-for-update', () => { slog('info', 'checking for update'); setState({ ...STATE.checking }); });
autoUpdater.on('update-available', (info) => {
  slog('info', 'update available: ' + (info && info.version));
  setState({ ...STATE.available, version: (info && info.version) || null });
});
autoUpdater.on('update-not-available', () => { slog('info', 'no update available'); setState(STATE.upToDate); });
autoUpdater.on('download-progress', (p) => {
  const percent = Number((p && p.percent) || 0).toFixed(1);
  const bps = Number((p && p.bytesPerSecond) || 0);
  slog('info', `download ${percent}% @ ${bps}B/s`);
  setState({ ...STATE.downloading, percent, bytesPerSecond: bps, transferred: p && p.transferred, total: p && p.total });
});
autoUpdater.on('update-downloaded', (info) => {
  slog('info', 'downloaded: ' + (info && info.version));
  setState({ ...STATE.ready, version: (info && info.version) || null });
});
autoUpdater.on('update-cancelled', () => { slog('info', 'cancelled'); setState(STATE.idle); });
autoUpdater.on('error', (err) => {
  const msg = (err && err.message) || String(err);
  slog('error', msg);
  setState({ ...STATE.error, message: msg });
});

// ---------------------------------------------------------------------------
// IPC surface
// ---------------------------------------------------------------------------
ipcMain.handle('myraa:update:check', async (_ev, opts = {}) => {
  if (process.env.MYRAA_UPDATER_DISABLE === '1') { setState(STATE.disabled); return STATE.disabled; }
  setState(STATE.checking);
  try {
    await autoUpdater.checkForUpdates();
    return current;
  } catch (e) {
    setState({ ...STATE.error, message: (e && e.message) || String(e) });
    return current;
  }
});

ipcMain.handle('myraa:update:download', async () => {
  if (current.state !== 'available' && current.state !== 'ready') return STATE.idle;
  try { await autoUpdater.downloadUpdate(); return current; }
  catch (e) { setState({ ...STATE.error, message: (e && e.message) || String(e) }); return current; }
});

ipcMain.handle('myraa:update:install', async () => {
  if (current.state !== 'ready') { slog('warn', 'install requested but not ready'); return current; }
  try { setState({ ...STATE.ready, installing: true }); autoUpdater.quitAndInstall(false, true); return current; }
  catch (e) { setState({ ...STATE.error, message: (e && e.message) || String(e) }); return current; }
});

ipcMain.handle('myraa:update:state', () => current);

// Allow a window to subscribe to state pushes
ipcMain.handle('myraa:update:subscribe', (ev) => {
  renderer.add(ev.sender);
  ev.sender.once('destroyed', () => renderer.delete(ev.sender));
  return current;
});

// ---------------------------------------------------------------------------
// Startup behavior — silent check unless disabled
// ---------------------------------------------------------------------------
function scheduleStartupCheck() {
  if (process.env.MYRAA_UPDATER_DISABLE === '1') return;
  // Wait for backend/window to be up, then check quietly.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => slog('warn', 'startup check failed: ' + (e && e.message)));
  }, 12_000);
}

module.exports = { scheduleStartupCheck, autoUpdater, getState: () => current };