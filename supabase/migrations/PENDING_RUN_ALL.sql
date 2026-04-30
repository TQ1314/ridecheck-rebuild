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


-- ============================================================
-- MIGRATION 023: RideChecker Verification (storage policies)
-- ============================================================
-- Storage bucket policies are applied via migration 023.
-- Run 023_ridechecker_verification.sql separately if storage
-- policies for ridechecker-verifications bucket are needed.


-- ============================================================
-- MIGRATION 024: RideChecker Training Results
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ridechecker_training_results (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id       TEXT        NOT NULL,
  score           INTEGER,
  passed          BOOLEAN     NOT NULL DEFAULT false,
  attempts        INTEGER     NOT NULL DEFAULT 1,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_results_unique
  ON public.ridechecker_training_results (ridechecker_id, module_id);

CREATE INDEX IF NOT EXISTS idx_training_results_ridechecker
  ON public.ridechecker_training_results (ridechecker_id);

ALTER TABLE public.ridechecker_training_results ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- MIGRATION 025: RideChecker Ops Messages
-- ============================================================

CREATE TABLE IF NOT EXISTS ridechecker_ops_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID,
  order_id      UUID,
  ridechecker_id UUID       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message       TEXT        NOT NULL,
  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ridechecker_ops_messages_assignment
  ON ridechecker_ops_messages(assignment_id);

CREATE INDEX IF NOT EXISTS idx_ridechecker_ops_messages_ridechecker
  ON ridechecker_ops_messages(ridechecker_id);

ALTER TABLE ridechecker_ops_messages ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- MIGRATION 026: listing_source on orders
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS listing_source TEXT NOT NULL DEFAULT 'online_marketplace';


-- ============================================================
-- MIGRATION 027: platform_source + vehicle_seen_location on orders
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS platform_source TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_seen_location TEXT;


-- ============================================================
-- MIGRATION 028: RLS Security Fix (2026-04-30)
-- Comprehensive RLS audit — enables RLS on ALL tables and
-- re-creates all least-privilege policies.
-- FIXES: health_pings public SELECT, missing activity_log policy,
-- explicit vehicle_classification_signals staff-only read,
-- ridechecker_ops_messages staff visibility.
-- ============================================================

-- RBAC helpers (idempotent CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() = 'owner'
$$;
CREATE OR REPLACE FUNCTION public.is_ops_lead()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('owner', 'operations_lead')
$$;
CREATE OR REPLACE FUNCTION public.is_ops()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() = 'operations'
$$;
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('owner','operations_lead','operations','qa','developer','platform')
$$;
CREATE OR REPLACE FUNCTION public.is_ridechecker()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('ridechecker', 'ridechecker_active')
$$;
CREATE OR REPLACE FUNCTION public.is_active_ridechecker()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() = 'ridechecker_active'
$$;

-- Enable RLS on all tables
ALTER TABLE IF EXISTS public.profiles                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.intelligence_reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.title_ownership_review         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bill_of_sale_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.health_pings                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inspectors                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_events                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_definitions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_invites                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ridechecker_earnings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_codes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referrals                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.seller_contact_attempts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ridechecker_availability       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ridechecker_job_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ridechecker_raw_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.terms_acceptances              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mechanical_findings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.obd_findings                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.title_intelligence             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_flags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fraud_flags                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.region_capacity                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.waitlist                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tier_pricing                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.regions                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.region_zips                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicle_rules                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ridechecker_stage_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ridechecker_applications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicle_classification_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ridechecker_training_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ridechecker_ops_messages       ENABLE ROW LEVEL SECURITY;

-- Drop all old policies
DROP POLICY IF EXISTS "profiles_select_own"                 ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"                 ON public.profiles;
DROP POLICY IF EXISTS "profiles_select"                     ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"                 ON public.profiles;
DROP POLICY IF EXISTS "allow_profile_insert"                ON public.profiles;
DROP POLICY IF EXISTS "orders_select_own"                   ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own"                   ON public.orders;
DROP POLICY IF EXISTS "orders_select"                       ON public.orders;
DROP POLICY IF EXISTS "orders_insert"                       ON public.orders;
DROP POLICY IF EXISTS "allow_health_pings_insert"           ON public.health_pings;
DROP POLICY IF EXISTS "allow_health_pings_select"           ON public.health_pings;
DROP POLICY IF EXISTS "health_pings_select"                 ON public.health_pings;
DROP POLICY IF EXISTS "health_pings_insert"                 ON public.health_pings;
DROP POLICY IF EXISTS "activity_log_select"                 ON public.activity_log;
DROP POLICY IF EXISTS "audit_log_select"                    ON public.audit_log;
DROP POLICY IF EXISTS "order_events_select"                 ON public.order_events;
DROP POLICY IF EXISTS "intelligence_reports_select"         ON public.intelligence_reports;
DROP POLICY IF EXISTS "title_review_select"                 ON public.title_ownership_review;
DROP POLICY IF EXISTS "bos_select"                          ON public.bill_of_sale_documents;
DROP POLICY IF EXISTS "inspectors_select"                   ON public.inspectors;
DROP POLICY IF EXISTS "inspectors_write"                    ON public.inspectors;
DROP POLICY IF EXISTS "user_invites_select"                 ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_insert"                 ON public.user_invites;
DROP POLICY IF EXISTS "earnings_select"                     ON public.ridechecker_earnings;
DROP POLICY IF EXISTS "referral_codes_select"               ON public.referral_codes;
DROP POLICY IF EXISTS "referrals_select"                    ON public.referrals;
DROP POLICY IF EXISTS "seller_contact_select"               ON public.seller_contact_attempts;
DROP POLICY IF EXISTS "ridechecker_own_availability"        ON public.ridechecker_availability;
DROP POLICY IF EXISTS "availability_select"                 ON public.ridechecker_availability;
DROP POLICY IF EXISTS "availability_insert"                 ON public.ridechecker_availability;
DROP POLICY IF EXISTS "availability_update"                 ON public.ridechecker_availability;
DROP POLICY IF EXISTS "availability_delete"                 ON public.ridechecker_availability;
DROP POLICY IF EXISTS "ridechecker_own_assignments_select"  ON public.ridechecker_job_assignments;
DROP POLICY IF EXISTS "assignments_select"                  ON public.ridechecker_job_assignments;
DROP POLICY IF EXISTS "ridechecker_own_submissions"         ON public.ridechecker_raw_submissions;
DROP POLICY IF EXISTS "submissions_select"                  ON public.ridechecker_raw_submissions;
DROP POLICY IF EXISTS "submissions_insert"                  ON public.ridechecker_raw_submissions;
DROP POLICY IF EXISTS "submissions_update"                  ON public.ridechecker_raw_submissions;
DROP POLICY IF EXISTS "terms_select"                        ON public.terms_acceptances;
DROP POLICY IF EXISTS "mechanical_findings_select"          ON public.mechanical_findings;
DROP POLICY IF EXISTS "mechanical_findings_write"           ON public.mechanical_findings;
DROP POLICY IF EXISTS "obd_findings_select"                 ON public.obd_findings;
DROP POLICY IF EXISTS "obd_findings_write"                  ON public.obd_findings;
DROP POLICY IF EXISTS "title_intelligence_select"           ON public.title_intelligence;
DROP POLICY IF EXISTS "title_intelligence_write"            ON public.title_intelligence;
DROP POLICY IF EXISTS "system_flags_select"                 ON public.system_flags;
DROP POLICY IF EXISTS "system_flags_write"                  ON public.system_flags;
DROP POLICY IF EXISTS "fraud_flags_select"                  ON public.fraud_flags;
DROP POLICY IF EXISTS "region_capacity_select"              ON public.region_capacity;
DROP POLICY IF EXISTS "anon_insert_waitlist"                ON public.waitlist;
DROP POLICY IF EXISTS "waitlist_insert"                     ON public.waitlist;
DROP POLICY IF EXISTS "waitlist_select"                     ON public.waitlist;
DROP POLICY IF EXISTS "reports_select"                      ON public.reports;
DROP POLICY IF EXISTS "auth_read_role_definitions"          ON public.role_definitions;
DROP POLICY IF EXISTS "role_definitions_select"             ON public.role_definitions;
DROP POLICY IF EXISTS "auth_read_tier_pricing"              ON public.tier_pricing;
DROP POLICY IF EXISTS "tier_pricing_select"                 ON public.tier_pricing;
DROP POLICY IF EXISTS "auth_read_regions"                   ON public.regions;
DROP POLICY IF EXISTS "regions_select"                      ON public.regions;
DROP POLICY IF EXISTS "auth_read_roles"                     ON public.roles;
DROP POLICY IF EXISTS "roles_select"                        ON public.roles;
DROP POLICY IF EXISTS "auth_read_region_zips"               ON public.region_zips;
DROP POLICY IF EXISTS "region_zips_select"                  ON public.region_zips;
DROP POLICY IF EXISTS "auth_read_vehicle_rules"             ON public.vehicle_rules;
DROP POLICY IF EXISTS "vehicle_rules_select"                ON public.vehicle_rules;
DROP POLICY IF EXISTS "user_roles_select"                   ON public.user_roles;
DROP POLICY IF EXISTS "stage_history_select"                ON public.ridechecker_stage_history;
DROP POLICY IF EXISTS "rc_applications_public_insert"       ON public.ridechecker_applications;
DROP POLICY IF EXISTS "rc_applications_select"              ON public.ridechecker_applications;
DROP POLICY IF EXISTS "classification_signals_select"       ON public.vehicle_classification_signals;
DROP POLICY IF EXISTS "rc_training_select_own"              ON public.ridechecker_training_results;
DROP POLICY IF EXISTS "rc_training_upsert_own"              ON public.ridechecker_training_results;
DROP POLICY IF EXISTS "ridechecker_ops_messages_insert"     ON public.ridechecker_ops_messages;
DROP POLICY IF EXISTS "ridechecker_ops_messages_select_own" ON public.ridechecker_ops_messages;

-- Re-create all policies
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_staff());

CREATE POLICY "orders_select" ON public.orders FOR SELECT
  USING (auth.uid() = customer_id OR public.is_staff());

CREATE POLICY "orders_insert" ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id OR customer_id IS NULL OR public.is_staff());

