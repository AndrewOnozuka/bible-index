import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { BOOKS } from '../src/lib/books';
import { verseId } from '../src/lib/osis';

const SRC = 'data/raw/scrollmapper/formats/json';
const names = process.argv.slice(2);
if (!names.length) {
  console.error('Usage: npx tsx scripts/import-many.ts ASV NHEB ...');
  process.exit(1);
}

const db = new Database('db/bible-index.sqlite');
const known = new Set((db.prepare('SELECT id FROM verses').all() as { id: string }[]).map((r) => r.id));
const insText = db.prepare('INSERT OR REPLACE INTO verse_text (verse_id, translation, text) VALUES (?,?,?)');
const delText = db.prepare('DELETE FROM verse_text WHERE translation = ?');

for (const name of names) {
  try {
    const src = JSON.parse(fs.readFileSync(`${SRC}/${name}.json`, 'utf8'));
    const books = src.books;
    if (!Array.isArray(books) || books.length !== 66) {
      console.log(`SKIP ${name}: found ${books?.length} books, need 66`);
      continue;
    }

    const rows: { id: string; text: string }[] = [];
    const unknown: string[] = [];
    books.forEach((b: any, bi: number) => {
      b.chapters.forEach((c: any, ci: number) => {
        c.verses.forEach((v: any, vi: number) => {
          const id = verseId(BOOKS[bi][0], c.chapter ?? ci + 1, v.verse ?? vi + 1);
          const text = String(v.text ?? '').replace(/\s+/g, ' ').trim();
          if (!text) return;
          if (!known.has(id)) { unknown.push(id); return; }
          rows.push({ id, text });
        });
      });
    });

    db.transaction(() => {
      delText.run(name);
      for (const r of rows) insText.run(r.id, name, r.text);
    })();

    fs.writeFileSync(
      `data/manifests/${name}.tsv`,
      rows.map((r) => `${r.id}\t${createHash('sha256').update(r.text).digest('hex')}`).join('\n') + '\n'
    );

    const note = unknown.length ? `  | ${unknown.length} not in verse structure, e.g. ${unknown.slice(0, 3).join(', ')}` : '';
    console.log(`OK   ${name}: ${rows.length} verses, ${known.size - rows.length} missing${note}`);
  } catch (e: any) {
    console.log(`FAIL ${name}: ${e.message}`);
  }
}
