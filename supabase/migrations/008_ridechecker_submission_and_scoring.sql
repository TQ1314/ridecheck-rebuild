-- RideCheck: RideChecker Structured Submission, Scoring & Payout
-- ADDITIVE ONLY: All new columns use IF NOT EXISTS guards.
-- Run this migration manually in Supabase SQL Editor AFTER 007_service_area.sql.

-- ==============================================
-- A) Profile columns for ridechecker scoring/capacity
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_max_daily_jobs') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_max_daily_jobs INT DEFAULT 3 CHECK (ridechecker_max_daily_jobs BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_rating') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_rating NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_jobs_completed') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_jobs_completed INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_jobs_cancelled') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_jobs_cancelled INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_on_time_pct') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_on_time_pct NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_quality_score') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_quality_score NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_is_approved') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_is_approved BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ==============================================
-- B) ridechecker_availability table
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id UUID NOT NULL REFERENCES profiles(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_jobs INT NOT NULL DEFAULT 3 CHECK (max_jobs BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ridechecker_id, date)
);

CREATE INDEX IF NOT EXISTS idx_availability_ridechecker ON ridechecker_availability(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON ridechecker_availability(date);

-- ==============================================
-- C) ridechecker_job_assignments table
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  ridechecker_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'assigned',
  scheduled_start TIMESTAMPTZ NULL,
  scheduled_end TIMESTAMPTZ NULL,
  accepted_at TIMESTAMPTZ NULL,
  started_at TIMESTAMPTZ NULL,
  submitted_at TIMESTAMPTZ NULL,
  approved_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  job_score NUMERIC NULL,
  payout_amount NUMERIC NULL,
  payout_status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ NULL,
  payout_method TEXT NULL,
  payout_notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_assignment_status CHECK (status IN ('assigned','accepted','in_progress','submitted','approved','rejected','paid','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_assignments_ridechecker_status ON ridechecker_job_assignments(ridechecker_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON ridechecker_job_assignments(order_id);

-- ==============================================
-- D) ridechecker_raw_submissions table
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_raw_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  ridechecker_id UUID NOT NULL REFERENCES profiles(id),
  assignment_id UUID NULL REFERENCES ridechecker_job_assignments(id),
  checklist_complete BOOLEAN DEFAULT FALSE,
  vin_photo_url TEXT NULL,
  odometer_photo_url TEXT NULL,
  under_hood_photo_url TEXT NULL,
  undercarriage_photo_url TEXT NULL,
  tire_tread_mm_front_left NUMERIC NULL,
  tire_tread_mm_front_right NUMERIC NULL,
  tire_tread_mm_rear_left NUMERIC NULL,
  tire_tread_mm_rear_right NUMERIC NULL,
  brake_condition TEXT NULL,
  scan_codes TEXT[] NULL,
  cosmetic_exterior TEXT NULL,
  interior_condition TEXT NULL,
  mechanical_issues TEXT NULL,
  test_drive_notes TEXT NULL,
  immediate_concerns TEXT NULL,
  audio_note_url TEXT NULL,
  extra_photos JSONB NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_brake_condition CHECK (brake_condition IS NULL OR brake_condition IN ('good','fair','poor','unknown'))
);

CREATE INDEX IF NOT EXISTS idx_raw_submissions_order ON ridechecker_raw_submissions(order_id);
CREATE INDEX IF NOT EXISTS idx_raw_submissions_ridechecker ON ridechecker_raw_submissions(ridechecker_id);

-- ==============================================
-- E) Orders table additions for ops report builder
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_report_url') THEN
    ALTER TABLE orders ADD COLUMN ops_report_url TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_summary') THEN
    ALTER TABLE orders ADD COLUMN ops_summary TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_severity_overall') THEN
    ALTER TABLE orders ADD COLUMN ops_severity_overall TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='assigned_ridechecker_id') THEN
    ALTER TABLE orders ADD COLUMN assigned_ridechecker_id UUID NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_sent_at') THEN
    ALTER TABLE orders ADD COLUMN report_sent_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Add check constraint on ops_severity_overall if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ops_severity_overall'
  ) THEN
    BEGIN
      ALTER TABLE orders ADD CONSTRAINT chk_ops_severity_overall
        CHECK (ops_severity_overall IS NULL OR ops_severity_overall IN ('minor','moderate','major','safety_critical'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
