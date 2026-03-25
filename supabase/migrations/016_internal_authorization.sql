-- =============================================================
-- 016_internal_authorization.sql
-- Internal authorization hardening: RBAC helper functions +
-- precise per-role RLS policies for every operational table.
--
-- !! REVIEW BEFORE RUNNING !!
-- This file is staged for review. Run it in Supabase SQL Editor
-- only after the team has approved the policies below.
--
-- Role mapping (RideCheck role → policy alias):
--   owner          → is_admin()    (full control)
--   operations_lead → is_ops_lead() (approval authority + broad ops)
--   operations     → is_ops()      (scheduling/coordination only)
--   ridechecker    → is_ridechecker()
--   ridechecker_active → is_ridechecker()
--   qa             → is_qa()
--   customer       → authenticated, row-owner only
--
-- Cascade: is_admin ⊂ is_ops_lead ⊂ is_ops ⊂ is_staff
-- i.e. every is_ops_lead check also passes for owner, etc.
--
-- NOTE: All server-side routes use supabaseAdmin (service role),
-- which bypasses RLS entirely. These policies only affect direct
-- REST API calls using a user JWT or the anon key.
-- =============================================================


-- =============================================================
-- PART 1: RBAC HELPER FUNCTIONS
-- SECURITY DEFINER means each function runs as its creator
-- (the Supabase service user), bypassing RLS when reading
-- the profiles table. This is intentional and safe — these
-- functions are read-only lookups of the caller's own role.
-- =============================================================

-- Low-level role lookup for the currently authenticated user.
-- Returns NULL if there is no authenticated session.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1
$$;

-- owner: full administrative control
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() = 'owner'
$$;

-- operations_lead OR owner: approval authority and broad oversight
CREATE OR REPLACE FUNCTION public.is_ops_lead()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('owner', 'operations_lead')
$$;

-- operations OR above: scheduling/coordination access
CREATE OR REPLACE FUNCTION public.is_ops()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('owner', 'operations_lead', 'operations')
$$;

-- Any internal staff member (ops and above + qa)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN (
    'owner', 'operations_lead', 'operations', 'qa', 'developer', 'platform'
  )
$$;

-- ridechecker or ridechecker_active (pending or approved field agent)
CREATE OR REPLACE FUNCTION public.is_ridechecker()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('ridechecker', 'ridechecker_active')
$$;

-- Approved (active) ridecheckers only
CREATE OR REPLACE FUNCTION public.is_active_ridechecker()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() = 'ridechecker_active'
$$;


-- =============================================================
-- PART 2: DROP OLD POLICIES FROM MIGRATIONS 013-015
-- These are replaced by more precise policies below.
-- =============================================================

-- profiles
DROP POLICY IF EXISTS "profiles_select_own"              ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"              ON profiles;

-- orders
DROP POLICY IF EXISTS "orders_select_own"                ON orders;
DROP POLICY IF EXISTS "orders_insert_own"                ON orders;

-- ridechecker_availability
DROP POLICY IF EXISTS "ridechecker_own_availability"     ON ridechecker_availability;

-- ridechecker_job_assignments
DROP POLICY IF EXISTS "ridechecker_own_assignments_select" ON ridechecker_job_assignments;

-- ridechecker_raw_submissions
DROP POLICY IF EXISTS "ridechecker_own_submissions"      ON ridechecker_raw_submissions;

-- role_definitions
DROP POLICY IF EXISTS "auth_read_role_definitions"       ON role_definitions;

-- tier_pricing / regions / roles / region_zips / vehicle_rules
DROP POLICY IF EXISTS "auth_read_tier_pricing"           ON tier_pricing;
DROP POLICY IF EXISTS "auth_read_regions"                ON regions;
DROP POLICY IF EXISTS "auth_read_roles"                  ON roles;
DROP POLICY IF EXISTS "auth_read_region_zips"            ON region_zips;
DROP POLICY IF EXISTS "auth_read_vehicle_rules"          ON vehicle_rules;

-- waitlist
DROP POLICY IF EXISTS "anon_insert_waitlist"             ON waitlist;


-- =============================================================
-- PART 3: profiles
-- - Customers see only their own row
-- - Staff (ops and above) can read all profiles
-- - NO client UPDATE or INSERT — all mutations via server (supabaseAdmin)
-- =============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: own row (customer/ridechecker), or any row (staff)
DROP POLICY IF EXISTS "profiles_select"                  ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_staff()
  );

