CREATE TABLE IF NOT EXISTS verses (
  id TEXT PRIMARY KEY,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  sort INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verses_bc ON verses(book, chapter);

CREATE TABLE IF NOT EXISTS verse_text (
  verse_id TEXT NOT NULL REFERENCES verses(id),
  translation TEXT NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (verse_id, translation)
);

CREATE TABLE IF NOT EXISTS original_words (
  verse_id TEXT NOT NULL REFERENCES verses(id),
  position INTEGER NOT NULL,
  surface TEXT, lemma TEXT, strongs TEXT, morph TEXT, lang TEXT,
  PRIMARY KEY (verse_id, position)
);

CREATE TABLE IF NOT EXISTS lexicon (
  strongs TEXT PRIMARY KEY,
  lang TEXT, lemma TEXT, translit TEXT, definition TEXT, source TEXT
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY, name TEXT, summary TEXT, note_path TEXT
);

CREATE TABLE IF NOT EXISTS links (
  source_type TEXT NOT NULL, source_id TEXT NOT NULL,
  target_type TEXT NOT NULL, target_id TEXT NOT NULL,
  link_type TEXT
);
CREATE INDEX IF NOT EXISTS idx_links_src ON links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_links_tgt ON links(target_type, target_id);
