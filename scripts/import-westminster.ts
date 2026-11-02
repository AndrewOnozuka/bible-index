import Database from 'better-sqlite3';
import fs from 'node:fs';
import { resolveBook } from '../src/lib/osis';
import { SINGLE_CHAPTER } from '../src/lib/stepbible';

const DIR = 'data/raw/westminster/static/confessions/';
const db = new Database('db/bible-index.sqlite');

db.exec(`
CREATE TABLE IF NOT EXISTS doc_items (
  id TEXT PRIMARY KEY,
  doc TEXT NOT NULL,
  ord INTEGER NOT NULL,
  chapter INTEGER,
  number INTEGER,
  title TEXT,
  question TEXT,
  body TEXT
);
CREATE TABLE IF NOT EXISTS doc_segments (
  item_id TEXT NOT NULL REFERENCES doc_items(id),
  seg INTEGER NOT NULL,
  text TEXT NOT NULL,
  refs TEXT,
  PRIMARY KEY (item_id, seg)
);
CREATE INDEX IF NOT EXISTS idx_doc_items_doc ON doc_items(doc, ord);
`);

const decode = (s: string) =>
  s.replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

type Seg = { text: string; refs: string };

// Splits an HTML answer into phrases, each with the proof-text references it carries
function segments(html: string): Seg[] {
  const out: Seg[] = [];
  const re = /<span data-prooftexts='([^']*)'[^>]*>([\s\S]*?)<\/span>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const before = decode(html.slice(last, m.index));
    if (before.trim()) out.push({ text: before, refs: '' });
    out.push({ text: decode(m[2]), refs: decode(m[1]).trim() });
    last = re.lastIndex;
  }
  const rest = decode(html.slice(last));
  if (rest.trim()) out.push({ text: rest, refs: '' });
  return out;
}

const q = db.prepare('SELECT id FROM verses WHERE book = ? AND chapter*1000+verse BETWEEN ? AND ?');

// "Psalms 86:9,12; I Corinthians 6:20; Romans 3:21-4:5; Psalms 8" -> verse IDs
function expand(refStr: string, bad: Set<string>): string[] {
  const ids = new Set<string>();
  for (const itemRaw of refStr.split(';')) {
    const item = itemRaw.replace(/[–—]/g, '-').trim();
    if (!item) continue;
    const m = /^((?:[1-3]|I{1,3})?\s*[A-Za-z][A-Za-z .]*?)\s+(\d[\d:,\-\s]*)$/.exec(item);
    const book = m ? resolveBook(m[1]) : null;
    if (!m || !book) { bad.add(item); continue; }

    let cur: number | null = null; // current chapter, for lists like "86:9,12"
    for (const partRaw of m[2].split(',')) {
      const p = partRaw.trim();
      let a = 0, b = 0;
      let m2: RegExpExecArray | null;
      if ((m2 = /^(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/.exec(p))) {
        const c1 = +m2[1], v1 = +m2[2];
        const c2 = m2[3] ? +m2[3] : c1;
        const v2 = m2[4] ? +m2[4] : v1;
        a = c1 * 1000 + v1; b = c2 * 1000 + v2; cur = c2;
      } else if ((m2 = /^(\d+)(?:-(\d+))?$/.exec(p))) {
        const n1 = +m2[1], n2 = m2[2] ? +m2[2] : n1;
        if (cur !== null) { a = cur * 1000 + n1; b = cur * 1000 + n2; }
        else if (SINGLE_CHAPTER.has(book)) { a = 1000 + n1; b = 1000 + n2; cur = 1; }
        else { a = n1 * 1000; b = n2 * 1000 + 999; }
      } else { bad.add(item); continue; }

      const rows = q.all(book, a, b) as { id: string }[];
      if (!rows.length) { bad.add(item); continue; }
      rows.forEach((r) => ids.add(r.id));
    }
  }
  return [...ids];
}

const load = (f: string) => JSON.parse(fs.readFileSync(DIR + f, 'utf8'));
const numKeys = (o: object) => Object.keys(o).sort((x, y) => Number(x) - Number(y));

const insItem = db.prepare(
  'INSERT INTO doc_items (id, doc, ord, chapter, number, title, question, body) VALUES (?,?,?,?,?,?,?,?)'
);
const insSeg = db.prepare('INSERT INTO doc_segments (item_id, seg, text, refs) VALUES (?,?,?,?)');
const insLink = db.prepare(
  "INSERT INTO links (source_type, source_id, target_type, target_id, link_type) VALUES ('doc_seg', ?, 'verse', ?, 'proof')"
);

const bad = new Set<string>();
let items = 0, segs = 0, links = 0, ord = 0;

function addItem(id: string, doc: string, chapter: number | null, number: number, title: string, question: string, html: string) {
  const ss = segments(html);
  insItem.run(id, doc, ord++, chapter, number, title, question, ss.map((s) => s.text).join('').replace(/\s+/g, ' ').trim());
  ss.forEach((s, i) => {
    insSeg.run(id, i + 1, s.text, s.refs);
    segs++;
    if (!s.refs) return;
    for (const v of expand(s.refs, bad)) { insLink.run(`${id}#${i + 1}`, v); links++; }
  });
  items++;
}

db.transaction(() => {
  // rerunnable: clear only what this script owns
  db.exec(`
    DELETE FROM links WHERE source_type = 'doc_seg'
      AND (source_id LIKE 'WCF.%' OR source_id LIKE 'WLC.%' OR source_id LIKE 'WSC.%');
    DELETE FROM doc_segments WHERE item_id LIKE 'WCF.%' OR item_id LIKE 'WLC.%' OR item_id LIKE 'WSC.%';
    DELETE FROM doc_items WHERE doc IN ('WCF','WLC','WSC');
  `);

  const wcf = load('wcf.json');
  console.log('WCF entry fields:', Object.keys(wcf[numKeys(wcf)[0]]).join(', '));
  for (const ch of numKeys(wcf)) {
    const e = wcf[ch];
    const title = decode(String(e.title ?? e.name ?? e.chapter_title ?? ''));
    for (const p of numKeys(e.body ?? {})) addItem(`WCF.${ch}.${p}`, 'WCF', +ch, +p, title, '', e.body[p]);
  }

  for (const [file, doc] of [['wlc.json', 'WLC'], ['wsc.json', 'WSC']] as const) {
    const d = load(file);
    for (const k of numKeys(d)) addItem(`${doc}.${k}`, doc, null, +k, '', decode(String(d[k].question ?? '')), String(d[k].answer ?? ''));
  }
})();

console.log(`Imported ${items} items, ${segs} phrases, ${links} proof-text links.`);
if (bad.size) console.log(`${bad.size} references not resolved, e.g.:\n  ${[...bad].slice(0, 15).join('\n  ')}`);
