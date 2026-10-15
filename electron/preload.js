// electron/preload.js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  platform: process.platform,
  isElectron: true,
});
