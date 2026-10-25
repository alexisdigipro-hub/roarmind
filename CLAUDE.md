# RoarMind · instructions for Claude Code

RoarMind is a Mac app: ask your Mac in everyday words and it finds the file, the email, the screenshot or the note,
with everything kept on the Mac. The Mad Lions Lab (Alex Konstantinidis, film director, Athens; not a developer). Talk
to him in Greek, friendly and concrete, no em dashes; the app's own text is English by default, with Greek as a choice
(app.js: `t()` and the `EL` table, the English text as the key; every new text goes through `t()` and gets its Greek).

- Electron app, Mac only (Apple Silicon and Intel). `app/` is the page (plain HTML, CSS, ES modules, no build step);
  `electron/main.js` the shell; `electron/worker.js` the engine in a utilityProcess at a low priority; `electron/engine/`
  the engine (plain Node, tested by `node test/engine.test.js` with a stand-in Ollama). Change it only with the test passing.
- Privacy is the point: nothing leaves the Mac. The index is SQLite in the app's user data folder (better-sqlite3 in the
  app, node:sqlite in the tests); the AI is Ollama on 127.0.0.1 (bge-m3 for meaning, gemma3:4b for answers, both
  changeable in Settings). Never add a network call to anywhere else (the updater's GitHub check aside).
- `helper/main.swift`: PDF text (PDFKit) and the words in pictures (Vision), built universal in CI (`npm run helper`,
  macOS only) and shipped as Resources/roarmind-helper; `selftest` proves it on the CI Mac.
- Sources: folders chosen in Settings (and a Never list), Apple Mail's .emlx (Full Disk Access), Notes through
  osascript (Automation). Only what is new or changed is read again; what is gone leaves the index.
- Look: the Roar family's dark glass, as RoarTwin (accent #ff453a).
- Releases: bump `version` in package.json, run the RoarMind for Mac workflow (or push a tag `vX.Y.Z`); the release's
  files are the download links and what electron/updater.js looks at.
- Work on a branch, open a PR, wait for the green check (.github/workflows/check.yml), merge it yourself.
