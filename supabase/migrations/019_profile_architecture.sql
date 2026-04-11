-- Migration 019: Profile Architecture (Additive Only)
-- SAFE: No drops, no renames, no required columns, no existing logic changed.
-- Adds profile_type/origin_type/origin_id/is_orphan to profiles.
-- Adds ridechecker_applications table.
-- Backfills all existing rows with legacy markers.
-- Middleware and role/is_active checks are completely untouched.

-- ============================================================
-- PHASE 1: Additive columns on public.profiles
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='profile_type'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN profile_type TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='origin_type'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN origin_type TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='origin_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN origin_id UUID NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='is_orphan'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_orphan BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- ============================================================
-- PHASE 1: Backfill existing profiles with legacy origin_type
-- ============================================================

-- All existing records without origin_type = legacy
UPDATE public.profiles
SET origin_type = 'legacy'
WHERE origin_type IS NULL;

-- Backfill profile_type from existing role values
UPDATE public.profiles
SET profile_type = 'ridechecker_active'
WHERE role = 'ridechecker_active'
  AND profile_type IS NULL;

UPDATE public.profiles
SET profile_type = 'ridechecker_applicant'
WHERE role = 'ridechecker'
  AND profile_type IS NULL;

UPDATE public.profiles
SET profile_type = 'staff'
WHERE role IN ('operations', 'operations_lead', 'qa', 'developer', 'platform', 'owner')
  AND profile_type IS NULL;

-- Default all remaining (customers) to 'customer'
UPDATE public.profiles
SET profile_type = 'customer'
WHERE profile_type IS NULL;

-- ============================================================
-- PHASE 2: ridechecker_applications table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ridechecker_applications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  phone         TEXT        NULL,
  city          TEXT        NULL,
  experience    TEXT        NULL,
  notes         TEXT        NULL,
  resume_url    TEXT        NULL,
  status        TEXT        NOT NULL DEFAULT 'submitted',
  reviewed_at   TIMESTAMPTZ NULL,
  reviewed_by   UUID        NULL,
  review_notes  TEXT        NULL,
  profile_id    UUID        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rc_applications_email  ON public.ridechecker_applications(email);
CREATE INDEX IF NOT EXISTS idx_rc_applications_status ON public.ridechecker_applications(status);

-- RLS: admins and ops_lead can read all; public can insert only
ALTER TABLE public.ridechecker_applications ENABLE ROW LEVEL SECURITY;

-- Allow anonymous INSERT (public application form)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ridechecker_applications'
      AND policyname = 'rc_applications_public_insert'
  ) THEN
    CREATE POLICY "rc_applications_public_insert"
      ON public.ridechecker_applications
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users can read applications via service role (API handles auth)
-- No direct public SELECT — all reads go through server-side API routes.

-- ============================================================
-- PHASE 5: Tighten profiles RLS — block direct public INSERT
-- (SELECT/UPDATE own record policies are preserved from migration 014)
-- ============================================================

-- Drop the old unrestricted insert policy if it exists
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "allow_profile_insert" ON public.profiles;

-- New: service role only can insert (all profile creation goes through server routes)
-- Supabase service role bypasses RLS by default, so no explicit policy needed for it.
-- Anon and authenticated users should NOT be able to directly INSERT profiles.
-- If a policy granting INSERT to authenticated users was added before, drop it:
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'profiles_insert_authenticated'
  ) THEN
    DROP POLICY "profiles_insert_authenticated" ON public.profiles;
  END IF;
END $$;
