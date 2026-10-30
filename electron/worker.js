// RoarMind's engine in a process of its own (Electron's utilityProcess) at a low priority: the reading, the index and
// the searching never slow the window down. The app asks with { id, cmd, args } and gets { id, ok, result | error };
// the reading's progress comes as { event: 'progress' }.
const os = require('os')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')
const { open, getMeta, setMeta } = require('./engine/db')
const { Helper } = require('./engine/extract')
const indexer = require('./engine/indexer')
const { search, answer, excerpts } = require('./engine/search')
const ollama = require('./engine/ollama')

try { os.setPriority(0, 10) } catch { /* as it is */ }
const [dbPath, helperPath] = process.argv.slice(2)
const db = open(dbPath)
const helper = new Helper(helperPath)
const port = process.parentPort
// once: settings saved while the charger was the default now read on battery too (Alex, 26 Oct)
if (!getMeta(db, 'batteryDefault')) {
  const saved = getMeta(db, 'settings', null)
  if (saved) setMeta(db, 'settings', { ...saved, onlyOnPower: false })
  setMeta(db, 'batteryDefault', true)
}
const send = (m) => port.postMessage(m)

let running = null, stopNow = false, progress = null, pulling = null, forceNow = false
const EVERY = 30 * 60e3

async function indexNow(force = false) {
  if (force) forceNow = true
  if (running) return running
  stopNow = false
  await aiStatus(indexer.settingsOf(db).ollama).catch(() => {})
  running = (async () => {
    try { return await indexer.runIndex(db, helper, (p) => { progress = p; send({ event: 'progress', data: p }) }, () => stopNow, { force: () => forceNow }) } catch (e) { if (!(e instanceof indexer.Stopped)) setMeta(db, 'lastError', String(e?.message || e)) } finally { running = null; progress = null; forceNow = false; send({ event: 'progress', data: null }) }
  })()
  return running
}

/* Ollama installed but closed: RoarMind opens it in the background (Alex, 26 Oct: "does Ollama have to be open?"),
   at most once a minute, so the AI is there without a thought */
let wokeAt = 0
async function aiStatus(cfg) {
  const st = await ollama.status(cfg)
  if (!st.running && process.platform === 'darwin' && Date.now() - wokeAt > 60e3) {
    const app = ['/Applications/Ollama.app', path.join(os.homedir(), 'Applications', 'Ollama.app')].find((p) => fs.existsSync(p))
    if (app) {
      wokeAt = Date.now()
      execFile('/usr/bin/open', ['-g', '-a', app])
      for (let i = 0; i < 10; i++) { await new Promise((r) => setTimeout(r, 1000)); const again = await ollama.status(cfg); if (again.running) return again }
    }
  }
  return st
}

function stats() {
  const by = Object.fromEntries(db.prepare('SELECT kind, COUNT(*) AS n FROM items GROUP BY kind').all().map((r) => [r.kind, r.n]))
  const pieces = db.prepare('SELECT COUNT(*) AS n, SUM(vec IS NULL) AS waiting FROM chunks').get()
  return { by, pieces: pieces.n, waiting: pieces.waiting || 0, lastRun: getMeta(db, 'lastRun'), lastError: getMeta(db, 'lastError'), running: !!running, progress, mailState: indexer.mailRoot() === 'blocked' ? 'blocked' : 'ok' }
}

const CMD = {
  async status() { const s = indexer.settingsOf(db); return { settings: s, ai: await aiStatus(s.ollama), stats: stats(), pulling } },
  settings(next) {
    const s = { ...indexer.settingsOf(db), ...next }
    setMeta(db, 'settings', s)
    return s
  },
  index(args) { indexNow(!!args?.force); return true },
  stop() { stopNow = true; return true },
  async search({ q, ai }) { return search(db, indexer.settingsOf(db).ollama, String(q || ''), { ai: ai !== false }) },
  async answer({ q, results }) { return answer(indexer.settingsOf(db).ollama, String(q || ''), results || []) },
  // Ask Claude: the pieces of the items found, within their limits (search.js excerpts)
  excerpts({ ids, q }) { return excerpts(db, (ids || []).slice(0, 12), String(q || '')) },
  // the two models, downloaded through Ollama, with their progress
  async pull() {
    if (pulling) return true
    const cfg = indexer.settingsOf(db).ollama
    pulling = { model: cfg.embed, done: 0, total: 0 }
    ;(async () => {
      try {
        for (const m of [cfg.embed, cfg.chat]) await ollama.pull(cfg, m, (p) => { pulling = p; send({ event: 'pull', data: p }) })
        pulling = null; send({ event: 'pull', data: { done: true } })
        indexNow()
      } catch (e) { pulling = null; send({ event: 'pull', data: { error: String(e?.message || e) } }) }
    })()
    return true
  },
  // everything RoarMind knows, gone; the next reading starts from nothing
  erase() {
    stopNow = true
    db.exec('DELETE FROM fts; DELETE FROM chunks; DELETE FROM items;')
    setMeta(db, 'lastRun', null)
    return true
  },
}

port.on('message', async (e) => {
  const { id, cmd, args } = e.data || {}
  try { send({ id, ok: true, result: await CMD[cmd](args) }) } catch (err) { send({ id, ok: false, error: String(err?.message || err) }) }
})

// a first reading a few seconds after the app opens, then every half hour
setTimeout(indexNow, 5e3)
setInterval(indexNow, EVERY)
