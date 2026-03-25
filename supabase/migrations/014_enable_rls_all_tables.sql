-- 014_enable_rls_all_tables.sql
-- Enables Row Level Security on every public table that was missing it.
-- All server-side routes use supabaseAdmin (service role) which bypasses RLS,
-- so enabling RLS here does NOT break any existing functionality.
-- Policies below govern direct client-side (anon/user JWT) access only.
--
-- Run this manually in the Supabase SQL Editor.

-- =============================================================
-- 1. role_definitions  (read-only reference data)
-- =============================================================
ALTER TABLE role_definitions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read role definitions (non-sensitive lookup data)
DROP POLICY IF EXISTS "auth_read_role_definitions" ON role_definitions;
CREATE POLICY "auth_read_role_definitions" ON role_definitions
  FOR SELECT
  USING (auth.role() = 'authenticated');


-- =============================================================
-- 2. seller_contact_attempts  (internal ops data — service role only)
-- =============================================================
ALTER TABLE seller_contact_attempts ENABLE ROW LEVEL SECURITY;
-- No client-facing policies: all mutations happen via supabaseAdmin on the server.
-- Authenticated users have no direct access; service role bypasses RLS entirely.


-- =============================================================
-- 3. ridechecker_availability  (ridecheckers manage their own slots)
-- =============================================================
ALTER TABLE ridechecker_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ridechecker_own_availability" ON ridechecker_availability;
CREATE POLICY "ridechecker_own_availability" ON ridechecker_availability
  FOR ALL
  USING (auth.uid() = ridechecker_id)
  WITH CHECK (auth.uid() = ridechecker_id);


-- =============================================================
-- 4. ridechecker_job_assignments  (ridecheckers can read their own jobs)
-- =============================================================
ALTER TABLE ridechecker_job_assignments ENABLE ROW LEVEL SECURITY;

-- Ridecheckers may read their own assignment records (mutations via service role)
DROP POLICY IF EXISTS "ridechecker_own_assignments_select" ON ridechecker_job_assignments;
CREATE POLICY "ridechecker_own_assignments_select" ON ridechecker_job_assignments
  FOR SELECT
  USING (auth.uid() = ridechecker_id);


-- =============================================================
-- 5. ridechecker_raw_submissions  (ridecheckers can read/write their own)
-- =============================================================
ALTER TABLE ridechecker_raw_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ridechecker_own_submissions" ON ridechecker_raw_submissions;
CREATE POLICY "ridechecker_own_submissions" ON ridechecker_raw_submissions
  FOR ALL
  USING (auth.uid() = ridechecker_id)
  WITH CHECK (auth.uid() = ridechecker_id);


-- =============================================================
-- 6. terms_acceptances  (immutable audit trail — service role only)
-- =============================================================
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;
-- No client-facing policies: written exclusively by supabaseAdmin on the server.
-- This table has no user_id foreign key; it is an immutable acceptance record.


-- =============================================================
-- 7. profiles  (if RLS is not already on — safe to re-enable)
-- =============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (role changes happen via service role only)
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- New profile rows are inserted by the server trigger / service role; no client insert.


-- =============================================================
-- 8. orders  (if RLS is not already on — safe to re-enable)
-- =============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Buyers can read their own orders (customer_id is the authenticated user UUID)
DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT
  USING (auth.uid() = customer_id);

-- Buyers can insert new orders when authenticated
DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = customer_id OR customer_id IS NULL);

-- NOTE: All ops/admin reads and every mutation from server routes use
-- supabaseAdmin (service role key) which bypasses these policies entirely.
