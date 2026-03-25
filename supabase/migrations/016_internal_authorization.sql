-- =============================================================
-- 016_internal_authorization.sql
-- Internal authorization hardening: RBAC helper functions +
-- precise per-role RLS policies for every operational table.
--
-- !! REVIEW BEFORE RUNNING !!
-- Run in Supabase SQL Editor only after team approval.
-- Must be run AFTER migrations 013, 014, 015.
--
-- Role mapping (RideCheck role → policy alias):
--   owner            → is_admin()             (full control)
--   operations_lead  → is_ops_lead()          (approval authority + broad oversight)
--   operations       → is_ops()               (scheduling/coordination, read-only on sensitive tables)
--   ridechecker_active → is_active_ridechecker() (own assigned work only)
--   ridechecker      → is_ridechecker()       (pending applicant — own data only)
--   qa / developer / platform → is_staff()   (internal read access)
--   customer         → row-owner check        (own orders/data only)
--
-- Cascade: is_admin ⊂ is_ops_lead ⊂ is_ops ⊂ is_staff
-- i.e. every is_ops_lead() check passes for owner too.
--
-- Design principle: LEAST PRIVILEGE.
-- When in doubt, restrict rather than allow.
-- All server-side routes use supabaseAdmin (service role) which
-- bypasses RLS entirely. These policies apply only to direct
-- Supabase REST calls using a user JWT or the anon key.
-- =============================================================


-- =============================================================
-- PART 1: RBAC HELPER FUNCTIONS
-- All functions use SECURITY DEFINER so they run as the
-- function creator (service user), bypassing RLS when reading
-- the profiles table. This is safe — they only read the caller's
-- own role, not any other user's data.
-- =============================================================

-- Low-level role lookup for the currently authenticated user.
-- Returns NULL if there is no authenticated session or the
-- profile does not exist / is not active.
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

-- operations_lead OR owner: approval authority + broad oversight
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

-- Any internal staff member (ops and above + qa, developer, platform)
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

-- Approved (active) ridecheckers only — can submit work
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
-- PART 2: DROP OLD POLICIES FROM MIGRATIONS 013–015
-- These are replaced by the more precise policies below.
-- We use DROP POLICY IF EXISTS so this is safe to re-run.
-- =============================================================

DROP POLICY IF EXISTS "profiles_select_own"                ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"                ON profiles;

DROP POLICY IF EXISTS "orders_select_own"                  ON orders;
DROP POLICY IF EXISTS "orders_insert_own"                  ON orders;

DROP POLICY IF EXISTS "ridechecker_own_availability"       ON ridechecker_availability;
DROP POLICY IF EXISTS "ridechecker_own_assignments_select" ON ridechecker_job_assignments;
DROP POLICY IF EXISTS "ridechecker_own_submissions"        ON ridechecker_raw_submissions;

DROP POLICY IF EXISTS "auth_read_role_definitions"         ON role_definitions;
DROP POLICY IF EXISTS "auth_read_tier_pricing"             ON tier_pricing;
DROP POLICY IF EXISTS "auth_read_regions"                  ON regions;
DROP POLICY IF EXISTS "auth_read_roles"                    ON roles;
DROP POLICY IF EXISTS "auth_read_region_zips"              ON region_zips;
DROP POLICY IF EXISTS "auth_read_vehicle_rules"            ON vehicle_rules;
DROP POLICY IF EXISTS "anon_insert_waitlist"               ON waitlist;

