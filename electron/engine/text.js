// Text the index can compare: accents and case taken off, Greek also written in Latin letters (Γιώργος = giorgos =
// George's "Giorgos"), cut into overlapping pieces for the AI to read.

const norm = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const GR = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o' }
// Greek in Latin letters, the way people spell names (ου = ou, γγ = ng, μπ = b at the start)
function latin(s) {
  let t = norm(s).replace(/ου/g, 'ou').replace(/γγ/g, 'ng').replace(/γκ/g, 'gk').replace(/(^|\s)μπ/g, '$1b').replace(/ντ/g, 'nt').replace(/αι/g, 'ai').replace(/ει/g, 'ei').replace(/οι/g, 'oi')
  return t.replace(/[α-ω]/g, (c) => GR[c] || c)
}
// the spellings a name may have in mail headers and documents
function nameForms(name) {
  const n = norm(name).trim()
  const l = latin(name).trim()
  const forms = new Set([n, l, l.replace(/y/g, 'i'), l.replace(/^gi/, 'y').replace(/^g(?=[ie])/, 'y'), l.replace(/ch/g, 'h')])
  // the everyday English forms of common Greek first names
  const EN = { giorgos: 'george', georgios: 'george', ioannis: 'john', giannis: 'john', dimitris: 'dimitri', nikos: 'nick', konstantinos: 'costas', kostas: 'costas', alexandros: 'alex', alexis: 'alex', panagiotis: 'panos', vasilis: 'bill', christos: 'chris', michalis: 'michael', maria: 'mary', eleni: 'helen', aikaterini: 'katerina' }
  for (const f of [...forms]) if (EN[f]) forms.add(EN[f])
  return [...forms].filter((x) => x.length > 1)
}

const squash = (s) => String(s || '').replace(/\u0000/g, '').replace(/[ \t\f\v ]+/g, ' ').replace(/\s*\n\s*\n\s*/g, '\n\n').trim()
// pieces of about 1000 characters, 150 shared with the next, at most 40 an item (the first 40 000 characters)
function chunks(text, size = 1000, overlap = 150, max = 40) {
  const t = squash(text)
  const out = []
  let at = 0
  while (at < t.length && out.length < max) {
    let end = Math.min(t.length, at + size)
    // end on a sentence or a line when one is near
    if (end < t.length) { const cut = Math.max(t.lastIndexOf('. ', end), t.lastIndexOf('\n', end)); if (cut > at + size * 0.6) end = cut + 1 }
    const piece = t.slice(at, end).trim()
    if (piece) out.push(piece)
    if (end >= t.length) break
    at = Math.max(at + 1, end - overlap)
  }
  return out
}

// a vector as bytes: 8 bits a number and one scale, a quarter of the room of floats
function pack(vec) {
  let max = 0
  for (const x of vec) max = Math.max(max, Math.abs(x))
  const scale = max / 127 || 1
  const q = new Int8Array(vec.length)
  for (let i = 0; i < vec.length; i++) q[i] = Math.round(vec[i] / scale)
  return { blob: Buffer.from(q.buffer), scale }
}
const unpack = (blob) => new Int8Array(blob.buffer, blob.byteOffset, blob.byteLength)
function cosine(q, qn, v, scale) {
  let dot = 0, vn = 0
  for (let i = 0; i < v.length; i++) { const x = v[i] * scale; dot += q[i] * x; vn += x * x }
  return vn ? dot / (qn * Math.sqrt(vn)) : 0
}

module.exports = { norm, latin, nameForms, squash, chunks, pack, unpack, cosine }