CREATE POLICY "health_pings_insert" ON public.health_pings FOR INSERT WITH CHECK (true);
CREATE POLICY "health_pings_select" ON public.health_pings FOR SELECT USING (public.is_staff());

CREATE POLICY "activity_log_select" ON public.activity_log FOR SELECT USING (public.is_staff());

CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT USING (public.is_ops_lead());

CREATE POLICY "order_events_select" ON public.order_events FOR SELECT
  USING (public.is_staff() OR (NOT is_internal AND EXISTS (SELECT 1 FROM public.orders WHERE orders.id::text = order_events.order_id AND orders.customer_id = auth.uid())));

CREATE POLICY "intelligence_reports_select" ON public.intelligence_reports FOR SELECT USING (public.is_staff());

CREATE POLICY "title_review_select" ON public.title_ownership_review FOR SELECT USING (public.is_staff());

CREATE POLICY "bos_select" ON public.bill_of_sale_documents FOR SELECT
  USING (public.is_staff() OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = bill_of_sale_documents.order_id AND orders.customer_id = auth.uid()));

CREATE POLICY "inspectors_select" ON public.inspectors FOR SELECT USING (public.is_staff());
CREATE POLICY "inspectors_write" ON public.inspectors FOR ALL USING (public.is_ops_lead()) WITH CHECK (public.is_ops_lead());

