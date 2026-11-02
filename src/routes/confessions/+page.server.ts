import { db } from '#lib/server/db';

export const prerender = true;

export function load() {
  const counts = db.prepare(`
    SELECT doc, COUNT(*) AS itemCount
    FROM doc_items
    WHERE doc IN ('WCF', 'WLC', 'WSC')
    GROUP BY doc
  `).all() as { doc: string; itemCount: number }[];

  const countByDoc = new Map(counts.map(({ doc, itemCount }) => [doc, itemCount]));

  return {
    documents: [
      {
        id: 'WCF',
        name: 'Westminster Confession of Faith',
        description: 'The Confession of Faith, arranged by chapter and paragraph.',
        itemCount: countByDoc.get('WCF') ?? 0
      },
      {
        id: 'WLC',
        name: 'Westminster Larger Catechism',
        description: 'The Larger Catechism, arranged by question and answer.',
        itemCount: countByDoc.get('WLC') ?? 0
      },
      {
        id: 'WSC',
        name: 'Westminster Shorter Catechism',
        description: 'The Shorter Catechism, arranged by question and answer.',
        itemCount: countByDoc.get('WSC') ?? 0
      }
    ]
  };
}
