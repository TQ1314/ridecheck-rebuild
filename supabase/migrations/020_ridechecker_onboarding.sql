-- Migration 020: RideChecker Onboarding Fields
-- SAFE: Additive only. No drops, no renames, no existing logic changed.
-- Adds availability + willing_to_use_tools to ridechecker_applications.
-- Adds level to profiles.
-- Adds application_id to user_invites so acceptance can link back.

-- ============================================================
-- 1. ridechecker_applications: availability + willing_to_use_tools
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ridechecker_applications' AND column_name='availability'
  ) THEN
    ALTER TABLE public.ridechecker_applications ADD COLUMN availability TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ridechecker_applications' AND column_name='willing_to_use_tools'
  ) THEN
    ALTER TABLE public.ridechecker_applications ADD COLUMN willing_to_use_tools BOOLEAN NULL DEFAULT NULL;
  END IF;
END $$;

-- ============================================================
-- 2. profiles: level field
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='level'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN level TEXT NOT NULL DEFAULT 'level_1';
  END IF;
END $$;

-- ============================================================
-- 3. user_invites: application_id to link invite → application
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_invites' AND column_name='application_id'
  ) THEN
    ALTER TABLE public.user_invites
      ADD COLUMN application_id UUID NULL
      REFERENCES public.ridechecker_applications(id) ON DELETE SET NULL;
  END IF;
END $$;
