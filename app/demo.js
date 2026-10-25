// Opened in a browser (no Mac app around it), a sample stands in for the Mac, so the page can be seen and tested.
// Nothing here touches a real file.
const day = (y, m, d) => new Date(y, m - 1, d, 10, 30).getTime()
const RESULTS = [
  { id: 1, kind: 'mail', ext: 'pdf', path: '/Users/alex/Library/Mail/V10/x/1.emlx', title: 'Προσφορές εξοπλισμού', sender: 'Γιώργος Παπαδόπουλος <gpap@rental.gr>', date: day(2024, 3, 12), extra: { attachments: ['prosfores_martios.pdf'] }, snippet: 'Καλησπέρα Alex, σου στέλνω τις προσφορές για τον εξοπλισμό του γυρίσματος: κάμερα, φακοί, φώτα. Attachment: prosfores_martios.pdf…' },
  { id: 2, kind: 'pdf', ext: 'pdf', path: '/Users/alex/Downloads/prosfores_martios.pdf', title: 'prosfores_martios.pdf', sender: '', date: day(2024, 3, 12), extra: {}, snippet: 'ΠΡΟΣΦΟΡΑ ΕΝΟΙΚΙΑΣΗΣ · ARRI Alexa Mini LF · Σετ Cooke S4 · 3 ημέρες…' },
  { id: 3, kind: 'image', ext: 'png', path: '/Users/alex/Desktop/Screenshot 2024-03-14 at 18.02.png', title: 'Screenshot 2024-03-14 at 18.02.png', sender: '', date: day(2024, 3, 14), extra: {}, snippet: 'Rental quote · Giorgos · total €2.960…' },
]
export function demoMind() {
  let settings = { folders: ['/Users/alex/Documents', '/Users/alex/Desktop', '/Users/alex/Downloads'], never: ['/Users/alex/Documents/Bank'], mail: true, notes: true, images: true, onlyOnPower: true, lang: 'en', ollama: { embed: 'bge-m3', chat: 'gemma3:4b' } }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  return {
    status: async () => ({ settings, ai: { running: true, embed: true, chat: true }, stats: { by: { pdf: 1840, doc: 3120, mail: 22410, image: 960, note: 214 }, waiting: 0, lastRun: { at: Date.now() - 600e3, counts: { read: 37 }, removed: 2, mail: 'ok', notes: 'ok' } } }),
    settings: async (s) => (settings = { ...settings, ...s }),
    index: async () => true, stop: async () => true, pull: async () => true, erase: async () => true,
    search: async () => { await wait(500); return { plan: { ai: true, terms: 'προσφορές offers quote', kinds: ['pdf', 'mail'], people: ['Γιώργος'], after: '2024-03-01', before: '2024-03-31' }, results: RESULTS } },
    answer: async () => { await wait(800); return 'Είναι το email του Γιώργου Παπαδόπουλου «Προσφορές εξοπλισμού» στις 12 Μαρτίου 2024, με συνημμένο το prosfores_martios.pdf [1]. Το ίδιο PDF είναι και στα Downloads [2].' },
    pick: async () => ['/Users/alex/Projects'], open: async () => true, reveal: async () => true,
    openSettings: async () => true, getOllama: async () => true,
  }
}
