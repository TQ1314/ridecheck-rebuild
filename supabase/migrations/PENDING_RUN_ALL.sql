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

-- ============================================================
-- MIGRATION 029: Order Assignment Pay + Job Broadcasts
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='base_pay') THEN
    ALTER TABLE orders ADD COLUMN base_pay INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='current_offer') THEN
    ALTER TABLE orders ADD COLUMN current_offer INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='boost_amount') THEN
    ALTER TABLE orders ADD COLUMN boost_amount INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='assignment_status') THEN
    ALTER TABLE orders ADD COLUMN assignment_status TEXT DEFAULT 'unassigned';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_status') THEN
    ALTER TABLE orders ADD COLUMN seller_status TEXT DEFAULT 'awaiting';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_name='chk_orders_assignment_status') THEN
    ALTER TABLE orders ADD CONSTRAINT chk_orders_assignment_status CHECK (assignment_status IN ('unassigned','assigned','accepted','en_route','completed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_name='chk_orders_seller_status') THEN
    ALTER TABLE orders ADD CONSTRAINT chk_orders_seller_status CHECK (seller_status IN ('awaiting','confirmed','no_response','invalid'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS job_broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ridechecker_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'sent',
  offered_pay      INTEGER NOT NULL DEFAULT 0,
  responded_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_broadcast_status CHECK (status IN ('sent','accepted','declined','expired'))
);

CREATE INDEX IF NOT EXISTS idx_job_broadcasts_order_id       ON job_broadcasts(order_id);
CREATE INDEX IF NOT EXISTS idx_job_broadcasts_ridechecker_id ON job_broadcasts(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_job_broadcasts_order_status   ON job_broadcasts(order_id, status);

ALTER TABLE job_broadcasts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='job_broadcasts' AND policyname='ridecheckers_see_own_broadcasts') THEN
    CREATE POLICY "ridecheckers_see_own_broadcasts" ON job_broadcasts FOR SELECT TO authenticated USING (ridechecker_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='job_broadcasts' AND policyname='staff_manage_broadcasts') THEN
    CREATE POLICY "staff_manage_broadcasts" ON job_broadcasts FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('operations','operations_lead','owner','admin','platform','developer')));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_job_broadcasts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_job_broadcasts_updated_at ON job_broadcasts;
CREATE TRIGGER trg_job_broadcasts_updated_at BEFORE UPDATE ON job_broadcasts FOR EACH ROW EXECUTE FUNCTION update_job_broadcasts_updated_at();

-- ============================================================
-- MIGRATION 030: RideChecker Payout Tracking System
-- ============================================================

CREATE TABLE IF NOT EXISTS ridechecker_payout_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name    TEXT,
  total_amount  INTEGER NOT NULL DEFAULT 0,
  payout_count  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  notes         TEXT,
  processed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_batch_status CHECK (status IN ('pending','processing','completed','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON ridechecker_payout_batches(status);
ALTER TABLE ridechecker_payout_batches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ridechecker_payout_batches' AND policyname='staff_manage_payout_batches') THEN
    CREATE POLICY "staff_manage_payout_batches" ON ridechecker_payout_batches FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('operations','operations_lead','owner','admin','platform','developer')));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ridechecker_payouts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  base_pay         INTEGER NOT NULL DEFAULT 0,
  bonus            INTEGER NOT NULL DEFAULT 0,
  bonus_breakdown  JSONB,
  total_pay        INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending',
  payout_batch_id  UUID REFERENCES ridechecker_payout_batches(id) ON DELETE SET NULL,
  notes            TEXT,
  approved_at      TIMESTAMPTZ,
  approved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  paid_at          TIMESTAMPTZ,
  paid_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_payout_status CHECK (status IN ('pending','approved','paid','cancelled')),
  CONSTRAINT uq_payout_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_payouts_ridechecker ON ridechecker_payouts(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order       ON ridechecker_payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status      ON ridechecker_payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_batch       ON ridechecker_payouts(payout_batch_id);
ALTER TABLE ridechecker_payouts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ridechecker_payouts' AND policyname='staff_manage_payouts') THEN
    CREATE POLICY "staff_manage_payouts" ON ridechecker_payouts FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('operations','operations_lead','owner','admin','platform','developer')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ridechecker_payouts' AND policyname='ridecheckers_read_own_payouts') THEN
    CREATE POLICY "ridecheckers_read_own_payouts" ON ridechecker_payouts FOR SELECT TO authenticated USING (ridechecker_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_ridechecker_payouts_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_ridechecker_payouts_updated_at ON ridechecker_payouts;
CREATE TRIGGER trg_ridechecker_payouts_updated_at BEFORE UPDATE ON ridechecker_payouts FOR EACH ROW EXECUTE FUNCTION update_ridechecker_payouts_updated_at();

CREATE OR REPLACE FUNCTION update_payout_batches_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_payout_batches_updated_at ON ridechecker_payout_batches;
CREATE TRIGGER trg_payout_batches_updated_at BEFORE UPDATE ON ridechecker_payout_batches FOR EACH ROW EXECUTE FUNCTION update_payout_batches_updated_at();
-- ============================================================
-- MIGRATION 031: Manual Payment Verification
-- Adds columns to orders table for ops_lead/owner-initiated
-- manual payment verification with evidence.
-- These columns shadow but never overwrite Stripe webhook data.
-- Safe to run multiple times (all operations are idempotent).
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_verification_note TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_stripe_reference  TEXT,
  ADD COLUMN IF NOT EXISTS payment_evidence_url      TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_amount_verified   NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS payment_payer_email       TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_reference
  ON public.orders (payment_stripe_reference);

COMMENT ON COLUMN public.orders.payment_verification_note
  IS 'Freeform note recorded by ops_lead/owner when manually verifying payment';

COMMENT ON COLUMN public.orders.payment_verified_by
  IS 'Profile ID of the user who performed manual verification';

COMMENT ON COLUMN public.orders.payment_stripe_reference
  IS 'Stripe payment intent ID or checkout session ID supplied during manual verification';

COMMENT ON COLUMN public.orders.payment_evidence_url
  IS 'URL to screenshot or evidence document uploaded during manual verification';

COMMENT ON COLUMN public.orders.payment_verified_at
  IS 'Timestamp when manual verification was performed';

COMMENT ON COLUMN public.orders.payment_amount_verified
  IS 'Amount confirmed during manual verification in dollars';

COMMENT ON COLUMN public.orders.payment_payer_email
  IS 'Payer email recorded during manual verification';
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
  ) NOT VALID;

-- 4. Index for expiry sweeps
CREATE INDEX IF NOT EXISTS idx_assignments_expires_at
  ON public.ridechecker_job_assignments (expires_at)
  WHERE status = 'awaiting_acceptance';

COMMENT ON COLUMN public.ridechecker_job_assignments.expires_at
  IS 'Timestamp after which an awaiting_acceptance assignment auto-expires (default 15 min from creation)';

COMMENT ON COLUMN public.ridechecker_job_assignments.declined_at
  IS 'Timestamp when the RideChecker declined the assignment';


-- ============================================================
-- MIGRATION 033: Assignment comms tracking
-- first_viewed_at: when RC first opened the job detail page
-- last_nudge_at:   when ops last re-sent the notification
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ridechecker_job_assignments' AND column_name='first_viewed_at') THEN
    ALTER TABLE public.ridechecker_job_assignments ADD COLUMN first_viewed_at TIMESTAMPTZ NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ridechecker_job_assignments' AND column_name='last_nudge_at') THEN
    ALTER TABLE public.ridechecker_job_assignments ADD COLUMN last_nudge_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- ============================================================
-- MIGRATION 034: Connecteam integration support
-- connecteam_logs   – audit trail of internal comms actions
-- connecteam_mappings – links RideCheck profiles to Connecteam
-- ============================================================

CREATE TABLE IF NOT EXISTS public.connecteam_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ridechecker_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action         text NOT NULL,
  notes          text,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connecteam_logs_order_id
  ON public.connecteam_logs (order_id);

CREATE INDEX IF NOT EXISTS idx_connecteam_logs_ridechecker_id
  ON public.connecteam_logs (ridechecker_id);

CREATE TABLE IF NOT EXISTS public.connecteam_mappings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  connecteam_name   text,
  connecteam_status text NOT NULL DEFAULT 'active',
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connecteam_mappings_profile_id
  ON public.connecteam_mappings (profile_id);

ALTER TABLE public.connecteam_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connecteam_mappings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'connecteam_logs' AND policyname = 'ops_manage_connecteam_logs'
  ) THEN
    CREATE POLICY ops_manage_connecteam_logs ON public.connecteam_logs
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('owner','admin','operations_lead','operations')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'connecteam_mappings' AND policyname = 'ops_manage_connecteam_mappings'
  ) THEN
    CREATE POLICY ops_manage_connecteam_mappings ON public.connecteam_mappings
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('owner','admin','operations_lead','operations')
        )
      );
  END IF;