-- No INSERT policy: registration goes through /api/auth/register (service role)
-- No UPDATE policy: profile updates go through server routes (service role)
-- No DELETE policy: deletions via service role only


-- =============================================================
-- PART 4: orders
-- - Customers (buyers) can read their own orders
-- - Staff (ops and above) can read all orders
-- - Buyers can INSERT their own order (needed for order creation flow)
-- - No client UPDATE/DELETE — all mutations via server
-- =============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select"                    ON orders;
CREATE POLICY "orders_select" ON orders
  FOR SELECT
  USING (
    auth.uid() = customer_id
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "orders_insert"                    ON orders;
CREATE POLICY "orders_insert" ON orders
  FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
    OR customer_id IS NULL   -- unauthenticated booking flow creates order before login
    OR public.is_staff()
  );


-- =============================================================
-- PART 5: ridechecker_job_assignments
-- - RideCheckers can read their own assignments
-- - Staff (ops and above) can read all assignments
-- - Ops can SELECT all (needed for dispatch/scheduling)
-- - No client INSERT/UPDATE/DELETE — all mutations via server
-- =============================================================
ALTER TABLE ridechecker_job_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_select"               ON ridechecker_job_assignments;
CREATE POLICY "assignments_select" ON ridechecker_job_assignments
  FOR SELECT
  USING (
    auth.uid() = ridechecker_id
    OR public.is_staff()
  );


-- =============================================================
-- PART 6: ridechecker_raw_submissions
-- - Active RideCheckers can INSERT and UPDATE their own submissions
-- - Any ridechecker (pending or active) can read their own submissions
-- - Staff can read all submissions (needed for QA review)
-- - No client DELETE
-- =============================================================
ALTER TABLE ridechecker_raw_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_select"               ON ridechecker_raw_submissions;
CREATE POLICY "submissions_select" ON ridechecker_raw_submissions
  FOR SELECT
  USING (
    auth.uid() = ridechecker_id
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "submissions_insert"               ON ridechecker_raw_submissions;
CREATE POLICY "submissions_insert" ON ridechecker_raw_submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  );

DROP POLICY IF EXISTS "submissions_update"               ON ridechecker_raw_submissions;
CREATE POLICY "submissions_update" ON ridechecker_raw_submissions
  FOR UPDATE
  USING (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  )
  WITH CHECK (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  );


-- =============================================================
-- PART 7: ridechecker_availability
-- - Active RideCheckers can manage only their own slots
-- - Staff can read all availability (needed for dispatch engine)
-- =============================================================
ALTER TABLE ridechecker_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availability_select"              ON ridechecker_availability;
CREATE POLICY "availability_select" ON ridechecker_availability
  FOR SELECT
  USING (
    auth.uid() = ridechecker_id
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "availability_insert"              ON ridechecker_availability;
CREATE POLICY "availability_insert" ON ridechecker_availability
  FOR INSERT
  WITH CHECK (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  );

DROP POLICY IF EXISTS "availability_update"              ON ridechecker_availability;
CREATE POLICY "availability_update" ON ridechecker_availability
  FOR UPDATE
  USING (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  )
  WITH CHECK (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  );

DROP POLICY IF EXISTS "availability_delete"              ON ridechecker_availability;
CREATE POLICY "availability_delete" ON ridechecker_availability
  FOR DELETE
  USING (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  );


-- =============================================================
-- PART 8: ridechecker_earnings
-- - RideCheckers can read their own earnings only
-- - Ops lead and above can read all (for payout management)
-- - No client INSERT/UPDATE/DELETE — payouts managed via server
-- =============================================================
ALTER TABLE ridechecker_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "earnings_select"                  ON ridechecker_earnings;
CREATE POLICY "earnings_select" ON ridechecker_earnings
  FOR SELECT
  USING (
    auth.uid() = ridechecker_id
    OR public.is_ops_lead()
  );


-- =============================================================
-- PART 9: referral_codes
-- - RideCheckers can read their own code
-- - Ops lead can read all (for audit)
-- - No client INSERT/DELETE — managed via registration route
-- =============================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral_codes_select"            ON referral_codes;
CREATE POLICY "referral_codes_select" ON referral_codes
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_ops_lead()
  );


