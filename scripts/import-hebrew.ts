import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'data/raw/stepbible/Translators Amalgamated OT+NT';

const BOOK: Record<string, string> = {
  Gen:'Gen', Exo:'Exod', Lev:'Lev', Num:'Num', Deu:'Deut', Jos:'Josh', Jdg:'Judg', Rut:'Ruth',
  '1Sa':'1Sam', '2Sa':'2Sam', '1Ki':'1Kgs', '2Ki':'2Kgs', '1Ch':'1Chr', '2Ch':'2Chr', Ezr:'Ezra',
  Neh:'Neh', Est:'Esth', Job:'Job', Psa:'Ps', Pro:'Prov', Ecc:'Eccl', Sng:'Song', Isa:'Isa',
  Jer:'Jer', Lam:'Lam', Ezk:'Ezek', Dan:'Dan', Hos:'Hos', Jol:'Joel', Amo:'Amos', Oba:'Obad',
  Jon:'Jonah', Mic:'Mic', Nam:'Nah', Hab:'Hab', Zep:'Zeph', Hag:'Hag', Zec:'Zech', Mal:'Mal',
  Eze:'Ezek', Joe:'Joel', Nah:'Nah', Zph:'Zeph', Zch:'Zech'
};

const db = new Database('db/bible-index.sqlite');

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
  estrong TEXT,
  PRIMARY KEY (verse_id, position)
);
`);
const owCols = db.prepare('PRAGMA table_info(original_words)').all() as { name: string }[];
if (!owCols.some((c) => c.name === 'estrong')) db.exec('ALTER TABLE original_words ADD COLUMN estrong TEXT');
db.exec('CREATE INDEX IF NOT EXISTS idx_ow_strongs ON original_words(strongs)');
db.exec('CREATE INDEX IF NOT EXISTS idx_ow_estrong ON original_words(estrong)');

const known = new Set((db.prepare('SELECT id FROM verses').all() as { id: string }[]).map((r) => r.id));
const ins = db.prepare(
  'INSERT INTO original_words (verse_id, position, wtype, surface, translit, english, strongs, morph, lemma, gloss, lang, estrong) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
);

const files = fs.readdirSync(DIR).filter((f) => f.startsWith('TAHOT')).sort();
if (!files.length) throw new Error(`No TAHOT files found in ${DIR}`);

const position = new Map<string, number>();
const unknownBooks = new Set<string>();
const missingVerses = new Set<string>();
const types = new Map<string, number>();
let kept = 0;

db.transaction(() => {
  db.prepare("DELETE FROM original_words WHERE lang = 'heb'").run(); // rerunnable

  for (const f of files) {
    const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '');
      if (!line || line.startsWith('#')) continue;
      const c = line.split('\t');
      if (c.length < 6) continue;

      const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)[^#]*#(\d+)=(\S+)$/.exec(c[0].trim());
      if (!m) continue;

      const book = BOOK[m[1]];
      if (!book) { unknownBooks.add(m[1]); continue; }

      const id = `${book}.${Number(m[2])}.${Number(m[3])}`;
      if (!known.has(id)) { missingVerses.add(id); continue; }

      // Root Strong's: the tag in {curly brackets}, ignoring punctuation tags after a backslash
      const tags = (c[4] ?? '').split('\\')[0];
      const braced = /\{([^}]*)\}/.exec(tags);
      const rootText = braced ? braced[1] : (tags.split('/').pop() ?? '');
      const root = (/H\d{4,5}[A-Za-z]?/.exec(rootText) ?? [''])[0];

      const pos = (position.get(id) ?? 0) + 1;
      position.set(id, pos);

      const clean = (s: string) => s.replace(/[\/\\]/g, '').replace(/\s+/g, ' ').trim();
      ins.run(id, pos, m[5], clean(c[1] ?? ''), clean(c[2] ?? ''), clean(c[3] ?? ''), root, (c[5] ?? '').trim(), '', '', 'heb', root);
      types.set(m[5], (types.get(m[5]) ?? 0) + 1);
      kept++;
    }
  }
})();

console.log(`Imported ${kept} Hebrew words from ${files.length} files.`);
console.log('Word types:', [...types].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => `${t}=${n}`).join(', '));
if (unknownBooks.size) console.log(`Unrecognized book codes: ${[...unknownBooks].join(', ')}`);
if (missingVerses.size) console.log(`${missingVerses.size} verse refs not in verses table, e.g. ${[...missingVerses].slice(0, 6).join(', ')}`);
