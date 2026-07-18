const { contextBridge, ipcRenderer } = require('electron');

// API exposta pro site (renderer) usar através de window.atelasUpdater —
// nada de Node.js exposto diretamente, só essas 3 funções específicas.
contextBridge.exposeInMainWorld('atelasUpdater', {
  check: () => ipcRenderer.send('check-for-updates'),
  restart: () => ipcRenderer.send('restart-app'),
  onStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  }
});