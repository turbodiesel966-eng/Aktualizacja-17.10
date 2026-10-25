-- Idempotent baseline copied from the deployed subscription Worker schema.
-- CREATE IF NOT EXISTS keeps existing records and existing schemas intact.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, tier TEXT NOT NULL DEFAULT 'amator',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS api_tokens (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL,
  expires_at INTEGER, revoked_at INTEGER, last_used_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS checkout_requests (
  idempotency_key TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_id TEXT, created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS stripe_customers (
  stripe_customer_id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, event_created INTEGER, processed_at INTEGER,
  processing INTEGER NOT NULL DEFAULT 0, claimed_at INTEGER, last_error TEXT
);
CREATE TABLE IF NOT EXISTS subscriptions (
  stripe_subscription_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, stripe_customer_id TEXT,
  tier TEXT NOT NULL DEFAULT 'amator', price_id TEXT, billing_interval TEXT, status TEXT NOT NULL,
  current_period_end INTEGER NOT NULL, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, grace_until INTEGER,
  stripe_created_at INTEGER, updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS user_data (
  user_id TEXT NOT NULL, data_key TEXT NOT NULL, json_value TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, data_key), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
