// RoarMind's page: one question box, what the AI understood, its answer, and what was found, each with Open and
// Show in Finder; Settings for what it reads and the AI. Everything on the Mac goes through window.mind
// (electron/preload.js); opened in a browser, a sample stands in for it (demo.js), so the page can be seen and tested.
import { demoMind } from './demo.js'

const M = window.mind || demoMind()
// room at the left of the top row for the Mac's window buttons (Alex, 26 Oct: they sat on the wordmark)
if (window.mind) document.documentElement.classList.add('mac')

/* ---------- small helpers (as RoarTwin's) ---------- */
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else if (k === 'html') e.innerHTML = v
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? e.style.setProperty(sk, sv) : (e.style[sk] = sv)
    else e.setAttribute(k, v === true ? '' : v)
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)))
  return e
}
const I = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4"/><path d="M9.5 14h5M9.5 17h3"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4"/><path d="M9.5 12h5M9.5 15h5M9.5 18h3"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4.5 17.5 5-4.5 3.5 3 3-2.5 3.5 3"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></svg>',
  reveal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="m10 13 2 2 2-2M12 10v5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
}
const ico = (name) => h('span', { html: I[name], 'aria-hidden': 'true' })
const num = (n) => Number(n || 0).toLocaleString('en-US')
const store = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem('mind:' + k)); return v ?? d } catch { return d } }, set: (k, v) => { try { localStorage.setItem('mind:' + k, JSON.stringify(v)) } catch { /* private */ } } }
function toast(text) { const e = h('div', { class: 'toast' }, text); document.body.append(e); setTimeout(() => e.remove(), 3200) }
function seg(options, value, onPick) {
  const lens = h('span', { class: 'lens' })
  const box = h('div', { class: 'seg', role: 'radiogroup' }, lens, ...options.map(([v, label]) => h('button', { type: 'button', class: v === value ? 'on' : '', role: 'radio', 'aria-checked': String(v === value), onclick: () => onPick(v) }, label)))
  requestAnimationFrame(() => { const on = box.querySelector('button.on'); if (on) { lens.style.left = on.offsetLeft + 'px'; lens.style.width = on.offsetWidth + 'px' } })
  return box
}
const switchEl = (on, onFlip, label) => h('button', { type: 'button', class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), 'aria-label': label, onclick: () => onFlip(!on) })
const opt = (title, sub, control) => h('div', { class: 'opt' }, h('span', {}, h('b', {}, title), sub ? h('small', {}, sub) : null), control)

