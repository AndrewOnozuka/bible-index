import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { BOOKS } from '../src/lib/books';
import { verseId } from '../src/lib/osis';

const [file, translation] = process.argv.slice(2);
if (!file || !translation) {
  console.error('Usage: npx tsx scripts/import-text.ts <file.json> <TRANSLATION>');
  process.exit(1);
}

const db = new Database('db/bible-index.sqlite');
db.exec(fs.readFileSync('scripts/schema.sql', 'utf8'));

const src = JSON.parse(fs.readFileSync(file, 'utf8'));
const books = src.books;
if (!Array.isArray(books) || books.length !== 66) {
  throw new Error(`Expected 66 books in order, got ${books?.length}. Check the file's shape.`);
}

const insVerse = db.prepare('INSERT OR IGNORE INTO verses (id, book, chapter, verse, sort) VALUES (?,?,?,?,?)');
const insText = db.prepare('INSERT OR REPLACE INTO verse_text (verse_id, translation, text) VALUES (?,?,?)');
const manifest: string[] = [];
let sort = 0;

db.transaction(() => {
  db.prepare('DELETE FROM verse_text WHERE translation = ?').run(translation);
  books.forEach((b: any, bi: number) => {
    const osis = BOOKS[bi][0];
    b.chapters.forEach((c: any, ci: number) => {
      c.verses.forEach((v: any, vi: number) => {
        const ch = c.chapter ?? ci + 1;
        const vs = v.verse ?? vi + 1;
        const id = verseId(osis, ch, vs);
        const text = String(v.text).replace(/\s+/g, ' ').trim();
        insVerse.run(id, osis, ch, vs, sort++);
        insText.run(id, translation, text);
        manifest.push(`${id}\t${createHash('sha256').update(text).digest('hex')}`);
      });
    });
  });
})();

fs.writeFileSync(`data/manifests/${translation}.tsv`, manifest.join('\n') + '\n');
const n = db.prepare('SELECT COUNT(*) n FROM verse_text WHERE translation = ?').get(translation) as any;
console.log(`Imported ${n.n} verses for ${translation}. Manifest written.`);