END $$;

-- ============================================================
-- MIGRATION 035 — Live Inspection Execution System
-- ============================================================

-- 1. Extend status constraint to include new lifecycle stages
ALTER TABLE public.ridechecker_job_assignments
  DROP CONSTRAINT IF EXISTS chk_assignment_status;

ALTER TABLE public.ridechecker_job_assignments
  ADD CONSTRAINT chk_assignment_status CHECK (
    status IN (
      'awaiting_acceptance', 'assigned', 'accepted', 'declined', 'expired',
      'en_route', 'arrived', 'inspection_started', 'photos_uploading',
      'report_pending', 'in_progress', 'submitted', 'approved', 'rejected',
      'paid', 'cancelled', 'escalated', 'reassigned'
    )
  ) NOT VALID;

-- 2. Add new timestamp and operational columns
ALTER TABLE public.ridechecker_job_assignments
  ADD COLUMN IF NOT EXISTS en_route_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photos_uploading_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_pending_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_status_update_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delay_notes             TEXT,
  ADD COLUMN IF NOT EXISTS escalation_notes        TEXT,
  ADD COLUMN IF NOT EXISTS last_known_lat          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_known_lng          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_update_at TIMESTAMPTZ;

-- 3. Job status history log table
CREATE TABLE IF NOT EXISTS public.ridechecker_job_status_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  UUID        REFERENCES public.ridechecker_job_assignments(id) ON DELETE CASCADE,
  order_id       UUID        REFERENCES public.orders(id) ON DELETE SET NULL,
  ridechecker_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_status     TEXT,
  new_status     TEXT        NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_status_log_assignment
  ON public.ridechecker_job_status_log (assignment_id);

