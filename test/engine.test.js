// RoarMind's engine on real files and messages, with a stand-in for Ollama (an HTTP server on this machine that
// answers like it: numbers for text, and filters for the question), so the whole chain runs without the models.
// node test/engine.test.js
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const { open, setMeta } = require('../electron/engine/db')
const { runIndex, settingsOf } = require('../electron/engine/indexer')
const { search, simplePlan, ftsQuery, excerpts } = require('../electron/engine/search')
const { parseEmlx } = require('../electron/engine/mail')
const { nameForms, chunks, norm } = require('../electron/engine/text')

// numbers for a text: each word (accents off, Greek and English words that mean the same put together) adds to a slot
const SAME = { προσφορα: 'offer', προσφορες: 'offer', offers: 'offer', quote: 'offer', quotation: 'offer', συμβολαιο: 'contract', contract: 'contract', σεναριο: 'script', script: 'script' }
function fakeVec(text) {
  const v = new Array(64).fill(0)
  for (let w of norm(text).split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 3) continue
    w = SAME[w] || w
    let h = 0; for (const c of w) h = (h * 31 + c.codePointAt(0)) >>> 0
    v[h % 64] += 1
  }
  return v
}
// Greek as an older mail program writes it: one byte a letter, Windows-1253
const W1253 = new Map([...new TextDecoder('windows-1253').decode(Uint8Array.from({ length: 256 }, (_, i) => i))].map((c, i) => [c, i]))
const win1253 = (s) => Buffer.from([...s].map((c) => W1253.get(c) ?? 63))
let planFor = () => ({})
const ollama = http.createServer((q, r) => {
  let b = ''; q.on('data', (d) => (b += d)); q.on('end', () => {
    const j = b ? JSON.parse(b) : {}
    r.setHeader('Content-Type', 'application/json')
    if (q.url === '/api/tags') return r.end(JSON.stringify({ models: [{ name: 'bge-m3:latest' }, { name: 'gemma3:4b' }] }))
    if (q.url === '/api/embed') return r.end(JSON.stringify({ embeddings: j.input.map(fakeVec) }))
    if (q.url === '/api/chat') return r.end(JSON.stringify({ message: { content: j.format === 'json' ? JSON.stringify(planFor(j.messages.at(-1).content)) : 'It is [1].' } }))
    r.statusCode = 404; r.end('{}')
  })
}).listen(0)

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roarmind-'))
const at = (...p) => { const f = path.join(root, ...p); fs.mkdirSync(path.dirname(f), { recursive: true }); return f }