-- Also drop any policies we're replacing in this file, so
-- re-running migration 016 is idempotent.
DROP POLICY IF EXISTS "profiles_select"                    ON profiles;
DROP POLICY IF EXISTS "orders_select"                      ON orders;
DROP POLICY IF EXISTS "orders_insert"                      ON orders;
DROP POLICY IF EXISTS "assignments_select"                 ON ridechecker_job_assignments;
DROP POLICY IF EXISTS "submissions_select"                 ON ridechecker_raw_submissions;
DROP POLICY IF EXISTS "submissions_insert"                 ON ridechecker_raw_submissions;
DROP POLICY IF EXISTS "submissions_update"                 ON ridechecker_raw_submissions;
DROP POLICY IF EXISTS "availability_select"                ON ridechecker_availability;
DROP POLICY IF EXISTS "availability_insert"                ON ridechecker_availability;
DROP POLICY IF EXISTS "availability_update"                ON ridechecker_availability;
DROP POLICY IF EXISTS "availability_delete"                ON ridechecker_availability;
DROP POLICY IF EXISTS "earnings_select"                    ON ridechecker_earnings;
DROP POLICY IF EXISTS "referral_codes_select"              ON referral_codes;
DROP POLICY IF EXISTS "referrals_select"                   ON referrals;
DROP POLICY IF EXISTS "audit_log_select"                   ON audit_log;
DROP POLICY IF EXISTS "order_events_select"                ON order_events;
DROP POLICY IF EXISTS "intelligence_reports_select"        ON intelligence_reports;
DROP POLICY IF EXISTS "title_review_select"                ON title_ownership_review;
DROP POLICY IF EXISTS "bos_select"                         ON bill_of_sale_documents;
DROP POLICY IF EXISTS "inspectors_select"                  ON inspectors;
DROP POLICY IF EXISTS "inspectors_write"                   ON inspectors;
DROP POLICY IF EXISTS "user_invites_select"                ON user_invites;
DROP POLICY IF EXISTS "user_invites_insert"                ON user_invites;
DROP POLICY IF EXISTS "seller_contact_select"              ON seller_contact_attempts;
DROP POLICY IF EXISTS "terms_select"                       ON terms_acceptances;
DROP POLICY IF EXISTS "mechanical_findings_select"         ON mechanical_findings;
DROP POLICY IF EXISTS "mechanical_findings_write"          ON mechanical_findings;
DROP POLICY IF EXISTS "obd_findings_select"                ON obd_findings;
DROP POLICY IF EXISTS "obd_findings_write"                 ON obd_findings;
DROP POLICY IF EXISTS "title_intelligence_select"          ON title_intelligence;
DROP POLICY IF EXISTS "title_intelligence_write"           ON title_intelligence;
DROP POLICY IF EXISTS "system_flags_select"                ON system_flags;
DROP POLICY IF EXISTS "system_flags_write"                 ON system_flags;
DROP POLICY IF EXISTS "fraud_flags_select"                 ON fraud_flags;
DROP POLICY IF EXISTS "region_capacity_select"             ON region_capacity;
DROP POLICY IF EXISTS "role_definitions_select"            ON role_definitions;
DROP POLICY IF EXISTS "tier_pricing_select"                ON tier_pricing;
DROP POLICY IF EXISTS "regions_select"                     ON regions;
DROP POLICY IF EXISTS "region_zips_select"                 ON region_zips;
DROP POLICY IF EXISTS "vehicle_rules_select"               ON vehicle_rules;
DROP POLICY IF EXISTS "roles_select"                       ON roles;
DROP POLICY IF EXISTS "user_roles_select"                  ON user_roles;
DROP POLICY IF EXISTS "reports_select"                     ON reports;
DROP POLICY IF EXISTS "waitlist_insert"                    ON waitlist;
DROP POLICY IF EXISTS "waitlist_select"                    ON waitlist;


-- =============================================================
-- PART 3: profiles
-- Customers and ridecheckers see only their own row.
-- Staff (ops and above) can read all profiles.
-- NO client INSERT or UPDATE — all mutations go through the
-- server (supabaseAdmin / service role).
-- =============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_staff()
  );

-- No INSERT policy: registration uses /api/auth/register (service role).
-- No UPDATE policy: profile updates use server routes (service role).
-- No DELETE policy: deletions via service role only.


-- =============================================================
-- PART 4: orders
-- Buyers can read only their own orders.
-- Staff (ops and above, qa) can read all orders.
-- Buyers can INSERT their own order (needed for the booking flow).
-- All UPDATE / DELETE via server (service role).
-- =============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders
  FOR SELECT
  USING (
    auth.uid() = customer_id
    OR public.is_staff()
  );

