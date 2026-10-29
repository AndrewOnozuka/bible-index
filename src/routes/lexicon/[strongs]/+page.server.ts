import { db } from '#lib/server/db';
import { bookName } from '#lib/books';
import { STEP_TO_OSIS, SINGLE_CHAPTER } from '#lib/stepbible';
import { error } from '@sveltejs/kit';

function render(def: string): string {
  const links: string[] = [];
  let h = def.replace(/<ref='([^']*)'>(.*?)<\/ref>/gi, (_m, r: string, t: string) => {
    const m = /^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?/.exec(r);
    const book = m && STEP_TO_OSIS[m[1]];
    if (!m || !book) return t;
    let ch = m[2], vs = m[3];
    if (!vs && SINGLE_CHAPTER.has(book)) { vs = ch; ch = '1'; }
    links.push(`<a href="/read/${book}/${Number(ch)}${vs ? '#v' + Number(vs) : ''}">${t}</a>`);
    return `@@LINK${links.length - 1}@@`;
  });
  h = h.replace(/<(?!\/?(?:b|i|br)\b)[^>]*>/gi, '');
  return h.replace(/@@LINK(\d+)@@/g, (_m, i: string) => links[Number(i)]);
}

export function load({ params }) {
  // Accepts G26, G0026, H0430G, H430g, and so on
  const m = /^([GH])0*(\d+)([A-Za-z]?)$/i.exec(params.strongs);
  if (!m) throw error(404, "Not a Strong's number");
  const key = `${m[1].toUpperCase()}${m[2].padStart(4, '0')}${m[3].toUpperCase()}`;

  const entry = db.prepare('SELECT * FROM lexicon WHERE strongs = ?').get(key) as any;
  if (!entry) throw error(404, `No lexicon entry for ${key}`);

  const total = (db.prepare('SELECT COUNT(*) n FROM original_words WHERE estrong = ?').get(key) as any).n;
  const rows = db.prepare(
    `SELECT v.book, v.chapter, v.verse, o.surface, o.english
     FROM original_words o JOIN verses v ON v.id = o.verse_id
     WHERE o.estrong = ? ORDER BY v.sort, o.position LIMIT 300`
  ).all(key) as { book: string; chapter: number; verse: number; surface: string; english: string }[];

  return {
    key, entry,
    definition: render(entry.definition),
    total,
    occurrences: rows.map((r) => ({
      href: `/read/${r.book}/${r.chapter}#v${r.verse}`,
      label: `${bookName(r.book)} ${r.chapter}:${r.verse}`,
      surface: r.surface,
      english: r.english
    }))
  };
}
