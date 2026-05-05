-- ============================================================
-- MIGRATION 032: Assignment Acceptance Flow
-- Upgrades ridechecker_job_assignments to support a full
-- awaiting_acceptance → accepted / declined / expired lifecycle.
-- Also adds expires_at and declined_at columns.
-- Safe to run multiple times (all operations are idempotent).
-- ============================================================

-- 1. Drop the old status CHECK constraint so we can expand the enum
ALTER TABLE public.ridechecker_job_assignments
  DROP CONSTRAINT IF EXISTS chk_assignment_status;

-- 2. Add new columns (idempotent)
ALTER TABLE public.ridechecker_job_assignments
  ADD COLUMN IF NOT EXISTS expires_at   TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS declined_at  TIMESTAMPTZ NULL;

-- 3. Re-create the CHECK constraint with expanded values
ALTER TABLE public.ridechecker_job_assignments
  ADD CONSTRAINT chk_assignment_status CHECK (
    status IN (
      'awaiting_acceptance',
      'assigned',
      'accepted',
      'declined',
      'expired',
      'in_progress',
      'submitted',
      'approved',
      'rejected',
      'paid',
      'cancelled'
    )
  );

-- 4. Index for expiry sweeps
CREATE INDEX IF NOT EXISTS idx_assignments_expires_at
  ON public.ridechecker_job_assignments (expires_at)
  WHERE status = 'awaiting_acceptance';

COMMENT ON COLUMN public.ridechecker_job_assignments.expires_at
  IS 'Timestamp after which an awaiting_acceptance assignment auto-expires (default 15 min from creation)';

COMMENT ON COLUMN public.ridechecker_job_assignments.declined_at
  IS 'Timestamp when the RideChecker declined the assignment';