CREATE POLICY "orders_insert" ON orders
  FOR INSERT
  WITH CHECK (
    -- buyer creates their own order
    auth.uid() = customer_id
    -- unauthenticated booking creates order before login (customer_id backfilled later)
    OR customer_id IS NULL
    -- ops can create test orders
    OR public.is_staff()
  );


-- =============================================================
-- PART 5: ridechecker_job_assignments
-- RideCheckers see only their own assignments.
-- Staff (ops and above, qa) see all assignments.
-- No client INSERT/UPDATE/DELETE — managed via server.
-- =============================================================
ALTER TABLE ridechecker_job_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_select" ON ridechecker_job_assignments
  FOR SELECT
  USING (
    auth.uid() = ridechecker_id
    OR public.is_staff()
  );


-- =============================================================
-- PART 6: ridechecker_raw_submissions
-- Active ridecheckers can INSERT and UPDATE their own submissions.
-- Any ridechecker (pending or active) can read their own.
-- Staff can read all (for QA review queue).
-- No client DELETE.
-- =============================================================
ALTER TABLE ridechecker_raw_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions_select" ON ridechecker_raw_submissions
  FOR SELECT
  USING (
    auth.uid() = ridechecker_id
    OR public.is_staff()
  );

CREATE POLICY "submissions_insert" ON ridechecker_raw_submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  );

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
-- Active ridecheckers manage only their own slots.
-- Staff can read all slots (needed for the dispatch engine).
-- =============================================================
ALTER TABLE ridechecker_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_select" ON ridechecker_availability
  FOR SELECT
  USING (
    auth.uid() = ridechecker_id
    OR public.is_staff()
  );

CREATE POLICY "availability_insert" ON ridechecker_availability
  FOR INSERT
  WITH CHECK (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  );

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

CREATE POLICY "availability_delete" ON ridechecker_availability
  FOR DELETE
  USING (
    auth.uid() = ridechecker_id
    AND public.is_active_ridechecker()
  );


-- =============================================================
-- PART 8: ridechecker_earnings
-- RideCheckers read their own earnings only.
-- ops_lead and above read all (for payout management).
-- No client INSERT/UPDATE — payout records created/updated server-side.
-- =============================================================
ALTER TABLE ridechecker_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "earnings_select" ON ridechecker_earnings
  FOR SELECT
  USING (
    auth.uid() = ridechecker_id
    OR public.is_ops_lead()
  );


-- =============================================================
-- PART 9: referral_codes
-- RideCheckers read their own code only.
-- ops_lead and above read all (for audit).
-- No client INSERT/DELETE — managed via registration route.
-- =============================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_codes_select" ON referral_codes
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_ops_lead()
  );


-- =============================================================
-- PART 10: referrals
-- RideCheckers see referrals where they are referrer or referee.
-- ops_lead sees all.
-- No client INSERT/UPDATE — managed via server.
-- =============================================================
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select" ON referrals
  FOR SELECT
  USING (
    auth.uid() = referrer_id
    OR auth.uid() = referee_id
    OR public.is_ops_lead()
  );


-- =============================================================
-- PART 11: audit_log
-- ops_lead and above can read.
-- No client INSERT — audit writes via service role only.
-- No client UPDATE or DELETE ever (immutable audit trail).
-- =============================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT
  USING (public.is_ops_lead());


