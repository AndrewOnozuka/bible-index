import Database from 'better-sqlite3';

export const db = new Database('db/bible-index.sqlite', { readonly: true, fileMustExist: true });
