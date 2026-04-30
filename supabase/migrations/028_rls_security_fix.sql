-- =============================================================
-- 028_rls_security_fix.sql
-- Comprehensive RLS audit and hardening pass.
--
-- Triggered by: Supabase Security Advisor flag "rls_disabled_in_public"
-- Date: 2026-04-30
--
-- Strategy:
--   1. ENABLE ROW LEVEL SECURITY on every public table (idempotent).
--   2. DROP and re-create all policies idempotently (DROP IF EXISTS guards).
--   3. All server-side routes use supabaseAdmin (service role key) which
--      BYPASSES RLS entirely — enabling RLS here does NOT break any server
--      functionality.
--   4. Tighten health_pings: remove public SELECT (USING(true)).
--   5. Add explicit staff-only SELECT to tables that had RLS on but no policy.
--   6. No permissive "allow all" policies are created.
--
-- Safe to re-run: every statement is idempotent.
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- =============================================================


-- =============================================================
-- SECTION A: Ensure RBAC helper functions exist
-- (Defined in 016; re-created here so this migration is
--  self-contained and safe even if 016 was never applied.)
-- =============================================================

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
  SELECT public.current_user_role() IN (
    'owner', 'operations_lead', 'operations', 'qa', 'developer', 'platform'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_ridechecker()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('ridechecker', 'ridechecker_active')
$$;

CREATE OR REPLACE FUNCTION public.is_active_ridechecker()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() = 'ridechecker_active'
$$;


-- =============================================================
-- SECTION B: Enable RLS on ALL public tables (idempotent)
-- Tables are listed in creation order for auditability.
-- =============================================================

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


-- =============================================================
-- SECTION C: Drop all old policies before re-creating
-- (Idempotent — DROP IF EXISTS on every named policy)
-- =============================================================

-- profiles
DROP POLICY IF EXISTS "profiles_select_own"              ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"              ON public.profiles;
DROP POLICY IF EXISTS "profiles_select"                  ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"              ON public.profiles;
DROP POLICY IF EXISTS "allow_profile_insert"             ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_authenticated"    ON public.profiles;

-- orders
DROP POLICY IF EXISTS "orders_select_own"                ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own"                ON public.orders;
DROP POLICY IF EXISTS "orders_select"                    ON public.orders;
DROP POLICY IF EXISTS "orders_insert"                    ON public.orders;

-- health_pings
DROP POLICY IF EXISTS "allow_health_pings_insert"        ON public.health_pings;
DROP POLICY IF EXISTS "allow_health_pings_select"        ON public.health_pings;
DROP POLICY IF EXISTS "health_pings_select"              ON public.health_pings;
DROP POLICY IF EXISTS "health_pings_insert"              ON public.health_pings;

-- activity_log
DROP POLICY IF EXISTS "activity_log_select"              ON public.activity_log;

-- audit_log
DROP POLICY IF EXISTS "audit_log_select"                 ON public.audit_log;

-- order_events
DROP POLICY IF EXISTS "order_events_select"              ON public.order_events;

-- intelligence_reports
DROP POLICY IF EXISTS "intelligence_reports_select"      ON public.intelligence_reports;

-- title_ownership_review
DROP POLICY IF EXISTS "title_review_select"              ON public.title_ownership_review;

-- bill_of_sale_documents
DROP POLICY IF EXISTS "bos_select"                       ON public.bill_of_sale_documents;

-- inspectors
DROP POLICY IF EXISTS "inspectors_select"                ON public.inspectors;
DROP POLICY IF EXISTS "inspectors_write"                 ON public.inspectors;

-- user_invites
DROP POLICY IF EXISTS "user_invites_select"              ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_insert"              ON public.user_invites;

-- ridechecker_earnings
DROP POLICY IF EXISTS "earnings_select"                  ON public.ridechecker_earnings;

-- referral_codes
DROP POLICY IF EXISTS "referral_codes_select"            ON public.referral_codes;

-- referrals
DROP POLICY IF EXISTS "referrals_select"                 ON public.referrals;

-- seller_contact_attempts
DROP POLICY IF EXISTS "seller_contact_select"            ON public.seller_contact_attempts;

-- ridechecker_availability
DROP POLICY IF EXISTS "ridechecker_own_availability"     ON public.ridechecker_availability;
DROP POLICY IF EXISTS "availability_select"              ON public.ridechecker_availability;
DROP POLICY IF EXISTS "availability_insert"              ON public.ridechecker_availability;
DROP POLICY IF EXISTS "availability_update"              ON public.ridechecker_availability;
DROP POLICY IF EXISTS "availability_delete"              ON public.ridechecker_availability;

-- ridechecker_job_assignments
DROP POLICY IF EXISTS "ridechecker_own_assignments_select" ON public.ridechecker_job_assignments;
DROP POLICY IF EXISTS "assignments_select"               ON public.ridechecker_job_assignments;

-- ridechecker_raw_submissions
DROP POLICY IF EXISTS "ridechecker_own_submissions"      ON public.ridechecker_raw_submissions;
DROP POLICY IF EXISTS "submissions_select"               ON public.ridechecker_raw_submissions;
DROP POLICY IF EXISTS "submissions_insert"               ON public.ridechecker_raw_submissions;
DROP POLICY IF EXISTS "submissions_update"               ON public.ridechecker_raw_submissions;

-- terms_acceptances
DROP POLICY IF EXISTS "terms_select"                     ON public.terms_acceptances;

-- mechanical_findings
DROP POLICY IF EXISTS "mechanical_findings_select"       ON public.mechanical_findings;
DROP POLICY IF EXISTS "mechanical_findings_write"        ON public.mechanical_findings;

-- obd_findings
DROP POLICY IF EXISTS "obd_findings_select"              ON public.obd_findings;
DROP POLICY IF EXISTS "obd_findings_write"               ON public.obd_findings;

-- title_intelligence
DROP POLICY IF EXISTS "title_intelligence_select"        ON public.title_intelligence;
DROP POLICY IF EXISTS "title_intelligence_write"         ON public.title_intelligence;

-- system_flags / fraud_flags (no client policies — keep locked)
DROP POLICY IF EXISTS "system_flags_select"              ON public.system_flags;
DROP POLICY IF EXISTS "system_flags_write"               ON public.system_flags;
DROP POLICY IF EXISTS "fraud_flags_select"               ON public.fraud_flags;

-- region_capacity
DROP POLICY IF EXISTS "region_capacity_select"           ON public.region_capacity;

-- waitlist
DROP POLICY IF EXISTS "anon_insert_waitlist"             ON public.waitlist;
DROP POLICY IF EXISTS "waitlist_insert"                  ON public.waitlist;
DROP POLICY IF EXISTS "waitlist_select"                  ON public.waitlist;

-- reports
DROP POLICY IF EXISTS "reports_select"                   ON public.reports;

-- lookup tables
DROP POLICY IF EXISTS "auth_read_role_definitions"       ON public.role_definitions;
DROP POLICY IF EXISTS "role_definitions_select"          ON public.role_definitions;
DROP POLICY IF EXISTS "auth_read_tier_pricing"           ON public.tier_pricing;
DROP POLICY IF EXISTS "tier_pricing_select"              ON public.tier_pricing;
DROP POLICY IF EXISTS "auth_read_regions"                ON public.regions;
DROP POLICY IF EXISTS "regions_select"                   ON public.regions;
DROP POLICY IF EXISTS "auth_read_roles"                  ON public.roles;
DROP POLICY IF EXISTS "roles_select"                     ON public.roles;
DROP POLICY IF EXISTS "auth_read_region_zips"            ON public.region_zips;
DROP POLICY IF EXISTS "region_zips_select"               ON public.region_zips;
DROP POLICY IF EXISTS "auth_read_vehicle_rules"          ON public.vehicle_rules;
DROP POLICY IF EXISTS "vehicle_rules_select"             ON public.vehicle_rules;
DROP POLICY IF EXISTS "user_roles_select"                ON public.user_roles;

-- ridechecker_stage_history
DROP POLICY IF EXISTS "stage_history_select"             ON public.ridechecker_stage_history;

-- ridechecker_applications
DROP POLICY IF EXISTS "rc_applications_public_insert"    ON public.ridechecker_applications;
DROP POLICY IF EXISTS "rc_applications_select"           ON public.ridechecker_applications;

-- vehicle_classification_signals
DROP POLICY IF EXISTS "classification_signals_select"    ON public.vehicle_classification_signals;

-- ridechecker_training_results
DROP POLICY IF EXISTS "rc_training_select_own"           ON public.ridechecker_training_results;
DROP POLICY IF EXISTS "rc_training_upsert_own"           ON public.ridechecker_training_results;

-- ridechecker_ops_messages
DROP POLICY IF EXISTS "ridechecker_ops_messages_insert"  ON public.ridechecker_ops_messages;
DROP POLICY IF EXISTS "ridechecker_ops_messages_select_own" ON public.ridechecker_ops_messages;


-- =============================================================
-- SECTION D: Re-create all policies (least-privilege)
-- =============================================================


-- -----------------------------------------------------------
-- profiles
-- Users read their own row. Staff reads all profiles.
-- No client INSERT/UPDATE — all mutations via service role.
-- -----------------------------------------------------------
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_staff());