/* ---------- words: English, or Greek when chosen in Settings ---------- */
const EL = {
  'RoarMind has not read your Mac yet.': 'Το RoarMind δεν έχει διαβάσει ακόμα το Mac σου.',
  'Your Mac is on battery, and RoarMind reads on the charger. Put it on the charger, or read now.': 'Το Mac είναι στη μπαταρία, και το RoarMind διαβάζει στον φορτιστή. Βάλ\' το στον φορτιστή, ή διάβασε τώρα.',
  'Read now, on battery': 'Διάβασε τώρα, με μπαταρία',
  'Reading your Mac for the first time: {n} so far. Search finds more as it goes.': 'Διαβάζει το Mac σου για πρώτη φορά: {n} ως τώρα. Η αναζήτηση βρίσκει περισσότερα όσο προχωράει.',
  'It starts by itself in a moment, or now:': 'Ξεκινάει μόνο του σε λίγο, ή τώρα:',
  'Nothing is read yet, so nothing can be found.': 'Δεν έχει διαβαστεί τίποτα ακόμα, άρα δεν βρίσκεται τίποτα.',
  'Ask your <b>Mac</b>.': 'Ρώτα το <b>Mac</b> σου.',
  'Files, emails, screenshots and notes, found by what they say. Everything stays on this Mac.': 'Αρχεία, email, screenshots και σημειώσεις, βρίσκονται από αυτό που λένε. Όλα μένουν σε αυτό το Mac.',
  'Ask anything… e.g. the PDF with the offers Giorgos sent me in March 2024': 'Ρώτα ό,τι θες… π.χ. το PDF με τις προσφορές που μου έστειλε ο Γιώργος τον Μάρτιο του 2024',
  'The PDF with the offers Giorgos sent me in March 2024': 'Το PDF με τις προσφορές που μου έστειλε ο Γιώργος τον Μάρτιο του 2024',
  'Screenshots with an invoice': 'Screenshots με τιμολόγιο',
  'Notes about the next shoot': 'Σημειώσεις για το επόμενο γύρισμα',
  'Settings': 'Ρυθμίσεις', 'Back': 'Πίσω', 'Open': 'Άνοιγμα', 'Show in Finder': 'Εμφάνιση στο Finder', 'Open in Mail': 'Άνοιγμα στο Mail', 'Open in Notes': 'Άνοιγμα στις Σημειώσεις',
  'Answer': 'Απάντηση', 'Thinking': 'Σκέφτεται', 'Searching': 'Ψάχνει',
  'Nothing found. Try other words, or a wider period.': 'Δεν βρέθηκε τίποτα. Δοκίμασε άλλες λέξεις ή μεγαλύτερο διάστημα.',
  'PDF': 'PDF', 'Document': 'Έγγραφο', 'Email': 'Email', 'Picture': 'Εικόνα', 'Note': 'Σημείωση',
  'From: {n}': 'Από: {n}', 'Since {d}': 'Από {d}', 'Until {d}': 'Έως {d}', 'AI understood': 'Το AI κατάλαβε', 'Words only (the AI is off)': 'Μόνο λέξεις (το AI είναι κλειστό)',
  '{n} found': '{n} βρέθηκαν',
  'Reading… {n}': 'Διαβάζει… {n}', '{n} items': '{n} στοιχεία', 'Waiting for the charger': 'Περιμένει τον φορτιστή', 'Not read yet': 'Δεν έχει διαβάσει ακόμα',
  'The AI runs on this Mac through <b>Ollama</b>': 'Το AI τρέχει σε αυτό το Mac μέσω του <b>Ollama</b>',
  'Ollama is free. Install it once, open it, and come back: RoarMind finds it by itself. Until then RoarMind searches by words only.': 'Το Ollama είναι δωρεάν. Εγκατάστησέ το μία φορά, άνοιξέ το και γύρνα εδώ: το RoarMind το βρίσκει μόνο του. Ως τότε ψάχνει μόνο με λέξεις.',
  'Get Ollama': 'Κατέβασε το Ollama', 'Check again': 'Έλεγξε ξανά',
  'Download the AI (about 4 GB)': 'Κατέβασε το AI (περίπου 4 GB)',
  'Two models, once: one that understands Greek and English by meaning, one that answers.': 'Δύο μοντέλα, μία φορά: ένα που καταλαβαίνει ελληνικά και αγγλικά με νόημα, κι ένα που απαντάει.',
  'Downloading {m}': 'Κατεβαίνει το {m}',
  'What RoarMind reads': 'Τι διαβάζει το RoarMind', 'Folders': 'Φάκελοι', 'Add a folder…': 'Πρόσθεσε φάκελο…', 'Never read': 'Ποτέ αυτά',
  'Folders that stay out, whatever else is chosen (a bank, private papers).': 'Φάκελοι που μένουν έξω, ό,τι κι αν έχει διαλεχτεί (τράπεζα, προσωπικά).',
  'Mail': 'Mail', 'Every message in Apple Mail, with who sent it, when, and the text of PDFs and documents attached.': 'Κάθε μήνυμα στο Apple Mail, με αποστολέα, ημερομηνία και το κείμενο των PDF και εγγράφων που είναι συνημμένα.',
  'Needs Full Disk Access: System Settings > Privacy & Security > Full Disk Access > RoarMind on.': 'Θέλει Full Disk Access: Ρυθμίσεις Συστήματος > Απόρρητο & Ασφάλεια > Πλήρης πρόσβαση στον δίσκο > RoarMind ανοιχτό.',
  'Open the setting': 'Άνοιξε τη ρύθμιση',
  'Notes': 'Σημειώσεις', 'Every note in the Notes app (the Mac asks once to allow it).': 'Κάθε σημείωση στην εφαρμογή Σημειώσεις (το Mac ρωτάει μία φορά για άδεια).',
  'Notes said no: System Settings > Privacy & Security > Automation > RoarMind > Notes on.': 'Οι Σημειώσεις δεν το επέτρεψαν: Ρυθμίσεις Συστήματος > Απόρρητο & Ασφάλεια > Αυτοματισμός > RoarMind > Σημειώσεις ανοιχτό.',
  'Words in pictures': 'Κείμενο μέσα σε εικόνες', 'Screenshots, scans and photos of papers: their words are read by the Mac itself.': 'Screenshots, σκαναρίσματα και φωτογραφίες εγγράφων: τις λέξεις τους τις διαβάζει το ίδιο το Mac.',
  'Only on the charger': 'Μόνο στον φορτιστή', 'Reading waits while the Mac runs on its battery.': 'Το διάβασμα περιμένει όσο το Mac είναι στη μπαταρία.',
  'Language': 'Γλώσσα', 'The words of the app.': 'Η γλώσσα της εφαρμογής.',
  'The AI': 'Το AI', 'Model that finds by meaning': 'Μοντέλο που βρίσκει με νόημα', 'Model that answers': 'Μοντέλο που απαντάει',
  'Ollama runs, both models are here.': 'Το Ollama τρέχει, και τα δύο μοντέλα είναι εδώ.', 'Ollama runs; a model is missing.': 'Το Ollama τρέχει· λείπει μοντέλο.', 'Ollama is not running.': 'Το Ollama δεν τρέχει.',
  'The index': 'Το ευρετήριο', 'Read now': 'Διάβασε τώρα', 'Stop': 'Σταμάτα', 'Erase everything': 'Σβήσε τα πάντα',
  'Last read {d}: {n} new or changed, {r} gone.': 'Τελευταίο διάβασμα {d}: {n} νέα ή αλλαγμένα, {r} έφυγαν.',
  '{n} pieces still waiting for the AI.': '{n} κομμάτια περιμένουν ακόμα το AI.',
  'It reads again by itself every half hour; only what is new or changed.': 'Ξαναδιαβάζει μόνο του κάθε μισή ώρα· μόνο ό,τι είναι νέο ή αλλαγμένο.',
  'Erased. RoarMind reads everything again.': 'Σβήστηκε. Το RoarMind τα ξαναδιαβάζει όλα.',
  'Restart to update': 'Επανεκκίνηση για ενημέρωση', 'files': 'αρχεία', 'emails': 'email', 'pictures': 'εικόνες', 'notes': 'σημειώσεις', 'documents': 'έγγραφα', 'PDFs': 'PDF',
  "Ask Claude": "Ρώτα τον Claude",
  "Sends your question and pieces of the {n} items found to Claude, to think them through. Nothing else leaves the Mac.": "Στέλνει την ερώτησή σου και κομμάτια από τα {n} που βρέθηκαν στον Claude, για να τα σκεφτεί. Τίποτα άλλο δεν φεύγει από το Mac.",
  "Claude is thinking": "Ο Claude σκέφτεται",
  "Claude could not answer: {e}": "Ο Claude δεν μπόρεσε να απαντήσει: {e}",
  "Sent: your question and pieces of {n} items ({c} characters).": "Στάλθηκαν: η ερώτησή σου και κομμάτια από {n} ({c} χαρακτήρες).",
  "Ask again": "Ρώτα ξανά",
  "Ask Claude works in the Mac app.": "Το Ρώτα τον Claude δουλεύει στην εφαρμογή του Mac.",
  "Sign in with your RoarMe account to ask Claude.": "Συνδέσου με τον λογαριασμό σου RoarMe για να ρωτάς τον Claude.",
  "Searching always stays on this Mac. Only when you press Ask Claude, your question and pieces of the items found go to Claude (Anthropic), through The Mad Lions' server; never whole files, nothing else.": "Το ψάξιμο μένει πάντα σε αυτό το Mac. Μόνο όταν πατάς Ρώτα τον Claude, η ερώτησή σου και κομμάτια από ό,τι βρέθηκε πάνε στον Claude (Anthropic), μέσω του server των The Mad Lions· ποτέ ολόκληρα αρχεία, τίποτα άλλο.",
  "Signed in as {e}.": "Συνδεδεμένος ως {e}.",
  "Sign out": "Αποσύνδεση",
  "Password": "Κωδικός",
  "Sign in": "Σύνδεση",
  "Signed in. Ask Claude is ready.": "Συνδέθηκες. Το Ρώτα τον Claude είναι έτοιμο.",
  "Could not sign in: {e}": "Δεν έγινε σύνδεση: {e}",
  "Sign in with your RoarMe account (the same as RoarWriter and RoarList) to ask Claude.": "Συνδέσου με τον λογαριασμό σου RoarMe (τον ίδιο με το RoarWriter και το RoarList) για να ρωτάς τον Claude."
}
const t = (s, vars) => { let o = (S.settings?.lang === 'el' && EL[s]) || s; if (vars) o = o.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''); return o }
const dateOf = (ms) => (ms ? new Date(ms).toLocaleDateString(S.settings?.lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/* ---------- state ---------- */
const S = { view: 'home', q: store.get('q', ''), res: null, answer: null, claude: { signedIn: false, email: '' }, claudeAns: null, busy: false, settings: null, ai: null, stats: null, pulling: null, progress: null, update: null }
const app = document.getElementById('app')
// the state from the engine; quiet = only the top row and the AI card change (never the box being typed in)
async function refresh(quiet = false) {
  try { const s = await M.status(); S.settings = s.settings; S.ai = s.ai; S.stats = s.stats; S.pulling = s.pulling || S.pulling } catch { /* the engine is starting */ }
  if (quiet) { drawTop(); drawSetup() } else draw()
}
M.onProgress?.((p) => { const was = !!S.progress; S.progress = p; if (!indexedCount() && was !== !!p && S.view !== 'settings') draw(); else drawTop() })
M.onPull?.((p) => { S.pulling = p?.done || p?.error ? null : p; if (p?.error) toast(p.error); if (p?.done) refresh(); else drawSetup() })
M.update?.state?.().then((u) => { S.update = u; drawTop() })
M.update?.on?.((u) => { S.update = u; drawTop() })
M.onMenu?.((cmd) => { if (cmd === 'new') { S.view = 'home'; S.res = null; S.q = ''; draw(); focusAsk() } if (cmd === 'settings') { S.view = 'settings'; draw() } })

/* ---------- the top row ---------- */
let topEl = null
function drawTop() {
  if (!topEl) return
  const p = S.progress, st = S.stats
  const total = st ? Object.values(st.by || {}).reduce((a, n) => a + n, 0) : 0
  const status = p ? (p.stage === 'battery' ? t('Waiting for the charger') : t('Reading… {n}', { n: p.stage === 'embed' ? `${num(p.done)} / ${num(p.total)}` : num(p.done || 0) }))
    : total ? t('{n} items', { n: num(total) }) : t('Not read yet')
  topEl.replaceChildren(...[
    h('div', { class: 'wm' }, h('span', {}, 'ROAR'), h('b', {}, 'MIND')),
    h('div', { class: 'spacer' }),
    S.update?.status === 'ready' ? h('button', { class: 'btn', onclick: () => M.update.install() }, t('Restart to update')) : null,
    h('span', { class: 'chip status-chip', title: t('The index'), onclick: () => { S.view = 'settings'; draw() } }, h('i', { style: { background: p ? 'var(--warn)' : 'var(--ok)' } }), status),
    S.view === 'settings'
      ? h('button', { class: 'btn', onclick: () => { S.view = S.res ? 'results' : 'home'; draw() } }, ico('back'), t('Back'))
      : h('button', { class: 'ib', title: t('Settings'), 'aria-label': t('Settings'), html: I.gear, onclick: () => { S.view = 'settings'; draw() } }),
  ].filter(Boolean))
}

function draw() {
  topEl = h('header', { class: 'top' })
  const body = S.view === 'settings' ? viewSettings() : S.view === 'results' ? viewResults() : viewHome()
  app.replaceChildren(topEl, body)
  drawTop()
}
const focusAsk = () => requestAnimationFrame(() => document.querySelector('.ask')?.focus())

/* ---------- asking ---------- */
function askBox() {
  const input = h('input', { class: 'ask', type: 'search', value: S.q, placeholder: t('Ask anything… e.g. the PDF with the offers Giorgos sent me in March 2024'), autocomplete: 'off', spellcheck: 'false',
    onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) go(e.target.value.trim()) } })
  return h('div', { class: 'search-wrap' }, h('span', { html: I.search }), input)
}
async function go(q) {
  S.q = q; store.set('q', q); S.view = 'results'; S.res = null; S.answer = null; S.claudeAns = null; S.busy = true; draw()
  try {
    S.res = await M.search({ q, ai: true })
  } catch (e) { S.res = { plan: {}, results: [] }; toast(String(e?.message || e)) }
  S.busy = false
  // an answer only when the AI that answers is there and something was found
  if (S.res.plan?.ai && S.res.results.length) { S.answer = '…'; draw(); M.answer({ q, results: S.res.results.slice(0, 6) }).then((a) => { if (S.q === q) { S.answer = a; draw() } }).catch(() => { S.answer = null; draw() }) } else draw()
}