CREATE POLICY "user_invites_select" ON public.user_invites FOR SELECT USING (public.is_ops_lead());
CREATE POLICY "user_invites_insert" ON public.user_invites FOR INSERT WITH CHECK (public.is_ops_lead());

CREATE POLICY "earnings_select" ON public.ridechecker_earnings FOR SELECT
  USING (auth.uid() = ridechecker_id OR public.is_ops_lead());

CREATE POLICY "referral_codes_select" ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id OR public.is_ops_lead());

CREATE POLICY "referrals_select" ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id OR public.is_ops_lead());

CREATE POLICY "seller_contact_select" ON public.seller_contact_attempts FOR SELECT
  USING (public.is_ops_lead() OR public.is_ops());

CREATE POLICY "availability_select" ON public.ridechecker_availability FOR SELECT
  USING (auth.uid() = ridechecker_id OR public.is_staff());
CREATE POLICY "availability_insert" ON public.ridechecker_availability FOR INSERT
  WITH CHECK (auth.uid() = ridechecker_id AND public.is_active_ridechecker());
CREATE POLICY "availability_update" ON public.ridechecker_availability FOR UPDATE
  USING (auth.uid() = ridechecker_id AND public.is_active_ridechecker())
  WITH CHECK (auth.uid() = ridechecker_id AND public.is_active_ridechecker());
