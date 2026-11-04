import { db } from '#lib/server/db';
import { BOOKS, bookName } from '#lib/books';
import { error } from '@sveltejs/kit';

type Word = {
  verse: number;
  position: number;
  surface: string;
  translit: string;
  english: string;
  strongs: string;
  estrong: string;
  morph: string;
  gloss: string | null;
  lemma: string | null;
};

type VerseRow = { verse: number; text: string | null; text2: string | null };

// Only prerender reading pages during the dedicated static build.
export const prerender = process.env.STATIC_KJV_BUILD === '1';

// Tell SvelteKit which book/chapter combinations to generate.
export function entries() {
  return (
    db.prepare(`
      SELECT book, chapter
      FROM verses
      GROUP BY book, chapter
      ORDER BY MIN(sort)
    `).all() as { book: string; chapter: number }[]
  ).map(({ book, chapter }) => ({
    book,
    chapter: String(chapter)
  }));
}

function rubyFor(translation: string | null, book: string, chapter: number): Record<number, string> {
  const out: Record<number, string> = {};
  if (!translation || !translation.startsWith('Jap')) return out;
  try {
    const rows = db.prepare(
      'SELECT v.verse AS verse, r.html AS html FROM verses v ' +
      'JOIN verse_ruby r ON r.verse_id = v.id AND r.translation = ? ' +
      'WHERE v.book = ? AND v.chapter = ?'
    ).all(translation, book, chapter) as { verse: number; html: string }[];
    for (const r of rows) out[r.verse] = r.html;
  } catch {
    // verse_ruby does not exist yet
  }
  return out;
}

export function load({ params, url, cookies }) {
  const chapter = Number(params.chapter);

  // Static GitHub Pages build: KJV only, with no URL or cookie access.
  if (process.env.STATIC_KJV_BUILD === '1') {
    const rows = db.prepare(`
      SELECT v.verse, t.text
      FROM verses v
      JOIN verse_text t
        ON t.verse_id = v.id
       AND t.translation = 'KJV'
      WHERE v.book = ? AND v.chapter = ?
      ORDER BY v.verse
    `).all(params.book, chapter) as { verse: number; text: string }[];

    if (!rows.length) {
      throw error(404, 'Chapter not found');
    }

    const verses: VerseRow[] = rows.map((r) => ({ ...r, text2: null }));

    const max = (
      db.prepare(`
        SELECT MAX(chapter) AS m
        FROM verses
        WHERE book = ?
      `).get(params.book) as { m: number }
    ).m;

    return {
      book: params.book,
      name: bookName(params.book),
      chapter,
      max,
      translation: 'KJV',
      translation2: null as string | null,
      translations: ['KJV'],
      showRuby: false,
      ruby: {} as Record<number, string>,
      ruby2: {} as Record<number, string>,
      verses,
      interlinear: false,
      hasOriginal: false,
      lang: null,
      words: {} as Record<number, Word[]>
    };
  }

  // Local development: preserve the existing reader behavior.
  const translations = (
    db.prepare(
      'SELECT DISTINCT translation FROM verse_text ORDER BY translation'
    ).all() as { translation: string }[]
  )
    .map((r) => r.translation)
    .filter((translation) => ['ESV', 'KJV', 'JapSKY2017'].includes(translation));

  const cookieOpts = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' } as const;

  // Primary translation: ?t= link, then cookie, then KJV
  const fromUrl = url.searchParams.get('t');
  const fromCookie = cookies.get('translation');

  let translation: string;

  if (fromUrl && translations.includes(fromUrl)) {
    translation = fromUrl;
    cookies.set('translation', translation, cookieOpts);
  } else if (fromCookie && translations.includes(fromCookie)) {
    translation = fromCookie;
  } else {
    translation = translations.includes('KJV') ? 'KJV' : translations[0];
  }

  // Second translation: ?t2= link ("none" clears it), then cookie, then nothing
  const t2Url = url.searchParams.get('t2');
  const t2Cookie = cookies.get('translation2');
  let translation2: string | null = null;

  if (t2Url !== null) {
    translation2 = translations.includes(t2Url) && t2Url !== translation ? t2Url : null;
    cookies.set('translation2', translation2 ?? 'none', cookieOpts);
  } else if (t2Cookie && translations.includes(t2Cookie) && t2Cookie !== translation) {
    translation2 = t2Cookie;
  }

  const rows = db.prepare(`
    SELECT v.verse, t.text
    FROM verses v
    LEFT JOIN verse_text t
      ON t.verse_id = v.id
     AND t.translation = ?
    WHERE v.book = ? AND v.chapter = ?
    ORDER BY v.verse
  `).all(translation, params.book, chapter) as {
    verse: number;
    text: string | null;
  }[];

  if (!rows.length) {
    throw error(404, 'Chapter not found');
  }

  const second = new Map<number, string | null>();
  if (translation2) {
    const rows2 = db.prepare(`
      SELECT v.verse, t.text
      FROM verses v
      LEFT JOIN verse_text t
        ON t.verse_id = v.id
       AND t.translation = ?
      WHERE v.book = ? AND v.chapter = ?
    `).all(translation2, params.book, chapter) as { verse: number; text: string | null }[];
    for (const r of rows2) second.set(r.verse, r.text);
  }

  const verses: VerseRow[] = rows.map((r) => ({
    ...r,
    text2: translation2 ? (second.get(r.verse) ?? null) : null
  }));

  const max = (
    db.prepare(
      'SELECT MAX(chapter) AS m FROM verses WHERE book = ?'
    ).get(params.book) as { m: number }
  ).m;

  const orig = db.prepare(`
    SELECT o.lang AS lang
    FROM original_words o
    JOIN verses v ON v.id = o.verse_id
    WHERE v.book = ? AND v.chapter = ?
    LIMIT 1
  `).get(params.book, chapter) as { lang: string } | undefined;

  const rParam = url.searchParams.get('r');
  if (rParam !== null) cookies.set('ruby', rParam === '1' ? '1' : '0', cookieOpts);
  const showRuby = (rParam ?? cookies.get('ruby')) === '1';
  const ruby = showRuby ? rubyFor(translation, params.book, chapter) : {};
  const ruby2 = showRuby ? rubyFor(translation2, params.book, chapter) : {};

  const hasOriginal = !!orig;
  const lang = orig?.lang ?? null;
  const interlinear = url.searchParams.get('i') === '1';
  const words: Record<number, Word[]> = {};

  if (interlinear && hasOriginal) {
    const wordRows = db.prepare(`
      SELECT
        v.verse AS verse,
        o.position,
        o.surface,
        o.translit,
        o.english,
        o.strongs,
        o.estrong,
        o.morph,
        l.gloss,
        l.lemma
      FROM verses v
      JOIN original_words o ON o.verse_id = v.id
      LEFT JOIN lexicon l ON l.strongs = o.estrong
      WHERE v.book = ? AND v.chapter = ?
      ORDER BY v.verse, o.position
    `).all(params.book, chapter) as Word[];

    for (const r of wordRows) {
      (words[r.verse] ??= []).push(r);
    }
  }

  return {
    book: params.book,
    name: bookName(params.book),
    chapter,
    max,
    translation,
    translation2,
    translations,
    verses,
    interlinear,
    hasOriginal,
    lang,
    words,
    showRuby,
    ruby,
    ruby2
  };
}
