// RoarMind's Ask Claude (Edge Function roarmind-ai, in RoarMe's Supabase project, beside roarwriter-ai). Alex, 30 Oct:
// "can RoarMind work like you?" (option 2). The search always happens on the Mac; only when the person presses Ask
// Claude, the app sends the question and the pieces of text it found for it (never whole files, never anything else),
// and this asks Claude to think over them. Only a signed-in RoarMe account may ask. The Anthropic API key is the
// project's secret ANTHROPIC_API_KEY (Supabase > Edge Functions > Secrets, already set for RoarWriter), never in the app.
import Anthropic from 'npm:@anthropic-ai/sdk'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const SYSTEM = `You are RoarMind, the assistant inside a Mac app that finds a person's own files, emails, screenshots and notes. The person is a film director and producer in Athens; their material is in Greek and English.
The app has already searched the Mac and gives you the items it found for the question, numbered [1], [2]…, each with pieces of its text (not the whole file).

How to answer:
- Answer in the language of the question (Greek questions in natural modern Greek).
- Work only from the items given. Never invent a file, a date, an amount or a name. If they do not hold the answer, say so plainly and say what to search for instead.
- Cite the items you use by their number, like [2], right where you use them.
- Think it through like a sharp assistant: compare, sum up, put in order, notice what is missing or contradictory (two different amounts, a later version, a date that does not fit).
- When asked to draft something (a reply to an email, a summary for someone, a list), write it ready to use.
- Be concise: a short answer first, then the details that matter. Plain text; short lists with "- " are fine; no markdown headings, no tables.`

async function ask(user: string){
  const msg = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  } as any)
  if (msg.stop_reason === 'refusal') throw Object.assign(new Error('refusal'), { refusal: true })
  return msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim()
}

const KIND: Record<string, string> = { pdf: 'PDF', doc: 'Document', mail: 'Email', image: 'Picture (text read from it)', note: 'Note' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405)
  try {
    // a signed-in RoarMe account, checked with Supabase Auth
    const auth = req.headers.get('Authorization') || ''
    const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { Authorization: auth, apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' } })
    if (!who.ok) return reply({ error: 'signin' }, 401)

    const b = await req.json().catch(() => ({}))
    const question = String(b.question || '').trim().slice(0, 2000)
    if (!question) return reply({ error: 'Write the question first.' }, 400)
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 12)
    let budget = 30000
    const found = items.map((it: any, i: number) => {
      const text = String(it.text || '').slice(0, Math.max(0, Math.min(4000, budget)))
      budget -= text.length
      const head = [`[${i + 1}] ${KIND[it.kind] || 'File'}: ${String(it.title || '').slice(0, 300)}`,
        it.sender ? `from ${String(it.sender).slice(0, 200)}` : '', it.date ? `dated ${String(it.date).slice(0, 10)}` : ''].filter(Boolean).join(', ')
      return `${head}\n${text}`
    }).join('\n\n')
    const today = new Date().toISOString().slice(0, 10)
    const user = `Today is ${today}.\nQuestion: ${question}\n\n${found ? `What the Mac found:\n\n${found}` : 'The Mac found nothing for this question.'}`
    return reply({ answer: await ask(user) })
  } catch (e) {
    if ((e as any)?.refusal) return reply({ error: 'Claude would not answer this one.' }, 422)
    return reply({ error: 'Claude could not answer just now. Try again in a moment.' }, 502)
  }
})