CREATE POLICY "availability_delete" ON public.ridechecker_availability FOR DELETE
  USING (auth.uid() = ridechecker_id AND public.is_active_ridechecker());

CREATE POLICY "assignments_select" ON public.ridechecker_job_assignments FOR SELECT
  USING (auth.uid() = ridechecker_id OR public.is_staff());

CREATE POLICY "submissions_select" ON public.ridechecker_raw_submissions FOR SELECT
  USING (auth.uid() = ridechecker_id OR public.is_staff());
CREATE POLICY "submissions_insert" ON public.ridechecker_raw_submissions FOR INSERT
  WITH CHECK (auth.uid() = ridechecker_id AND public.is_active_ridechecker());
CREATE POLICY "submissions_update" ON public.ridechecker_raw_submissions FOR UPDATE
  USING (auth.uid() = ridechecker_id AND public.is_active_ridechecker())
  WITH CHECK (auth.uid() = ridechecker_id AND public.is_active_ridechecker());

CREATE POLICY "terms_select" ON public.terms_acceptances FOR SELECT USING (public.is_ops_lead());

CREATE POLICY "mechanical_findings_select" ON public.mechanical_findings FOR SELECT
  USING (public.is_ops_lead() OR public.is_ops() OR (public.is_active_ridechecker() AND EXISTS (SELECT 1 FROM public.ridechecker_job_assignments rja WHERE rja.order_id::text = mechanical_findings.order_id::text AND rja.ridechecker_id = auth.uid())));
CREATE POLICY "mechanical_findings_write" ON public.mechanical_findings FOR ALL
  USING (public.is_ops_lead()) WITH CHECK (public.is_ops_lead());

CREATE POLICY "obd_findings_select" ON public.obd_findings FOR SELECT
  USING (public.is_ops_lead() OR public.is_ops() OR (public.is_active_ridechecker() AND EXISTS (SELECT 1 FROM public.ridechecker_job_assignments rja WHERE rja.order_id::text = obd_findings.order_id::text AND rja.ridechecker_id = auth.uid())));
CREATE POLICY "obd_findings_write" ON public.obd_findings FOR ALL
  USING (public.is_ops_lead()) WITH CHECK (public.is_ops_lead());

CREATE POLICY "title_intelligence_select" ON public.title_intelligence FOR SELECT USING (public.is_ops_lead());
CREATE POLICY "title_intelligence_write" ON public.title_intelligence FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- system_flags, fraud_flags, reports, region_capacity, user_roles: LOCKED (no policies = denied)

CREATE POLICY "waitlist_insert" ON public.waitlist FOR INSERT WITH CHECK (true);

CREATE POLICY "role_definitions_select" ON public.role_definitions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tier_pricing_select" ON public.tier_pricing FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "regions_select" ON public.regions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "roles_select" ON public.roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "region_zips_select" ON public.region_zips FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "vehicle_rules_select" ON public.vehicle_rules FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "stage_history_select" ON public.ridechecker_stage_history FOR SELECT
  USING (public.is_ops_lead() OR auth.uid() = ridechecker_id);

CREATE POLICY "rc_applications_public_insert" ON public.ridechecker_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "rc_applications_select" ON public.ridechecker_applications FOR SELECT USING (public.is_staff());

CREATE POLICY "classification_signals_select" ON public.vehicle_classification_signals FOR SELECT USING (public.is_admin());

CREATE POLICY "rc_training_select_own" ON public.ridechecker_training_results FOR SELECT TO authenticated
  USING (ridechecker_id = auth.uid() OR public.is_staff());
CREATE POLICY "rc_training_upsert_own" ON public.ridechecker_training_results FOR ALL
  USING (public.is_ops_lead()) WITH CHECK (public.is_ops_lead());

CREATE POLICY "ridechecker_ops_messages_insert" ON public.ridechecker_ops_messages FOR INSERT TO authenticated
  WITH CHECK (ridechecker_id = auth.uid());
CREATE POLICY "ridechecker_ops_messages_select_own" ON public.ridechecker_ops_messages FOR SELECT TO authenticated
  USING (ridechecker_id = auth.uid() OR public.is_staff());
