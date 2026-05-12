-- ============================================================
-- MIGRATION 034: Guided Inspection Wizard
-- Creates the ridecheck_inspection_sessions,
-- ridecheck_inspection_steps, and ridecheck_inspection_issues
-- tables. Expands ridechecker_job_assignments status constraint.
-- Safe to run multiple times (all operations are idempotent).
-- ============================================================

-- ── 1. Inspection Sessions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ridecheck_inspection_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id     UUID        NOT NULL,
  order_id          UUID        NOT NULL,
  ridechecker_id    UUID        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'in_progress',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.ridecheck_inspection_sessions
    ADD CONSTRAINT chk_ris_status
    CHECK (status IN ('in_progress','submitted','abandoned'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ris_assignment_id
  ON public.ridecheck_inspection_sessions(assignment_id);

-- ── 2. Inspection Steps ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ridecheck_inspection_steps (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL,
  assignment_id   UUID        NOT NULL,
  step_key        TEXT        NOT NULL,
  section         TEXT        NOT NULL,
  answer          TEXT,
  severity        TEXT,
  note            TEXT,
  wide_photo_url  TEXT,
  close_photo_url TEXT,
  completed       BOOLEAN     NOT NULL DEFAULT false,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.ridecheck_inspection_steps
    ADD CONSTRAINT fk_rist_session
    FOREIGN KEY (session_id) REFERENCES public.ridecheck_inspection_sessions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ridecheck_inspection_steps
    ADD CONSTRAINT uq_rist_session_step
    UNIQUE (session_id, step_key);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_rist_session_id
  ON public.ridecheck_inspection_steps(session_id);

-- ── 3. Inspection Issues (flags) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ridecheck_inspection_issues (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID        NOT NULL,
  order_id        UUID        NOT NULL,
  ridechecker_id  UUID        NOT NULL,
  issue_type      TEXT        NOT NULL,
  note            TEXT,
  hold_triggered  BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_riii_assignment_id
  ON public.ridecheck_inspection_issues(assignment_id);

-- ── 4. Expand ridechecker_job_assignments status constraint ──────────────────

ALTER TABLE public.ridechecker_job_assignments
  DROP CONSTRAINT IF EXISTS chk_assignment_status;

ALTER TABLE public.ridechecker_job_assignments
  ADD CONSTRAINT chk_assignment_status CHECK (
    status IN (
      'awaiting_acceptance',
      'assigned',
      'accepted',
      'declined',
      'expired',
      'en_route',
      'arrived',
      'inspection_started',
      'inspecting',
      'photos_uploading',
      'report_pending',
      'report_processing',
      'in_progress',
      'submitted',
      'approved',
      'rejected',
      'paid',
      'cancelled',
      'escalated',
      'unsafe_hold',
      'fraud_hold'
    )
  );

-- ── 5. Add timestamps to assignments if missing ───────────────────────────────

ALTER TABLE public.ridechecker_job_assignments
  ADD COLUMN IF NOT EXISTS inspecting_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_processing_at  TIMESTAMPTZ;