/* ---------- Ask Claude (Alex, 30 Oct: "RoarMind like you", option 2) ----------
   Only when pressed: the question and the pieces of the items found go to Claude (electron/claude.js); the search
   itself never leaves the Mac. The answer names the items as [2]; a tap on [2] opens it. */
const CLAUDE_ITEMS = 8
M.claude?.state().then((c) => { S.claude = c; if (S.view === 'settings') draw() })
async function askClaude() {
  const q = S.q, found = (S.res?.results || []).slice(0, CLAUDE_ITEMS)
  if (!M.claude) return toast(t('Ask Claude works in the Mac app.'))
  if (!S.claude.signedIn) { S.view = 'settings'; S.claudeFocus = true; draw(); return toast(t('Sign in with your RoarMe account to ask Claude.')) }
  S.claudeAns = { busy: true, found }; draw()
  const r = await M.claude.ask(q, found.map((x) => x.id))
  if (S.q !== q) return
  if (r.ok) S.claudeAns = { text: r.answer, sent: r.sent, found: r.ids ? r.ids.map((id) => found.find((x) => String(x.id) === String(id))).filter(Boolean) : found }
  else if (r.signin) { S.claude = { signedIn: false, email: '' }; S.claudeAns = null; S.view = 'settings'; S.claudeFocus = true; toast(t('Sign in with your RoarMe account to ask Claude.')) }
  else S.claudeAns = { error: r.error, found }
  draw()
}
// Claude's text, with [2] made into a link to the second item found
function claudeText(text, found) {
  return h('div', { class: 'claude-text' }, ...String(text).split('\n').map((line) => h('p', {}, ...line.split(/(\[\d+\])/).map((part) => {
    const m = /^\[(\d+)\]$/.exec(part)
    const it = m && found[+m[1] - 1]
    return it ? h('button', { class: 'cite', title: it.title, onclick: () => M.open(it.id) }, `[${m[1]}]`) : part
  }))))
}
function claudeEl() {
  const r = S.res
  if (!r || !r.results.length) return null
  const a = S.claudeAns
  const n = Math.min(CLAUDE_ITEMS, r.results.length)
  if (!a) return h('section', { class: 'panel claude-ask' },
    h('button', { class: 'btn main', onclick: askClaude }, ico('spark'), t('Ask Claude')),
    h('small', { class: 'muted' }, t('Sends your question and pieces of the {n} items found to Claude, to think them through. Nothing else leaves the Mac.', { n })))
  return h('section', { class: 'panel answer claude' },
    h('b', { class: 'lbl' }, ico('spark'), 'Claude'),
    a.busy ? h('p', { class: 'dots' }, t('Claude is thinking')) : a.error ? h('p', { class: 'warn-line' }, t('Claude could not answer: {e}', { e: a.error })) : claudeText(a.text, a.found),
    a.sent ? h('small', { class: 'muted' }, t('Sent: your question and pieces of {n} items ({c} characters).', { n: a.sent.items, c: num(a.sent.chars) })) : null,
    !a.busy ? h('div', { class: 'row' }, h('button', { class: 'btn', onclick: askClaude }, t('Ask again'))) : null)
}

