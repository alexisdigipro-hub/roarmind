// Reading the Mac into the index, in the background: the folders chosen in Settings (documents, PDFs, and the words in
// screenshots and pictures), Apple Mail and Notes. Only what is new or changed since last time is read again; what is
// gone from the Mac is taken out of the index. It waits while the Mac runs on battery (a setting), works at a low
// priority, and every piece of text is turned into numbers by the AI on this Mac for searching by meaning.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { tx, dropItem, getMeta, setMeta } = require('./db')
const { norm, latin, nameForms, chunks, pack } = require('./text')
const { textOf, textOfBytes, kindOf, extOf, run } = require('./extract')
const { parseEmlx, html2text } = require('./mail')
const ollama = require('./ollama')

class Stopped extends Error { constructor() { super('Stopped') } }

const HOME = os.homedir()
const DEFAULT_SETTINGS = {
  folders: ['Documents', 'Desktop', 'Downloads'].map((d) => path.join(HOME, d)),
  // reads on battery too (Alex, 26 Oct); waiting for the charger is a choice in Settings
  never: [], mail: true, notes: true, images: true, onlyOnPower: false, lang: 'en',
  ollama: { ...ollama.DEFAULTS },
}
const settingsOf = (db) => { const s = { ...DEFAULT_SETTINGS, ...getMeta(db, 'settings', {}) }; s.ollama = { ...ollama.DEFAULTS, ...(s.ollama || {}) }; return s }

// never walked into: the system's own folders, apps, libraries that are one thing (Photos, Final Cut), code
const SKIP = new Set(['Library', 'node_modules', '.Trash', '.git', 'Applications', '$RECYCLE.BIN', 'System Volume Information'])
const BUNDLE = /\.(app|photoslibrary|fcpbundle|lrdata|lrcat-data|imovielibrary|logicx|pkg|xcodeproj|bundle|framework|band)$/i
const LIMIT = { doc: 60e6, pdf: 300e6, image: 30e6 }
const inside = (p, d) => p === d || p.startsWith(d.endsWith(path.sep) ? d : d + path.sep)

async function* walk(roots, never, stop) {
  const dirs = [...roots]
  while (dirs.length) {
    if (stop()) throw new Stopped()
    const dir = dirs.pop()
    if (never.some((n) => inside(dir, n))) continue
    let d
    try { d = await fs.promises.opendir(dir) } catch { continue }
    for await (const e of d) {
      if (e.name.startsWith('.') || e.isSymbolicLink()) continue
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (!SKIP.has(e.name) && !BUNDLE.test(e.name)) dirs.push(p); continue }
      if (e.isFile()) yield p
    }
  }
}

// on the charger? (pmset says "AC Power"); off a Mac, always yes
async function onPower() {
  if (process.platform !== 'darwin') return true
  const o = await run('/usr/bin/pmset', ['-g', 'ps'], 5000)
  return /AC Power/.test(o) || !/Battery Power/.test(o)
}

/* one item into the index: its row, its pieces of text, their words for the keyword search, their numbers when the
   AI is there (otherwise they are filled in later) */
