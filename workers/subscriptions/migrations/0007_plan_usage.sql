-- NAPRAWNIK usage counters. Append-only quota ledger; user records are never deleted on downgrade.
CREATE TABLE IF NOT EXISTS plan_usage (
  user_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  period_start INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, metric, period_start),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_plan_usage_user_period
  ON plan_usage(user_id, period_start);
CREATE TABLE IF NOT EXISTS plan_usage_events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  period_start INTEGER NOT NULL DEFAULT 0,
  delta INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_plan_usage_events_user_time
  ON plan_usage_events(user_id, created_at);