CREATE INDEX IF NOT EXISTS idx_job_status_log_order
  ON public.ridechecker_job_status_log (order_id);

ALTER TABLE public.ridechecker_job_status_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ridechecker_job_status_log'
      AND policyname = 'ops_read_job_status_log'
  ) THEN
    CREATE POLICY ops_read_job_status_log
      ON public.ridechecker_job_status_log
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('owner','admin','operations_lead','operations')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ridechecker_job_status_log'
      AND policyname = 'rc_read_own_status_log'
  ) THEN
    CREATE POLICY rc_read_own_status_log
      ON public.ridechecker_job_status_log
      FOR SELECT TO authenticated
      USING (ridechecker_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ridechecker_job_status_log'
      AND policyname = 'service_manage_job_status_log'
  ) THEN
    CREATE POLICY service_manage_job_status_log
      ON public.ridechecker_job_status_log
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- MIGRATIONS 036–045 (catch-up from 035)
-- All operations are idempotent — safe to run multiple times.
-- ============================================================


-- ============================================================
-- MIGRATION 036-A: profiles — RideChecker availability toggle
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_available            BOOLEAN    DEFAULT false,
  ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMPTZ;


-- ============================================================
-- MIGRATION 036-C: Fix orders.assignment_status constraint
-- ============================================================
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_orders_assignment_status;
ALTER TABLE public.orders
  ADD CONSTRAINT chk_orders_assignment_status CHECK (
    assignment_status IN (
      'unassigned','assigned','awaiting_acceptance','accepted',
      'declined','expired','en_route','arrived',
      'inspection_started','inspecting','in_progress','report_processing',
      'fraud_hold','unsafe_hold','completed','cancelled'
    )
  );


