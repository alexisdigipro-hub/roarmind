// RoarMind's index: one SQLite file in the app's own folder on this Mac. better-sqlite3 inside the app (as RoarMail);
// Node's own node:sqlite where that is not there (the tests). Nothing here ever leaves the computer.
const fs = require('fs')
const path = require('path')

function open(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  let db
  try { const B = require('better-sqlite3'); db = new B(file) } catch { const { DatabaseSync } = require('node:sqlite'); db = new DatabaseSync(file) }
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY, key TEXT UNIQUE, kind TEXT, ext TEXT, path TEXT, title TEXT,
      sender TEXT, people TEXT, date INTEGER, size INTEGER, mtime INTEGER, extra TEXT, seen INTEGER
    );
    CREATE INDEX IF NOT EXISTS items_kind ON items(kind);
    CREATE INDEX IF NOT EXISTS items_date ON items(date);
    CREATE TABLE IF NOT EXISTS chunks (id INTEGER PRIMARY KEY, item INTEGER, n INTEGER, text TEXT, vec BLOB, scale REAL);
    CREATE INDEX IF NOT EXISTS chunks_item ON chunks(item);
    CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(body, title, people, tokenize = 'unicode61 remove_diacritics 2');
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
  `)
  return db
}

const tx = (db, fn) => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r } catch (e) { db.exec('ROLLBACK'); throw e } }
const getMeta = (db, k, d = null) => { const r = db.prepare('SELECT v FROM meta WHERE k = ?').get(k); return r ? JSON.parse(r.v) : d }
const setMeta = (db, k, v) => db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, JSON.stringify(v))

// an item and everything indexed for it, gone
function dropItem(db, id) {
  for (const c of db.prepare('SELECT id FROM chunks WHERE item = ?').all(id)) db.prepare('DELETE FROM fts WHERE rowid = ?').run(c.id)
  db.prepare('DELETE FROM chunks WHERE item = ?').run(id)
  db.prepare('DELETE FROM items WHERE id = ?').run(id)
}

module.exports = { open, tx, getMeta, setMeta, dropItem }