-- -----------------------------------------------------------
-- orders
-- Buyers read their own orders. Staff reads all.
-- Buyers may INSERT their own order (booking flow).
-- All UPDATE/DELETE via server (service role).
-- -----------------------------------------------------------
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT
  USING (auth.uid() = customer_id OR public.is_staff());

CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT
  WITH CHECK (
    -- authenticated buyer creating their own order
    auth.uid() = customer_id
    -- unauthenticated booking (customer_id backfilled by webhook)
    OR customer_id IS NULL
    -- ops can create orders via the dashboard
    OR public.is_staff()
  );


-- -----------------------------------------------------------
-- health_pings
-- FIX: was SELECT USING(true) — now restricted to staff only.
-- INSERT remains open for server-side health check route.
-- Public/anon can INSERT (server uses service role anyway).
-- No anon SELECT — health timestamps are internal data.
-- -----------------------------------------------------------
CREATE POLICY "health_pings_insert" ON public.health_pings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "health_pings_select" ON public.health_pings
  FOR SELECT
  USING (public.is_staff());


-- -----------------------------------------------------------
-- activity_log
-- Internal event log. Staff read-only. No client writes.
-- -----------------------------------------------------------
CREATE POLICY "activity_log_select" ON public.activity_log
  FOR SELECT
  USING (public.is_staff());