function store(db, item, text, vecs) {
  return tx(db, () => {
    const old = db.prepare('SELECT id FROM items WHERE key = ?').get(item.key)
    if (old) dropItem(db, old.id)
    const r = db.prepare('INSERT INTO items (key, kind, ext, path, title, sender, people, date, size, mtime, extra, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(item.key, item.kind, item.ext || '', item.path || '', item.title || '', item.sender || '', item.people || '', item.date || 0, item.size || 0, item.mtime || 0, JSON.stringify(item.extra || {}), item.seen)
    const id = Number(r.lastInsertRowid)
    const pieces = text.length ? text : ['']
    const titleWords = norm(item.title) + ' ' + latin(item.title)
    pieces.forEach((t, n) => {
      const v = vecs?.[n] ? pack(vecs[n]) : null
      const c = db.prepare('INSERT INTO chunks (item, n, text, vec, scale) VALUES (?, ?, ?, ?, ?)').run(id, n, t, v ? v.blob : null, v ? v.scale : null)
      db.prepare('INSERT INTO fts (rowid, body, title, people) VALUES (?, ?, ?, ?)').run(Number(c.lastInsertRowid), norm(t), titleWords, item.people || '')
    })
    return id
  })
}

const embedText = (item, piece) => `${item.title || ''}\n${piece}`.slice(0, 2000)
async function vectors(cfg, ai, item, pieces) {
  if (!ai || !pieces.length) return null
  try { return await ollama.embed(cfg, pieces.map((p) => embedText(item, p))) } catch { return null }
}

// who is in a message, every way their names and addresses may be searched
function peopleWords(list) {
  const w = new Set()
  for (const p of list) {
    if (p.email) { w.add(p.email); w.add(p.email.split('@')[0]) }
    for (const part of String(p.name || '').split(/\s+/)) for (const f of nameForms(part)) w.add(f)
  }
  return [...w].join(' ')
}

/* ---------- the sources ---------- */
async function* fileItems(s, stop) {
  for await (const p of walk(s.folders, s.never, stop)) {
    const kind = kindOf(p)
    if (!kind || (kind === 'image' && !s.images)) continue
    let st
    try { st = await fs.promises.stat(p) } catch { continue }
    if (!st.size || st.size > LIMIT[kind]) continue
    yield { key: 'f:' + p, kind, ext: extOf(p), path: p, title: path.basename(p), date: st.mtimeMs, size: st.size, mtime: Math.round(st.mtimeMs) }
  }
}
function mailRoot() {
  const base = path.join(HOME, 'Library', 'Mail')
  try { return fs.readdirSync(base).filter((n) => /^V\d+$/.test(n)).sort((a, b) => +b.slice(1) - +a.slice(1)).map((n) => path.join(base, n))[0] || null } catch (e) { return e.code === 'EPERM' || e.code === 'EACCES' ? 'blocked' : null }
}
async function* mailFiles(stop) {
  const root = mailRoot()
  if (!root || root === 'blocked') return
  const dirs = [root]
  while (dirs.length) {
    if (stop()) throw new Stopped()
    const dir = dirs.pop()
    let d
    try { d = await fs.promises.opendir(dir) } catch { continue }
    for await (const e of d) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (!/^(Junk|Deleted Messages|Trash|Spam)\.mbox$/i.test(e.name)) dirs.push(p); continue }
      if (e.isFile() && e.name.endsWith('.emlx')) yield p
    }
  }
}
// every note, through the Notes app itself (Automation permission, asked once)
async function notesList() {
  if (process.platform !== 'darwin') return null
  const js = `const N = Application('Notes'); const n = N.notes; const ids = n.id(), names = n.name(), bodies = n.body(), dates = n.modificationDate(); JSON.stringify(ids.map((id, i) => ({ id, name: names[i], body: bodies[i], date: dates[i] ? dates[i].getTime() : 0 })))`
  const out = await run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', js], 300e3)
  try { return JSON.parse(out) } catch { return null }
}

