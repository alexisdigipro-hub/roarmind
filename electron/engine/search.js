// A question in everyday words ("the PDF with the offers Giorgos sent me in March 2024") becomes a search: the AI on
// this Mac reads it into filters (what kind, from whom, between which dates) and the words that describe the content;
// then every piece of text is weighed by meaning (the AI's numbers) and by its words (the keyword index), and the best
// items come back with the piece that matched. Without the AI it is a keyword search, still accent- and case-blind.
const { norm, latin, nameForms, unpack, cosine } = require('./text')
const ollama = require('./ollama')

const KINDS = ['pdf', 'doc', 'mail', 'image', 'note']
const iso = (d) => d.toISOString().slice(0, 10)

async function plan(cfg, question, today = new Date()) {
  const sys = `You turn a question about the user's own files, emails, screenshots and notes into search filters. Today is ${iso(today)}.
Reply with JSON only: {"terms": string, "kinds": [..], "people": [..], "after": "YYYY-MM-DD" or null, "before": "YYYY-MM-DD" or null}.
- terms: the words for what the content is about, in Greek AND English, with synonyms (e.g. "προσφορές προσφορά offers quote quotation"). Leave out names, dates and file kinds.
- kinds: any of "pdf", "doc" (Word, text), "mail", "image" (screenshots, pictures), "note". "A PDF someone sent me" is ["pdf","mail"]. Empty when not said.
- people: the people named, each in Greek and Latin letters (e.g. "Γιώργος", "Giorgos", "George").
- after/before: the period meant ("τον Μάρτιο του 2024" is 2024-03-01 to 2024-03-31; "last week" counts from today). null when not said.`
  try {
    const out = JSON.parse(await ollama.chat(cfg, [{ role: 'system', content: sys }, { role: 'user', content: question }], { json: true, ms: 60e3 }))
    return {
      terms: String(out.terms || question),
      kinds: (Array.isArray(out.kinds) ? out.kinds : []).filter((k) => KINDS.includes(k)),
      people: (Array.isArray(out.people) ? out.people : []).map(String).filter(Boolean).slice(0, 6),
      after: /^\d{4}-\d{2}-\d{2}$/.test(out.after || '') ? out.after : null,
      before: /^\d{4}-\d{2}-\d{2}$/.test(out.before || '') ? out.before : null,
      ai: true,
    }
  } catch { return simplePlan(question) }
}

// without the AI: the words, and a kind when it is named
function simplePlan(question) {
  const q = norm(question)
  const kinds = []
  if (/\bpdf\b/.test(q)) kinds.push('pdf')
  if (/\b(mail|email|e-mail|μειλ|μηνυμα)/.test(q)) kinds.push('mail')
  if (/(screenshot|εικον|φωτογραφ|στιγμιοτυπ)/.test(q)) kinds.push('image')
  if (/(σημειωσ|\bnote)/.test(q)) kinds.push('note')
  return { terms: question, kinds, people: [], after: null, before: null, ai: false }
}

// every vector in memory once (a few MB per ten thousand pieces), read again when the index has grown or changed
let cache = null
function vectors(db) {
  const sig = db.prepare('SELECT COUNT(*) AS n, MAX(id) AS m FROM chunks WHERE vec IS NOT NULL').get()
  const key = `${sig.n}:${sig.m}`
  if (cache?.key === key) return cache
  const rows = db.prepare('SELECT id, item, vec, scale FROM chunks WHERE vec IS NOT NULL').all()
  cache = { key, rows: rows.map((r) => ({ id: r.id, item: r.item, v: unpack(Buffer.from(r.vec)), s: r.scale })) }
  return cache
}

const ftsQuery = (terms) => {
  const words = [...new Set(norm(terms).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1))].slice(0, 24)
  return words.length ? words.map((w) => `"${w.replace(/"/g, '')}"*`).join(' OR ') : null
}

