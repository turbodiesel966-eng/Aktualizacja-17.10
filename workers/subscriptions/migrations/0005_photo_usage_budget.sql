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
