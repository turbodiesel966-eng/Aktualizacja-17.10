-- NAPRAWNIK Subscription Worker — limity planów i liczniki zużycia (idempotentne, atomowe).
CREATE TABLE IF NOT EXISTS usage_counters (
  user_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  period_key TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, metric, period_key)
);

CREATE TABLE IF NOT EXISTS usage_events (
  user_id TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  metric TEXT NOT NULL,
  amount INTEGER NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0,
  period_key TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, idem_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events (created_at);
