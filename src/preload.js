'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexUsage', {
  getAccounts: () => ipcRenderer.invoke('accounts:get'),
  refresh: index => ipcRenderer.invoke('accounts:refresh', index),
  login: index => ipcRenderer.invoke('accounts:login', index),
  cancelLogin: index => ipcRenderer.invoke('accounts:cancel-login', index),
  addAccount: () => ipcRenderer.invoke('accounts:add'),
  removeAccount: index => ipcRenderer.invoke('accounts:remove', index),
  getLaunchAtLogin: () => ipcRenderer.invoke('settings:launch-at-login:get'),
  setLaunchAtLogin: enabled => ipcRenderer.invoke('settings:launch-at-login:set', enabled),
  onAccounts: callback => ipcRenderer.on('accounts', (_, accounts) => callback(accounts))
});
