'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  init: () => ipcRenderer.invoke('init'),
  onState: (cb) => ipcRenderer.on('state', (e, s) => cb(s)),
  onCmd: (cb) => ipcRenderer.on('cmd', (e, c) => cb(c)),
  onHostOpen: (cb) => ipcRenderer.on('host:open', (e, d) => cb(d)),
  hostReady: () => ipcRenderer.send('host:ready'),

  update: (id, patch) => ipcRenderer.send('memo:update', id, patch),
  create: (opts) => ipcRenderer.invoke('memo:create', opts || {}),
  remove: (id) => ipcRenderer.send('memo:delete', id),
  focus: (id) => ipcRenderer.send('memo:focus', id),
  move: (id, x, y, done) => ipcRenderer.send('memo:move', id, x, y, !!done),
  resize: (id, w, h, done) => ipcRenderer.send('memo:resize', id, w, h, !!done),
  foldAll: () => ipcRenderer.send('memo:foldAll'),
  unfoldAll: () => ipcRenderer.send('memo:unfoldAll'),

  setSettings: (p) => ipcRenderer.send('settings:update', p),
  setEvents: (key, list) => ipcRenderer.send('events:set', key, list),

  sideIgnore: (v) => ipcRenderer.send('side:ignore', !!v),
  sideFocus: () => ipcRenderer.send('side:focus'),
  widgetMove: (x, y, done) => ipcRenderer.send('widget:move', x, y, !!done),
  widgetSize: (h) => ipcRenderer.send('widget:size', h),
  openData: () => ipcRenderer.send('open:data'),
  copyText: (t) => ipcRenderer.send('clip:write', t),

  restore: (id) => ipcRenderer.send('trash:restore', id),
  purge: (id) => ipcRenderer.send('trash:purge', id),
  emptyTrash: () => ipcRenderer.send('trash:empty'),
  exportBackup: (pw) => ipcRenderer.invoke('backup:export', pw),
  importBackup: (pw) => ipcRenderer.invoke('backup:import', pw),

  cloudSignIn: (mode, username, password) => ipcRenderer.invoke('cloud:signin', mode, username, password),
  cloudLogout: () => ipcRenderer.send('cloud:logout'),
  cloudSync: () => ipcRenderer.send('cloud:sync'),
  copyMobileUrl: () => ipcRenderer.send('cloud:copyUrl'),
  openMobileUrl: () => ipcRenderer.send('cloud:openUrl')
});