/* ---------- the first screen ---------- */
function viewHome() {
  const ex = ['The PDF with the offers Giorgos sent me in March 2024', 'Screenshots with an invoice', 'Notes about the next shoot']
  focusAsk()
  return h('main', {}, h('div', { class: 'home' }, h('div', { class: 'card' },
    h('div', { class: 'hero' }, h('h1', { html: t('Ask your <b>Mac</b>.') }), h('p', {}, t('Files, emails, screenshots and notes, found by what they say. Everything stays on this Mac.'))),
    setupEl(),
    firstReadEl(),
    askBox(),
    h('div', { class: 'examples' }, ...ex.map((x) => h('span', { class: 'chip', onclick: () => go(t(x)) }, t(x)))))))
}

// before the first reading: why nothing is found yet, and a way to start now (Alex, 26 Oct: "it doesn't work")
const indexedCount = () => Object.values(S.stats?.by || {}).reduce((a, n) => a + n, 0)
function firstReadEl() {
  if (!S.stats || indexedCount() > 0) return null
  const p = S.progress
  if (p && p.stage !== 'battery') return h('section', { class: 'panel setup' }, h('p', {}, t('Reading your Mac for the first time: {n} so far. Search finds more as it goes.', { n: num(p.done || 0) })))
  return h('section', { class: 'panel setup' },
    h('h3', {}, t('RoarMind has not read your Mac yet.')),
    h('p', {}, p?.stage === 'battery' ? t('Your Mac is on battery, and RoarMind reads on the charger. Put it on the charger, or read now.') : t('It starts by itself in a moment, or now:')),
    h('div', { class: 'row' }, h('button', { class: 'btn main', onclick: () => { M.index({ force: true }); S.progress = { stage: 'files', done: 0 }; draw() } }, p?.stage === 'battery' ? t('Read now, on battery') : t('Read now'))))
}
// when the AI is not ready: what to do, one step
let setupBox = null
function setupEl() {
  setupBox = h('div')
  drawSetup()
  return setupBox
}
function drawSetup() {
  if (!setupBox) return
  const ai = S.ai
  let el = null
  if (ai && !ai.running) {
    el = h('section', { class: 'panel setup' }, h('h3', { html: t('The AI runs on this Mac through <b>Ollama</b>') }), h('p', {}, t('Ollama is free. Install it once, open it, and come back: RoarMind finds it by itself. Until then RoarMind searches by words only.')),
      h('div', { class: 'row' }, h('button', { class: 'btn main', onclick: () => M.getOllama() }, t('Get Ollama')), h('button', { class: 'btn', onclick: () => refresh() }, t('Check again'))))
  } else if (ai && (!ai.embed || !ai.chat)) {
    const p = S.pulling
    el = h('section', { class: 'panel setup' }, h('h3', {}, t('Download the AI (about 4 GB)')), h('p', {}, t('Two models, once: one that understands Greek and English by meaning, one that answers.')),
      p ? h('div', { class: 'setup' }, h('small', { class: 'muted' }, t('Downloading {m}', { m: p.model || '' }) + (p.total ? ` · ${Math.round((p.done / p.total) * 100)}%` : '')), h('div', { class: 'bar' }, h('i', { style: { width: (p.total ? (p.done / p.total) * 100 : 5) + '%' } })))
        : h('div', { class: 'row' }, h('button', { class: 'btn main', onclick: () => { S.pulling = { model: '' }; M.pull(); drawSetup() } }, t('Download the AI (about 4 GB)'))))
  }
  setupBox.replaceChildren(...(el ? [el] : []))
}

