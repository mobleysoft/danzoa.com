CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  studio_name TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(email)
);
