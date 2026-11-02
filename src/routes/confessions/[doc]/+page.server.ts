import { db } from '#lib/server/db';
import { resolveBook } from '#lib/osis';
import { SINGLE_CHAPTER } from '#lib/stepbible';
import { error } from '@sveltejs/kit';

const documentNames: Record<string, string> = {
  WCF: 'Westminster Confession of Faith',
  WLC: 'Westminster Larger Catechism',
  WSC: 'Westminster Shorter Catechism'
};

type Row = {
  id: string;
  doc: string;
  chapter: number | null;
  number: number;
  title: string | null;
  question: string | null;
  seg: number | null;
  text: string | null;
  refs: string | null;
  target_id: string | null;
};

type ReferenceLink = {
  id: string;
  book: string;
  chapter: number;
  verse: number;
};

function makeCitations(refs: string) {
  let currentBook: string | null = null;

  return refs.split(';').map((raw) => {
    const text = raw.trim();
    const romanToArabic: Record<string, string> = {
      i: '1',
      ii: '2',
      iii: '3'
    };
    const displayText = text.replace(
      /^(III|II|I)(?=\s)/i,
      (roman) => romanToArabic[roman.toLowerCase()] ?? roman
    );
    if (!text) return { text: displayText, href: null };

    const withBook =
      /^((?:[1-3]|I{1,3})?\s*[A-Za-z][A-Za-z .]*?)\s+(\d[\d:,\-\s]*)$/.exec(text);

    let passage = text;
    if (withBook) {
      currentBook = resolveBook(withBook[1]);
      passage = withBook[2];
    }

    if (!currentBook) return { text: displayText, href: null };

    let chapter = 0;
    let verse = 1;
    let match: RegExpExecArray | null;

    if ((match = /^(\d+):(\d+)/.exec(passage))) {
      chapter = Number(match[1]);
      verse = Number(match[2]);
    } else if ((match = /^(\d+)-\d+:\d+/.exec(passage))) {
      // Chapter range such as "21-22:29": link to the start of chapter 21.
      chapter = Number(match[1]);
    } else if ((match = /^(\d+)/.exec(passage))) {
      const number = Number(match[1]);
      if (SINGLE_CHAPTER.has(currentBook)) {
        chapter = 1;
        verse = number;
      } else {
        chapter = number;
      }
    }

    const id = `${currentBook}.${chapter}.${verse}`;
    const exists = db.prepare('SELECT 1 FROM verses WHERE id = ?').get(id);

    return {
      text: displayText,
      href: exists
        ? `/read/${currentBook}/${chapter}?t=ESV#v${verse}`
        : null
    };
  });
}

export const prerender = true;

export function entries() {
  return (
    db.prepare(`
      SELECT DISTINCT doc
      FROM doc_items
      WHERE doc IN ('WCF', 'WLC', 'WSC')
    `).all() as { doc: string }[]
  ).map(({ doc }) => ({ doc }));
}

export function load({ params }) {
  const doc = params.doc.toUpperCase();
  const title = documentNames[doc];

  if (!title) throw error(404, 'Document not found');

  const rows = db.prepare(`
    SELECT
      i.id, i.doc, i.chapter, i.number, i.title, i.question,
      s.seg, s.text, s.refs, l.target_id
    FROM doc_items i
    LEFT JOIN doc_segments s ON s.item_id = i.id
    LEFT JOIN links l
      ON l.source_type = 'doc_seg'
     AND l.source_id = i.id || '#' || s.seg
     AND l.target_type = 'verse'
     AND l.link_type = 'proof'
    WHERE i.doc = ?
    ORDER BY i.ord, s.seg, l.target_id
  `).all(doc) as Row[];

  if (!rows.length) {
    throw error(404, 'Document content not found. Run the Westminster importer first.');
  }

  const items = new Map<string, {
    id: string;
    chapter: number | null;
    number: number;
    title: string;
    question: string;
    segments: Map<number, {
      text: string;
      refs: string;
      references: ReferenceLink[];
    }>;
  }>();

  for (const row of rows) {
    let item = items.get(row.id);

    if (!item) {
      item = {
        id: row.id,
        chapter: row.chapter,
        number: row.number,
        title: row.title ?? '',
        question: row.question ?? '',
        segments: new Map()
      };
      items.set(row.id, item);
    }

    if (row.seg === null || row.text === null) continue;

    let segment = item.segments.get(row.seg);
    if (!segment) {
      segment = {
        text: row.text,
        refs: row.refs ?? '',
        references: []
      };
      item.segments.set(row.seg, segment);
    }

    if (row.target_id) {
      const parts = row.target_id.split('.');
      if (parts.length === 3) {
        const [book, chapter, verse] = parts;
        if (book && Number(chapter) && Number(verse)) {
          if (!segment.references.some((ref) => ref.id === row.target_id)) {
            segment.references.push({
              id: row.target_id,
              book,
              chapter: Number(chapter),
              verse: Number(verse)
            });
          }
        }
      }
    }
  }

  return {
    doc,
    title,
    items: [...items.values()].map((item) => ({
      ...item,
      segments: [...item.segments.values()].map((segment) => ({
        ...segment,
        citations: makeCitations(segment.refs)
      }))
    }))
  };
}
