// RoarMind's engine in a process of its own (Electron's utilityProcess) at a low priority: the reading, the index and
// the searching never slow the window down. The app asks with { id, cmd, args } and gets { id, ok, result | error };
// the reading's progress comes as { event: 'progress' }.
const os = require('os')
const { open, getMeta, setMeta } = require('./engine/db')
const { Helper } = require('./engine/extract')
const indexer = require('./engine/indexer')
const { search, answer } = require('./engine/search')
const ollama = require('./engine/ollama')

try { os.setPriority(0, 10) } catch { /* as it is */ }
const [dbPath, helperPath] = process.argv.slice(2)
const db = open(dbPath)
const helper = new Helper(helperPath)
const port = process.parentPort
const send = (m) => port.postMessage(m)

let running = null, stopNow = false, progress = null, pulling = null
const EVERY = 30 * 60e3

async function indexNow() {
  if (running) return running
  stopNow = false
  running = (async () => {
    try { return await indexer.runIndex(db, helper, (p) => { progress = p; send({ event: 'progress', data: p }) }, () => stopNow) } catch (e) { if (!(e instanceof indexer.Stopped)) setMeta(db, 'lastError', String(e?.message || e)) } finally { running = null; progress = null; send({ event: 'progress', data: null }) }
  })()
  return running
}

function stats() {
  const by = Object.fromEntries(db.prepare('SELECT kind, COUNT(*) AS n FROM items GROUP BY kind').all().map((r) => [r.kind, r.n]))
  const pieces = db.prepare('SELECT COUNT(*) AS n, SUM(vec IS NULL) AS waiting FROM chunks').get()
  return { by, pieces: pieces.n, waiting: pieces.waiting || 0, lastRun: getMeta(db, 'lastRun'), lastError: getMeta(db, 'lastError'), running: !!running, progress, mailState: indexer.mailRoot() === 'blocked' ? 'blocked' : 'ok' }
}

const CMD = {
  async status() { const s = indexer.settingsOf(db); return { settings: s, ai: await ollama.status(s.ollama), stats: stats(), pulling } },
  settings(next) {
    const s = { ...indexer.settingsOf(db), ...next }
    setMeta(db, 'settings', s)
    return s
  },
  index() { indexNow(); return true },
  stop() { stopNow = true; return true },
  async search({ q, ai }) { return search(db, indexer.settingsOf(db).ollama, String(q || ''), { ai: ai !== false }) },
  async answer({ q, results }) { return answer(indexer.settingsOf(db).ollama, String(q || ''), results || []) },
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

// a first reading a little after the app opens, then every half hour
setTimeout(indexNow, 20e3)
setInterval(indexNow, EVERY)
