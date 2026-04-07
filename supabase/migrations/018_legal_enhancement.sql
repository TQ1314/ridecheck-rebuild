-- =============================================================
-- 018_legal_enhancement.sql
-- Extends legal acceptance tracking with explicit per-checkbox booleans.
-- ADDITIVE ONLY — no drops, no renames.
-- Run AFTER migration 017.
-- =============================================================

-- ── terms_acceptances: add per-checkbox booleans ──────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='terms_acceptances' AND column_name='disclaimer_accepted') THEN
    ALTER TABLE terms_acceptances ADD COLUMN disclaimer_accepted BOOLEAN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='terms_acceptances' AND column_name='no_sole_reliance_accepted') THEN
    ALTER TABLE terms_acceptances ADD COLUMN no_sole_reliance_accepted BOOLEAN;
  END IF;

  -- Track which version of the legal text was accepted
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='terms_acceptances' AND column_name='legal_version') THEN
    ALTER TABLE terms_acceptances ADD COLUMN legal_version TEXT;
  END IF;
END $$;

-- ── orders: per-checkbox boolean columns ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='disclaimer_accepted') THEN
    ALTER TABLE orders ADD COLUMN disclaimer_accepted BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='no_sole_reliance_accepted') THEN
    ALTER TABLE orders ADD COLUMN no_sole_reliance_accepted BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ==============================================
-- END OF 018_legal_enhancement.sql
-- ==============================================
