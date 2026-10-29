import { db } from '#lib/server/db';
import { bookName } from '#lib/books';
import { error } from '@sveltejs/kit';

export function load({ params, url, cookies }) {
  const chapter = Number(params.chapter);

  const translations = (
    db.prepare('SELECT DISTINCT translation FROM verse_text ORDER BY translation').all() as { translation: string }[]
  ).map((r) => r.translation);

  // Priority: explicit ?t= link, then the saved cookie, then KJV, then anything
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
  return { book: params.book, name: bookName(params.book), chapter, max, translation, translations, verses };
}
