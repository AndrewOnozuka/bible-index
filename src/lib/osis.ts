import { BOOKS } from './books';

export interface RefRange {
  book: string;
  startChapter: number;
  startVerse?: number;
  endChapter: number;
  endVerse?: number;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/\./g, ' ').trim()
    .replace(/^(iii|ii|i)\s+/, m => ({ 'i ': '1', 'ii ': '2', 'iii ': '3' } as any)[m.trim() + ' '])
    .replace(/[^a-z0-9]/g, '');

const EXTRA: Record<string, string> = {
  gn:'Gen', ex:'Exod', lv:'Lev', nm:'Num', dt:'Deut', jos:'Josh', jdg:'Judg', jg:'Judg',
  '1sm':'1Sam','2sm':'2Sam','1ki':'1Kgs','2ki':'2Kgs','1kings':'1Kgs','2kings':'2Kgs',
  '1ch':'1Chr','2ch':'2Chr', ps:'Ps', psa:'Ps', pss:'Ps', psalm:'Ps', pr:'Prov', prv:'Prov',
  ecc:'Eccl', qoh:'Eccl', sos:'Song', sng:'Song', songofsongs:'Song', is:'Isa', jr:'Jer',
  ez:'Ezek', dn:'Dan', jon:'Jonah', mt:'Matt', mk:'Mark', mrk:'Mark', lk:'Luke', jn:'John',
  ac:'Acts', rm:'Rom', ro:'Rom', '1co':'1Cor','2co':'2Cor', ga:'Gal', ep:'Eph', php:'Phil',
  pp:'Phil', co:'Col', '1th':'1Thess','2th':'2Thess', '1ti':'1Tim','2ti':'2Tim', tit:'Titus',
  phm:'Phlm', philem:'Phlm', hb:'Heb', jm:'Jas', james:'Jas', '1pt':'1Pet','2pt':'2Pet',
  '1jn':'1John','2jn':'2John','3jn':'3John', rv:'Rev', revelations:'Rev'
};

const exact = new Map<string, string>();
for (const [osis, name] of BOOKS) { exact.set(norm(osis), osis); exact.set(norm(name), osis); }
for (const [k, v] of Object.entries(EXTRA)) exact.set(k, v);

export function resolveBook(input: string): string | null {
  const n = norm(input);
  if (exact.has(n)) return exact.get(n)!;
  if (n.length < 3) return null;
  const hits = [...new Set([...exact].filter(([k]) => k.startsWith(n)).map(([, v]) => v))];
  return hits.length === 1 ? hits[0] : null;
}

const RE = /^\s*((?:[1-3]|I{1,3})?\s*[A-Za-z][A-Za-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+))?(?:\s*[-–—]\s*(?:(\d+)\s*[:.]\s*)?(\d+))?\s*$/;

const SINGLE_CHAPTER = new Set(['Obad', 'Phlm', '2John', '3John', 'Jude']);

export function parseRef(input: string): RefRange | null {
  const m = RE.exec(input);
  if (!m) return null;
  const book = resolveBook(m[1]);
  if (!book) return null;
  const ch = +m[2];
  const v = m[3] ? +m[3] : undefined;
    if (v === undefined) {
        if (SINGLE_CHAPTER.has(book)) {
            return { book, startChapter: 1, startVerse: ch, endChapter: 1, endVerse: m[5] ? +m[5] : ch };
        }
        return { book, startChapter: ch, endChapter: m[5] ? +m[5] : ch };
    }
  if (m[4]) return { book, startChapter: ch, startVerse: v, endChapter: +m[4], endVerse: +m[5] };
  return { book, startChapter: ch, startVerse: v, endChapter: ch, endVerse: m[5] ? +m[5] : v };
}

export const verseId = (book: string, ch: number, v: number) => `${book}.${ch}.${v}`;