-- =============================================================
-- PART 10: referrals
-- - RideCheckers can see referrals where they are referrer or referee
-- - Ops lead can see all
-- - No client INSERT/UPDATE/DELETE — managed via server
-- =============================================================
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_select"                 ON referrals;
CREATE POLICY "referrals_select" ON referrals
  FOR SELECT
  USING (
    auth.uid() = referrer_id
    OR auth.uid() = referee_id
    OR public.is_ops_lead()
  );


-- =============================================================
-- PART 11: audit_log
-- - ops_lead and above can read all audit records
-- - No client INSERT (audit writes via service role only)
-- =============================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select"                 ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT
  USING (public.is_ops_lead());


-- =============================================================
-- PART 12: order_events
-- - Buyers can read non-internal events for their own orders
-- - Staff can read all events (internal and external)
-- - No client INSERT — events written via server
-- =============================================================
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_events_select"              ON order_events;
CREATE POLICY "order_events_select" ON order_events
  FOR SELECT
  USING (
    public.is_staff()
    -- customers need to check order ownership; order_id is TEXT here,
    -- so we do a subquery. TODO: confirm order_id type is consistent.
    OR (
      NOT is_internal
      AND EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id::text = order_events.order_id
          AND orders.customer_id = auth.uid()
      )
    )
  );


-- =============================================================
-- PART 13: intelligence_reports
-- - Staff (ops and above + qa) can read all reports
-- - No client INSERT/UPDATE/DELETE
-- =============================================================
ALTER TABLE intelligence_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intelligence_reports_select"      ON intelligence_reports;
CREATE POLICY "intelligence_reports_select" ON intelligence_reports
  FOR SELECT
  USING (public.is_staff());


-- =============================================================
-- PART 14: title_ownership_review
-- - Staff can read
-- - No client mutations
-- =============================================================
ALTER TABLE title_ownership_review ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "title_review_select"              ON title_ownership_review;
CREATE POLICY "title_review_select" ON title_ownership_review
  FOR SELECT
  USING (public.is_staff());


-- =============================================================
-- PART 15: bill_of_sale_documents
-- - Buyer can read their own BOS (via order)
-- - Staff can read all
-- =============================================================
ALTER TABLE bill_of_sale_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bos_select"                       ON bill_of_sale_documents;
CREATE POLICY "bos_select" ON bill_of_sale_documents
  FOR SELECT
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = bill_of_sale_documents.order_id
        AND orders.customer_id = auth.uid()
    )
  );


-- =============================================================
-- PART 16: inspectors (legacy workforce table)
-- - Staff can read
-- - Ops lead can INSERT/UPDATE
-- - No client DELETE
-- =============================================================
ALTER TABLE inspectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspectors_select"                ON inspectors;
CREATE POLICY "inspectors_select" ON inspectors
  FOR SELECT
  USING (public.is_staff());

DROP POLICY IF EXISTS "inspectors_write"                 ON inspectors;
CREATE POLICY "inspectors_write" ON inspectors
  FOR ALL
  USING (public.is_ops_lead())
  WITH CHECK (public.is_ops_lead());


-- =============================================================
-- PART 17: user_invites
-- - Ops lead and above can read/create invites
-- - Token lookup for invite acceptance is done via service role
-- =============================================================
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_invites_select"              ON user_invites;
CREATE POLICY "user_invites_select" ON user_invites
  FOR SELECT
  USING (public.is_ops_lead());

DROP POLICY IF EXISTS "user_invites_insert"              ON user_invites;
CREATE POLICY "user_invites_insert" ON user_invites
  FOR INSERT
  WITH CHECK (public.is_ops_lead());


-- =============================================================
-- PART 18: seller_contact_attempts
-- - Ops and above can read (needed for concierge workflow)
-- - No client INSERT — attempts are logged via server
-- =============================================================
ALTER TABLE seller_contact_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_contact_select"            ON seller_contact_attempts;
CREATE POLICY "seller_contact_select" ON seller_contact_attempts
  FOR SELECT
  USING (public.is_ops());


-- =============================================================
-- PART 19: terms_acceptances (immutable legal audit trail)
-- - Ops lead and above can read (for legal/compliance review)
-- - No client INSERT/UPDATE/DELETE (service role only)
-- =============================================================
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_select"                     ON terms_acceptances;
CREATE POLICY "terms_select" ON terms_acceptances
  FOR SELECT
  USING (public.is_ops_lead());


