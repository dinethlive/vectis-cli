CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_tracked INTEGER DEFAULT 1,
  board_count INTEGER DEFAULT 0,
  pulled_at TEXT NOT NULL
);

CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_tracked INTEGER DEFAULT 1,
  layout_type TEXT,
  layer_count INTEGER DEFAULT 0,
  has_context INTEGER DEFAULT 0,
  pulled_at TEXT NOT NULL
);

CREATE TABLE components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  variants TEXT,
  annotation TEXT,
  pulled_at TEXT NOT NULL
);

CREATE TABLE token_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  tokens TEXT NOT NULL,
  pulled_at TEXT NOT NULL
);

CREATE TABLE flows (
  name TEXT PRIMARY KEY,
  screen_count INTEGER DEFAULT 0,
  context_path TEXT
);

CREATE TABLE specs (
  id TEXT PRIMARY KEY,
  board_name TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  status TEXT DEFAULT 'draft'
);

CREATE TABLE decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  flow TEXT,
  board TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  received_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_boards_page ON boards(page_id);
CREATE INDEX idx_boards_name ON boards(name);
CREATE INDEX idx_events_unprocessed ON events(processed) WHERE processed = 0
