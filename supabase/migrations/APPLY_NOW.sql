-- =======================================================
-- APPLY_NOW.sql  —  Adds only what is actually missing.
-- Paste this entire file into the Supabase SQL Editor.
-- All statements are idempotent (safe to run again).
-- =======================================================


-- ── orders: payment override columns (migration 040) ────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_required          BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_override_approved BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_override_reason   TEXT,
  ADD COLUMN IF NOT EXISTS payment_override_by       UUID,
  ADD COLUMN IF NOT EXISTS payment_override_at       TIMESTAMPTZ;


-- ── orders: seller_type (migration 042) ─────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_type TEXT;

UPDATE public.orders SET seller_type = 'private_party' WHERE seller_type IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN seller_type SET NOT NULL,
  ALTER COLUMN seller_type SET DEFAULT 'private_party';

CREATE INDEX IF NOT EXISTS idx_orders_seller_type ON public.orders(seller_type);


-- ── ridechecker_raw_submissions: road test (migration 037) ───────────────────
ALTER TABLE public.ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS road_test_module JSONB;


-- ── ridechecker_raw_submissions: OBD-II (migration 038) ─────────────────────
ALTER TABLE public.ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS obd_module JSONB;


-- ── ridechecker_raw_submissions: title history (migration 039) ───────────────
ALTER TABLE public.ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS title_history_module JSONB;


-- ── ridechecker_raw_submissions: audit timestamps (migration 045) ────────────
ALTER TABLE public.ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_rrs_updated_at ON public.ridechecker_raw_submissions;
CREATE TRIGGER trg_rrs_updated_at
  BEFORE UPDATE ON public.ridechecker_raw_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── rc_reminder_log (migration 060) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rc_reminder_log (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      timestamptz DEFAULT now(),
  ridechecker_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_key    text        NOT NULL,
  sent_by         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  channels        text[]      NOT NULL DEFAULT '{email}',
  email_sent      boolean     NOT NULL DEFAULT false,
  sms_sent        boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rc_reminder_log_rc_template
  ON public.rc_reminder_log(ridechecker_id, template_key, created_at DESC);

ALTER TABLE public.rc_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ops can manage reminder log" ON public.rc_reminder_log;
CREATE POLICY "ops can manage reminder log"
  ON public.rc_reminder_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operations','operations_lead','ops_lead','admin','owner','ops')
        AND profiles.is_active = true
    )
  );


-- ── rc_announcements (migration 059) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rc_announcements (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      timestamptz DEFAULT now(),
  sent_by         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject         text        NOT NULL,
  body            text        NOT NULL,
  channels        text[]      NOT NULL DEFAULT '{email}',
  recipient_group text        NOT NULL DEFAULT 'all',
  area_filter     text,
  recipient_count int         NOT NULL DEFAULT 0,
  email_sent      int         NOT NULL DEFAULT 0,
  sms_sent        int         NOT NULL DEFAULT 0,
  email_failed    int         NOT NULL DEFAULT 0,
  sms_failed      int         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rc_announcements_created_at ON public.rc_announcements(created_at DESC);

ALTER TABLE public.rc_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ops can manage announcements" ON public.rc_announcements;
CREATE POLICY "ops can manage announcements"
  ON public.rc_announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operations','operations_lead','ops_lead','admin','owner','ops')
        AND profiles.is_active = true
    )
  );
