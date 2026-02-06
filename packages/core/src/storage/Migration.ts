/**
 * Database migrations for SQLite schema
 */

export const MIGRATIONS = [
  `
CREATE TABLE IF NOT EXISTS explanations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  structural_signature TEXT NOT NULL,
  text TEXT NOT NULL,
  summary TEXT NOT NULL,
  concepts TEXT,
  confidence REAL NOT NULL,
  source TEXT NOT NULL,
  related_symbols TEXT,
  related_files TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,
  access_count INTEGER DEFAULT 0,
  UNIQUE(user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_explanations_hash ON explanations(user_id, code_hash);
CREATE INDEX IF NOT EXISTS idx_explanations_accessed ON explanations(accessed_at);
`,
  `
CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  symbol_name TEXT NOT NULL,
  symbol_type TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  definition TEXT,
  signature TEXT,
  documentation TEXT,
  dependencies TEXT,
  exports TEXT,
  metadata TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(user_id, file_path);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(user_id, symbol_name);
`,
  `
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  text TEXT NOT NULL,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_hash ON annotations(code_hash);
`,
  `
CREATE TABLE IF NOT EXISTS usage_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_stats ON usage_stats(user_id, timestamp);
`,
  `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

INSERT OR IGNORE INTO schema_version (version) VALUES (4);
`,
];
