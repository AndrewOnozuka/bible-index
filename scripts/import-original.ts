import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'data/raw/stepbible/Translators Amalgamated OT+NT';

const BOOK: Record<string, string> = {
  Mat: 'Matt', Mrk: 'Mark', Luk: 'Luke', Jhn: 'John', Act: 'Acts', Rom: 'Rom',
  '1Co': '1Cor', '2Co': '2Cor', Gal: 'Gal', Eph: 'Eph', Php: 'Phil', Col: 'Col',
  '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim', Tit: 'Titus', Phm: 'Phlm',
  Heb: 'Heb', Jas: 'Jas', '1Pe': '1Pet', '2Pe': '2Pet', '1Jn': '1John', '2Jn': '2John',
  '3Jn': '3John', Jud: 'Jude', Rev: 'Rev'
};

const db = new Database('db/bible-index.sqlite');

// The original_words table from the first schema has too few columns; replace it if it is the old one.
const cols = db.prepare('PRAGMA table_info(original_words)').all() as { name: string }[];
if (cols.length && !cols.some((c) => c.name === 'wtype')) db.exec('DROP TABLE original_words');

db.exec(`
CREATE TABLE IF NOT EXISTS original_words (
  verse_id TEXT NOT NULL REFERENCES verses(id),
  position INTEGER NOT NULL,
  wtype TEXT,
  surface TEXT,
  translit TEXT,
  english TEXT,
  strongs TEXT,
  morph TEXT,
  lemma TEXT,
  gloss TEXT,
  lang TEXT,
  PRIMARY KEY (verse_id, position)
);
CREATE INDEX IF NOT EXISTS idx_ow_strongs ON original_words(strongs);
`);

const known = new Set((db.prepare('SELECT id FROM verses').all() as { id: string }[]).map((r) => r.id));
const ins = db.prepare(
  'INSERT INTO original_words (verse_id, position, wtype, surface, translit, english, strongs, morph, lemma, gloss, lang) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
);

const files = fs.readdirSync(DIR).filter((f) => f.startsWith('TAGNT')).sort();
if (!files.length) throw new Error(`No TAGNT files found in ${DIR}`);

const position = new Map<string, number>();
const unknownBooks = new Set<string>();
const missingVerses = new Set<string>();
let kept = 0;

db.transaction(() => {
  db.prepare("DELETE FROM original_words WHERE lang = 'grc'").run(); // rerunnable

  for (const f of files) {
    const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '');
      if (!line || line.startsWith('#')) continue;
      const c = line.split('\t');

      const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)\S*?#(\d+)=(\S+)$/.exec(c[0]);
      if (!m) continue;

      const book = BOOK[m[1]];
      if (!book) { unknownBooks.add(m[1]); continue; }

      const id = `${book}.${Number(m[2])}.${Number(m[3])}`;
      if (!known.has(id)) { missingVerses.add(id); continue; }

      const pos = (position.get(id) ?? 0) + 1;
      position.set(id, pos);

      const g = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(c[1] ?? '');
      const surface = (g ? g[1] : (c[1] ?? '')).trim();
      const translit = g ? g[2] : '';

      const s = c[3] ?? '';
      const si = s.indexOf('=');
      const strongs = si >= 0 ? s.slice(0, si) : s;
      const morph = si >= 0 ? s.slice(si + 1) : '';

      const d = c[4] ?? '';
      const di = d.indexOf('=');
      const lemma = di >= 0 ? d.slice(0, di) : d;
      const gloss = di >= 0 ? d.slice(di + 1) : '';

      ins.run(id, pos, m[5], surface, translit, (c[2] ?? '').trim(), strongs, morph, lemma, gloss, 'grc');
      kept++;
    }
  }
})();

console.log(`Imported ${kept} Greek words from ${files.length} files.`);
if (unknownBooks.size) console.log(`Unrecognized book codes: ${[...unknownBooks].join(', ')}`);
if (missingVerses.size) console.log(`${missingVerses.size} verse refs not in verses table, e.g. ${[...missingVerses].slice(0, 5).join(', ')}`);
