-- Account device inventory and optional bearer-token revocation by device.
-- Legacy tokens remain valid and unbound until a user opts in to device registration.
ALTER TABLE api_tokens ADD COLUMN device_id_hash TEXT;

CREATE TABLE IF NOT EXISTS user_devices (
  device_id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Urządzenie',
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_last_seen
  ON user_devices(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_tokens_device
  ON api_tokens(user_id, device_id_hash);
