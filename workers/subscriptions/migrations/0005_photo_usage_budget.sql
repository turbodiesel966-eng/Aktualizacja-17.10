-- NAPRAWNIK migration 0005: admin promo history and aggregate photo AI cost budget.
-- Additive only. Existing accounts, subscriptions and promo grants are retained.

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_redeemed_at
  ON promo_redemptions(redeemed_at);

-- One row per UTC month. The ledger has aggregate estimates only, no customer identifiers or images.
CREATE TABLE IF NOT EXISTS photo_usage_budget (
  period_start INTEGER PRIMARY KEY,
  budget_microusd INTEGER NOT NULL CHECK (budget_microusd BETWEEN 1 AND 100000000),
  reserved_microusd INTEGER NOT NULL DEFAULT 0 CHECK (reserved_microusd >= 0),
  actual_microusd INTEGER NOT NULL DEFAULT 0 CHECK (actual_microusd >= 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photo_usage_budget_updated_at ON photo_usage_budget(updated_at);

-- Paid one-time access packages; only verified Stripe Checkout sessions grant time-limited access.
CREATE TABLE IF NOT EXISTS one_time_purchases (
  checkout_session_id TEXT PRIMARY KEY,
  payment_intent_id TEXT UNIQUE,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('pro', 'warsztat')),
  duration_days INTEGER NOT NULL CHECK (duration_days IN (3, 7)),
  price_id TEXT NOT NULL,
  amount_total INTEGER NOT NULL CHECK (amount_total IN (300, 500, 700, 1000)),
  currency TEXT NOT NULL CHECK (currency = 'pln'),
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_one_time_purchases_user_expiry ON one_time_purchases(user_id, expires_at);

CREATE TABLE IF NOT EXISTS one_time_checkout_locks (
  user_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK (tier IN ('pro', 'warsztat')),
  duration_days INTEGER NOT NULL CHECK (duration_days IN (3, 7)),
  session_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_one_time_checkout_locks_expires ON one_time_checkout_locks(expires_at);
