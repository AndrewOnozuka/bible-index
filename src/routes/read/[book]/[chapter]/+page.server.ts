import { db } from '#lib/server/db';
import { bookName } from '#lib/books';
import { error } from '@sveltejs/kit';

export function load({ params, url }) {
  const chapter = Number(params.chapter);

  const translations = (
    db.prepare('SELECT DISTINCT translation FROM verse_text ORDER BY translation').all() as { translation: string }[]
  ).map((r) => r.translation);

  const requested = url.searchParams.get('t');
  const translation =
    requested && translations.includes(requested)
      ? requested
      : translations.includes('KJV')
        ? 'KJV'
        : translations[0];

  const verses = db.prepare(
    `SELECT v.verse, t.text FROM verses v
     LEFT JOIN verse_text t ON t.verse_id = v.id AND t.translation = ?
     WHERE v.book = ? AND v.chapter = ? ORDER BY v.verse`
  ).all(translation, params.book, chapter) as { verse: number; text: string | null }[];
  if (!verses.length) throw error(404, 'Chapter not found');

  const max = (db.prepare('SELECT MAX(chapter) m FROM verses WHERE book = ?').get(params.book) as any).m;
  return { book: params.book, name: bookName(params.book), chapter, max, translation, translations, verses };
}