-- =============================================================
-- PART 20: SENSITIVE / INTELLIGENCE TABLES (from Supabase dashboard)
-- These tables were created outside migrations. Their schemas
-- are inferred from their names; TODO markers indicate where
-- schema confirmation is needed.
-- =============================================================

-- mechanical_findings: vehicle inspection findings
-- TODO: confirm column name for inspector/ridechecker FK
ALTER TABLE IF EXISTS mechanical_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mechanical_findings_select"       ON mechanical_findings;
CREATE POLICY "mechanical_findings_select" ON mechanical_findings
  FOR SELECT
  USING (public.is_ops());   -- ops and above can review findings

-- obd_findings: OBD scan results
-- TODO: confirm column names
ALTER TABLE IF EXISTS obd_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "obd_findings_select"              ON obd_findings;
CREATE POLICY "obd_findings_select" ON obd_findings
  FOR SELECT
  USING (public.is_ops());

-- title_intelligence: vehicle title check intelligence
-- Treat as sensitive — ops_lead and above
ALTER TABLE IF EXISTS title_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "title_intelligence_select"        ON title_intelligence;
CREATE POLICY "title_intelligence_select" ON title_intelligence
  FOR SELECT
  USING (public.is_ops_lead());

-- system_flags: system-level configuration flags
-- Admin (owner) only
ALTER TABLE IF EXISTS system_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_flags_select"              ON system_flags;
CREATE POLICY "system_flags_select" ON system_flags
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "system_flags_write"               ON system_flags;
CREATE POLICY "system_flags_write" ON system_flags
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- fraud_flags: HIGHEST SENSITIVITY — owner only
ALTER TABLE IF EXISTS fraud_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fraud_flags_select"               ON fraud_flags;
CREATE POLICY "fraud_flags_select" ON fraud_flags
  FOR SELECT
  USING (public.is_admin());

-- region_capacity: operational capacity data
ALTER TABLE IF EXISTS region_capacity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "region_capacity_select"           ON region_capacity;
CREATE POLICY "region_capacity_select" ON region_capacity
  FOR SELECT
  USING (public.is_ops());

-- =============================================================
-- PART 21: CONFIGURATION / LOOKUP TABLES
-- Read-only for authenticated staff; anon key gets nothing.
-- =============================================================

ALTER TABLE IF EXISTS role_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_definitions_select"          ON role_definitions;
CREATE POLICY "role_definitions_select" ON role_definitions
  FOR SELECT
  USING (public.is_staff());

ALTER TABLE IF EXISTS tier_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tier_pricing_select"              ON tier_pricing;
CREATE POLICY "tier_pricing_select" ON tier_pricing
  FOR SELECT
  USING (public.is_staff());

ALTER TABLE IF EXISTS regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "regions_select"                   ON regions;
CREATE POLICY "regions_select" ON regions
  FOR SELECT
  USING (public.is_staff());

ALTER TABLE IF EXISTS region_zips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "region_zips_select"               ON region_zips;
CREATE POLICY "region_zips_select" ON region_zips
  FOR SELECT
  USING (public.is_staff());

ALTER TABLE IF EXISTS vehicle_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicle_rules_select"             ON vehicle_rules;
CREATE POLICY "vehicle_rules_select" ON vehicle_rules
  FOR SELECT
  USING (public.is_staff());

-- roles / user_roles: role assignment tables (if they exist separately from role_definitions)
ALTER TABLE IF EXISTS roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select"                     ON roles;
CREATE POLICY "roles_select" ON roles
  FOR SELECT
  USING (public.is_ops_lead());

ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_select"                ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT
  USING (public.is_ops_lead());

-- reports (dashboard table — separate from intelligence_reports)
ALTER TABLE IF EXISTS reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_select"                   ON reports;
CREATE POLICY "reports_select" ON reports
  FOR SELECT
  USING (public.is_staff());

-- waitlist: public signups — allow anon INSERT, ops_lead can read
ALTER TABLE IF EXISTS waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waitlist_insert"                  ON waitlist;
CREATE POLICY "waitlist_insert" ON waitlist
  FOR INSERT
  WITH CHECK (true);           -- anon/public INSERT for waitlist signups

DROP POLICY IF EXISTS "waitlist_select"                  ON waitlist;
CREATE POLICY "waitlist_select" ON waitlist
  FOR SELECT
  USING (public.is_ops_lead());


-- =============================================================
-- END OF 016_internal_authorization.sql
-- Awaiting team review and approval before running.
-- =============================================================