async function search(db, cfg, question, { ai = true, limit = 30 } = {}) {
  const st = ai ? await ollama.status(cfg) : { running: false }
  const p = st.running && st.chat ? await plan(cfg, question) : simplePlan(question)
  // the items the filters allow
  const where = [], args = []
  if (p.kinds.length) {
    const files = p.kinds.filter((k) => k !== 'mail')
    const parts = []
    if (files.length) { parts.push(`kind IN (${files.map(() => '?').join(',')})`); args.push(...files) }
    // "a PDF someone sent me": the PDFs on the Mac, and the messages with a PDF attached (not every message)
    if (p.kinds.includes('mail')) {
      if (files.length) { parts.push(`(kind = 'mail' AND (${files.map(() => "(',' || ext || ',') LIKE ?").join(' OR ')}))`); args.push(...files.map((k) => `%,${k},%`)) }
      else parts.push("kind = 'mail'")
    }
    where.push(`(${parts.join(' OR ')})`)
  }
  if (p.after) { where.push('date >= ?'); args.push(Date.parse(p.after)) }
  if (p.before) { where.push('date < ?'); args.push(Date.parse(p.before) + 864e5) }
  let allowed = db.prepare(`SELECT id, people FROM items${where.length ? ' WHERE ' + where.join(' AND ') : ''}`).all(...args)
  // people: whoever sent or received it, in any spelling; when nobody matches, the people only weigh in
  let personHit = new Set()
  if (p.people.length) {
    const forms = [...new Set(p.people.flatMap(nameForms))]
    personHit = new Set(allowed.filter((r) => forms.some((f) => ` ${r.people} `.includes(` ${f} `) || r.people.includes(f + '@'))).map((r) => r.id))
    if (personHit.size) allowed = allowed.filter((r) => personHit.has(r.id))
  }
  const ok = new Set(allowed.map((r) => r.id))
  if (!ok.size) return { plan: p, results: [] }

  const score = new Map() // item -> { sem, kw, chunk }
  const bump = (item, k, v, chunk) => { const s = score.get(item) || { sem: 0, kw: 0, chunk: null, kwChunk: null }; if (v > s[k]) { s[k] = v; if (k === 'sem') s.chunk = chunk; else s.kwChunk = chunk } score.set(item, s) }
  // by words
  const fq = ftsQuery(p.terms + ' ' + latin(p.terms))
  if (fq) {
    const rows = db.prepare('SELECT f.rowid AS id, c.item AS item, bm25(fts, 1.0, 2.5, 0.5) AS r FROM fts f JOIN chunks c ON c.id = f.rowid WHERE fts MATCH ? ORDER BY r LIMIT 2000').all(fq)
    const best = rows.length ? -rows[0].r : 1
    for (const r of rows) if (ok.has(r.item)) bump(r.item, 'kw', Math.max(0, -r.r) / (best || 1), r.id)
  }
  // by meaning
  if (st.running && st.embed) {
    try {
      const [q] = await ollama.embed(cfg, [p.terms])
      const qn = Math.sqrt(q.reduce((a, x) => a + x * x, 0)) || 1
      for (const c of vectors(db).rows) if (ok.has(c.item)) bump(c.item, 'sem', cosine(q, qn, c.v, c.s), c.id)
    } catch { /* the keyword part still stands */ }
  }
  const semOn = [...score.values()].some((s) => s.sem > 0)
  let ranked = [...score.entries()].map(([item, s]) => ({ item, s, total: (semOn ? 0.65 * s.sem + 0.35 * s.kw : s.kw) + (personHit.has(item) ? 0.05 : 0) }))
  // only filters, no words that say anything: the newest that fit
  if (!ranked.length && (p.people.length || p.after || p.kinds.length)) ranked = [...ok].map((item) => ({ item, s: {}, total: 0 }))
  ranked.sort((a, b) => b.total - a.total)
  const top = ranked.slice(0, limit)
  const results = top.map(({ item, s, total }) => {
    const it = db.prepare('SELECT * FROM items WHERE id = ?').get(item)
    const cid = s.chunk || s.kwChunk
    const piece = cid ? db.prepare('SELECT text FROM chunks WHERE id = ?').get(cid)?.text : db.prepare('SELECT text FROM chunks WHERE item = ? ORDER BY n LIMIT 1').get(item)?.text
    return { id: it.id, kind: it.kind, ext: it.ext, path: it.path, title: it.title, sender: it.sender, date: it.date, size: it.size, extra: JSON.parse(it.extra || '{}'), snippet: snippet(piece || '', p.terms), score: total }
  })
  if (!results.some((r) => r.score > 0)) results.sort((a, b) => b.date - a.date)
  return { plan: p, results }
}

// the part of a piece around the first word of the question it holds
function snippet(text, terms) {
  const t = text.replace(/\s+/g, ' ').trim()
  const n = norm(t)
  let at = -1
  for (const w of norm(terms).split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 2)) { const i = n.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i }
  const from = Math.max(0, at - 90)
  return (from > 0 ? '…' : '') + t.slice(from, from + 280) + (from + 280 < t.length ? '…' : '')
}

// a short answer from what was found, the files named
async function answer(cfg, question, results) {
  const ctx = results.slice(0, 6).map((r, i) => `[${i + 1}] ${r.kind === 'mail' ? 'Email' : 'File'}: ${r.title}${r.sender ? ' from ' + r.sender : ''}${r.date ? ', ' + iso(new Date(r.date)) : ''}\n${r.snippet}`).join('\n\n')
  const sys = 'You help the user find things on their own Mac. Answer in the language of the question, in two or three sentences, from the found items only; name the item(s) by number like [1]. If nothing fits, say so.'
  return ollama.chat(cfg, [{ role: 'system', content: sys }, { role: 'user', content: `Question: ${question}\n\nFound:\n${ctx}` }], { ms: 120e3 })
}

/* What Ask Claude may send (Alex, 30 Oct: RoarMind "as you", option 2): for the items found, only their pieces of
   text, the ones that match the question's words first, then the item's opening; at most `per` characters an item and
   `total` in all. Never a whole file, never anything that was not found for this question. */
function excerpts(db, ids, question, { per = 3500, total = 24000 } = {}) {
  const words = [...new Set(norm(question).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2))]
  const out = []
  let left = total
  for (const id of ids) {
    if (left <= 0) break
    const it = db.prepare('SELECT id, kind, ext, title, sender, date, path FROM items WHERE id = ?').get(Number(id))
    if (!it) continue
    const pieces = db.prepare('SELECT n, text FROM chunks WHERE item = ? ORDER BY n').all(it.id)
    const hits = (p) => words.reduce((a, w) => a + (norm(p.text).includes(w) ? 1 : 0), 0)
    const order = pieces.map((p) => ({ ...p, h: hits(p) })).sort((a, b) => b.h - a.h || a.n - b.n)
    const take = []
    let room = Math.min(per, left)
    for (const p of order) {
      if (room <= 0) break
      const s = p.text.slice(0, room)
      take.push({ n: p.n, s })
      room -= s.length
    }
    const text = take.sort((a, b) => a.n - b.n).map((p) => p.s).join('\n…\n')
    left -= text.length
    out.push({ id: it.id, kind: it.kind, ext: it.ext, title: it.title, sender: it.sender || '', date: it.date ? iso(new Date(it.date)) : '', text })
  }
  return out
}

module.exports = { search, plan, simplePlan, answer, excerpts, snippet, ftsQuery, KINDS }