-- ============================================================
-- MIGRATION 036-D: profiles — availability_status + capacity
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS suspended_until     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_active_jobs     INT  NOT NULL DEFAULT 5;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_availability_status;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_availability_status
  CHECK (availability_status IN ('available','unavailable','busy','suspended'));


-- ============================================================
-- MIGRATION 036-E: orders.seller_status — full enum
-- ============================================================
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_orders_seller_status;
ALTER TABLE public.orders
  ADD CONSTRAINT chk_orders_seller_status CHECK (
    seller_status IN (
      'awaiting',
      'seller_not_contacted','seller_contacted','awaiting_seller_response',
      'seller_confirmed','seller_reschedule_requested','seller_declined',
      'seller_no_response','vehicle_sold','unsafe_location_flagged',
      'confirmed','no_response','invalid'
    )
  );


-- ============================================================
-- MIGRATION 036-F: ridechecker_job_assignments — expand lifecycle
-- constraint FIRST so the backfill below can insert any status.
-- ============================================================
ALTER TABLE public.ridechecker_job_assignments
  DROP CONSTRAINT IF EXISTS chk_assignment_status;
ALTER TABLE public.ridechecker_job_assignments
  ADD CONSTRAINT chk_assignment_status CHECK (
    status IN (
      'awaiting_acceptance','assigned','accepted','declined','expired',
      'en_route','arrived','inspection_started','inspecting',
      'photos_uploading','report_pending','report_processing',
      'in_progress','submitted','approved','rejected',
      'paid','cancelled','escalated','reassigned',
      'fraud_hold','unsafe_hold'
    )
  ) NOT VALID;

ALTER TABLE public.ridechecker_job_assignments
  ADD COLUMN IF NOT EXISTS flag_type  TEXT,
  ADD COLUMN IF NOT EXISTS flag_notes TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;


-- ============================================================
-- MIGRATION 036-B: ridechecker_job_assignments — data backfill
-- Runs AFTER constraint expansion so any existing assignment_status
-- value (e.g. 'in_progress') is accepted. Safe to run multiple times.
-- ============================================================
DO $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO public.ridechecker_job_assignments
    (order_id, ridechecker_id, status, created_at)
  SELECT
    o.id,
    o.assigned_ridechecker_id,
    COALESCE(NULLIF(o.assignment_status, 'unassigned'), 'awaiting_acceptance'),
    COALESCE(o.assigned_at, o.updated_at, NOW())
  FROM public.orders o
  WHERE o.assigned_ridechecker_id IS NOT NULL
    AND COALESCE(o.assignment_status, '') NOT IN ('unassigned', '')
    AND NOT EXISTS (
      SELECT 1 FROM public.ridechecker_job_assignments rja
      WHERE rja.order_id       = o.id
        AND rja.ridechecker_id = o.assigned_ridechecker_id
        AND rja.status NOT IN ('cancelled', 'declined', 'expired', 'rejected')
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ridechecker_job_assignments backfill: % row(s) inserted', v_count;
END $$;


-- ============================================================
-- MIGRATION 037: ridechecker_raw_submissions — road test module
-- ============================================================
ALTER TABLE public.ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS road_test_module JSONB NULL;

COMMENT ON COLUMN public.ridechecker_raw_submissions.road_test_module IS
  'Structured road test module: { status, engine_behavior[], transmission[], brakes[], steering[], suspension[], warning_lights[], other_lights_noted, other_lights_description, overall[], concerns_notes, photo_1_url, photo_2_url }';


-- ============================================================
-- MIGRATION 038: ridechecker_raw_submissions — OBD-II module
-- ============================================================
ALTER TABLE public.ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS obd_module JSONB NULL;

COMMENT ON COLUMN public.ridechecker_raw_submissions.obd_module IS
  'Structured OBD-II module: { scan_performed, uploaded_files[], dtc_codes[], notes, emissions_readiness, warning_lights[], warning_other_desc }';


-- ============================================================
-- MIGRATION 039: ridechecker_raw_submissions — title history module
-- ============================================================
ALTER TABLE public.ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS title_history_module JSONB NULL;

COMMENT ON COLUMN public.ridechecker_raw_submissions.title_history_module IS
  'Observable title/VIN/flood/tampering/accident indicators: { title_review_status, title_type, vin_match_title, seller_name_match, title_signed, dashboard_vin_verified, door_jamb_vin_verified, vins_matched, dashboard_vin_photo_url, door_jamb_vin_photo_url, lien_status, lien_notes, odometer_reading, odometer_consistency, odometer_tampering, odometer_notes, flood_indicators[], flood_notes, tampering_indicators[], tampering_notes, accident_indicators[], accident_notes, ops_review_status }';


-- ============================================================
-- MIGRATION 040: orders — payment override tracking
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='payment_required') THEN
    ALTER TABLE orders ADD COLUMN payment_required BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='payment_override_approved') THEN
    ALTER TABLE orders ADD COLUMN payment_override_approved BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='payment_override_reason') THEN
    ALTER TABLE orders ADD COLUMN payment_override_reason TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='payment_override_by') THEN
    ALTER TABLE orders ADD COLUMN payment_override_by UUID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='payment_override_at') THEN
    ALTER TABLE orders ADD COLUMN payment_override_at TIMESTAMPTZ;
  END IF;
