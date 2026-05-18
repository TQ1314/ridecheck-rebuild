-- ============================================================
-- MIGRATION 035: RideChecker Score Card System
-- Creates ridechecker_score_events table and adds score
-- columns to profiles. Fully idempotent / safe to re-run.
-- ============================================================

-- ── 1. New profile columns ────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_score') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_score INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rejection_count_30d') THEN
    ALTER TABLE profiles ADD COLUMN rejection_count_30d INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_score_updated_at') THEN
    ALTER TABLE profiles ADD COLUMN last_score_updated_at TIMESTAMPTZ;
  END IF;
END $$;

-- ── 2. Score events table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ridechecker_score_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id   UUID,
  order_id        UUID,
  event_type      TEXT        NOT NULL,
  points          INT         NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Anti-gaming: one event type per assignment per RideChecker ─────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_score_event_per_assignment'
  ) THEN
    ALTER TABLE public.ridechecker_score_events
      ADD CONSTRAINT uq_score_event_per_assignment
      UNIQUE (ridechecker_id, assignment_id, event_type);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rse_ridechecker ON public.ridechecker_score_events(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_rse_assignment   ON public.ridechecker_score_events(assignment_id);
CREATE INDEX IF NOT EXISTS idx_rse_created      ON public.ridechecker_score_events(created_at DESC);

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.ridechecker_score_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ridechecker_score_events' AND policyname = 'rse_rc_read_own') THEN
    CREATE POLICY rse_rc_read_own ON public.ridechecker_score_events
      FOR SELECT USING (auth.uid() = ridechecker_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ridechecker_score_events' AND policyname = 'rse_ops_read_all') THEN
    CREATE POLICY rse_ops_read_all ON public.ridechecker_score_events
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('operations','operations_lead','ops_lead','admin','owner','ops','qa')
        )
      );
  END IF;
END $$;
