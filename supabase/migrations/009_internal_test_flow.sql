-- RideCheck: Internal $1 End-to-End Test Flow
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable or have defaults.
-- Run this migration manually in Supabase SQL Editor AFTER 008.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='is_internal_test') THEN
    ALTER TABLE orders ADD COLUMN is_internal_test BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='test_run_id') THEN
    ALTER TABLE orders ADD COLUMN test_run_id TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ridechecker_earnings' AND column_name='is_internal_test') THEN
    ALTER TABLE ridechecker_earnings ADD COLUMN is_internal_test BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ridechecker_job_assignments' AND column_name='is_internal_test') THEN
    ALTER TABLE ridechecker_job_assignments ADD COLUMN is_internal_test BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_is_internal_test ON orders(is_internal_test) WHERE is_internal_test = TRUE;
