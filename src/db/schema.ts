export const SCHEMA_VERSION = 1;

/** Run once per connection, before anything else. */
export const PRAGMAS_SQL = 'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;';

export const SCHEMA_V1_SQL = `
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  model TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  chatId TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'pending', 'error')),
  errorCode TEXT,
  errorMessage TEXT,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chatId_createdAt ON messages(chatId, createdAt);
CREATE INDEX IF NOT EXISTS idx_chats_updatedAt ON chats(updatedAt);
`;
