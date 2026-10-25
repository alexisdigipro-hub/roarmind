// Apple Mail's messages as RoarMind reads them: each .emlx file is a byte count, the message itself (RFC 822 with its
// MIME parts) and a short plist. From it: who sent it and to whom, the subject, the date, the text (the plain part, or
// the HTML one without its tags), and every attachment's name, type and, when the message carries it, its bytes.

const decode = (buf, charset) => {
  const cs = String(charset || 'utf-8').toLowerCase().replace(/^(x-|cp)/, (m) => (m === 'cp' ? 'windows-' : '')).replace(/^windows-125(\d)$/, 'windows-125$1')
  try { return new TextDecoder(cs === 'utf8' ? 'utf-8' : cs).decode(buf) } catch { return new TextDecoder('utf-8').decode(buf) }
}
const qp = (s) => {
  const bytes = []
  const t = s.replace(/=\r?\n/g, '')
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) { bytes.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2 } else bytes.push(t.charCodeAt(i) & 0xff)
  }
  return Buffer.from(bytes)
}
// =?UTF-8?B?...?= and =?ISO-8859-7?Q?...?= in a header
const words = (s) => String(s || '').replace(/\?=\s+=\?/g, '?==?').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, txt) =>
  decode(/b/i.test(enc) ? Buffer.from(txt, 'base64') : qp(txt.replace(/_/g, ' ')), cs))

function headers(block) {
  const h = {}
  for (const line of block.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/)
    if (!m) continue
    // a header written in raw UTF-8 (no =?...?= words) arrives here byte by byte
    let v = m[2]
    if (/[\x80-\xff]/.test(v)) { const u = Buffer.from(v, 'latin1').toString('utf8'); if (!u.includes('\ufffd')) v = u }
    const k = m[1].toLowerCase(); h[k] = h[k] ? h[k] + ', ' + v : v
  }
  return h
}
const param = (v, name) => {
  const star = new RegExp(`${name}\\*=([^']*)'[^']*'([^;]+)`, 'i').exec(v || '')
  if (star) return decode(Buffer.from(star[2].replace(/%([0-9A-F]{2})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))), 'latin1'), star[1] || 'utf-8')
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, 'i').exec(v || '')
  return m ? words(m[2] ?? m[1]) : ''
}
const html2text = (h) => h.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))

// one MIME part, and the parts inside it
function walk(raw, out, depth = 0) {
  const at = raw.search(/\r?\n\r?\n/)
  const head = headers(at < 0 ? raw : raw.slice(0, at))
  const body = at < 0 ? '' : raw.slice(raw.indexOf('\n', at + 1) + 1).replace(/^\r?\n/, '')
  const type = (head['content-type'] || 'text/plain').toLowerCase()
  if (type.startsWith('multipart/') && depth < 8) {
    const b = param(head['content-type'], 'boundary')
    if (b) for (const part of body.split(new RegExp(`\\r?\\n?--${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?[ \\t]*\\r?\\n`)).slice(1)) if (part.trim() && part.trim() !== '--') walk(part, out, depth + 1)
    return head
  }
  const enc = (head['content-transfer-encoding'] || '').toLowerCase()
  const bytes = enc.includes('base64') ? Buffer.from(body.replace(/\s+/g, ''), 'base64') : enc.includes('quoted') ? qp(body) : Buffer.from(body, 'latin1')
  const name = param(head['content-disposition'], 'filename') || param(head['content-type'], 'name')
  if (name || /attachment/i.test(head['content-disposition'] || '')) out.attachments.push({ name: name || 'attachment', type: type.split(';')[0], bytes: bytes.length > 0 ? bytes : null })
  else if (type.startsWith('text/plain')) out.plain.push(decode(bytes, param(head['content-type'], 'charset')))
  else if (type.startsWith('text/html')) out.html.push(decode(bytes, param(head['content-type'], 'charset')))
  return head
}

// "Γιώργος Π. <g@x.gr>, b@y.com" -> [{ name, email }]
function people(s) {
  return words(s).split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => {
    const m = p.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/)
    return m ? { name: m[1].trim(), email: m[2].trim().toLowerCase() } : { name: '', email: p.trim().toLowerCase() }
  }).filter((p) => p.email.includes('@'))
}

/* an .emlx file's contents (or a plain .eml) -> the message */
function parseEmlx(buf) {
  let raw = buf.toString('latin1')
  const first = raw.match(/^(\d+)\s*\n/)
  if (first) raw = raw.slice(first[0].length, first[0].length + Number(first[1]))
  const out = { plain: [], html: [], attachments: [] }
  const head = walk(raw, out)
  const from = people(head.from || '')[0] || { name: '', email: '' }
  const to = [...people(head.to || ''), ...people(head.cc || '')]
  const date = Date.parse(head.date || '') || 0
  const text = out.plain.length ? out.plain.join('\n\n') : html2text(out.html.join('\n'))
  return {
    subject: words(head.subject || '').trim(), from, to, date, text,
    id: (head['message-id'] || '').replace(/[<>\s]/g, ''), attachments: out.attachments,
  }
}

module.exports = { parseEmlx, people, words, html2text }