/* ---------- what was found ---------- */
const KIND = { pdf: ['pdf', 'PDF', '#ff6b5e'], doc: ['doc', 'Document', '#64d2ff'], mail: ['mail', 'Email', '#ffb224'], image: ['image', 'Picture', '#bf5af2'], note: ['note', 'Note', '#32d74b'] }
function mark(text, terms) {
  const words = String(terms || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2)
  const plain = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  const out = h('div', { class: 'snip' })
  // each word of the text, highlighted when it starts with a word of the question
  for (const part of String(text).split(/([\p{L}\p{N}]+)/u)) {
    const hit = part && words.some((w) => plain(part).startsWith(w.slice(0, Math.max(3, w.length - 2))))
    out.append(hit ? h('mark', {}, part) : document.createTextNode(part))
  }
  return out
}
function hitEl(r, terms) {
  const [icon, label, c] = KIND[r.kind] || KIND.doc
  const sub = r.kind === 'mail' ? r.sender : r.kind === 'note' ? t('Notes') : r.path.replace(/\/[^/]*$/, '')
  return h('article', { class: 'hit', style: { '--c': c } },
    h('div', { class: 'k', html: I[icon] }),
    h('div', { style: { minWidth: 0 } },
      h('div', { class: 't', title: r.title }, r.title),
      h('div', { class: 's', title: sub }, sub),
      r.snippet ? mark(r.snippet, terms) : null,
      h('div', { class: 'meta' },
        h('span', { class: 'chip tint', style: { '--c': c } }, h('i'), t(label)),
        r.date ? h('span', { class: 'chip' }, dateOf(r.date)) : null,
        ...(r.extra?.attachments || []).slice(0, 4).map((a) => h('span', { class: 'chip', title: a }, a)))),
    h('div', { class: 'acts' },
      h('button', { class: 'ib sm', title: r.kind === 'mail' ? t('Open in Mail') : r.kind === 'note' ? t('Open in Notes') : t('Open'), html: I.open, onclick: () => M.open(r.id) }),
      r.kind !== 'note' ? h('button', { class: 'ib sm', title: t('Show in Finder'), html: I.reveal, onclick: () => M.reveal(r.id) }) : null))
}
function planChips(p) {
  if (!p) return []
  const c = []
  c.push(h('span', { class: 'chip tint', style: { '--c': p.ai ? 'var(--ok)' : 'var(--dim)' } }, h('i'), p.ai ? t('AI understood') : t('Words only (the AI is off)')))
  for (const k of p.kinds || []) c.push(h('span', { class: 'chip' }, t(KIND[k]?.[1] || k)))
  if (p.people?.length) c.push(h('span', { class: 'chip' }, t('From: {n}', { n: p.people[0] })))
  if (p.after) c.push(h('span', { class: 'chip' }, t('Since {d}', { d: dateOf(Date.parse(p.after)) })))
  if (p.before) c.push(h('span', { class: 'chip' }, t('Until {d}', { d: dateOf(Date.parse(p.before)) })))
  return c
}
function viewResults() {
  const r = S.res
  return h('main', {}, h('div', { class: 'res' },
    askBox(),
    S.busy ? h('div', { class: 'empty dots' }, t('Searching')) : null,
    r ? h('div', { class: 'sum' }, ...planChips(r.plan), h('span', { class: 'chip' }, t('{n} found', { n: num(r.results.length) }))) : null,
    S.answer ? h('section', { class: 'panel answer' }, h('b', { class: 'lbl' }, t('Answer')), S.answer === '…' ? h('p', { class: 'dots' }, t('Thinking')) : h('p', {}, S.answer)) : null,
    !S.busy ? claudeEl() : null,
    r && !r.results.length && !S.busy ? (indexedCount() ? h('div', { class: 'empty' }, t('Nothing found. Try other words, or a wider period.')) : firstReadEl() || h('div', { class: 'empty' }, t('Nothing is read yet, so nothing can be found.'))) : null,
    ...(r ? r.results.map((x) => hitEl(x, r.plan?.terms || S.q)) : [])))
}

