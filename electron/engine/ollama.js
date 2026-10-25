// The AI, on this Mac: Ollama (ollama.com) serves the models at 127.0.0.1:11434 and nothing goes anywhere else. One
// model turns text into numbers that can be compared by meaning (bge-m3, at home in Greek and English); another reads a
// question and the pieces found and answers (gemma3:4b). Both can be changed in Settings.

const DEFAULTS = { url: 'http://127.0.0.1:11434', embed: 'bge-m3', chat: 'gemma3:4b' }

async function call(cfg, p, body, ms = 120e3) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(cfg.url + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal })
    if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`)
    return await r.json()
  } finally { clearTimeout(t) }
}

// is Ollama there, and which of the two models does it have
async function status(cfg) {
  try {
    const d = await call(cfg, '/api/tags', null, 3000)
    const names = (d.models || []).map((m) => m.name)
    const has = (m) => names.some((n) => n === m || n === m + ':latest' || n.split(':')[0] === m)
    return { running: true, models: names, embed: has(cfg.embed), chat: has(cfg.chat) }
  } catch { return { running: false, models: [], embed: false, chat: false } }
}

async function embed(cfg, texts) {
  const d = await call(cfg, '/api/embed', { model: cfg.embed, input: texts, truncate: true })
  return d.embeddings
}

async function chat(cfg, messages, { json = false, ms = 120e3 } = {}) {
  const d = await call(cfg, '/api/chat', { model: cfg.chat, messages, stream: false, format: json ? 'json' : undefined, options: { temperature: json ? 0 : 0.2, num_ctx: 8192 } }, ms)
  return d.message?.content || ''
}

// a model downloaded, with its progress (Ollama sends a line of JSON at a time)
async function pull(cfg, model, onStep) {
  const r = await fetch(cfg.url + '/api/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: true }) })
  if (!r.ok || !r.body) throw new Error(`Ollama ${r.status}`)
  const dec = new TextDecoder()
  let buf = ''
  for await (const part of r.body) {
    buf += dec.decode(part, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1)
      if (!line.trim()) continue
      const d = JSON.parse(line)
      if (d.error) throw new Error(d.error)
      onStep?.({ model, status: d.status, done: d.completed || 0, total: d.total || 0 })
    }
  }
}

module.exports = { DEFAULTS, status, embed, chat, pull }
