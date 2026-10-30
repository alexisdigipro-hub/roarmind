// What RoarMind's page may ask of the Mac app: searching, the reading's state, settings, opening what was found.
const { contextBridge, ipcRenderer } = require('electron')

const on = (channel) => (fn) => { const h = (_e, v) => fn(v); ipcRenderer.on(channel, h); return () => ipcRenderer.removeListener(channel, h) }
contextBridge.exposeInMainWorld('mind', {
  version: () => ipcRenderer.invoke('mind:version'),
  status: () => ipcRenderer.invoke('mind:status'),
  settings: (s) => ipcRenderer.invoke('mind:settings', s),
  index: (a) => ipcRenderer.invoke('mind:index', a),
  stop: () => ipcRenderer.invoke('mind:stop'),
  pull: () => ipcRenderer.invoke('mind:pull'),
  erase: () => ipcRenderer.invoke('mind:erase'),
  search: (q) => ipcRenderer.invoke('mind:search', q),
  answer: (a) => ipcRenderer.invoke('mind:answer', a),
  claude: {
    state: () => ipcRenderer.invoke('mind:claude-state'),
    signIn: (email, password) => ipcRenderer.invoke('mind:claude-signin', { email, password }),
    signOut: () => ipcRenderer.invoke('mind:claude-signout'),
    ask: (q, ids) => ipcRenderer.invoke('mind:claude-ask', { q, ids }),
  },
  pick: () => ipcRenderer.invoke('mind:pick'),
  open: (id) => ipcRenderer.invoke('mind:open', String(id)),
  reveal: (id) => ipcRenderer.invoke('mind:reveal', String(id)),
  openSettings: (which) => ipcRenderer.invoke('mind:open-settings', String(which)),
  getOllama: () => ipcRenderer.invoke('mind:get-ollama'),
  onProgress: on('mind:progress'),
  onPull: on('mind:pull'),
  onMenu: on('mind:menu'),
  update: {
    state: () => ipcRenderer.invoke('mind:update-state'),
    install: () => ipcRenderer.invoke('mind:update-install'),
    on: on('mind:update'),
  },
})
