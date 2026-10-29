import Database from 'better-sqlite3';
import { existsSync, unlinkSync, statSync } from 'node:fs';

const source = new Database('db/bible-index.sqlite', {
  readonly: true,
  fileMustExist: true
});

const outputPath = 'db/bible-index-kjv.sqlite';

if (existsSync(outputPath)) {
  unlinkSync(outputPath);
}

const target = new Database(outputPath);

target.exec(`
  CREATE TABLE verses (
    id TEXT PRIMARY KEY,
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    sort INTEGER NOT NULL
  );

  CREATE TABLE verse_text (
    verse_id TEXT NOT NULL,
    translation TEXT NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (verse_id, translation)
  );

  CREATE TABLE original_words (
    verse_id TEXT,
    position INTEGER,
    wtype TEXT,
    surface TEXT,
    translit TEXT,
    english TEXT,
    strongs TEXT,
    morph TEXT,
    lemma TEXT,
    gloss TEXT,
    lang TEXT,
    estrong TEXT
  );

  CREATE TABLE lexicon (
    strongs TEXT,
    lang TEXT,
    lemma TEXT,
    translit TEXT,
    pos TEXT,
    gloss TEXT,
    definition TEXT,
    source TEXT
  );

  CREATE INDEX idx_verses_book_chapter
    ON verses(book, chapter, verse);

  CREATE INDEX idx_verse_text_translation
    ON verse_text(translation, verse_id);
`);

const insertVerse = target.prepare(`
  INSERT INTO verses (id, book, chapter, verse, sort)
  VALUES (@id, @book, @chapter, @verse, @sort)
`);

const insertText = target.prepare(`
  INSERT INTO verse_text (verse_id, translation, text)
  VALUES (@verse_id, @translation, @text)
`);

const copyData = target.transaction(() => {
  for (const row of source.prepare(
    'SELECT id, book, chapter, verse, sort FROM verses'
  ).iterate()) {
    insertVerse.run(row);
  }

  for (const row of source.prepare(
    `SELECT verse_id, translation, text
     FROM verse_text
     WHERE translation = 'KJV'`
  ).iterate()) {
    insertText.run(row);
  }
});

copyData();

source.close();
target.close();

console.log('Created:', outputPath);
console.log(
  'File size:',
  (statSync(outputPath).size / 1024 / 1024).toFixed(2),
  'MB'
);