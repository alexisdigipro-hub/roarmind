// The text inside a file. Plain text is read as it is; Word, RTF, OpenDocument, HTML and web archives go through the
// Mac's own textutil; PDFs and the words in pictures (screenshots, scans) through RoarMind's small helper, which uses
// the Mac's PDFKit and Vision (the same text recognition as Live Text). All of it on this computer.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile, spawn } = require('child_process')

const TEXT = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'srt', 'vtt', 'fountain', 'fdx', 'xml', 'log', 'yaml', 'yml', 'ini', 'tex'])
const TEXTUTIL = new Set(['doc', 'docx', 'rtf', 'rtfd', 'odt', 'html', 'htm', 'webarchive', 'wordml'])
const PDF = new Set(['pdf'])
const IMAGE = new Set(['png', 'jpg', 'jpeg', 'heic', 'heif', 'tif', 'tiff', 'gif', 'bmp', 'webp'])
const extOf = (p) => path.extname(p).slice(1).toLowerCase()
const kindOf = (p) => { const e = extOf(p); return PDF.has(e) ? 'pdf' : TEXT.has(e) || TEXTUTIL.has(e) ? 'doc' : IMAGE.has(e) ? 'image' : null }

const run = (cmd, args, ms = 30e3) => new Promise((ok) => {
  execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024, timeout: ms, encoding: 'utf8' }, (err, out) => ok(err ? '' : out))
})

/* the helper: one process kept open, a line in ("pdf\t/path" or "ocr\t/path"), a line of JSON out */
class Helper {
  constructor(bin) { this.bin = bin; this.p = null; this.wait = []; this.buf = '' }
  start() {
    if (this.p || !this.bin || !fs.existsSync(this.bin)) return !!this.p
    this.p = spawn(this.bin, ['serve'], { stdio: ['pipe', 'pipe', 'ignore'] })
    try { os.setPriority(this.p.pid, 10) } catch { /* as it is */ }
    this.p.stdout.setEncoding('utf8')
    this.p.stdout.on('data', (d) => {
      this.buf += d
      let i
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i); this.buf = this.buf.slice(i + 1)
        const w = this.wait.shift()
        if (w) { clearTimeout(w.t); try { w.ok(JSON.parse(line).text || '') } catch { w.ok('') } }
      }
    })
    this.p.on('exit', () => { this.p = null; this.buf = ''; for (const w of this.wait.splice(0)) { clearTimeout(w.t); w.ok('') } })
    return true
  }
  ask(cmd, file, ms = 60e3) {
    if (!this.start()) return Promise.resolve('')
    return new Promise((ok) => {
      // a file that hangs the helper: it is stopped, and started again for the next
      const t = setTimeout(() => { try { this.p?.kill('SIGKILL') } catch {} }, ms)
      this.wait.push({ ok, t })
      this.p.stdin.write(`${cmd}\t${file.replace(/[\t\n]/g, ' ')}\n`)
    })
  }
  stop() { try { this.p?.stdin.end(); this.p?.kill() } catch {} this.p = null }
}

async function textOf(file, helper, { maxText = 2e6 } = {}) {
  const e = extOf(file)
  if (TEXT.has(e)) {
    const st = await fs.promises.stat(file)
    const fh = await fs.promises.open(file, 'r')
    try { const b = Buffer.alloc(Math.min(st.size, maxText)); await fh.read(b, 0, b.length, 0); return b.toString('utf8') } finally { await fh.close() }
  }
  if (TEXTUTIL.has(e) && process.platform === 'darwin') return run('/usr/bin/textutil', ['-convert', 'txt', '-stdout', file])
  if (PDF.has(e)) return helper ? helper.ask('pdf', file) : ''
  if (IMAGE.has(e)) return helper ? helper.ask('ocr', file) : ''
  return ''
}

// an attachment's bytes, read through the same paths from a file of its own for a moment
async function textOfBytes(name, bytes, helper) {
  const e = extOf(name)
  if (!bytes || !kindOf(name) || IMAGE.has(e)) return ''
  if (TEXT.has(e)) return bytes.toString('utf8').slice(0, 2e6)
  const tmp = path.join(os.tmpdir(), `roarmind-${process.pid}-${Date.now()}.${e}`)
  try { await fs.promises.writeFile(tmp, bytes); return await textOf(tmp, helper) } finally { fs.promises.rm(tmp, { force: true }).catch(() => {}) }
}

module.exports = { Helper, textOf, textOfBytes, kindOf, extOf, run, IMAGE }