-- -----------------------------------------------------------
-- audit_log
-- Immutable. ops_lead+ read. No client writes ever.
-- -----------------------------------------------------------
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT
  USING (public.is_ops_lead());


-- -----------------------------------------------------------
-- order_events
-- Staff sees all events.
-- Buyers see only non-internal events on their own orders.
-- -----------------------------------------------------------
CREATE POLICY "order_events_select" ON public.order_events
  FOR SELECT
  USING (
    public.is_staff()
    OR (
      NOT is_internal
      AND EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id::text = order_events.order_id
          AND orders.customer_id = auth.uid()
      )
    )
  );


-- -----------------------------------------------------------
-- intelligence_reports
-- Staff (ops/qa) read. No client mutations.
-- -----------------------------------------------------------
CREATE POLICY "intelligence_reports_select" ON public.intelligence_reports
  FOR SELECT
  USING (public.is_staff());


-- -----------------------------------------------------------
-- title_ownership_review
-- Staff read. No client mutations.
-- -----------------------------------------------------------
CREATE POLICY "title_review_select" ON public.title_ownership_review
  FOR SELECT
  USING (public.is_staff());


-- -----------------------------------------------------------
-- bill_of_sale_documents
-- Buyers read their own (via order FK). Staff reads all.
-- No client mutations.
-- -----------------------------------------------------------
CREATE POLICY "bos_select" ON public.bill_of_sale_documents
  FOR SELECT
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = bill_of_sale_documents.order_id
        AND orders.customer_id = auth.uid()
    )
  );


-- -----------------------------------------------------------
-- inspectors  (legacy workforce table)
-- Staff read. ops_lead write. No client DELETE.
-- -----------------------------------------------------------
CREATE POLICY "inspectors_select" ON public.inspectors
  FOR SELECT
  USING (public.is_staff());

CREATE POLICY "inspectors_write" ON public.inspectors
  FOR ALL
  USING (public.is_ops_lead())
  WITH CHECK (public.is_ops_lead());


-- -----------------------------------------------------------
-- user_invites
-- ops_lead reads and creates invites.
-- Token lookup for invite acceptance uses service role.
-- -----------------------------------------------------------
CREATE POLICY "user_invites_select" ON public.user_invites
  FOR SELECT
  USING (public.is_ops_lead());

CREATE POLICY "user_invites_insert" ON public.user_invites
  FOR INSERT
  WITH CHECK (public.is_ops_lead());


-- -----------------------------------------------------------
-- ridechecker_earnings
-- RideCheckers read their own. ops_lead reads all.
-- No client INSERT/UPDATE — payout records via service role.
-- -----------------------------------------------------------
CREATE POLICY "earnings_select" ON public.ridechecker_earnings
  FOR SELECT
  USING (auth.uid() = ridechecker_id OR public.is_ops_lead());


-- -----------------------------------------------------------
-- referral_codes
-- RideCheckers read their own code. ops_lead reads all.
-- No client INSERT/DELETE.
-- -----------------------------------------------------------
CREATE POLICY "referral_codes_select" ON public.referral_codes
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_ops_lead());


