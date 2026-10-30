# RoarMind

Ask your Mac in everyday words: *"Where is that PDF with the offers Giorgos sent me in March 2024?"* RoarMind finds
the file, the email, the screenshot or the note, shows the piece that matched, and answers in a sentence. Everything
stays on the Mac. An experiment of The Mad Lions Lab.

## How it works
- **Reads, in the background:** the folders you choose (Documents, Desktop, Downloads to begin with; a *Never read*
  list keeps folders out), the text of PDFs, Word, RTF, OpenDocument and plain text, the words in screenshots and
  pictures (the Mac's own text recognition), every message in Apple Mail with its sender, date and the text of its
  attached PDFs and documents, and every note in Notes. Only what is new or changed is read again, every half hour;
  what is gone leaves the index. It reads on battery too (waiting for the charger is a setting) and works at a low priority.
- **Understands the question:** the AI on the Mac turns it into filters (what kind, from whom in any spelling, Γιώργος
  = Giorgos = George, between which dates) and words for the content in Greek and English.
- **Finds by meaning and by words:** every piece of text has numbers from the AI (bge-m3, at home in Greek and
  English) and is in a keyword index that does not mind accents or case; both are weighed together. Without the AI it
  is a keyword search.
- **Answers:** a short answer from what was found (gemma3:4b), naming the items; each result opens in its app, in Mail
  or in Notes, or shows in the Finder.

## Private by design
The index is one file in the app's own folder on the Mac. The AI runs through [Ollama](https://ollama.com) on the
same Mac (when Ollama is installed but closed, RoarMind opens it in the background); RoarMind talks to nothing else (apart from looking for its own updates on GitHub, and Ask Claude, only when you press it: see below). *Erase everything* in
Settings deletes the index; files, mail and notes are never changed.

## Ask Claude (0.2.0)
Alex, 30 Oct: "can RoarMind work like you?". Under the answer of a search, **Ask Claude** sends the question and pieces
of the items found (never whole files, at most 8 items and 24,000 characters) to Claude, which thinks them through:
compares, adds up, notices what is missing, drafts a reply. Its answer names the items as [2]; a tap opens them. It
needs a RoarMe account (Settings > Claude, the same as RoarWriter and RoarList); the session is kept encrypted on the
Mac. The Edge Function `roarmind-ai` (supabase/functions/roarmind-ai) runs in RoarMe's Supabase project and holds the
Anthropic key. Without pressing it, nothing leaves the Mac.

## Needs
A Mac with Apple Silicon (M1 or later; 16 GB is comfortable), macOS 12 or later, Ollama (free) and its two models
(about 4 GB, downloaded from inside RoarMind). Full Disk Access for Mail, Automation for Notes: RoarMind says where.

## Layout
- `electron/engine/`: the index (db.js), text (text.js), Apple Mail (mail.js), extraction (extract.js), the AI
  (ollama.js), the reading (indexer.js), the search (search.js). `test/engine.test.js` runs them.
- `electron/worker.js` (the engine in its own process), `main.js`, `preload.js`, `updater.js`.
- `helper/main.swift`: PDF text and words in pictures, through the Mac's own frameworks.
- `app/`: the page (no build step). Opened in a browser, `app/demo.js` stands in for the Mac.

## Releases
Bump `version` in package.json and run the *RoarMind for Mac* workflow (or push a tag `v0.1.0`): it builds the helper
and the Apple Silicon and Intel apps onto a GitHub release; the app updates itself from there.
