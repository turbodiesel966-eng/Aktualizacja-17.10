-- One outstanding hosted Checkout session per account prevents duplicate concurrent subscriptions.
CREATE TABLE IF NOT EXISTS checkout_locks (
  user_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK (tier IN ('pro', 'warsztat')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  session_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_checkout_locks_expires ON checkout_locks(expires_at);