/* ---------- Settings ---------- */
function viewSettings() {
  const s = S.settings || {}
  const st = S.stats || {}
  const save = async (patch) => { S.settings = await M.settings(patch); draw() }
  const pathChip = (p, onX) => h('span', { class: 'root', title: p }, ico('folder'), h('span', {}, p), h('button', { 'aria-label': 'Remove', html: I.x, onclick: onX }))
  const addTo = async (k) => { const add = (await M.pick()).filter((p) => !(s[k] || []).includes(p)); if (add.length) save({ [k]: [...(s[k] || []), ...add] }) }
  const lr = st.lastRun
  const by = st.by || {}
  const ai = S.ai || {}
  return h('main', {}, h('div', { class: 'sets' },
    h('h2', {}, t('What RoarMind reads')),
    h('section', { class: 'panel setup' },
      h('b', {}, t('Folders')),
      h('div', { class: 'paths' }, ...(s.folders || []).map((p) => pathChip(p, () => save({ folders: s.folders.filter((x) => x !== p) }))), h('button', { class: 'btn', onclick: () => addTo('folders') }, ico('plus'), t('Add a folder…'))),
      h('b', {}, t('Never read')), h('small', { class: 'muted' }, t('Folders that stay out, whatever else is chosen (a bank, private papers).')),
      h('div', { class: 'paths' }, ...(s.never || []).map((p) => pathChip(p, () => save({ never: s.never.filter((x) => x !== p) }))), h('button', { class: 'btn', onclick: () => addTo('never') }, ico('plus'), t('Add a folder…')))),
    h('section', { class: 'opts' },
      opt(t('Mail'), t('Every message in Apple Mail, with who sent it, when, and the text of PDFs and documents attached.'), switchEl(!!s.mail, (v) => save({ mail: v }), t('Mail'))),
      s.mail && (st.mailState === 'blocked' || lr?.mail === 'blocked') ? h('div', { class: 'row' }, h('span', { class: 'warn-line' }, t('Needs Full Disk Access: System Settings > Privacy & Security > Full Disk Access > RoarMind on.')), h('button', { class: 'btn', onclick: () => M.openSettings('disk') }, t('Open the setting'))) : null,
      opt(t('Notes'), t('Every note in the Notes app (the Mac asks once to allow it).'), switchEl(!!s.notes, (v) => save({ notes: v }), t('Notes'))),
      s.notes && lr?.notes === 'blocked' ? h('div', { class: 'row' }, h('span', { class: 'warn-line' }, t('Notes said no: System Settings > Privacy & Security > Automation > RoarMind > Notes on.')), h('button', { class: 'btn', onclick: () => M.openSettings('automation') }, t('Open the setting'))) : null,
      opt(t('Words in pictures'), t('Screenshots, scans and photos of papers: their words are read by the Mac itself.'), switchEl(!!s.images, (v) => save({ images: v }), t('Words in pictures'))),
      opt(t('Only on the charger'), t('Reading waits while the Mac runs on its battery.'), switchEl(!!s.onlyOnPower, (v) => save({ onlyOnPower: v }), t('Only on the charger'))),
      opt(t('Language'), t('The words of the app.'), seg([['en', 'English'], ['el', 'Ελληνικά']], s.lang || 'en', (v) => save({ lang: v })))),
    h('h2', {}, t('The AI')),
    h('section', { class: 'panel setup' },
      h('p', {}, !ai.running ? t('Ollama is not running.') : ai.embed && ai.chat ? t('Ollama runs, both models are here.') : t('Ollama runs; a model is missing.')),
      h('div', { class: 'two' },
        h('label', { class: 'nf' }, h('small', {}, t('Model that finds by meaning')), h('input', { value: s.ollama?.embed || '', onchange: (e) => save({ ollama: { ...s.ollama, embed: e.target.value.trim() } }) })),
        h('label', { class: 'nf' }, h('small', {}, t('Model that answers')), h('input', { value: s.ollama?.chat || '', onchange: (e) => save({ ollama: { ...s.ollama, chat: e.target.value.trim() } }) }))),
      setupEl()),
    h('h2', {}, 'Claude'),
    claudeSettings(),
    h('h2', {}, t('The index')),
    h('section', { class: 'panel setup' },
      h('div', { class: 'counts' },
        h('span', { class: 'chip' }, `${num(by.pdf)} ${t('PDFs')}`), h('span', { class: 'chip' }, `${num(by.doc)} ${t('documents')}`), h('span', { class: 'chip' }, `${num(by.mail)} ${t('emails')}`),
        h('span', { class: 'chip' }, `${num(by.image)} ${t('pictures')}`), h('span', { class: 'chip' }, `${num(by.note)} ${t('notes')}`)),
      lr ? h('small', { class: 'muted' }, t('Last read {d}: {n} new or changed, {r} gone.', { d: dateOf(lr.at) + ' ' + new Date(lr.at).toLocaleTimeString(s.lang === 'el' ? 'el-GR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }), n: num(lr.counts?.read), r: num(lr.removed) })) : null,
      st.waiting ? h('small', { class: 'muted' }, t('{n} pieces still waiting for the AI.', { n: num(st.waiting) })) : null,
      h('small', { class: 'muted' }, t('It reads again by itself every half hour; only what is new or changed.')),
      h('div', { class: 'row' },
        S.progress ? h('button', { class: 'btn', onclick: () => M.stop() }, t('Stop')) : h('button', { class: 'btn main', onclick: () => { M.index(); toast(t('Reading… {n}', { n: '' })) } }, t('Read now')),
        h('button', { class: 'btn', onclick: async () => { if (await M.erase()) { toast(t('Erased. RoarMind reads everything again.')); refresh() } } }, t('Erase everything'))))))
}

// Settings > Claude: the RoarMe account Ask Claude uses, and what goes to Claude
function claudeSettings() {
  const c = S.claude
  const why = h('small', { class: 'muted' }, t('Searching always stays on this Mac. Only when you press Ask Claude, your question and pieces of the items found go to Claude (Anthropic), through The Mad Lions\' server; never whole files, nothing else.'))
  if (!M.claude) return h('section', { class: 'panel setup' }, why, h('small', { class: 'muted' }, t('Ask Claude works in the Mac app.')))
  if (c.signedIn) return h('section', { class: 'panel setup' }, h('p', {}, t('Signed in as {e}.', { e: c.email || '…' })), why,
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { S.claude = await M.claude.signOut(); S.claudeAns = null; draw() } }, t('Sign out'))))
  const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'username', value: '' })
  const pass = h('input', { type: 'password', placeholder: t('Password'), autocomplete: 'current-password' })
  const go = async () => {
    const r = await M.claude.signIn(email.value, pass.value)
    if (r.ok) { S.claude = { signedIn: true, email: r.email }; toast(t('Signed in. Ask Claude is ready.')); if (S.res) S.view = 'results'; draw() }
    else toast(t('Could not sign in: {e}', { e: r.error }))
  }
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') go() })
  if (S.claudeFocus) { S.claudeFocus = false; requestAnimationFrame(() => email.focus()) }
  return h('section', { class: 'panel setup' }, h('p', {}, t('Sign in with your RoarMe account (the same as RoarWriter and RoarList) to ask Claude.')),
    h('div', { class: 'two' }, h('label', { class: 'nf' }, h('small', {}, 'Email'), email), h('label', { class: 'nf' }, h('small', {}, t('Password')), pass)),
    h('div', { class: 'row' }, h('button', { class: 'btn main', onclick: go }, t('Sign in'))), why)
}

refresh()
setInterval(() => refresh(true), 15e3)
