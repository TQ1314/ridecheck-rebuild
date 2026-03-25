-- 015_rls_remaining_tables.sql
-- Enables Row Level Security on all remaining exposed tables flagged by
-- Supabase Security Advisor. Tables are listed as seen in the Security Advisor
-- screenshots dated 2026-03-24.
--
-- Strategy:
--   All server-side routes use supabaseAdmin (service role key) which
--   BYPASSES RLS entirely. Enabling RLS here does NOT break any server
--   functionality. The policies below govern only direct REST API access
--   using the anon key or user JWT.
--
--   For tables with no active client use: enable RLS, add NO policies.
--   This means anon/user JWT requests are DENIED by default.
--   For lightweight lookup tables: allow authenticated SELECT only.
--
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Safe to re-run: DROP POLICY IF EXISTS guards prevent duplicates.

-- =============================================================
-- 1. mechanical_findings  (vehicle assessment data — service role only)
-- =============================================================
ALTER TABLE IF EXISTS mechanical_findings ENABLE ROW LEVEL SECURITY;
-- No client policies. All access via supabaseAdmin on the server.

-- =============================================================
-- 2. obd_findings  (OBD diagnostic scan data — service role only)
-- =============================================================
ALTER TABLE IF EXISTS obd_findings ENABLE ROW LEVEL SECURITY;
-- No client policies.

-- =============================================================
-- 3. region_capacity  (operational capacity config — service role only)
-- =============================================================
ALTER TABLE IF EXISTS region_capacity ENABLE ROW LEVEL SECURITY;
-- No client policies.

-- =============================================================
-- 4. title_intelligence  (vehicle title check data — service role only)
-- =============================================================
ALTER TABLE IF EXISTS title_intelligence ENABLE ROW LEVEL SECURITY;
-- No client policies.

-- =============================================================
-- 5. system_flags  (system configuration flags — service role only)
-- =============================================================
ALTER TABLE IF EXISTS system_flags ENABLE ROW LEVEL SECURITY;
-- No client policies. Anon or user access would be a security risk.

-- =============================================================
-- 6. fraud_flags  (fraud detection data — service role only, CRITICAL)
-- =============================================================
ALTER TABLE IF EXISTS fraud_flags ENABLE ROW LEVEL SECURITY;
-- Absolutely no client policies. This table must never be directly
-- readable or writable by end users.

-- =============================================================
-- 7. waitlist  (email capture — allow anon INSERT, no SELECT)
-- =============================================================
ALTER TABLE IF EXISTS waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can add themselves to the waitlist (public-facing form)
DROP POLICY IF EXISTS "anon_insert_waitlist" ON waitlist;
CREATE POLICY "anon_insert_waitlist" ON waitlist
  FOR INSERT
  WITH CHECK (true);
-- No SELECT policy: users cannot read the full waitlist.

-- =============================================================
-- 8. reports  (inspection report data — service role only)
-- =============================================================
ALTER TABLE IF EXISTS reports ENABLE ROW LEVEL SECURITY;
-- All access via supabaseAdmin. No client policies.

-- =============================================================
-- 9. tier_pricing  (pricing config lookup — authenticated read only)
-- =============================================================
ALTER TABLE IF EXISTS tier_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_tier_pricing" ON tier_pricing;
CREATE POLICY "auth_read_tier_pricing" ON tier_pricing
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =============================================================
-- 10. regions  (service region config — authenticated read only)
-- =============================================================
ALTER TABLE IF EXISTS regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_regions" ON regions;
CREATE POLICY "auth_read_regions" ON regions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =============================================================
-- 11. roles  (role definitions lookup — authenticated read only)
-- =============================================================
ALTER TABLE IF EXISTS roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_roles" ON roles;
CREATE POLICY "auth_read_roles" ON roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =============================================================
-- 12. user_roles  (user-to-role assignments — service role only)
-- =============================================================
ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;
-- No client policies. Role assignments are managed exclusively server-side.
-- Allowing clients to read or write this table would be a privilege
-- escalation risk.

-- =============================================================
-- 13. region_zips  (zip code to region mapping — authenticated read)
-- =============================================================
ALTER TABLE IF EXISTS region_zips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_region_zips" ON region_zips;
CREATE POLICY "auth_read_region_zips" ON region_zips
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =============================================================
-- 14. vehicle_rules  (vehicle classification rules — authenticated read)
-- =============================================================
ALTER TABLE IF EXISTS vehicle_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_vehicle_rules" ON vehicle_rules;
CREATE POLICY "auth_read_vehicle_rules" ON vehicle_rules
  FOR SELECT
  USING (auth.role() = 'authenticated');
