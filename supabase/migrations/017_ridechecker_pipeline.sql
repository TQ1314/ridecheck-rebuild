-- =============================================================
-- 017_ridechecker_pipeline.sql
-- Staged onboarding pipeline for RideChecker candidates.
-- ADDITIVE ONLY — no drops, no renames, all columns nullable/defaulted.
-- Run AFTER migration 016.
-- =============================================================

-- ==============================================
-- A) New columns on profiles
-- ==============================================
DO $$ BEGIN
  -- Primary pipeline tracker — independent of the role column.
  -- role = 'ridechecker'        → pending/applicant (no dashboard access)
  -- role = 'ridechecker_active' → approved (dashboard access granted)
  -- workflow_stage tracks where in the hiring process they are.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='workflow_stage') THEN
    ALTER TABLE profiles ADD COLUMN workflow_stage TEXT DEFAULT 'applied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='documents_complete') THEN
    ALTER TABLE profiles ADD COLUMN documents_complete BOOLEAN DEFAULT false;
  END IF;

  -- 'not_started' | 'pending' | 'clear' | 'failed'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='background_check_status') THEN
    ALTER TABLE profiles ADD COLUMN background_check_status TEXT DEFAULT 'not_started';
  END IF;

  -- 'not_started' | 'pending' | 'verified' | 'failed'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='references_status') THEN
    ALTER TABLE profiles ADD COLUMN references_status TEXT DEFAULT 'not_started';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='assessment_score') THEN
    ALTER TABLE profiles ADD COLUMN assessment_score NUMERIC(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='reviewer_notes') THEN
    ALTER TABLE profiles ADD COLUMN reviewer_notes TEXT;
  END IF;

  -- Secure one-time token for the onboarding setup link.
  -- Generated at approval time; cleared once invite is accepted.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='invite_token') THEN
    ALTER TABLE profiles ADD COLUMN invite_token TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='invite_sent_at') THEN
    ALTER TABLE profiles ADD COLUMN invite_sent_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='invite_accepted_at') THEN
    ALTER TABLE profiles ADD COLUMN invite_accepted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='suspended_at') THEN
    ALTER TABLE profiles ADD COLUMN suspended_at TIMESTAMPTZ;
  END IF;
END $$;

-- Unique index on invite_token (used for O(1) lookup on invite acceptance)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_invite_token
  ON profiles(invite_token)
  WHERE invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_workflow_stage
  ON profiles(workflow_stage);

-- ==============================================
-- B) Backfill workflow_stage for existing rows
-- Safe: only sets stage if the column is currently NULL.
-- ==============================================
UPDATE profiles
SET workflow_stage = 'active'
WHERE role = 'ridechecker_active'
  AND workflow_stage IS NULL;

UPDATE profiles
SET workflow_stage = 'applied'
WHERE role = 'ridechecker'
  AND workflow_stage IS NULL;

-- ==============================================
-- C) ridechecker_stage_history table
-- Immutable audit trail of every stage transition.
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_stage_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id UUID NOT NULL,        -- references profiles.id (no FK to avoid cascade issues)
  from_stage   TEXT,                   -- NULL for the initial 'applied' entry
  to_stage     TEXT NOT NULL,
  changed_by   UUID NOT NULL,          -- actor's profile id
  changed_by_email TEXT,
  changed_by_role  TEXT,
  notes        TEXT,                   -- optional reviewer comment at the time of transition
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_ridechecker
  ON ridechecker_stage_history(ridechecker_id);

CREATE INDEX IF NOT EXISTS idx_stage_history_created
  ON ridechecker_stage_history(created_at DESC);

ALTER TABLE ridechecker_stage_history ENABLE ROW LEVEL SECURITY;

-- ops_lead and above can read stage history; no client writes
DROP POLICY IF EXISTS "stage_history_select" ON ridechecker_stage_history;
CREATE POLICY "stage_history_select" ON ridechecker_stage_history
  FOR SELECT
  USING (public.is_ops_lead());

-- ==============================================
-- END OF 017_ridechecker_pipeline.sql
-- ==============================================
