-- 044_founding_supporters.sql
-- Founding Supporter Campaign — ridecheck_credits table

CREATE TABLE IF NOT EXISTS ridecheck_credits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type          TEXT NOT NULL DEFAULT 'founding_supporter',
  tier                  TEXT NOT NULL CHECK (tier IN ('backer', 'believer', 'founding_partner')),
  amount_cents          INTEGER NOT NULL,
  credits_count         INTEGER NOT NULL DEFAULT 1,
  credit_code           TEXT NOT NULL UNIQUE,
  supporter_name        TEXT NOT NULL,
  supporter_email       TEXT NOT NULL,
  supporter_phone       TEXT,
  gift_recipient_name   TEXT,
  gift_recipient_email  TEXT,
  gift_message          TEXT,
  list_on_partners_page BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_session_id     TEXT,
  status                TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redeemed', 'expired')),
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ridecheck_credits_email    ON ridecheck_credits (supporter_email);
CREATE INDEX IF NOT EXISTS idx_ridecheck_credits_status   ON ridecheck_credits (status);
CREATE INDEX IF NOT EXISTS idx_ridecheck_credits_stripe   ON ridecheck_credits (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_ridecheck_credits_partners ON ridecheck_credits (list_on_partners_page, status, created_at);

COMMENT ON TABLE ridecheck_credits IS
  'Founding Supporter campaign credits. One row per purchase. credits_count=2 for founding_partner tier.';
