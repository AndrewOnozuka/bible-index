import fs from 'node:fs';

const dir = 'src/routes/read/[book]/[chapter]/';
const edits = {
  '+page.server.ts': [
    [`export function load({ params, url, cookies }) {`,
`function rubyFor(translation: string | null, book: string, chapter: number): Record<number, string> {
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

export function load({ params, url, cookies }) {`],
    [`translations: ['KJV'],`,
`translations: ['KJV'],
      showRuby: false,
      ruby: {} as Record<number, string>,
      ruby2: {} as Record<number, string>,`],
    [`  const hasOriginal = !!orig;`,
`  const rParam = url.searchParams.get('r');
  if (rParam !== null) cookies.set('ruby', rParam === '1' ? '1' : '0', cookieOpts);
  const showRuby = (rParam ?? cookies.get('ruby')) === '1';
  const ruby = showRuby ? rubyFor(translation, params.book, chapter) : {};
  const ruby2 = showRuby ? rubyFor(translation2, params.book, chapter) : {};

  const hasOriginal = !!orig;`],
    [`    lang,
    words
  };`,
`    lang,
    words,
    showRuby,
    ruby,
    ruby2
  };`]
  ],
  '+page.svelte': [
    [`  const rtl = $derived(data.lang === 'heb');`,
`  const rtl = $derived(data.lang === 'heb');
  const hasJa = $derived([data.translation, data.translation2].some((t) => t?.startsWith('Jap')));`],
    [`function qs(o: { t?: string; t2?: string | null; i?: boolean } = {}) {`,
     `function qs(o: { t?: string; t2?: string | null; i?: boolean; r?: boolean } = {}) {`],
    [`    if (o.i ?? data.interlinear) p.set('i', '1');`,
`    if (o.i ?? data.interlinear) p.set('i', '1');
    p.set('r', (o.r ?? data.showRuby) ? '1' : '0');`],
    [`<p>
  {#if data.hasOriginal}`,
`{#if hasJa}
  <p>
    {#if data.showRuby}
      <a href={qs({ r: false })}>Hide readings</a>
    {:else}
      <a href={qs({ r: true })}>Show readings</a>
    {/if}
  </p>
{/if}

<p>
  {#if data.hasOriginal}`],
    [`      {#if v.text}{v.text}{:else}<em>(verse not present in {data.translation})</em>{/if}`,
     `      {#if data.ruby[v.verse]}{@html data.ruby[v.verse]}{:else if v.text}{v.text}{:else}<em>(verse not present in {data.translation})</em>{/if}`],
    [`        {#if v.text2}{v.text2}{:else}<em>(verse not present in {data.translation2})</em>{/if}`,
     `        {#if data.ruby2[v.verse]}{@html data.ruby2[v.verse]}{:else if v.text2}{v.text2}{:else}<em>(verse not present in {data.translation2})</em>{/if}`],
    [`  .il { display: flex;`,
`  :global(ruby rt) { font-size: 0.55em; opacity: 0.8; }
  p[lang='ja'] { line-height: 2.1; }
  .il { display: flex;`]
  ]
};

const next = {};
let ok = true;
for (const [file, list] of Object.entries(edits)) {
  let s = fs.readFileSync(dir + file, 'utf8');
  for (const [from, to] of list) {
    const n = s.split(from).length - 1;
    if (n !== 1) { console.log(`PROBLEM in ${file}: found ${n} matches for: ${from.split('\n')[0]}`); ok = false; continue; }
    s = s.replace(from, () => to);
  }
  next[file] = s;
}
if (ok) {
  for (const [file, s] of Object.entries(next)) fs.writeFileSync(dir + file, s);
  console.log('Patched both files.');
} else {
  console.log('Nothing was changed.');
}
