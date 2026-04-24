-- ============================================================
-- PENDING MIGRATIONS — paste this entire file into the
-- Supabase SQL Editor and click Run.
-- Safe to run multiple times (all operations are idempotent).
-- ============================================================


-- ============================================================
-- MIGRATION 019: Profile Architecture
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='profile_type') THEN
    ALTER TABLE public.profiles ADD COLUMN profile_type TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='origin_type') THEN
    ALTER TABLE public.profiles ADD COLUMN origin_type TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='origin_id') THEN
    ALTER TABLE public.profiles ADD COLUMN origin_id UUID NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_orphan') THEN
    ALTER TABLE public.profiles ADD COLUMN is_orphan BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

UPDATE public.profiles SET origin_type = 'legacy' WHERE origin_type IS NULL;
UPDATE public.profiles SET profile_type = 'ridechecker_active' WHERE role = 'ridechecker_active' AND profile_type IS NULL;
UPDATE public.profiles SET profile_type = 'ridechecker_applicant' WHERE role = 'ridechecker' AND profile_type IS NULL;
UPDATE public.profiles SET profile_type = 'staff' WHERE role IN ('operations', 'operations_lead', 'qa', 'developer', 'platform', 'owner') AND profile_type IS NULL;
UPDATE public.profiles SET profile_type = 'customer' WHERE profile_type IS NULL;

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

ALTER TABLE public.ridechecker_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ridechecker_applications' AND policyname = 'rc_applications_public_insert') THEN
    CREATE POLICY "rc_applications_public_insert"
      ON public.ridechecker_applications
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "allow_profile_insert" ON public.profiles;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_insert_authenticated') THEN
    DROP POLICY "profiles_insert_authenticated" ON public.profiles;
  END IF;
END $$;


-- ============================================================
-- MIGRATION 020: RideChecker Onboarding Fields
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ridechecker_applications' AND column_name='availability') THEN
    ALTER TABLE public.ridechecker_applications ADD COLUMN availability TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ridechecker_applications' AND column_name='willing_to_use_tools') THEN
    ALTER TABLE public.ridechecker_applications ADD COLUMN willing_to_use_tools BOOLEAN NULL DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='level') THEN
    ALTER TABLE public.profiles ADD COLUMN level TEXT NOT NULL DEFAULT 'level_1';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_invites' AND column_name='application_id') THEN
    ALTER TABLE public.user_invites ADD COLUMN application_id UUID NULL REFERENCES public.ridechecker_applications(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================================
-- MIGRATION 021: report_logic_version on orders
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS report_logic_version text;


-- ============================================================
-- MIGRATION 022: Private classification signals + report internal JSON
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vehicle_classification_signals (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz DEFAULT now(),
  ip_hash           text,
  make              text,
  model             text,
  year              integer,
  mileage           integer,
  asking_price      numeric(12, 2),
  tier_result       text        NOT NULL,
  signals_triggered text[]      DEFAULT '{}',
  risk_flags        jsonb       DEFAULT '{}',
  request_count     integer     DEFAULT 1
);

ALTER TABLE public.vehicle_classification_signals ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS report_internal_json jsonb;
