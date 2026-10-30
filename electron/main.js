// RoarMind for Mac (The Mad Lions Lab, Oct 2026): ask your Mac in everyday words and it finds the file, the email, the
// screenshot or the note. Everything stays on this Mac: the index is a file in the app's own folder, the AI runs through
// Ollama on this computer, and the engine works in a process of its own at a low priority (worker.js).
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, net, protocol, shell, utilityProcess } = require('electron')
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const { pathToFileURL } = require('url')
const updater = require('./updater')
const claude = require('./claude')

nativeTheme.themeSource = 'dark'

// the page comes from app://mind/ (the app/ folder inside the program)
const APP_DIR = path.join(__dirname, '..', 'app')
const HOME = 'app://mind/index.html'
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
function serveApp() {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html'
    const file = path.normalize(path.join(APP_DIR, rel))
    if (!file.startsWith(APP_DIR + path.sep)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

/* ---------- the engine, in its own process ---------- */
const helperPath = () => (app.isPackaged ? path.join(process.resourcesPath, 'roarmind-helper') : path.join(__dirname, '..', 'helper', 'bin', 'roarmind-helper'))
let engine = null, nextId = 1
const waiting = new Map()
function startEngine() {
  engine = utilityProcess.fork(path.join(__dirname, 'worker.js'), [path.join(app.getPath('userData'), 'index', 'roarmind.db'), helperPath()], { serviceName: 'RoarMind engine' })
  engine.on('message', (m) => {
    if (m && m.event) { win?.webContents.send('mind:' + m.event, m.data); return }
    const w = waiting.get(m?.id)
    if (w) { waiting.delete(m.id); m.ok ? w.ok(m.result) : w.bad(new Error(m.error)) }
  })
  engine.on('exit', () => { engine = null; for (const w of waiting.values()) w.bad(new Error('The engine stopped; it starts again.')); waiting.clear(); if (!quitting) setTimeout(startEngine, 2000) })
}
const ask = (cmd, args) => new Promise((ok, bad) => {
  if (!engine) return bad(new Error('The engine is starting.'))
  const id = nextId++
  waiting.set(id, { ok, bad })
  engine.postMessage({ id, cmd, args })
})

/* ---------- the window ---------- */
let win = null
let quitting = false
const openOutside = (url) => { if (/^(https?:|mailto:)/i.test(String(url))) shell.openExternal(url) }
function open() {
  win = new BrowserWindow({
    width: 1180, height: 820, minWidth: 820, minHeight: 560, show: false, backgroundColor: '#16181d', autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 21 },
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') },
  })
  win.loadURL(HOME)
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://mind/')) { e.preventDefault(); openOutside(url) } })
  win.on('closed', () => { win = null })
}
const send = (cmd) => win?.webContents.send('mind:menu', cmd)
function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'File', submenu: [{ label: 'New Search', accelerator: 'Cmd+N', click: () => send('new') }, { label: 'Settings…', accelerator: 'Cmd+,', click: () => send('settings') }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ]))
}

/* ---------- what the page may ask ---------- */
// only what a search returned may be opened or shown
const known = new Map()
ipcMain.handle('mind:status', () => ask('status'))
ipcMain.handle('mind:settings', (_e, s) => ask('settings', s))
ipcMain.handle('mind:index', (_e, a) => ask('index', a))
ipcMain.handle('mind:stop', () => ask('stop'))
ipcMain.handle('mind:pull', () => ask('pull'))
ipcMain.handle('mind:erase', async () => {
  const n = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Erase', 'Cancel'], defaultId: 1, cancelId: 1, message: 'Erase everything RoarMind knows?', detail: 'The index is deleted from this Mac. Your files, mail and notes are not touched; RoarMind reads them again from the start.' })
  return n === 0 ? ask('erase') : false
})
ipcMain.handle('mind:search', async (_e, q) => {
  const r = await ask('search', q)
  for (const x of r.results) known.set(String(x.id), x)
  return r
})
ipcMain.handle('mind:answer', (_e, a) => ask('answer', a))
// Ask Claude: only when the person presses it; only the question and pieces of the items found (claude.js)
ipcMain.handle('mind:claude-state', () => claude.state())
ipcMain.handle('mind:claude-signin', async (_e, a) => { try { return { ok: true, ...(await claude.signIn(a?.email, a?.password)) } } catch (e) { return { ok: false, error: String(e?.message || e) } } })
ipcMain.handle('mind:claude-signout', () => claude.signOut())
ipcMain.handle('mind:claude-ask', async (_e, a) => {
  try {
    const items = await ask('excerpts', { ids: a?.ids || [], q: a?.q || '' })
    const answer = await claude.ask(String(a?.q || ''), items)
    // the ids in the order sent, so [2] in the answer opens the item that was second in what Claude read
    return { ok: true, answer, ids: items.map((i) => i.id), sent: { items: items.length, chars: items.reduce((n, i) => n + i.text.length, 0) } }
  } catch (e) { return { ok: false, signin: !!e?.signin, error: String(e?.message || e) } }
})
ipcMain.handle('mind:pick', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'Folders RoarMind reads', properties: ['openDirectory', 'multiSelections'] })
  return canceled ? [] : filePaths
})
// open a result: a file in its app, a message in Mail, a note in Notes
ipcMain.handle('mind:open', (_e, id) => {
  const r = known.get(String(id))
  if (!r) return false
  if (r.kind === 'mail') {
    if (r.extra?.id) return shell.openExternal(`message:${encodeURIComponent('<' + r.extra.id + '>')}`)
    return shell.openPath(r.path)
  }
  if (r.kind === 'note') {
    execFile('/usr/bin/osascript', ['-e', `tell application "Notes" to show note id "${String(r.path).replace(/"/g, '')}"`, '-e', 'tell application "Notes" to activate'])
    return true
  }
  return shell.openPath(r.path)
})
ipcMain.handle('mind:reveal', (_e, id) => { const r = known.get(String(id)); if (r && r.kind !== 'note') shell.showItemInFolder(r.path) })
// the Mac's own settings pages for the two permissions, and Ollama's download page
ipcMain.handle('mind:open-settings', (_e, which) => shell.openExternal(which === 'automation'
  ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'
  : 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'))
ipcMain.handle('mind:get-ollama', () => shell.openExternal('https://ollama.com/download/mac'))
ipcMain.handle('mind:version', () => app.getVersion())

/* RoarMind can update itself only from Applications (as RoarTwin): started from the .dmg or Downloads, it offers to
   move itself there first */
function offerApplications() {
  if (process.platform !== 'darwin' || !app.isPackaged || app.isInApplicationsFolder()) return false
  const r = dialog.showMessageBoxSync({
    type: 'question', buttons: ['Move to Applications', 'Not now'], defaultId: 0, cancelId: 1,
    message: 'Move RoarMind to Applications?',
    detail: 'From there RoarMind updates itself, with nothing to download or install by hand. It opens again by itself.',
  })
  if (r !== 0) return false
  try { return app.moveToApplicationsFolder({ conflictHandler: () => true }) } catch (e) {
    dialog.showErrorBox('RoarMind could not move itself', `${e?.message || e}\n\nDrag RoarMind into the Applications folder yourself and open it from there.`)
    return false
  }
}

if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
app.whenReady().then(() => {
  if (offerApplications()) return
  serveApp()
  menu()
  startEngine()
  open()
  updater.start(ipcMain, () => { quitting = true })
  app.on('activate', () => { if (!win) open() })
})
app.on('before-quit', () => { quitting = true; try { engine?.kill() } catch {} })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
