-- Migration 024: RideChecker Training / Certification
-- Adds training_sip4_completed to profiles.
-- Creates ridechecker_training_results table.
-- ADDITIVE ONLY — no drops, no renames.

-- ── A) training_sip4_completed flag on profiles ───────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS training_sip4_completed BOOLEAN NOT NULL DEFAULT false;

-- ── B) ridechecker_training_results table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ridechecker_training_results (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id      TEXT        NOT NULL,
  score          INTEGER     NOT NULL,
  passed         BOOLEAN     NOT NULL DEFAULT false,
  attempts       INTEGER     NOT NULL DEFAULT 1,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── C) Unique index — enables upsert ON CONFLICT (ridechecker_id, module_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_results_unique
  ON public.ridechecker_training_results (ridechecker_id, module_id);

-- ── D) Look-up index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_training_results_ridechecker
  ON public.ridechecker_training_results (ridechecker_id);

-- ── E) Row-level security ────────────────────────────────────────────────
ALTER TABLE public.ridechecker_training_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rc_training_select_own" ON public.ridechecker_training_results;
CREATE POLICY "rc_training_select_own"
  ON public.ridechecker_training_results
  FOR SELECT TO authenticated
  USING (ridechecker_id = auth.uid());