-- -----------------------------------------------------------
-- referrals
-- RideCheckers see referrals where they are referrer or referee.
-- ops_lead sees all.
-- -----------------------------------------------------------
CREATE POLICY "referrals_select" ON public.referrals
  FOR SELECT
  USING (
    auth.uid() = referrer_id
    OR auth.uid() = referee_id
    OR public.is_ops_lead()
  );


-- -----------------------------------------------------------
-- seller_contact_attempts
-- ops and ops_lead read (concierge workflow).
-- No client INSERT — attempts logged via server.
-- -----------------------------------------------------------
CREATE POLICY "seller_contact_select" ON public.seller_contact_attempts
  FOR SELECT
  USING (public.is_ops_lead() OR public.is_ops());


-- -----------------------------------------------------------
-- ridechecker_availability
-- Active ridecheckers manage their own slots.
-- Staff reads all slots (dispatch engine).
-- -----------------------------------------------------------
CREATE POLICY "availability_select" ON public.ridechecker_availability
  FOR SELECT
  USING (auth.uid() = ridechecker_id OR public.is_staff());

CREATE POLICY "availability_insert" ON public.ridechecker_availability
  FOR INSERT
  WITH CHECK (auth.uid() = ridechecker_id AND public.is_active_ridechecker());

CREATE POLICY "availability_update" ON public.ridechecker_availability
  FOR UPDATE
  USING (auth.uid() = ridechecker_id AND public.is_active_ridechecker())
  WITH CHECK (auth.uid() = ridechecker_id AND public.is_active_ridechecker());

CREATE POLICY "availability_delete" ON public.ridechecker_availability
  FOR DELETE
  USING (auth.uid() = ridechecker_id AND public.is_active_ridechecker());


-- -----------------------------------------------------------
-- ridechecker_job_assignments
-- RideCheckers see their own assignments. Staff sees all.
-- No client INSERT/UPDATE/DELETE — managed via server.
-- -----------------------------------------------------------
CREATE POLICY "assignments_select" ON public.ridechecker_job_assignments
  FOR SELECT
  USING (auth.uid() = ridechecker_id OR public.is_staff());


-- -----------------------------------------------------------
-- ridechecker_raw_submissions
-- Active ridecheckers INSERT and UPDATE their own submissions.
-- Any ridechecker (pending or active) reads their own.
-- Staff reads all (QA review queue).
-- No client DELETE.
-- -----------------------------------------------------------
CREATE POLICY "submissions_select" ON public.ridechecker_raw_submissions
  FOR SELECT
  USING (auth.uid() = ridechecker_id OR public.is_staff());

CREATE POLICY "submissions_insert" ON public.ridechecker_raw_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = ridechecker_id AND public.is_active_ridechecker());

CREATE POLICY "submissions_update" ON public.ridechecker_raw_submissions
  FOR UPDATE
  USING (auth.uid() = ridechecker_id AND public.is_active_ridechecker())
  WITH CHECK (auth.uid() = ridechecker_id AND public.is_active_ridechecker());


-- -----------------------------------------------------------
-- terms_acceptances  (immutable legal audit trail)
-- ops_lead reads. No client INSERT/UPDATE/DELETE.
-- -----------------------------------------------------------
CREATE POLICY "terms_select" ON public.terms_acceptances
  FOR SELECT
  USING (public.is_ops_lead());


-- -----------------------------------------------------------
-- mechanical_findings
-- Active ridechecker: own assigned orders only.
-- ops: read-only coordination.
-- ops_lead: full read + write.
-- -----------------------------------------------------------
CREATE POLICY "mechanical_findings_select" ON public.mechanical_findings
  FOR SELECT
  USING (
    public.is_ops_lead()
    OR public.is_ops()
    OR (
      public.is_active_ridechecker()
      AND EXISTS (
        SELECT 1 FROM public.ridechecker_job_assignments rja
        WHERE rja.order_id::text = mechanical_findings.order_id::text
          AND rja.ridechecker_id = auth.uid()
      )
    )
  );

CREATE POLICY "mechanical_findings_write" ON public.mechanical_findings
  FOR ALL
  USING (public.is_ops_lead())
  WITH CHECK (public.is_ops_lead());


-- -----------------------------------------------------------
-- obd_findings  (same access rules as mechanical_findings)
-- -----------------------------------------------------------
CREATE POLICY "obd_findings_select" ON public.obd_findings
  FOR SELECT
  USING (
    public.is_ops_lead()
    OR public.is_ops()
    OR (
      public.is_active_ridechecker()
      AND EXISTS (
        SELECT 1 FROM public.ridechecker_job_assignments rja
        WHERE rja.order_id::text = obd_findings.order_id::text
          AND rja.ridechecker_id = auth.uid()
      )
    )
  );

