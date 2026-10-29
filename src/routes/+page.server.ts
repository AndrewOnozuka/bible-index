import { db } from '#lib/server/db';
import { BOOKS } from '#lib/books';

export const prerender = true;

export function load() {
  const rows = db
    .prepare('SELECT book, MAX(chapter) AS chapters FROM verses GROUP BY book')
    .all() as { book: string; chapters: number }[];

  const counts = new Map(rows.map((r) => [r.book, r.chapters]));

  return {
    books: BOOKS.map(([osis, name]) => ({
      osis,
      name,
      chapters: counts.get(osis) ?? 0
    }))
  };
}