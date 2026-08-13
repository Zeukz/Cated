const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getSources: () => ipcRenderer.invoke('desktop:get-sources'),
  selectSource: (sourceId) => ipcRenderer.invoke('desktop:select-source', sourceId)
});