/* ---------- a run ---------- */
async function runIndex(db, helper, tick = () => {}, stop = () => false, { force = () => false } = {}) {
  const s = settingsOf(db)
  const cfg = s.ollama
  const st = await ollama.status(cfg)
  const ai = st.running && st.embed
  const seen = Date.now()
  const swept = []
  const counts = { files: 0, mail: 0, notes: 0, read: 0 }
  const same = (item) => {
    const old = db.prepare('SELECT id, mtime, size FROM items WHERE key = ?').get(item.key)
    if (old && old.mtime === item.mtime && old.size === item.size) { db.prepare('UPDATE items SET seen = ? WHERE id = ?').run(seen, old.id); return true }
    return false
  }
  // "Read now, on battery" (force) lets this reading go on without the charger
  const waitPower = async () => { if (s.onlyOnPower) while (!force() && !(await onPower())) { tick({ stage: 'battery' }); for (let i = 0; i < 30 && !stop() && !force(); i++) await new Promise((r) => setTimeout(r, 1000)); if (stop()) throw new Stopped() } }

  // files
  await waitPower()
  for await (const item of fileItems(s, stop)) {
    counts.files++
    if (counts.files % 50 === 0) { tick({ stage: 'files', done: counts.files, read: counts.read, current: item.path }); await waitPower() }
    if (same(item)) continue
    const text = chunks(await textOf(item.path, helper).catch(() => ''))
    store(db, { ...item, seen }, text, await vectors(cfg, ai, item, text))
    counts.read++
  }
  swept.push('pdf', 'doc', 'image')

  // mail
  let mailState = 'off'
  if (s.mail) {
    mailState = mailRoot() === 'blocked' ? 'blocked' : mailRoot() ? 'ok' : 'none'
    if (mailState === 'ok') {
      for await (const p of mailFiles(stop)) {
        counts.mail++
        if (counts.mail % 100 === 0) { tick({ stage: 'mail', done: counts.mail, read: counts.read }); await waitPower() }
        let st2
        try { st2 = await fs.promises.stat(p) } catch { continue }
        const base = { key: 'm:' + p, kind: 'mail', path: p, size: st2.size, mtime: Math.round(st2.mtimeMs) }
        if (same(base)) continue
        let m
        try { m = parseEmlx(await fs.promises.readFile(p)) } catch { continue }
        const atts = m.attachments.map((a) => a.name)
        let body = m.text
        for (const a of m.attachments.slice(0, 6)) {
          const t = await textOfBytes(a.name, a.bytes, helper).catch(() => '')
          body += `\n\nAttachment: ${a.name}\n${t}`
        }
        const item = {
          ...base, title: m.subject || '(no subject)', date: m.date || st2.mtimeMs,
          ext: [...new Set(atts.map(extOf).filter(Boolean))].join(','),
          sender: m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email,
          people: peopleWords([m.from, ...m.to]),
          extra: { id: m.id, to: m.to.slice(0, 8), attachments: atts },
        }
        const text = chunks(`From: ${item.sender}\nSubject: ${item.title}\n${atts.length ? 'Attachments: ' + atts.join(', ') + '\n' : ''}\n${body}`)
        store(db, { ...item, seen }, text, await vectors(cfg, ai, item, text))
        counts.read++
      }
      swept.push('mail')
    }
  }

  // notes
  let notesState = 'off'
  if (s.notes) {
    const notes = await notesList()
    notesState = notes ? 'ok' : 'blocked'
    if (notes) {
      for (const n of notes) {
        if (stop()) throw new Stopped()
        counts.notes++
        const item = { key: 'n:' + n.id, kind: 'note', path: n.id, title: n.name || '(untitled)', date: n.date, size: (n.body || '').length, mtime: n.date }
        if (same(item)) continue
        const text = chunks(html2text(n.body || ''))
        store(db, { ...item, seen }, text, await vectors(cfg, ai, item, text))
        counts.read++
      }
      swept.push('note')
    }
  }

  // what is gone from the Mac, out of the index (only for sources read in full this time)
  const gone = db.prepare(`SELECT id FROM items WHERE seen < ? AND kind IN (${swept.map(() => '?').join(',') || "''"})`).all(seen, ...swept)
  tx(db, () => gone.forEach((g) => dropItem(db, g.id)))

  // pieces read while the AI was away: their numbers now
  if (ai) await fillVectors(db, cfg, tick, stop)

  const summary = { at: Date.now(), counts, removed: gone.length, mail: mailState, notes: notesState, ai }
  setMeta(db, 'lastRun', summary)
  return summary
}

async function fillVectors(db, cfg, tick, stop) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM chunks WHERE vec IS NULL AND text != ?').get('').n
  let done = 0
  for (;;) {
    if (stop()) throw new Stopped()
    const rows = db.prepare('SELECT c.id, c.text, i.title FROM chunks c JOIN items i ON i.id = c.item WHERE c.vec IS NULL AND c.text != ? LIMIT 32').all('')
    if (!rows.length) break
    let vecs
    try { vecs = await ollama.embed(cfg, rows.map((r) => `${r.title}\n${r.text}`.slice(0, 2000))) } catch { break }
    tx(db, () => rows.forEach((r, i) => { const v = pack(vecs[i]); db.prepare('UPDATE chunks SET vec = ?, scale = ? WHERE id = ?').run(v.blob, v.scale, r.id) }))
    done += rows.length
    tick({ stage: 'embed', done, total })
  }
}

module.exports = { runIndex, fillVectors, settingsOf, DEFAULT_SETTINGS, Stopped, store, peopleWords, mailRoot }