-- =============================================================
-- PART 12: order_events
-- Staff sees all events (including internal).
-- Buyers see only non-internal events for their own orders.
-- Note: order_id is TEXT in this table; join uses ::text cast.
-- No client INSERT — events written via server.
-- =============================================================
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_events_select" ON order_events
  FOR SELECT
  USING (
    public.is_staff()
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
-- Staff (ops and above, qa) can read.
-- No client mutations.
-- =============================================================
ALTER TABLE intelligence_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intelligence_reports_select" ON intelligence_reports
  FOR SELECT
  USING (public.is_staff());


-- =============================================================
-- PART 14: title_ownership_review
-- Staff can read.
-- No client mutations.
-- =============================================================
ALTER TABLE title_ownership_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "title_review_select" ON title_ownership_review
  FOR SELECT
  USING (public.is_staff());


-- =============================================================
-- PART 15: bill_of_sale_documents
-- Buyers can read their own (via order FK).
-- Staff can read all.
-- No client mutations.
-- =============================================================
ALTER TABLE bill_of_sale_documents ENABLE ROW LEVEL SECURITY;

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
-- Staff can read.
-- ops_lead can write.
-- No client DELETE.
-- =============================================================
ALTER TABLE inspectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspectors_select" ON inspectors
  FOR SELECT
  USING (public.is_staff());

CREATE POLICY "inspectors_write" ON inspectors
  FOR ALL
  USING (public.is_ops_lead())
  WITH CHECK (public.is_ops_lead());


-- =============================================================
-- PART 17: user_invites
-- ops_lead and above can read and create invites.
-- Token lookup for invite acceptance uses service role.
-- =============================================================
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_invites_select" ON user_invites
  FOR SELECT
  USING (public.is_ops_lead());

CREATE POLICY "user_invites_insert" ON user_invites
  FOR INSERT
  WITH CHECK (public.is_ops_lead());


-- =============================================================
-- PART 18: seller_contact_attempts
-- ops and above can read (concierge workflow).
-- No client INSERT — attempts logged via server.
-- =============================================================
ALTER TABLE seller_contact_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller_contact_select" ON seller_contact_attempts
  FOR SELECT
  USING (public.is_ops());


-- =============================================================
-- PART 19: terms_acceptances (immutable legal audit trail)
-- ops_lead and above can read (legal/compliance review).
-- No client INSERT/UPDATE/DELETE — service role only.
-- =============================================================
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terms_select" ON terms_acceptances
  FOR SELECT
  USING (public.is_ops_lead());


-- =============================================================
-- PART 20: mechanical_findings
-- Vehicle assessment findings — tied to inspections.
--
-- ASSUMPTION: The FK column linking this table to inspections
-- is `order_id` (TEXT or UUID). If the column is named differently
-- (e.g. `inspection_id`, `assignment_id`), update the subquery below.
--
-- Access rules (per product decision):
--   ridechecker_active → own assigned orders only (via ridechecker_job_assignments join)
--   ops               → read-only (coordination)
--   ops_lead + admin  → full read + write
--   ridechecker (pending), customer, anon → NO ACCESS
-- =============================================================
ALTER TABLE IF EXISTS mechanical_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mechanical_findings_select" ON mechanical_findings
  FOR SELECT
  USING (
    -- ops_lead / admin: full read
    public.is_ops_lead()
    -- ops: read-only for coordination
    OR public.is_ops()
    -- active ridechecker: only records for their assigned orders
    -- TODO: verify the FK column name is `order_id` in mechanical_findings
    OR (
      public.is_active_ridechecker()
      AND EXISTS (
        SELECT 1 FROM ridechecker_job_assignments rja
        WHERE rja.order_id::text = mechanical_findings.order_id::text
          AND rja.ridechecker_id = auth.uid()
      )
    )
  );

-- ops_lead can write (e.g. corrections); service role handles ridechecker inserts
CREATE POLICY "mechanical_findings_write" ON mechanical_findings
  FOR ALL
  USING (public.is_ops_lead())
  WITH CHECK (public.is_ops_lead());


-- =============================================================
-- PART 21: obd_findings
-- OBD diagnostic scan data — identical access rules to mechanical_findings.
--
-- ASSUMPTION: FK column is `order_id`. Update if different.
-- =============================================================
ALTER TABLE IF EXISTS obd_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obd_findings_select" ON obd_findings
  FOR SELECT
  USING (
    public.is_ops_lead()
    OR public.is_ops()
    OR (
      public.is_active_ridechecker()
      -- TODO: verify the FK column name is `order_id` in obd_findings
      AND EXISTS (
        SELECT 1 FROM ridechecker_job_assignments rja
        WHERE rja.order_id::text = obd_findings.order_id::text
          AND rja.ridechecker_id = auth.uid()
      )
    )
  );

CREATE POLICY "obd_findings_write" ON obd_findings
  FOR ALL
  USING (public.is_ops_lead())
  WITH CHECK (public.is_ops_lead());


-- =============================================================
-- PART 22: title_intelligence
-- SYSTEM INTELLIGENCE — highly restricted by product decision.
--
-- Access rules:
--   ridechecker → NO ACCESS
--   ops         → NO ACCESS
--   ops_lead    → read-only
--   admin       → full access (read + write)
-- =============================================================
ALTER TABLE IF EXISTS title_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "title_intelligence_select" ON title_intelligence
  FOR SELECT
  USING (public.is_ops_lead());   -- ops_lead OR owner; ops is intentionally excluded

-- Only admin (owner) can write to system intelligence tables
CREATE POLICY "title_intelligence_write" ON title_intelligence
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =============================================================
-- PART 23: system_flags
-- Platform-level configuration — owner only.
-- =============================================================
ALTER TABLE IF EXISTS system_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_flags_select" ON system_flags
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "system_flags_write" ON system_flags
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =============================================================
-- PART 24: fraud_flags
-- HIGHEST SENSITIVITY — owner only, no exceptions.
-- =============================================================
ALTER TABLE IF EXISTS fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fraud_flags_select" ON fraud_flags
  FOR SELECT
  USING (public.is_admin());

-- No client write policy — fraud flags written by service role only.


-- =============================================================
-- PART 25: region_capacity
-- Operational capacity data — ops and above can read.
-- ops_lead can write.
-- =============================================================
ALTER TABLE IF EXISTS region_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "region_capacity_select" ON region_capacity
  FOR SELECT
  USING (public.is_ops());

CREATE POLICY "region_capacity_write" ON region_capacity
  FOR ALL
  USING (public.is_ops_lead())
  WITH CHECK (public.is_ops_lead());


-- =============================================================
-- PART 26: configuration / lookup tables
-- Read-only for internal staff. No anon or customer access.
-- =============================================================

ALTER TABLE IF EXISTS role_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_definitions_select" ON role_definitions
  FOR SELECT USING (public.is_staff());

ALTER TABLE IF EXISTS tier_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tier_pricing_select" ON tier_pricing
  FOR SELECT USING (public.is_staff());

ALTER TABLE IF EXISTS regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regions_select" ON regions
  FOR SELECT USING (public.is_staff());

ALTER TABLE IF EXISTS region_zips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "region_zips_select" ON region_zips
  FOR SELECT USING (public.is_staff());

ALTER TABLE IF EXISTS vehicle_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_rules_select" ON vehicle_rules
  FOR SELECT USING (public.is_staff());

-- roles / user_roles: role assignment tables — ops_lead and above
ALTER TABLE IF EXISTS roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select" ON roles
  FOR SELECT USING (public.is_ops_lead());

ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT USING (public.is_ops_lead());

-- reports (Supabase dashboard table, separate from intelligence_reports)
ALTER TABLE IF EXISTS reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select" ON reports
  FOR SELECT USING (public.is_staff());


-- =============================================================
-- PART 27: waitlist
-- By product decision: NO anonymous inserts.
-- All signup must go through server routes (rate-limited, anti-spam).
-- ops_lead and above can read the waitlist.
-- =============================================================
ALTER TABLE IF EXISTS waitlist ENABLE ROW LEVEL SECURITY;

-- Intentionally no INSERT policy here.
-- Waitlist entries are created via /api/waitlist (service role).

CREATE POLICY "waitlist_select" ON waitlist
  FOR SELECT
  USING (public.is_ops_lead());


-- =============================================================
-- END OF 016_internal_authorization.sql
-- !! DO NOT RUN until approved by the team !!
-- =============================================================
