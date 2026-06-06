-- ============================================================
-- MIGRATION 045: ridechecker_raw_submissions
--
-- Creates the table that stores raw field inspection data
-- submitted by RideCheckers after completing an inspection.
--
-- Written to by: POST /api/ridechecker/jobs/[assignmentId]/submit
-- Read by:       POST /api/ops/orders/[orderId]/generate-report
--
-- All server routes use supabaseAdmin (service role key) which
-- bypasses RLS entirely. RLS policies here cover direct DB
-- access / security auditing only.
--
-- Safe to run multiple times (all operations are idempotent).
-- ============================================================

-- ── 1. Main table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ridechecker_raw_submissions (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  assignment_id               UUID        NOT NULL,
  order_id                    UUID        NOT NULL,
  ridechecker_id              UUID        NOT NULL,

  -- Checklist completion flag (computed by isChecklistComplete())
  checklist_complete          BOOLEAN     NOT NULL DEFAULT false,

  -- ── Core photo references (Supabase Storage URLs) ─────────────────────────
  vin_photo_url               TEXT,
  odometer_photo_url          TEXT,
  under_hood_photo_url        TEXT,
  undercarriage_photo_url     TEXT,
  extra_photos                TEXT[],
  audio_note_url              TEXT,

  -- ── Narrative / condition text fields ─────────────────────────────────────
  cosmetic_exterior           TEXT,
  interior_condition          TEXT,
  mechanical_issues           TEXT,
  test_drive_notes            TEXT,
  immediate_concerns          TEXT,

  -- ── Mechanical measurements ───────────────────────────────────────────────
  brake_condition             TEXT,
  scan_codes                  TEXT[],
  tire_tread_mm_front_left    NUMERIC(5,2),
  tire_tread_mm_front_right   NUMERIC(5,2),
  tire_tread_mm_rear_left     NUMERIC(5,2),
  tire_tread_mm_rear_right    NUMERIC(5,2),

  -- ── Structured inspection modules (JSONB) ─────────────────────────────────
  -- road_test_module: { status, engine_behavior[], transmission[], brakes[],
  --   steering[], suspension[], warning_lights[], photo_1_url, photo_2_url, ... }
  road_test_module            JSONB,

  -- obd_module: { scan_performed, dtc_codes[], uploaded_files[],
  --   emissions_readiness, warning_lights[], notes }
  obd_module                  JSONB,

  -- title_history_module: { title_review_status, title_type, vin_match_title,
  --   vins_matched, odometer_consistency, flood_indicators[], tampering_indicators[],
  --   accident_indicators[], dashboard_vin_photo_url, door_jamb_vin_photo_url,
  --   ops_review_status (server-computed), lien_status, ... }
  title_history_module        JSONB,

  -- ── Timestamps ────────────────────────────────────────────────────────────
  submitted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rrs_order_id
  ON public.ridechecker_raw_submissions(order_id);

CREATE INDEX IF NOT EXISTS idx_rrs_ridechecker_id
  ON public.ridechecker_raw_submissions(ridechecker_id);

CREATE INDEX IF NOT EXISTS idx_rrs_assignment_id
  ON public.ridechecker_raw_submissions(assignment_id);

-- Descending submitted_at — generate-report queries ORDER BY submitted_at DESC
CREATE INDEX IF NOT EXISTS idx_rrs_submitted_at
  ON public.ridechecker_raw_submissions(submitted_at DESC);

-- ── 3. Foreign-key constraints (idempotent) ───────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.ridechecker_raw_submissions
    ADD CONSTRAINT fk_rrs_order
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ridechecker_raw_submissions
    ADD CONSTRAINT fk_rrs_assignment
    FOREIGN KEY (assignment_id) REFERENCES public.ridechecker_job_assignments(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ridechecker_raw_submissions
    ADD CONSTRAINT fk_rrs_ridechecker
    FOREIGN KEY (ridechecker_id) REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. brake_condition check constraint ──────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.ridechecker_raw_submissions
    ADD CONSTRAINT chk_rrs_brake_condition
    CHECK (brake_condition IN ('good', 'fair', 'poor', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 5. Updated-at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rrs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rrs_updated_at ON public.ridechecker_raw_submissions;
CREATE TRIGGER trg_rrs_updated_at
  BEFORE UPDATE ON public.ridechecker_raw_submissions
  FOR EACH ROW EXECUTE FUNCTION public.rrs_set_updated_at();

-- ── 6. Row Level Security ─────────────────────────────────────────────────────
-- All server routes use supabaseAdmin (bypasses RLS).
-- Policies below govern direct PostgREST / dashboard access only.

ALTER TABLE public.ridechecker_raw_submissions ENABLE ROW LEVEL SECURITY;

-- RideCheckers: read their own submissions only
DROP POLICY IF EXISTS "rrs_select_own" ON public.ridechecker_raw_submissions;
CREATE POLICY "rrs_select_own" ON public.ridechecker_raw_submissions
  FOR SELECT TO authenticated
  USING (ridechecker_id = auth.uid() OR public.is_staff());

-- Staff (ops, ops_lead, owner, qa, developer, platform): full read/write
DROP POLICY IF EXISTS "rrs_staff_all" ON public.ridechecker_raw_submissions;
CREATE POLICY "rrs_staff_all" ON public.ridechecker_raw_submissions
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