;(async () => {
  try {
    const url = `http://127.0.0.1:${ollama.address().port}`
    // names, pieces
    assert.ok(nameForms('Γιώργος').includes('giorgos') && nameForms('Γιώργος').includes('george'))
    assert.ok(chunks('λέξη '.repeat(700)).length >= 3)
    assert.strictEqual(ftsQuery('Προσφορές, 2024!'), '"προσφορες"* OR "2024"*')

    // the Mac: documents, and a mail folder in Apple Mail's layout
    fs.writeFileSync(at('Documents', 'notes.txt'), 'Λίστα για το γύρισμα: φακοί, φώτα, catering.')
    fs.writeFileSync(at('Documents', 'Σενάριο Ματάρες.md'), 'ΕΣΩΤ. ΣΠΙΤΙ - ΝΥΧΤΑ. Το σενάριο του κλιπ για τον Φακίνο.')
    fs.writeFileSync(at('Documents', 'old.txt'), 'Συμβόλαιο συνεργασίας με το studio.')
    fs.writeFileSync(at('Documents', '.hidden.txt'), 'secret')
    fs.writeFileSync(at('Documents', 'Private', 'bank.txt'), 'τράπεζα κωδικοί')
    const mail = (from, subject, date, body, att) => {
      const b = 'B0UND'
      const msg = [`From: ${from}`, 'To: Alex <alex@themadlions.com>', `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`, `Date: ${date}`, `Message-ID: <${Math.random().toString(36).slice(2)}@x>`, `Content-Type: multipart/mixed; boundary="${b}"`, '',
        `--${b}`, 'Content-Type: text/plain; charset=windows-1253', 'Content-Transfer-Encoding: base64', '', win1253(body).toString('base64'),
        ...(att ? [`--${b}`, `Content-Type: application/pdf; name="${att}"`, `Content-Disposition: attachment; filename="${att}"`, 'Content-Transfer-Encoding: base64', '', Buffer.from('%PDF fake').toString('base64')] : []), `--${b}--`, ''].join('\r\n')
      return Buffer.from(Buffer.byteLength(msg, 'latin1') + '\n' + msg + '<plist/>', 'latin1')
    }
    const box = path.dirname(at('Library', 'Mail', 'V10', 'ACC', 'INBOX.mbox', 'X', 'Data', 'Messages', '1.emlx'))
    fs.writeFileSync(path.join(box, '1.emlx'), mail('=?UTF-8?B?' + Buffer.from('Γιώργος Παπαδόπουλος').toString('base64') + '?= <gpap@rental.gr>', 'Προσφορές εξοπλισμού', 'Tue, 12 Mar 2024 10:15:00 +0200', 'Hi Alex, see attached the quote.', 'prosfores_martios.pdf'))
    fs.writeFileSync(path.join(box, '2.emlx'), mail('Maria <maria@agency.gr>', 'Προσφορά για το κλιπ', 'Mon, 11 Mar 2024 09:00:00 +0200', 'Η προσφορά μας.', 'offer.pdf'))
    fs.writeFileSync(path.join(box, '3.emlx'), mail('George P <gpap@rental.gr>', 'Lunch', 'Fri, 20 Sep 2024 13:00:00 +0300', 'See you at 2.', null))
    const junk = path.dirname(at('Library', 'Mail', 'V10', 'ACC', 'Junk.mbox', 'Messages', '9.emlx')); fs.writeFileSync(path.join(junk, '9.emlx'), mail('spam <s@s.com>', 'Προσφορές!!!', 'Tue, 12 Mar 2024 10:00:00 +0200', 'προσφορές', null))
    // Windows-1253 text inside a message came out right
    assert.ok(parseEmlx(fs.readFileSync(path.join(box, '2.emlx'))).text.includes('προσφορά'))

    const prevHome = os.homedir
    os.homedir = () => root
    // the indexer reads HOME when it loads; load it again for this home
    delete require.cache[require.resolve('../electron/engine/indexer')]
    const ix = require('../electron/engine/indexer')
    const db = open(path.join(root, 'index', 'roarmind.db'))
    setMeta(db, 'settings', { folders: [at('Documents')], never: [at('Documents', 'Private')], notes: false, onlyOnPower: false, ollama: { url, embed: 'bge-m3', chat: 'gemma3:4b' } })
    const r1 = await ix.runIndex(db, null)
    assert.strictEqual(r1.mail, 'ok')
    assert.deepStrictEqual(db.prepare('SELECT kind, COUNT(*) AS n FROM items GROUP BY kind ORDER BY kind').all().map((x) => `${x.kind}:${x.n}`), ['doc:3', 'mail:3'])
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM chunks WHERE vec IS NULL').get().n, 0, 'every piece has its numbers')

    // the question from the brief
    const cfg = settingsOf(db).ollama
    planFor = () => ({ terms: 'προσφορές προσφορά offers quote', kinds: ['pdf', 'mail'], people: ['Γιώργος', 'Giorgos', 'George'], after: '2024-03-01', before: '2024-03-31' })
    const s1 = await search(db, cfg, 'Πού είναι εκείνο το PDF που μου έστειλε ο Γιώργος τον Μάρτιο του 2024 με τις προσφορές;')
    assert.ok(s1.plan.ai)
    assert.strictEqual(s1.results[0].title, 'Προσφορές εξοπλισμού', 'Giorgos\'s quote first: ' + s1.results.map((r) => r.title))
    assert.deepStrictEqual(s1.results[0].extra.attachments, ['prosfores_martios.pdf'])
    assert.ok(!s1.results.some((r) => r.title === 'Lunch'), 'September is not March')
    assert.ok(!s1.results.some((r) => r.title === 'Προσφορά για το κλιπ'), 'Maria is not Giorgos')
    assert.ok(!s1.results.some((r) => r.title.includes('!!!')), 'junk is not read')
    // by meaning across languages: "contract" finds the Greek Συμβόλαιο
    planFor = () => ({ terms: 'contract', kinds: [], people: [], after: null, before: null })
    const s2 = await search(db, cfg, 'the contract with the studio')
    assert.strictEqual(s2.results[0].title, 'old.txt')
    // without the AI: words, accents and case aside
    const s3 = await search(db, cfg, 'ΣΕΝΑΡΙΟ', { ai: false })
    assert.strictEqual(s3.results[0].title, 'Σενάριο Ματάρες.md')
    assert.ok(!s3.plan.ai)
    // hidden files and the Never folder are not read
    assert.ok(!db.prepare("SELECT 1 FROM items WHERE path LIKE '%hidden%' OR path LIKE '%bank%'").get())
    // a file changed is read again; a file gone leaves the index
    fs.writeFileSync(at('Documents', 'notes.txt'), 'Νέα λίστα: drone.')
    fs.utimesSync(at('Documents', 'notes.txt'), new Date(), new Date(Date.now() + 5000))
    fs.rmSync(at('Documents', 'old.txt'))
    const r2 = await ix.runIndex(db, null)
    assert.strictEqual(r2.counts.read, 1); assert.strictEqual(r2.removed, 1)
    assert.strictEqual((await search(db, cfg, 'drone', { ai: false })).results[0].title, 'notes.txt')
    assert.strictEqual(simplePlan('screenshot με το τιμολόγιο').kinds[0], 'image')
    // Ask Claude sends only pieces of what was found, within its limits
    const found = (await search(db, cfg, 'drone', { ai: false })).results.map((r) => r.id)
    const ex = excerpts(db, found, 'drone', { per: 40, total: 60 })
    assert.ok(ex.length >= 1 && ex[0].title === 'notes.txt' && ex[0].text.includes('drone'), JSON.stringify(ex))
    assert.ok(ex.every((e) => e.text.length <= 40) && ex.reduce((a, e) => a + e.text.length, 0) <= 60)
    assert.deepStrictEqual(excerpts(db, [], 'drone'), [])
    os.homedir = prevHome
    console.log('engine: all good')
  } catch (e) { console.error(e); process.exitCode = 1 } finally { ollama.close(); fs.rmSync(root, { recursive: true, force: true }) }
})()
