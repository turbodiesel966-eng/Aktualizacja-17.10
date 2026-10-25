-- Additive admin, promo-code, and privacy-minimised analytics tables.
-- Safe to apply to an existing production D1 database; no existing rows are dropped.

CREATE TABLE IF NOT EXISTS admin_settings (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  bootstrapped_by TEXT NOT NULL,
  bootstrapped_at INTEGER NOT NULL,
  FOREIGN KEY (bootstrapped_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  granted_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL CHECK (tier IN ('pro', 'warsztat')),
  duration_days INTEGER NOT NULL CHECK (duration_days IN (3, 7)),
  max_redemptions INTEGER NOT NULL CHECK (max_redemptions BETWEEN 1 AND 10000),
  redemption_count INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  starts_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_enabled_expiry ON promo_codes(enabled, expires_at);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id TEXT PRIMARY KEY,
  promo_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('pro', 'warsztat')),
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  redeemed_at INTEGER NOT NULL,
  UNIQUE (promo_id, user_id),
  FOREIGN KEY (promo_id) REFERENCES promo_codes(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user_expiry ON promo_redemptions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_expiry ON promo_redemptions(expires_at);

-- Store hashed random browser/session identifiers only; never store raw IP addresses.
CREATE TABLE IF NOT EXISTS app_visits (
  id TEXT PRIMARY KEY,
  visitor_hash TEXT NOT NULL,
  session_hash TEXT NOT NULL UNIQUE,
  user_id TEXT,
  visit_day TEXT NOT NULL,
  visited_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_app_visits_visited_at ON app_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_app_visits_user_time ON app_visits(user_id, visited_at);
CREATE INDEX IF NOT EXISTS idx_app_visits_day ON app_visits(visit_day);
