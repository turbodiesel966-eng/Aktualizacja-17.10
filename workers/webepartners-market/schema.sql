-- Dedicated NAPRAWNIK MARKET catalog database. Never run against subscriptions/live DB.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS market_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  category TEXT NOT NULL DEFAULT 'inne',
  price REAL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  product_url TEXT NOT NULL,
  image_url TEXT,
  is_workshop INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(program, external_id)
);
CREATE INDEX IF NOT EXISTS idx_market_products_workshop ON market_products(is_workshop);
CREATE INDEX IF NOT EXISTS idx_market_products_workshop_category ON market_products(is_workshop, category);
CREATE INDEX IF NOT EXISTS idx_market_products_workshop_title ON market_products(is_workshop, title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_market_products_workshop_price ON market_products(is_workshop, price);
CREATE INDEX IF NOT EXISTS idx_market_products_category_title ON market_products(category, title);
CREATE INDEX IF NOT EXISTS idx_market_products_brand ON market_products(brand);
CREATE INDEX IF NOT EXISTS idx_market_products_program ON market_products(program);

CREATE VIRTUAL TABLE IF NOT EXISTS market_products_fts USING fts5(
  title,
  brand,
  category,
  description,
  content='market_products',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS market_products_ai AFTER INSERT ON market_products BEGIN
  INSERT INTO market_products_fts(rowid, title, brand, category, description)
  VALUES (new.id, new.title, coalesce(new.brand, ''), new.category, coalesce(new.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS market_products_ad AFTER DELETE ON market_products BEGIN
  INSERT INTO market_products_fts(market_products_fts, rowid, title, brand, category, description)
  VALUES ('delete', old.id, old.title, coalesce(old.brand, ''), old.category, coalesce(old.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS market_products_au AFTER UPDATE ON market_products BEGIN
  INSERT INTO market_products_fts(market_products_fts, rowid, title, brand, category, description)
  VALUES ('delete', old.id, old.title, coalesce(old.brand, ''), old.category, coalesce(old.description, ''));
  INSERT INTO market_products_fts(rowid, title, brand, category, description)
  VALUES (new.id, new.title, coalesce(new.brand, ''), new.category, coalesce(new.description, ''));
END;

CREATE TABLE IF NOT EXISTS market_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ok','error')),
  product_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_market_sync_runs_created ON market_sync_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS market_sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
