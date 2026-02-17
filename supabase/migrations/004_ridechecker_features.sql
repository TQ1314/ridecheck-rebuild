-- RideCheck Phase 10: RideChecker Approval, Assignment, Earnings, Referrals
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable or have defaults.
-- Run this migration manually in Supabase SQL Editor AFTER 003_phases_5_9.sql.

-- ==============================================
-- A) New columns on profiles for ridechecker data
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='service_area') THEN
    ALTER TABLE profiles ADD COLUMN service_area TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='experience') THEN
    ALTER TABLE profiles ADD COLUMN experience TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='referral_code') THEN
    ALTER TABLE profiles ADD COLUMN referral_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rating') THEN
    ALTER TABLE profiles ADD COLUMN rating NUMERIC(3,2) DEFAULT 5.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='approved_at') THEN
    ALTER TABLE profiles ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='approved_by') THEN
    ALTER TABLE profiles ADD COLUMN approved_by UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rejection_reason') THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rejected_at') THEN
    ALTER TABLE profiles ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add unique constraint on referral_code if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_referral_code_key'
  ) THEN
    BEGIN
      ALTER TABLE profiles ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_service_area ON profiles(service_area);

-- ==============================================
-- B) RideChecker Earnings table
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id UUID NOT NULL,
  order_id TEXT NOT NULL,
  package TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  payout_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earnings_ridechecker ON ridechecker_earnings(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_earnings_order ON ridechecker_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON ridechecker_earnings(status);

ALTER TABLE ridechecker_earnings ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- C) Referral Codes table
-- ==============================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraints safely
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_codes_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE referral_codes ADD CONSTRAINT referral_codes_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_codes_code_key'
  ) THEN
    BEGIN
      ALTER TABLE referral_codes ADD CONSTRAINT referral_codes_code_key UNIQUE (code);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- D) Referrals tracking table
-- ==============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referee_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  referee_completed_jobs INT NOT NULL DEFAULT 0,
  qualified_at TIMESTAMPTZ,
  reward_amount NUMERIC(10,2) NOT NULL DEFAULT 100.00,
  referrer_paid_at TIMESTAMPTZ,
  referee_paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- E) Add ridechecker roles to role_definitions (if table exists)
-- ==============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='role_definitions') THEN
    INSERT INTO role_definitions (role, display_name, description) VALUES
      ('ridechecker', 'RideChecker (Pending)', 'Applicant awaiting approval'),
      ('ridechecker_active', 'RideChecker (Active)', 'Approved vehicle assessment professional')
    ON CONFLICT (role) DO NOTHING;
  END IF;
END $$;

-- ==============================================
-- F) New column on orders for ridechecker pay
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ridechecker_pay') THEN
    ALTER TABLE orders ADD COLUMN ridechecker_pay NUMERIC(10,2);
  END IF;
END $$;
