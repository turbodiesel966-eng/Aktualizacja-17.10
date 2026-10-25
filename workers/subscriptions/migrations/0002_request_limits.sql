-- Fixed-window counters; the Worker stores a hash rather than a raw client IP.
CREATE TABLE IF NOT EXISTS request_limits (
  scope TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope, subject_hash)
);
CREATE INDEX IF NOT EXISTS idx_request_limits_updated ON request_limits(updated_at);
