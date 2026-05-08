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
  );

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
  );

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

-- ── Migration 036: RideChecker simple availability toggle ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS availability_updated_at timestamptz;

-- ── Migration 037: Repair & Backfill ridechecker_job_assignments ──────────────
-- Finds every order that has assigned_ridechecker_id set but no matching
-- non-cancelled ridechecker_job_assignments row and creates the missing row.
-- Safe to run multiple times (ON CONFLICT DO NOTHING + WHERE NOT EXISTS guard).

DO $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO public.ridechecker_job_assignments
    (order_id, ridechecker_id, status, created_at)
  SELECT
    o.id,
    o.assigned_ridechecker_id,
    COALESCE(
      NULLIF(o.assignment_status, 'unassigned'),
      'awaiting_acceptance'
    ),
    COALESCE(o.assigned_at, o.updated_at, NOW())
  FROM public.orders o
  WHERE o.assigned_ridechecker_id IS NOT NULL
    AND COALESCE(o.assignment_status, '') NOT IN ('unassigned', '')
    AND NOT EXISTS (
      SELECT 1 FROM public.ridechecker_job_assignments rja
      WHERE rja.order_id          = o.id
        AND rja.ridechecker_id    = o.assigned_ridechecker_id
        AND rja.status NOT IN ('cancelled', 'declined', 'expired', 'rejected')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ridechecker_job_assignments backfill: % row(s) inserted', v_count;
END $$;
