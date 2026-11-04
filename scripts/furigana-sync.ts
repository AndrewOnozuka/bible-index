import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const DB = 'db/bible-index.sqlite';
const OVERRIDES = 'data/furigana-overrides.tsv';
const SCRIPT = 'scripts/add-furigana.ts';
const STAMP = 'db/.furigana-hash';
const force = process.argv.includes('--force');

// Only these translations get readings generated on dev start
const TARGETS = ['JapSKY2017'];

if (!fs.existsSync(DB)) process.exit(0);

const read = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f) : Buffer.alloc(0));
const hash = createHash('sha256').update(read(OVERRIDES)).update(read(SCRIPT)).digest('hex');

const db = new Database(DB, { readonly: true });
const translations = (
  db.prepare("SELECT DISTINCT translation FROM verse_text WHERE translation LIKE 'Jap%'").all() as { translation: string }[]
).map((r) => r.translation).filter((t) => TARGETS.includes(t));

let hasReadings = false;
try {
  hasReadings = ((db.prepare('SELECT COUNT(*) AS n FROM verse_ruby WHERE translation = ?').get(TARGETS[0]) as { n: number }).n) > 0;
} catch {
  // verse_ruby does not exist yet
}
db.close();

if (!translations.length) process.exit(0);

const previous = fs.existsSync(STAMP) ? fs.readFileSync(STAMP, 'utf8').trim() : '';
if (!force && hasReadings && previous === hash) {
  console.log('Furigana is up to date.');
  process.exit(0);
}

console.log(`Furigana overrides changed. Regenerating for ${translations.join(', ')}...`);
const result = spawnSync('npx', ['tsx', SCRIPT, ...translations], { stdio: 'inherit' });
if (result.status === 0) {
  fs.writeFileSync(STAMP, hash);
} else {
  console.log('Furigana regeneration failed. Starting anyway; run it by hand to see the error.');
}
process.exit(0);
