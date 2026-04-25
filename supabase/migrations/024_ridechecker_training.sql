-- Migration 024: RideChecker Training / Certification
-- Creates ridechecker_training_results table.
-- Adds training_sip4_completed column to profiles.
-- ADDITIVE ONLY — no drops, no renames.

-- =============================================================
-- A) training_sip4_completed flag on profiles
-- =============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'training_sip4_completed'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN training_sip4_completed BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- =============================================================
-- B) ridechecker_training_results table
-- (updated_at is managed by the API on every upsert — no trigger needed)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.ridechecker_training_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id      TEXT        NOT NULL,
  score          INTEGER     NOT NULL,
  passed         BOOLEAN     NOT NULL DEFAULT false,
  attempts       INTEGER     NOT NULL DEFAULT 1,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per ridechecker per module (enables upsert on conflict)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ridechecker_training_results_ridechecker_module_unique'
  ) THEN
    ALTER TABLE public.ridechecker_training_results
      ADD CONSTRAINT ridechecker_training_results_ridechecker_module_unique
        UNIQUE (ridechecker_id, module_id);
  END IF;
END $$;

-- Index for fast ridechecker look-ups
CREATE INDEX IF NOT EXISTS idx_training_results_ridechecker
  ON public.ridechecker_training_results (ridechecker_id);

-- RLS: ridecheckers can read their own results; all writes go through service role
ALTER TABLE public.ridechecker_training_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ridechecker_training_results'
      AND policyname = 'rc_training_select_own'
  ) THEN
    CREATE POLICY "rc_training_select_own"
      ON public.ridechecker_training_results
      FOR SELECT TO authenticated
      USING (ridechecker_id = auth.uid());
  END IF;
END $$;
