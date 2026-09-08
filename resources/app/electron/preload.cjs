/* ===========================================================================
 * MYRAA — Electron preload
 * ---------------------------------------------------------------------------
 * Runs in an isolated context and exposes a minimal, explicit API surface to
 * the renderer via contextBridge. Only serializable metadata may cross this
 * boundary. Live MediaStream objects stay in the renderer and are supplied by
 * Electron's main-process display-media request handler.
 * ========================================================================= */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Get the list of capturable desktop sources (entire screen + individual
 * windows) from the main process. Returns an array of
 * `{ id, name, thumbnail, display_id, appIcon }` where `thumbnail` is a
 * data-URL string suitable for a preview UI.
 */
async function getDesktopCaptureSources(options) {
  try {
    const sources = await ipcRenderer.invoke('screen:get-sources', options);
    return Array.isArray(sources) ? sources : [];
  } catch (err) {
    console.error('[MYRAA preload] getDesktopCaptureSources failed:', err);
    return [];
  }
}

// Real native window controls for the custom title bar. Each maps to a
// dedicated IPC handler in the main process — no fallbacks, no simulation.
const desktopWindow = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
};

contextBridge.exposeInMainWorld('myraa', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  appVersion: process.env.MYRAA_APP_VERSION || null,
  // Serializable source metadata only; MediaStreams cannot cross this bridge.
  getDesktopCaptureSources,
});

contextBridge.exposeInMainWorld('myraaDesktop', desktopWindow);

// MYRAA updater — safe API (check / download / install / subscribe).
const myraaUpdate = {
  check: (opts) => ipcRenderer.invoke('myraa:update:check', opts),
  download: () => ipcRenderer.invoke('myraa:update:download'),
  install: () => ipcRenderer.invoke('myraa:update:install'),
  state: () => ipcRenderer.invoke('myraa:update:state'),
  subscribe: (cb) => {
    const handle = (_ev, payload) => cb(payload);
    ipcRenderer.on('myraa:update:state', handle);
    ipcRenderer.invoke('myraa:update:subscribe');
    return () => ipcRenderer.removeListener('myraa:update:state', handle);
  },
};

contextBridge.exposeInMainWorld('myraaUpdate', myraaUpdate);