END $$;


-- ============================================================
-- MIGRATION 041: Risk Intelligence tables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicle_risk_checks (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vin                TEXT,
  overall_risk_score INTEGER,
  overall_risk_level TEXT,
  score_reasons      JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_risk_checks_order_id ON public.vehicle_risk_checks(order_id);
CREATE INDEX        IF NOT EXISTS idx_vehicle_risk_checks_order_id ON public.vehicle_risk_checks(order_id);

CREATE TABLE IF NOT EXISTS public.vehicle_vin_checks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vin            TEXT,
  decoded_year   TEXT,
  decoded_make   TEXT,
  decoded_model  TEXT,
  vin_valid      BOOLEAN,
  source         TEXT,
  raw_response   JSONB,
  checked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_vin_checks_order_id ON public.vehicle_vin_checks(order_id);

CREATE TABLE IF NOT EXISTS public.vehicle_recall_checks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vin              TEXT,
  recall_count     INTEGER,
  highest_severity TEXT,
  recall_data      JSONB,
  source           TEXT,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_recall_checks_order_id ON public.vehicle_recall_checks(order_id);

CREATE TABLE IF NOT EXISTS public.vehicle_flood_checks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  flood_risk_score INTEGER,
  flood_risk_level TEXT,
  findings         JSONB,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_flood_checks_order_id ON public.vehicle_flood_checks(order_id);

CREATE TABLE IF NOT EXISTS public.vehicle_theft_checks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  theft_status TEXT,
  theft_source TEXT,
  theft_data   JSONB,
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_theft_checks_order_id ON public.vehicle_theft_checks(order_id);

CREATE TABLE IF NOT EXISTS public.vehicle_market_value_checks (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_price          NUMERIC,
  estimated_market_value NUMERIC,
  variance_percent       NUMERIC,
  pricing_risk_level     TEXT,
  source                 TEXT,
  checked_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_market_value_checks_order_id ON public.vehicle_market_value_checks(order_id);


-- ============================================================
-- MIGRATION 042: orders — seller_type
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_type TEXT DEFAULT 'private_party';

UPDATE public.orders SET seller_type = 'private_party' WHERE seller_type IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN seller_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_seller_type ON public.orders(seller_type);


-- ============================================================
-- MIGRATION 043: vehicle_title_transfer_checks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicle_title_transfer_checks (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                      UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vin                           TEXT,
  title_present                 BOOLEAN,
  seller_name_on_title          TEXT,
  buyer_name_completed          TEXT,
  odometer_disclosure_completed TEXT,
  lien_release_present          TEXT,
  title_signed                  TEXT,
  open_title                    TEXT,
  vin_matches_title             TEXT,
  state_of_title                TEXT,
  title_photo_url               TEXT,
  lien_release_photo_url        TEXT,
  odometer_disclosure_photo_url TEXT,
  transfer_readiness_status     TEXT NOT NULL DEFAULT 'unknown'
    CHECK (transfer_readiness_status IN ('ready','caution','concern','unknown')),
  risk_flags                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes                         TEXT,
  checked_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vttc_order_id ON public.vehicle_title_transfer_checks(order_id);
CREATE INDEX IF NOT EXISTS idx_vttc_vin      ON public.vehicle_title_transfer_checks(vin);
CREATE INDEX IF NOT EXISTS idx_vttc_status   ON public.vehicle_title_transfer_checks(transfer_readiness_status);


-- ============================================================
-- MIGRATION 044: ridecheck_credits (Founding Supporter campaign)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ridecheck_credits (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type          TEXT        NOT NULL DEFAULT 'founding_supporter',
  tier                  TEXT        NOT NULL CHECK (tier IN ('backer','believer','founding_partner')),
  amount_cents          INTEGER     NOT NULL,
  credits_count         INTEGER     NOT NULL DEFAULT 1,
  credit_code           TEXT        NOT NULL UNIQUE,
  supporter_name        TEXT        NOT NULL,
  supporter_email       TEXT        NOT NULL,
  supporter_phone       TEXT,
  gift_recipient_name   TEXT,
  gift_recipient_email  TEXT,
  gift_message          TEXT,
  list_on_partners_page BOOLEAN     NOT NULL DEFAULT FALSE,
  stripe_session_id     TEXT,
  status                TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','redeemed','expired')),
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ridecheck_credits_email    ON public.ridecheck_credits(supporter_email);
CREATE INDEX IF NOT EXISTS idx_ridecheck_credits_status   ON public.ridecheck_credits(status);
CREATE INDEX IF NOT EXISTS idx_ridecheck_credits_stripe   ON public.ridecheck_credits(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_ridecheck_credits_partners ON public.ridecheck_credits(list_on_partners_page, status, created_at);

COMMENT ON TABLE public.ridecheck_credits IS
  'Founding Supporter campaign credits. One row per purchase. credits_count=2 for founding_partner tier.';


-- ============================================================
-- MIGRATION 045: ridechecker_raw_submissions — audit timestamps
-- ============================================================
ALTER TABLE public.ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_rrs_updated_at ON public.ridechecker_raw_submissions;
CREATE TRIGGER trg_rrs_updated_at
  BEFORE UPDATE ON public.ridechecker_raw_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- MIGRATION 046: Canonical Stripe payment ID columns on orders
--
-- 1. Adds payment_intent_id (base-schema column missing in some
--    deployments) as a catch-up, idempotent step.
-- 2. Adds stripe_checkout_session_id and stripe_payment_intent_id
--    as the canonical, well-named column pair.
-- 3. Backfills canonical columns from legacy ones where present.
--
-- All operations are idempotent — safe to run multiple times.
-- ============================================================

-- Step 1: Ensure legacy base-schema column exists (catch-up)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

-- Step 2: Add canonical columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id   TEXT;

-- Step 3: Backfill canonical columns from legacy columns
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orders'
      AND column_name  = 'stripe_session_id'
  ) THEN
    UPDATE public.orders
      SET stripe_checkout_session_id = stripe_session_id
      WHERE stripe_checkout_session_id IS NULL
        AND stripe_session_id IS NOT NULL;
    RAISE NOTICE 'Backfilled stripe_checkout_session_id from stripe_session_id';
  ELSE
    RAISE NOTICE 'stripe_session_id absent — skipping checkout session backfill';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orders'
      AND column_name  = 'payment_intent_id'
  ) THEN
    UPDATE public.orders
      SET stripe_payment_intent_id = payment_intent_id
      WHERE stripe_payment_intent_id IS NULL
        AND payment_intent_id IS NOT NULL;
    RAISE NOTICE 'Backfilled stripe_payment_intent_id from payment_intent_id';
  ELSE
    RAISE NOTICE 'payment_intent_id absent — skipping payment intent backfill';
  END IF;
END $$;

-- Step 4: Indexes
CREATE INDEX IF NOT EXISTS idx_orders_stripe_checkout_session_id
  ON public.orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id
  ON public.orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id
  ON public.orders (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

COMMENT ON COLUMN public.orders.payment_intent_id IS
  'Stripe PaymentIntent ID (pi_...) — legacy column, kept for backward compatibility.';

COMMENT ON COLUMN public.orders.stripe_checkout_session_id IS
  'Stripe Checkout Session ID (cs_...) linked to this order. Written by pay/create-session and webhook.';

COMMENT ON COLUMN public.orders.stripe_payment_intent_id IS
  'Stripe PaymentIntent ID (pi_...) confirmed as succeeded. Canonical column written by webhook and sync-payment.';


-- ============================================================
-- MIGRATION 047: ops_notes catch-up + ops_internal_note
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ops_notes          TEXT,
  ADD COLUMN IF NOT EXISTS ops_internal_note  TEXT;

COMMENT ON COLUMN public.orders.ops_notes IS
  'Free-form notes recorded by ops alongside status transitions.';

COMMENT ON COLUMN public.orders.ops_internal_note IS
  'Internal-only ops note recorded when vehicle/listing info is corrected. Never surfaced to buyer.';


-- ============================================================
-- MIGRATION 048: ridechecker_payouts — payment tracking columns
-- ============================================================

ALTER TABLE public.ridechecker_payouts
  ADD COLUMN IF NOT EXISTS payment_method    TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

COMMENT ON COLUMN public.ridechecker_payouts.payment_method IS
  'How the RideChecker was paid: zelle, paypal, cashapp, venmo, ach, check, cash, other';

COMMENT ON COLUMN public.ridechecker_payouts.payment_reference IS
  'Transaction ID, check number, or other reference for the payment method';


-- ============================================================
-- MIGRATION 049: buyer notification preferences + RC service radius
--                + seller reply tracking
-- ============================================================

-- 49a: Buyer notification preferences on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB;

COMMENT ON COLUMN public.profiles.notification_preferences IS
  'Buyer contact preferences: { primary_method, secondary_method, fastest_response_method, sms_opt_in, email_opt_in, phone_opt_in }';

-- 49b: RideChecker service radius on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER;

COMMENT ON COLUMN public.profiles.service_radius_miles IS
  'Maximum miles a RideChecker is willing to travel for a job. NULL = no limit set.';

-- 49c: Seller reply tracking on seller_contact_attempts
ALTER TABLE public.seller_contact_attempts
  ADD COLUMN IF NOT EXISTS response_received BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS response_at       TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS response_notes    TEXT NULL;

COMMENT ON COLUMN public.seller_contact_attempts.response_received IS
  'True when the seller replied to this specific attempt.';

COMMENT ON COLUMN public.seller_contact_attempts.response_at IS
  'Timestamp when the seller response was received/recorded.';

COMMENT ON COLUMN public.seller_contact_attempts.response_notes IS
  'Ops notes summarising the seller response content.';

-- ============================================================
-- Migration 050: Seller Trust + Buyer Retention
-- ============================================================

-- 50a: RideChecker public profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS completed_inspections INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2);

COMMENT ON COLUMN public.profiles.photo_url IS
  'Public-facing profile photo URL for RideChecker trust confirmation messages.';
COMMENT ON COLUMN public.profiles.completed_inspections IS
  'Running count of completed inspections used in seller trust messages.';
COMMENT ON COLUMN public.profiles.average_rating IS
  'Aggregate star rating (0.00–5.00) displayed to sellers in trust confirmation.';

-- 50b: Transferable order credit for buyer retention
CREATE TABLE IF NOT EXISTS public.transferable_order_credit (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  credit_amount_cents  INTEGER NOT NULL,
  remaining_amount_cents INTEGER NOT NULL,
  package_type         TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','used','refunded','expired')),
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 months'),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_order_id        UUID REFERENCES public.orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transferable_order_credit_buyer
  ON public.transferable_order_credit (buyer_id);
CREATE INDEX IF NOT EXISTS idx_transferable_order_credit_original_order
  ON public.transferable_order_credit (original_order_id);

COMMENT ON TABLE public.transferable_order_credit IS
  'Holds buyer credit created when a seller refuses inspection, enabling transfer to a new vehicle.';

-- 50c: seller_refused_inspection status on order_events (informational — no enum change needed,
--      stored as event_type TEXT in order_events)

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 051: Delivery tracking on seller_contact_attempts
-- Run in Supabase SQL Editor after deploying the matching application code.
-- ─────────────────────────────────────────────────────────────────────────────

-- 51a: Add delivery-tracking columns
ALTER TABLE public.seller_contact_attempts
  ADD COLUMN IF NOT EXISTS provider_message_id  TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status      TEXT
    CHECK (delivery_status IN ('queued','sent','delivered','bounced','failed','undeliverable')),
  ADD COLUMN IF NOT EXISTS delivery_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_auto_notification BOOLEAN NOT NULL DEFAULT FALSE;

-- Fast lookup by provider ID for webhook callbacks
CREATE INDEX IF NOT EXISTS idx_sca_provider_message_id
  ON public.seller_contact_attempts (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

COMMENT ON COLUMN public.seller_contact_attempts.provider_message_id IS
  'Resend email ID or Twilio SID returned at send time; used to match webhook delivery events.';
COMMENT ON COLUMN public.seller_contact_attempts.delivery_status IS
  'Provider-confirmed delivery state: queued|sent|delivered|bounced|failed|undeliverable. NULL = manual/untracked attempt.';
COMMENT ON COLUMN public.seller_contact_attempts.delivery_updated_at IS
  'Timestamp of the most recent delivery status update from the provider webhook.';
COMMENT ON COLUMN public.seller_contact_attempts.is_auto_notification IS
  'TRUE for system-generated messages (e.g. seller trust confirmation). Excluded from the 3-attempt ops counter.';


-- ============================================================
-- MIGRATION 052: Report-to-Order Safety Controls
-- generated_reports and report_delivery_events tables
-- ============================================================

-- generated_reports: one row per AI-generated report PDF
-- Enforces that every delivery is tied to a specific order/buyer/report.
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number         TEXT,
  buyer_email          TEXT,
  buyer_name           TEXT,
  vehicle_year         TEXT,
  vehicle_make         TEXT,
  vehicle_model        TEXT,
  vin                  TEXT,
  report_storage_path  TEXT,
  report_url           TEXT,
  -- qa_pending | qa_approved | delivered | superseded
  report_status        TEXT NOT NULL DEFAULT 'qa_pending',
  generated_by         UUID,
  qa_approved_by       UUID,
  qa_approved_at       TIMESTAMPTZ,
  qa_notes             TEXT,
  delivered_by         UUID,
  delivered_at         TIMESTAMPTZ,
  report_logic_version TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_order_id
  ON public.generated_reports(order_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status
  ON public.generated_reports(report_status);

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- report_delivery_events: immutable log of every delivery attempt
CREATE TABLE IF NOT EXISTS public.report_delivery_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  report_id            UUID REFERENCES public.generated_reports(id),
  recipient_email      TEXT,
  recipient_phone      TEXT,
  -- email | sms | both
  channel              TEXT NOT NULL DEFAULT 'email',
  -- sent | failed | bounced | delivered
  status               TEXT NOT NULL DEFAULT 'sent',
  delivered_by         UUID,
  delivered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_message_id  TEXT,
  notes                TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_delivery_events_order_id
  ON public.report_delivery_events(order_id);

ALTER TABLE public.report_delivery_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.generated_reports IS
  'One row per AI-generated PDF; report_status must be qa_approved before delivery is allowed.';
COMMENT ON TABLE public.report_delivery_events IS
  'Immutable audit log of every report delivery attempt (email/SMS).';
