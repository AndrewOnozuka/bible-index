import { db } from '#lib/server/db';
import { bookName } from '#lib/books';
import { error } from '@sveltejs/kit';

const TRANSLATION = 'KJV';

export function load({ params }) {
  const chapter = Number(params.chapter);
  const verses = db.prepare(
    `SELECT v.verse, t.text FROM verses v
     JOIN verse_text t ON t.verse_id = v.id AND t.translation = ?
     WHERE v.book = ? AND v.chapter = ? ORDER BY v.verse`
  ).all(TRANSLATION, params.book, chapter) as { verse: number; text: string }[];
  if (!verses.length) throw error(404, 'Chapter not found');

  const max = (db.prepare('SELECT MAX(chapter) m FROM verses WHERE book = ?').get(params.book) as any).m;
  return { book: params.book, name: bookName(params.book), chapter, max, translation: TRANSLATION, verses };
}
