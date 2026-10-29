import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'data/raw/stepbible/Lexicons';
const file = fs.readdirSync(DIR).find((f) => f.startsWith('TBESG'));
if (!file) throw new Error(`No TBESG file found in ${DIR}`);

const db = new Database('db/bible-index.sqlite');

const cols = db.prepare('PRAGMA table_info(lexicon)').all() as { name: string }[];
if (cols.length && !cols.some((c) => c.name === 'gloss')) db.exec('DROP TABLE lexicon');

db.exec(`
CREATE TABLE IF NOT EXISTS lexicon (
  strongs TEXT PRIMARY KEY,
  lang TEXT,
  lemma TEXT,
  translit TEXT,
  pos TEXT,
  gloss TEXT,
  definition TEXT,
  source TEXT
);
`);

const ins = db.prepare(
  'INSERT OR REPLACE INTO lexicon (strongs, lang, lemma, translit, pos, gloss, definition, source) VALUES (?,?,?,?,?,?,?,?)'
);
const SOURCE = 'TBESG (Abbott-Smith), STEPBible.org, CC BY 4.0';

let n = 0;
db.transaction(() => {
  db.prepare("DELETE FROM lexicon WHERE lang = 'grc'").run();
  const lines = fs.readFileSync(path.join(DIR, file), 'utf8').split('\n');
  for (const raw of lines) {
    const c = raw.replace(/\r$/, '').split('\t');
    // 0 eStrong, 1 dStrong, 2 uStrong, 3 Greek, 4 translit, 5 part of speech, 6 gloss, 7+ definition
    if (c.length < 8 || !/^G\d{4,5}$/.test(c[0].trim())) continue;
    const def = c.slice(7).join('\t').trim();
    if (!def) continue;
    ins.run(c[0].trim(), 'grc', c[3].trim(), c[4].trim(), c[5].trim(), c[6].trim(), def, SOURCE);
    n++;
  }
})();

console.log(`Imported ${n} Greek lexicon entries from ${file}.`);
if (n === 0) console.log('Nothing matched. The columns may be separated by spaces instead of tabs.');
