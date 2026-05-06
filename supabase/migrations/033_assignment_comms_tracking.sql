-- Migration 033: Add comms tracking to ridechecker_job_assignments
-- first_viewed_at: when RC first opened the job detail page
-- last_nudge_at:   when ops last re-sent the notification

ALTER TABLE ridechecker_job_assignments
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_nudge_at   TIMESTAMPTZ NULL;
