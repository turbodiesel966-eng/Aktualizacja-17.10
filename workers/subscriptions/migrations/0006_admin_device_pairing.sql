-- Additive one-time device pairing for the existing NAPRAWNIK owner account.
-- Codes are stored only as SHA-256 hashes, expire after 10 minutes, and are single-use.
CREATE TABLE IF NOT EXISTS admin_device_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_by TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_admin_device_codes_expiry
  ON admin_device_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_device_codes_user
  ON admin_device_codes(user_id, created_at);