CREATE POLICY "obd_findings_write" ON public.obd_findings
  FOR ALL
  USING (public.is_ops_lead())
  WITH CHECK (public.is_ops_lead());


-- -----------------------------------------------------------
-- title_intelligence  (highly restricted system data)
-- ops_lead: read-only. admin (owner): full access.
-- ridechecker / ops / customer: NO ACCESS.
-- -----------------------------------------------------------
CREATE POLICY "title_intelligence_select" ON public.title_intelligence
  FOR SELECT
  USING (public.is_ops_lead());

CREATE POLICY "title_intelligence_write" ON public.title_intelligence
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- -----------------------------------------------------------
-- system_flags  — LOCKED (service role only, no client access)
-- fraud_flags   — LOCKED (service role only, CRITICAL)
-- reports       — LOCKED (service role only)
-- region_capacity — LOCKED (service role only)
-- user_roles    — LOCKED (privilege escalation risk)
-- No policies = anon/JWT access denied by default (RLS is ON).
-- -----------------------------------------------------------


-- -----------------------------------------------------------
-- waitlist  (public-facing email capture form)
-- Anon INSERT only. No SELECT for any client role.
-- -----------------------------------------------------------
CREATE POLICY "waitlist_insert" ON public.waitlist
  FOR INSERT
  WITH CHECK (true);


-- -----------------------------------------------------------
-- Lookup / reference tables
-- Authenticated read only. No client mutations.
-- -----------------------------------------------------------
CREATE POLICY "role_definitions_select" ON public.role_definitions
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "tier_pricing_select" ON public.tier_pricing
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "regions_select" ON public.regions
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "roles_select" ON public.roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "region_zips_select" ON public.region_zips
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "vehicle_rules_select" ON public.vehicle_rules
  FOR SELECT
  USING (auth.role() = 'authenticated');


-- -----------------------------------------------------------
-- ridechecker_stage_history
-- ops_lead reads. No client writes (service role only).
-- RideCheckers can read their own history.
-- -----------------------------------------------------------
CREATE POLICY "stage_history_select" ON public.ridechecker_stage_history
  FOR SELECT
  USING (
    public.is_ops_lead()
    OR auth.uid() = ridechecker_id
  );


-- -----------------------------------------------------------
-- ridechecker_applications
-- Public anon INSERT (application form is pre-login).
-- Staff reads all applications for review pipeline.
-- No client UPDATE/DELETE.
-- -----------------------------------------------------------
CREATE POLICY "rc_applications_public_insert" ON public.ridechecker_applications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "rc_applications_select" ON public.ridechecker_applications
  FOR SELECT
  USING (public.is_staff());


-- -----------------------------------------------------------
-- vehicle_classification_signals
-- INTERNAL ML training data — never exposed to customers.
-- Staff (developer/platform/owner) read only.
-- No client mutations — written exclusively by server.
-- -----------------------------------------------------------
CREATE POLICY "classification_signals_select" ON public.vehicle_classification_signals
  FOR SELECT
  USING (public.is_admin());


-- -----------------------------------------------------------
-- ridechecker_training_results
-- RideCheckers read their own training results.
-- Staff reads all (for progress tracking).
-- ops_lead upserts results (training engine).
-- -----------------------------------------------------------
CREATE POLICY "rc_training_select_own" ON public.ridechecker_training_results
  FOR SELECT TO authenticated
  USING (ridechecker_id = auth.uid() OR public.is_staff());

CREATE POLICY "rc_training_upsert_own" ON public.ridechecker_training_results
  FOR ALL
  USING (public.is_ops_lead())
  WITH CHECK (public.is_ops_lead());


-- -----------------------------------------------------------
-- ridechecker_ops_messages
-- RideCheckers INSERT and SELECT their own messages.
-- Staff reads all messages (ops visibility into field comms).
-- No client UPDATE/DELETE.
-- -----------------------------------------------------------
CREATE POLICY "ridechecker_ops_messages_insert" ON public.ridechecker_ops_messages
  FOR INSERT TO authenticated
  WITH CHECK (ridechecker_id = auth.uid());

CREATE POLICY "ridechecker_ops_messages_select_own" ON public.ridechecker_ops_messages
  FOR SELECT TO authenticated
  USING (ridechecker_id = auth.uid() OR public.is_staff());


-- =============================================================
-- SECTION E: Verification summary
-- (Informational — run separately to confirm results)
-- =============================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
-- =============================================================
