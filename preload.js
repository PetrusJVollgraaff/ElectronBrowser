const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  newTab: () => ipcRenderer.send('new-tab'),
  switchTab: (id) => ipcRenderer.send('switch-tab', id),
  closeTab: (id) => ipcRenderer.send('close-tab', id),
  navigate: (input) => ipcRenderer.send('navigate', input),
  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),
  reload: () => ipcRenderer.send('reload'),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximizeToggle: () => ipcRenderer.send('window-maximize-toggle'),
  close: () => ipcRenderer.send('window-close'),

  getTabs: () => ipcRenderer.invoke('get-tabs'),
  getActiveUrl: () => ipcRenderer.invoke('get-active-url'),

  onTabsUpdated: (callback) => ipcRenderer.on('tabs-updated', (_e, data) => callback(data)),
  onWindowState: (callback) => ipcRenderer.on('window-state', (_e, data) => callback(data))
});
