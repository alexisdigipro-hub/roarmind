// Ask Claude (Alex, 30 Oct: "can RoarMind work like you?", option 2). The one place RoarMind talks to the internet
// besides the updater, and only when the person asks: a RoarMe account signs in (RoarMe's Supabase project, as
// RoarWriter), and the question with the pieces of text found for it goes to the Edge Function roarmind-ai, which asks
// Claude. The session is kept on this Mac, encrypted by the system's keychain (safeStorage). The publishable key is
// public by design; the Anthropic key lives only in the Edge Function.
const { app, net, safeStorage } = require('electron')
const fs = require('fs')
const path = require('path')

const SB_URL = 'https://bzmjhbnwhdwmncxkqkdl.supabase.co'
const SB_KEY = 'sb_publishable_7mQ3e0NH5lCmdoIKx2-FUA_EgCoXx9X'
const file = () => path.join(app.getPath('userData'), 'claude-session.bin')

let session = null
function load() {
  if (session) return session
  try {
    const raw = fs.readFileSync(file())
    session = JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8'))
  } catch { session = null }
  return session
}
function keep(s) {
  session = s && s.access_token ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), email: s.user?.email || session?.email || '' } : null
  try {
    if (!session) fs.rmSync(file(), { force: true })
    else fs.writeFileSync(file(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(JSON.stringify(session)) : JSON.stringify(session), { mode: 0o600 })
  } catch { /* kept in memory for this run */ }
}

async function call(p, { method = 'POST', body, token } = {}) {
  const res = await net.fetch(SB_URL + p, {
    method,
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error_description || data.msg || data.error || `HTTP ${res.status}`), { status: res.status })
  return data
}

async function token() {
  const s = load()
  if (!s) return null
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token
  try { keep(await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token } })); return session.access_token }
  catch (e) { if (e.status === 400 || e.status === 401) keep(null); throw e }
}

const state = () => { const s = load(); return { signedIn: !!s, email: s?.email || '' } }
async function signIn(email, password) {
  keep(await call('/auth/v1/token?grant_type=password', { body: { email: String(email || '').trim(), password: String(password || '') } }))
  return state()
}
async function signOut() {
  const s = load()
  try { if (s) await call('/auth/v1/logout', { token: s.access_token }) } catch { /* gone anyway */ }
  keep(null)
  return state()
}

// the question and the pieces found go to Claude; the answer comes back as text
async function ask(question, items) {
  const t = await token()
  if (!t) throw Object.assign(new Error('signin'), { signin: true })
  try {
    const r = await call('/functions/v1/roarmind-ai', { token: t, body: { question, items } })
    return r.answer || ''
  } catch (e) {
    if (e.status === 401) { keep(null); throw Object.assign(new Error('signin'), { signin: true }) }
    throw e
  }
}

module.exports = { state, signIn, signOut, ask }
