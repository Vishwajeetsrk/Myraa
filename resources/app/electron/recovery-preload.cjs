'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recoveryAPI', {
  onUpdate: (callback) => {
    ipcRenderer.on('myraa:recovery-update', (_ev, data) => callback(data));
  },
  retry: () => ipcRenderer.invoke('myraa:recovery-retry'),
  browse: () => ipcRenderer.invoke('myraa:recovery-browse'),
  repair: () => ipcRenderer.invoke('myraa:recovery-repair')
});
