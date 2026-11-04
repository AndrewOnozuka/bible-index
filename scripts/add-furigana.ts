import Database from 'better-sqlite3';
import fs from 'node:fs';
import kuromoji from 'kuromoji';

const OVERRIDES = 'data/furigana-overrides.tsv';
const args = process.argv.slice(2);
const showMode = args[0] === '--show';
if (!args.length) {
  console.error('Usage:\n  npx tsx scripts/add-furigana.ts JapSKY2017\n  npx tsx scripts/add-furigana.ts --show JapSKY2017 John.3.16');
  process.exit(1);
}

const KANJI = /[\u4E00-\u9FFF\u3400-\u4DBF々〆ヶ]/;
const isKanji = (c: string) => KANJI.test(c);
const toHira = (s: string) => s.replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let unreadable = 0;

// Put the reading only over the kanji part, leaving okurigana (trailing kana) outside
function ruby(surface: string, reading: string | undefined): string {
  if (!isKanji(surface)) return esc(surface);
  if (!reading || reading === '*') { unreadable++; return esc(surface); }
  // Align the reading per kanji run when kana sits between kanji (振り向い -> 振[ふ]り向[む]い)
  const parts: string[] = [];
  for (const ch of surface) {
    const k = isKanji(ch);
    if (parts.length && isKanji(parts[parts.length - 1][0]) === k) parts[parts.length - 1] += ch;
    else parts.push(ch);
  }
  if (parts.filter((p) => isKanji(p[0])).length > 1) {
    const rd = toHira(reading);
    let pos = 0;
    let out = '';
    let ok = true;
    for (let i = 0; i < parts.length && ok; i++) {
      const p = parts[i];
      if (isKanji(p[0])) {
        const next = parts[i + 1];
        const end = next === undefined ? rd.length : rd.indexOf(toHira(next), pos + 1);
        if (end <= pos) { ok = false; break; }
        out += '<ruby>' + esc(p) + '<rt>' + esc(rd.slice(pos, end)) + '</rt></ruby>';
        pos = end;
      } else {
        const lit = toHira(p);
        if (rd.slice(pos, pos + lit.length) !== lit) { ok = false; break; }
        out += esc(p);
        pos += lit.length;
      }
    }
    if (ok && pos === rd.length) return out;
  }

  let s = surface;
  let r = toHira(reading);
  let pre = '';
  let suf = '';
  while (s.length > 1 && r.length > 1 && !isKanji(s[0]) && toHira(s[0]) === r[0]) {
    pre += s[0]; s = s.slice(1); r = r.slice(1);
  }
  while (s.length > 1 && r.length > 1 && !isKanji(s[s.length - 1]) && toHira(s[s.length - 1]) === r[r.length - 1]) {
    suf = s[s.length - 1] + suf; s = s.slice(0, -1); r = r.slice(0, -1);
  }
  return esc(pre) + '<ruby>' + esc(s) + '<rt>' + esc(r) + '</rt></ruby>' + esc(suf);
}

// ---- overrides ----
const global = new Map<string, string>();
const byVerse = new Map<string, Map<string, string>>();
const used = new Set<string>();

if (fs.existsSync(OVERRIDES)) {
  for (const raw of fs.readFileSync(OVERRIDES, 'utf8').split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.startsWith('#')) continue;
    const c = line.trim().split(/\s+/);
    const scoped = /^[1-3]?[A-Za-z]+(\.\d+){0,2}$/.test(c[0]);
    const pairs = scoped ? c.slice(1) : c;
    if (pairs.length < 2 || pairs.length % 2 !== 0) { console.log(`Skipping malformed override line: ${line}`); continue; }
    for (let k = 0; k < pairs.length; k += 2) {
      if (scoped) {
        if (!byVerse.has(c[0])) byVerse.set(c[0], new Map());
        byVerse.get(c[0])!.set(pairs[k], pairs[k + 1]);
      } else global.set(pairs[k], pairs[k + 1]);
    }
  }
}

// Scopes checked from most to least specific: verse, chapter, book
const scopesOf = (id: string) => { const p = id.split('.'); return [id, p.slice(0, 2).join('.'), p[0]]; };

function render(tokens: any[], verseId: string): string {
  const scopes = scopesOf(verseId);
  let out = '';
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    for (let len = Math.min(4, tokens.length - i); len >= 1; len--) {
      const s = tokens.slice(i, i + len).map((t) => t.surface_form).join('');
      let r: string | undefined;
      let key = s;
      for (const sc of scopes) {
        const x = byVerse.get(sc)?.get(s);
        if (x !== undefined) { r = x; key = `${sc}\t${s}`; break; }
      }
      if (r === undefined) r = global.get(s);
      if (r !== undefined) {
        used.add(key);
        out += r === '-' ? esc(s) : ruby(s, r);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) { out += ruby(tokens[i].surface_form, tokens[i].reading); i++; }
  }
  return out;
}

async function main() {
  const tokenizer: any = await new Promise((resolve, reject) =>
    kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((e: any, t: any) => (e ? reject(e) : resolve(t)))
  );
  const db = new Database('db/bible-index.sqlite');

  if (showMode) {
    const [tr, vid] = args.slice(1);
    const row = db.prepare('SELECT text FROM verse_text WHERE translation = ? AND verse_id = ?').get(tr, vid) as { text: string } | undefined;
    if (!row) { console.log('Verse not found. Usage: --show JapSKY2017 John.3.16'); return; }
    const toks = tokenizer.tokenize(row.text) as any[];
    console.log(row.text + '\n');
    console.log('Pieces (use these in the overrides file):');
    for (const t of toks) if (isKanji(t.surface_form)) console.log(`  ${t.surface_form}\t${t.reading ? toHira(t.reading) : '?'}`);
    console.log('\nWith overrides applied:\n' + render(toks, vid));
    return;
  }

  db.exec(`CREATE TABLE IF NOT EXISTS verse_ruby (
    verse_id TEXT NOT NULL,
    translation TEXT NOT NULL,
    html TEXT NOT NULL,
    PRIMARY KEY (verse_id, translation)
  )`);
  const ins = db.prepare('INSERT OR REPLACE INTO verse_ruby (verse_id, translation, html) VALUES (?,?,?)');

  for (const tr of args) {
    const rows = db.prepare('SELECT verse_id, text FROM verse_text WHERE translation = ?').all(tr) as { verse_id: string; text: string }[];
    if (!rows.length) { console.log(`No verses found for ${tr}`); continue; }
    unreadable = 0;
    db.transaction(() => {
      db.prepare('DELETE FROM verse_ruby WHERE translation = ?').run(tr);
      for (const r of rows) ins.run(r.verse_id, tr, render(tokenizer.tokenize(r.text) as any[], r.verse_id));
    })();
    console.log(`${tr}: wrote readings for ${rows.length} verses (${unreadable} kanji words had no reading).`);
  }

  const all = [...global.keys(), ...[...byVerse].flatMap(([v, m]) => [...m.keys()].map((k) => `${v}\t${k}`))];
  const unused = all.filter((k) => !used.has(k));
  console.log(`Overrides: ${all.length - unused.length} of ${all.length} applied.`);
  if (unused.length) console.log('Never matched (typo, or the word is split differently):\n  ' + unused.join('\n  '));
}

main();
