/* ===========================================================================
 * MYRAA — Splash preload (minimal, safe)
 * ---------------------------------------------------------------------------
 * Exposes ONLY the splash progress subscription. No Node APIs, no fs,
 * no shell. contextIsolation stays ON, nodeIntegration stays OFF.
 * ========================================================================== */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myraaSplash', {
  onProgress: (cb) => {
    const handle = (_event, state) => {
      try { cb(state); } catch (e) {}
    };
    ipcRenderer.on('myraa:splash-progress', handle);
    return () => ipcRenderer.removeListener('myraa:splash-progress', handle);
  },
});
