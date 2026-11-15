-- Migration 0009: Affiliate Program, Wallet & New Subscription Plans (Weekend 19 PLN, Month 39 PLN, Year 79 PLN, Workshop VIP 149 PLN)
-- Safe and idempotent schema definitions for Cloudflare D1.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'amator',
  bonus_balance REAL NOT NULL DEFAULT 10.0,
  wallet_balance REAL NOT NULL DEFAULT 0.0,
  ref_code TEXT UNIQUE,
  referred_by TEXT,
  pro_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  ref_code TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  amount_gross REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  commission_amount REAL NOT NULL,
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(referrer_id) REFERENCES users(id),
  FOREIGN KEY(buyer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'blik',
  payout_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  processed_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_buyer ON referrals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id, created_at DESC);

