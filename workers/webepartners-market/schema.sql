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
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(program, external_id)
);
CREATE INDEX IF NOT EXISTS idx_market_products_category_title ON market_products(category, title);
CREATE INDEX IF NOT EXISTS idx_market_products_brand ON market_products(brand);
CREATE INDEX IF NOT EXISTS idx_market_products_program ON market_products(program);
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
