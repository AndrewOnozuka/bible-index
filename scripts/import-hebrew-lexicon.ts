import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'data/raw/stepbible/Lexicons';
const file = fs.readdirSync(DIR).find((f) => f.startsWith('TBESH'));
if (!file) throw new Error(`No TBESH file found in ${DIR}`);

const db = new Database('db/bible-index.sqlite');
db.exec(`
CREATE TABLE IF NOT EXISTS lexicon (
  strongs TEXT PRIMARY KEY,
  lang TEXT, lemma TEXT, translit TEXT, pos TEXT, gloss TEXT, definition TEXT, source TEXT
);
`);

const ins = db.prepare(
  'INSERT OR REPLACE INTO lexicon (strongs, lang, lemma, translit, pos, gloss, definition, source) VALUES (?,?,?,?,?,?,?,?)'
);
const SOURCE =
  'TBESH, STEPBible.org, CC BY 4.0. Meanings from Abridged BDB (Online Bible): permission needed before public use.';

let n = 0, dupes = 0;
const seen = new Set<string>();
db.transaction(() => {
  db.prepare("DELETE FROM lexicon WHERE lang = 'heb'").run();
  const lines = fs.readFileSync(path.join(DIR, file), 'utf8').split('\n');
  for (const raw of lines) {
    const c = raw.replace(/\r$/, '').split('\t');
    // 0 eStrong, 1 dStrong (+ description), 2 uStrong, 3 Hebrew, 4 translit, 5 morph, 6 gloss, 7+ meaning
    if (c.length < 8 || !/^H\d{4,5}[A-Za-z]?$/.test(c[0].trim())) continue;
    const key = (/^(H\d{4,5}[A-Za-z]?)/.exec(c[1].trim()) ?? [c[0].trim()])[1];
    const def = c.slice(7).join('\t').trim();
    if (!def) continue;
    if (seen.has(key)) dupes++;
    seen.add(key);
    ins.run(key, 'heb', c[3].trim(), c[4].trim(), c[5].trim(), c[6].trim(), def, SOURCE);
    n++;
  }
})();

console.log(`Imported ${n} Hebrew lexicon entries (${dupes} duplicate keys) from ${file}.`);
