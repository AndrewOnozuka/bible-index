import { db } from '#lib/server/db';

export const prerender = false;

// Add people here as you decide how their names map to original-language IDs.
const PERSON_LABELS: Record<string, string> = {
  G2424: 'Jesus'
};

const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by',
  'do', 'for', 'from', 'he', 'her', 'his', 'i', 'in', 'is', 'it',
  'its', 'let', 'me', 'my', 'not', 'of', 'on', 'or', 'our', 'so',
  'that', 'the', 'their', 'them', 'they', 'this', 'to', 'was', 'we',
  'were', 'will', 'with', 'you', 'your'
]);

export function load({ url }) {
  const query = (url.searchParams.get('q') ?? '').trim();
  const focus = (url.searchParams.get('focus') ?? '').trim().toUpperCase();
  const requestedCount = Number(url.searchParams.get('count') ?? 100);
  const count = Number.isFinite(requestedCount)
    ? Math.max(30, Math.min(400, Math.floor(requestedCount)))
    : 100;
  const candidateLimit = Math.min(count * 2, 800);

  const concepts = db.prepare(`
    SELECT
      o.estrong AS strongs,
      COALESCE(l.lemma, MIN(o.surface), '') AS lemma,
      COALESCE(l.gloss, '') AS gloss,
      COUNT(DISTINCT o.verse_id) AS frequency
    FROM original_words o
    LEFT JOIN lexicon l ON l.strongs = o.estrong
    WHERE o.estrong IS NOT NULL
    GROUP BY o.estrong, l.lemma, l.gloss
    ORDER BY frequency DESC
    LIMIT ?
  `).all(candidateLimit) as {
    strongs: string;
    lemma: string;
    gloss: string;
    frequency: number;
  }[];

  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const cellWidth = 900 / columns;
  const cellHeight = 900 / rows;

  const slots = Array.from({ length: columns * rows }, (_, index) => ({
    column: index % columns,
    row: Math.floor(index / columns)
  })).sort((a, b) => {
    const ax = (a.column - (columns - 1) / 2) / columns;
    const ay = (a.row - (rows - 1) / 2) / rows;
    const bx = (b.column - (columns - 1) / 2) / columns;
    const by = (b.row - (rows - 1) / 2) / rows;
    const distanceA = Math.max(Math.abs(ax), Math.abs(ay));
    const distanceB = Math.max(Math.abs(bx), Math.abs(by));
    if (distanceA !== distanceB) return distanceA - distanceB;

    return Math.atan2(ay, ax) - Math.atan2(by, bx);
  });

  const nodes = concepts
    .filter((concept) => !stopWords.has((concept.gloss || '').trim().toLowerCase()))
    .slice(0, count)
    .map((concept, index, all) => {
      const maxFrequency = all[0]?.frequency ?? 1;
      const frequencyRatio = concept.frequency / maxFrequency;
      const sizeWeight = Math.pow(frequencyRatio, 0.62);
      const labelWeight = Math.pow(frequencyRatio, 0.5);
      const slot = slots[index];
      const maxRadius = Math.min(42, Math.min(cellWidth, cellHeight) * 0.44);
      const englishLabel = (concept.gloss || '')
        .split(/[;,]/)[0]
        .trim()
        .replace(/^to\\s+/i, '');

      return {
        ...concept,
        id: concept.strongs === 'G2424' ? 'person:jesus' : `lemma:${concept.strongs}`,
        label: PERSON_LABELS[concept.strongs] ?? (englishLabel || concept.lemma || concept.strongs),
        language: concept.strongs.startsWith('H') ? 'Hebrew' : 'Greek',
        x: 50 + (slot.column + 0.5) * cellWidth,
        y: 50 + (slot.row + 0.5) * cellHeight,
        size: 8 + sizeWeight * (maxRadius - 8),
        labelSize: 8 + labelWeight * 18
      };
    });

  const strongs = nodes.map((node) => node.strongs);
  let edges: { source: string; target: string; shared: number; score: number }[] = [];

  if (strongs.length) {
    const placeholders = strongs.map(() => '?').join(',');
    const pairs = db.prepare(`
      SELECT
        a.estrong AS source,
        b.estrong AS target,
        COUNT(DISTINCT a.verse_id) AS shared
      FROM original_words a
      JOIN original_words b
        ON b.verse_id = a.verse_id
       AND a.estrong < b.estrong
      WHERE a.estrong IN (${placeholders})
        AND b.estrong IN (${placeholders})
      GROUP BY a.estrong, b.estrong
      HAVING COUNT(DISTINCT a.verse_id) >= 3
    `).all(...strongs, ...strongs) as {
      source: string;
      target: string;
      shared: number;
    }[];

    const frequency = new Map(nodes.map((node) => [node.strongs, node.frequency]));
    const degree = new Map<string, number>();

    edges = pairs
      .map((edge) => ({
        ...edge,
        score: edge.shared / Math.sqrt(
          (frequency.get(edge.source) ?? 1) * (frequency.get(edge.target) ?? 1)
        )
      }))
      .sort((a, b) => b.score - a.score)
      .filter((edge) => {
        const sourceDegree = degree.get(edge.source) ?? 0;
        const targetDegree = degree.get(edge.target) ?? 0;
        if (sourceDegree >= 5 || targetDegree >= 5) return false;
        degree.set(edge.source, sourceDegree + 1);
        degree.set(edge.target, targetDegree + 1);
        return true;
      })
      .slice(0, 600);
  }

  const like = `%${query}%`;
  const results = query
    ? db.prepare(`
        SELECT
          o.estrong AS strongs,
          COALESCE(l.lemma, MIN(o.surface), '') AS lemma,
          COALESCE(l.gloss, '') AS gloss,
          COUNT(DISTINCT o.verse_id) AS frequency
        FROM original_words o
        LEFT JOIN lexicon l ON l.strongs = o.estrong
        WHERE o.estrong IS NOT NULL
          AND (
            o.estrong LIKE ?
            OR o.surface LIKE ?
            OR o.translit LIKE ?
            OR o.english LIKE ?
            OR l.lemma LIKE ?
            OR l.gloss LIKE ?
          )
        GROUP BY o.estrong, l.lemma, l.gloss
        ORDER BY
          CASE WHEN LOWER(o.estrong) = LOWER(?) THEN 0 ELSE 1 END,
          frequency DESC
        LIMIT 30
      `).all(like, like, like, like, like, like, query) as {
        strongs: string;
        lemma: string;
        gloss: string;
        frequency: number;
      }[]
    : [];

  const focusConcept = focus
    ? db.prepare(`
        SELECT
          o.estrong AS strongs,
          COALESCE(l.lemma, MIN(o.surface), '') AS lemma,
          COALESCE(l.gloss, '') AS gloss,
          COUNT(DISTINCT o.verse_id) AS frequency
        FROM original_words o
        LEFT JOIN lexicon l ON l.strongs = o.estrong
        WHERE o.estrong = ?
        GROUP BY o.estrong, l.lemma, l.gloss
      `).get(focus) as {
        strongs: string;
        lemma: string;
        gloss: string;
        frequency: number;
      } | undefined
    : undefined;

  let occurrences: {
    id: string;
    book: string;
    chapter: number;
    verse: number;
    surface: string;
    translit: string;
    english: string;
    morph: string;
    texts: Record<string, string>;
  }[] = [];

  if (focusConcept) {
    const found = db.prepare(`
      SELECT
        v.id,
        v.book,
        v.chapter,
        v.verse,
        GROUP_CONCAT(DISTINCT o.surface) AS surface,
        GROUP_CONCAT(DISTINCT o.translit) AS translit,
        GROUP_CONCAT(DISTINCT o.english) AS english,
        GROUP_CONCAT(DISTINCT o.morph) AS morph
      FROM original_words o
      JOIN verses v ON v.id = o.verse_id
      WHERE o.estrong = ?
      GROUP BY v.id
      ORDER BY MIN(v.sort)
      LIMIT 60
    `).all(focus) as {
      id: string;
      book: string;
      chapter: number;
      verse: number;
      surface: string;
      translit: string;
      english: string;
      morph: string;
    }[];

    const ids = found.map((verse) => verse.id);
    const textByVerse = new Map<string, Record<string, string>>();

    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const textRows = db.prepare(`
        SELECT verse_id, translation, text
        FROM verse_text
        WHERE translation IN ('ESV', 'KJV', 'JapSKY2017')
          AND verse_id IN (${placeholders})
      `).all(...ids) as {
        verse_id: string;
        translation: string;
        text: string;
      }[];

      for (const row of textRows) {
        const texts = textByVerse.get(row.verse_id) ?? {};
        texts[row.translation] = row.text;
        textByVerse.set(row.verse_id, texts);
      }
    }

    occurrences = found.map((verse) => ({
      ...verse,
      texts: textByVerse.get(verse.id) ?? {}
    }));
  }

  const nextParams = new URLSearchParams();
  nextParams.set('count', String(Math.min(count + 50, 400)));
  if (query) nextParams.set('q', query);
  if (focus) nextParams.set('focus', focus);
  const moreUrl = count < 400 ? `/map?${nextParams.toString()}` : null;

  return {
    query,
    focus,
    count,
    moreUrl,
    nodes,
    edges,
    results,
    focusConcept: focusConcept
      ? {
          ...focusConcept,
          label: PERSON_LABELS[focusConcept.strongs] ?? (focusConcept.gloss || focusConcept.lemma)
        }
      : null,
    occurrences
  };
}
