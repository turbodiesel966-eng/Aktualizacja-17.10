-- One-time 24-hour WARSZTAT trial. UNIQUE(user_id) prevents re-claiming after expiry.
-- Additive only: existing accounts, licences, subscriptions and user data are untouched.
CREATE TABLE IF NOT EXISTS trial_entitlements (
  user_id TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier = 'warsztat'),
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_trial_entitlements_expiry
  ON trial_entitlements(expires_at);
