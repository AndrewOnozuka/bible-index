import { db } from '#lib/server/db';
import { bookName } from '#lib/books';
import { error } from '@sveltejs/kit';

type Word = {
  verse: number; position: number; surface: string; translit: string; english: string;
  strongs: string; estrong: string; morph: string; gloss: string | null; lemma: string | null;
};

export function load({ params, url, cookies }) {
  const chapter = Number(params.chapter);

  const translations = (
    db.prepare('SELECT DISTINCT translation FROM verse_text ORDER BY translation').all() as { translation: string }[]
  ).map((r) => r.translation);

  const fromUrl = url.searchParams.get('t');
  const fromCookie = cookies.get('translation');
  let translation: string;
  if (fromUrl && translations.includes(fromUrl)) {
    translation = fromUrl;
    cookies.set('translation', translation, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  } else if (fromCookie && translations.includes(fromCookie)) {
    translation = fromCookie;
  } else {
    translation = translations.includes('KJV') ? 'KJV' : translations[0];
  }

  const verses = db.prepare(
    `SELECT v.verse, t.text FROM verses v
     LEFT JOIN verse_text t ON t.verse_id = v.id AND t.translation = ?
     WHERE v.book = ? AND v.chapter = ? ORDER BY v.verse`
  ).all(translation, params.book, chapter) as { verse: number; text: string | null }[];
  if (!verses.length) throw error(404, 'Chapter not found');

  const max = (db.prepare('SELECT MAX(chapter) m FROM verses WHERE book = ?').get(params.book) as any).m;

  const orig = db.prepare(
    `SELECT o.lang AS lang FROM original_words o JOIN verses v ON v.id = o.verse_id
     WHERE v.book = ? AND v.chapter = ? LIMIT 1`
  ).get(params.book, chapter) as { lang: string } | undefined;
  const hasOriginal = !!orig;
  const lang = orig?.lang ?? null;

  const interlinear = url.searchParams.get('i') === '1';
  const words: Record<number, Word[]> = {};
  if (interlinear && hasOriginal) {
    const rows = db.prepare(
      `SELECT v.verse AS verse, o.position, o.surface, o.translit, o.english, o.strongs, o.estrong, o.morph,
              l.gloss, l.lemma
       FROM verses v
       JOIN original_words o ON o.verse_id = v.id
       LEFT JOIN lexicon l ON l.strongs = o.estrong
       WHERE v.book = ? AND v.chapter = ? ORDER BY v.verse, o.position`
    ).all(params.book, chapter) as Word[];
    for (const r of rows) (words[r.verse] ??= []).push(r);
  }

  return {
    book: params.book, name: bookName(params.book), chapter, max,
    translation, translations, verses, interlinear, hasOriginal, lang, words
  };
}
