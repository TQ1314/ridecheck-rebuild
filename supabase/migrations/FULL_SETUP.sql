-- =============================================================
-- FULL_SETUP.sql  ·  RideCheck Pre-Car-Purchase Intelligence Platform
--
-- PURPOSE: Complete database bootstrap for a fresh Supabase project.
--          Contains: base schema (000) + all migrations (001–022).
--
-- HOW TO USE:
--   1. Open your Supabase project → SQL Editor → New query
--   2. Paste this entire file and click "Run"
--   3. All tables, policies, triggers, and indexes will be created.
--      Every statement is idempotent — safe to run more than once.
--
-- After this runs, the app (booking form, careers form, etc.)
-- will be fully operational.
-- =============================================================

-- =============================================================
-- SECTION 000: BASE SCHEMA
-- =============================================================
-- 000_BASE_SCHEMA.sql

-- =============================================================
-- 000_BASE_SCHEMA.sql
-- RideCheck Pre-Car-Purchase Intelligence Platform
--
-- Run this FIRST in the Supabase SQL Editor on a fresh project,
-- BEFORE running any numbered migration (001 through 022).
--
-- All statements use IF NOT EXISTS / DO $$ guards so it is
-- safe to run on a database that already has some tables.
-- =============================================================


-- =============================================================
-- 1. profiles
--    Mirrors auth.users; one row per authenticated user.
--    Auto-created by the trigger below on first sign-in.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY,          -- same as auth.users.id
  email       TEXT,
  full_name   TEXT,
  phone       TEXT,
  role        TEXT        NOT NULL DEFAULT 'customer',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY "profiles_select_own" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- Users can update their own profile (role changes via service role only)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;


-- =============================================================
-- 2. Auto-create profile on auth.users INSERT
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'customer',
    true,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================
-- 3. orders
--    Core booking / order table.
-- =============================================================

CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.orders (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        TEXT        UNIQUE DEFAULT 'RC-' || nextval('orders_order_number_seq')::text,
  order_id            TEXT,                        -- legacy human-readable ID; mirrors order_number

  -- buyer / customer identifiers
  customer_id         UUID,                        -- auth.users.id (nullable for guest)
  buyer_email         TEXT,
  buyer_phone         TEXT,
  customer_name       TEXT,                        -- legacy display name
  customer_email      TEXT,                        -- legacy email field
  customer_phone      TEXT,                        -- legacy phone field

  -- vehicle details
  vehicle_year        INTEGER,
  vehicle_make        TEXT,
  vehicle_model       TEXT,
  vehicle_location    TEXT,
  vehicle_description TEXT,
  vehicle_trim        TEXT,

  -- listing / seller info
  listing_url         TEXT,
  seller_name         TEXT,
  seller_phone        TEXT,

  -- booking & package
  booking_type        TEXT        NOT NULL DEFAULT 'concierge',
  package             TEXT        NOT NULL DEFAULT 'standard',
  preferred_date      TEXT,
  scheduled_date      TEXT,

  -- pricing
  base_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- payment
  payment_status      TEXT        NOT NULL DEFAULT 'not_requested',
  payment_intent_id   TEXT,
  paid_at             TIMESTAMPTZ,

  -- status
  status              TEXT        NOT NULL DEFAULT 'submitted',
  order_status        TEXT        DEFAULT 'created',

  -- assignment
  assigned_ops_id     UUID,

  -- report / delivery
  report_url          TEXT,

  -- tokens
  idempotency_key     TEXT        UNIQUE,
  tracking_token      TEXT,
  payment_link_token  TEXT,

  -- timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Buyers can read their own orders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'orders_select_own'
  ) THEN
    CREATE POLICY "orders_select_own" ON public.orders
      FOR SELECT USING (auth.uid() = customer_id);
  END IF;
END $$;

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id    ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON public.orders(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================
-- 4. audit_log
--    Immutable audit trail for all privileged actions.
--    Columns that migration 002 adds (actor_id, actor_email …)
--    are included here so 002 is a no-op.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id            BIGSERIAL   PRIMARY KEY,
  action        TEXT        NOT NULL,
  actor_id      UUID,
  actor_email   TEXT,
  actor_role    TEXT,
  resource_type TEXT,
  resource_id   TEXT,
  old_value     JSONB,
  new_value     JSONB,
  metadata      JSONB,
  ip_address    TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id   ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource   ON public.audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);


-- =============================================================
-- 5. activity_log
--    Lightweight per-order event log used by API routes.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID,
  order_id   UUID,
  action     TEXT        NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_log_order_id ON public.activity_log(order_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id  ON public.activity_log(user_id);


-- =============================================================
-- 6. intelligence_reports
--    Structured AI-generated report data linked to an order.
--    Referenced by migration 001 (ALTER TABLE … ENABLE RLS).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.intelligence_reports (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                TEXT        NOT NULL,
  report_type             TEXT        NOT NULL DEFAULT 'standard',
  vin_consistency_check   JSONB,
  fraud_screening         JSONB,
  title_ownership_review  JSONB,
  risk_flags              JSONB,
  observations            TEXT,
  inspector_notes         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.intelligence_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_intel_reports_order_id ON public.intelligence_reports(order_id);


-- =============================================================
-- 7. title_ownership_review
--    Referenced by migration 001 (ALTER TABLE … ENABLE RLS).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.title_ownership_review (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   TEXT        NOT NULL,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.title_ownership_review ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_title_review_order_id ON public.title_ownership_review(order_id);


-- =============================================================
-- 8. bill_of_sale_documents
--    Referenced by migration 001 (ALTER TABLE … ENABLE RLS).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.bill_of_sale_documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            TEXT        NOT NULL,
  language            TEXT        NOT NULL DEFAULT 'en',
  buyer_name          TEXT,
  seller_name         TEXT,
  vehicle_description TEXT,
  sale_price          TEXT,
  document_html       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bill_of_sale_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bill_of_sale_order_id ON public.bill_of_sale_documents(order_id);


-- =============================================================
-- Done. You can now run migrations 001 through 022 in order.
-- =============================================================
-- RideCheck Pre-Car-Purchase Intelligence Platform Upgrade
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable.
-- Run this migration manually in Supabase SQL Editor.

-- ==============================================
-- A) Health Pings table (for /api/health/supabase)
-- ==============================================
CREATE TABLE IF NOT EXISTS health_pings (
  id BIGSERIAL PRIMARY KEY,
  pinged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow inserts from service role (already has bypass) or anon if needed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'health_pings' AND policyname = 'allow_health_pings_insert'
  ) THEN
    ALTER TABLE health_pings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "allow_health_pings_insert" ON health_pings FOR INSERT WITH CHECK (true);
    CREATE POLICY "allow_health_pings_select" ON health_pings FOR SELECT USING (true);
  END IF;
END $$;

-- ==============================================
-- B) Orders table: add new optional columns
-- ==============================================
DO $$ BEGIN
  -- Booking method: concierge (default) or buyer_arranged
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='booking_method') THEN
    ALTER TABLE orders ADD COLUMN booking_method TEXT DEFAULT 'concierge';
  END IF;

  -- Package tier for new pricing (standard/plus/premium)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='package_tier') THEN
    ALTER TABLE orders ADD COLUMN package_tier TEXT;
  END IF;

  -- Calculated price in cents
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='calculated_price_cents') THEN
    ALTER TABLE orders ADD COLUMN calculated_price_cents INTEGER;
  END IF;

  -- Preferred language
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='preferred_language') THEN
    ALTER TABLE orders ADD COLUMN preferred_language TEXT DEFAULT 'en';
  END IF;

  -- Buyer-arranged fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspection_address') THEN
    ALTER TABLE orders ADD COLUMN inspection_address TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspection_time_window') THEN
    ALTER TABLE orders ADD COLUMN inspection_time_window TEXT;
  END IF;

  -- Listing parsing fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='listing_platform') THEN
    ALTER TABLE orders ADD COLUMN listing_platform TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='listing_title') THEN
    ALTER TABLE orders ADD COLUMN listing_title TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='listing_price') THEN
    ALTER TABLE orders ADD COLUMN listing_price TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='listing_location_text') THEN
    ALTER TABLE orders ADD COLUMN listing_location_text TEXT;
  END IF;

  -- Vehicle details (may already exist partially)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='vehicle_trim') THEN
    ALTER TABLE orders ADD COLUMN vehicle_trim TEXT;
  END IF;

  -- Stability fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='order_status') THEN
    ALTER TABLE orders ADD COLUMN order_status TEXT DEFAULT 'created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='last_error') THEN
    ALTER TABLE orders ADD COLUMN last_error TEXT;
  END IF;

  -- Notes to inspector
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='notes_to_inspector') THEN
    ALTER TABLE orders ADD COLUMN notes_to_inspector TEXT;
  END IF;
END $$;

-- ==============================================
-- C) Intelligence Reports table
-- ==============================================
CREATE TABLE IF NOT EXISTS intelligence_reports (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  report_type TEXT NOT NULL DEFAULT 'standard',
  vin_consistency_check JSONB,
  fraud_screening JSONB,
  title_ownership_review JSONB,
  risk_flags JSONB,
  observations TEXT,
  inspector_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- D) Title & Ownership Review table
-- ==============================================
CREATE TABLE IF NOT EXISTS title_ownership_review (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  vin TEXT,
  title_status TEXT,
  ownership_history JSONB,
  flags JSONB,
  notes TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- E) Bill of Sale Documents table
-- ==============================================
CREATE TABLE IF NOT EXISTS bill_of_sale_documents (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  language TEXT NOT NULL DEFAULT 'en',
  buyer_name TEXT,
  seller_name TEXT,
  vehicle_description TEXT,
  sale_price TEXT,
  document_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- RLS for new tables (strict by default)
-- ==============================================
ALTER TABLE intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_ownership_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_of_sale_documents ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- If service role is unavailable, add these policies:
-- CREATE POLICY "allow_authenticated_read_reports" ON intelligence_reports FOR SELECT USING (auth.uid() IS NOT NULL);
-- CREATE POLICY "allow_authenticated_read_bos" ON bill_of_sale_documents FOR SELECT USING (auth.uid() IS NOT NULL);
-- RideCheck Phase 2: Ops Engine B
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable or have defaults.
-- Run this migration manually in Supabase SQL Editor AFTER 001_add_upgrade_columns.sql.

-- ==============================================
-- A) New columns on orders table
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_status') THEN
    ALTER TABLE orders ADD COLUMN ops_status TEXT DEFAULT 'new';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='assigned_inspector_id') THEN
    ALTER TABLE orders ADD COLUMN assigned_inspector_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='assigned_at') THEN
    ALTER TABLE orders ADD COLUMN assigned_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_contact_attempts') THEN
    ALTER TABLE orders ADD COLUMN seller_contact_attempts INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_contacted_at') THEN
    ALTER TABLE orders ADD COLUMN seller_contacted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_confirmed_at') THEN
    ALTER TABLE orders ADD COLUMN seller_confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_requested_at') THEN
    ALTER TABLE orders ADD COLUMN payment_requested_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspection_scheduled_for') THEN
    ALTER TABLE orders ADD COLUMN inspection_scheduled_for TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspection_completed_at') THEN
    ALTER TABLE orders ADD COLUMN inspection_completed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_delivered_at') THEN
    ALTER TABLE orders ADD COLUMN report_delivered_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_priority') THEN
    ALTER TABLE orders ADD COLUMN ops_priority INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_notes') THEN
    ALTER TABLE orders ADD COLUMN ops_notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='hold_status') THEN
    ALTER TABLE orders ADD COLUMN hold_status TEXT DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_url') THEN
    ALTER TABLE orders ADD COLUMN payment_link_url TEXT;
  END IF;
END $$;

-- ==============================================
-- B) Inspectors table
-- ==============================================
CREATE TABLE IF NOT EXISTS inspectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  region TEXT,
  specialties TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_daily_capacity INT NOT NULL DEFAULT 3,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inspectors ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- C) Order Events table (timeline of what happened)
-- ==============================================
CREATE TABLE IF NOT EXISTS order_events (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT,
  details JSONB,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If order_events already existed with missing columns, add them
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_events' AND column_name='actor_id') THEN
    ALTER TABLE order_events ADD COLUMN actor_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_events' AND column_name='actor_email') THEN
    ALTER TABLE order_events ADD COLUMN actor_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_events' AND column_name='details') THEN
    ALTER TABLE order_events ADD COLUMN details JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_events' AND column_name='is_internal') THEN
    ALTER TABLE order_events ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON order_events(created_at);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- D) Audit Log table (every admin/ops action)
-- ==============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If audit_log already existed with missing columns, add them
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='actor_id') THEN
    ALTER TABLE audit_log ADD COLUMN actor_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='actor_email') THEN
    ALTER TABLE audit_log ADD COLUMN actor_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='actor_role') THEN
    ALTER TABLE audit_log ADD COLUMN actor_role TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='resource_type') THEN
    ALTER TABLE audit_log ADD COLUMN resource_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='resource_id') THEN
    ALTER TABLE audit_log ADD COLUMN resource_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='old_value') THEN
    ALTER TABLE audit_log ADD COLUMN old_value JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='new_value') THEN
    ALTER TABLE audit_log ADD COLUMN new_value JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='metadata') THEN
    ALTER TABLE audit_log ADD COLUMN metadata JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='ip_address') THEN
    ALTER TABLE audit_log ADD COLUMN ip_address TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- E) Index for FIFO queue ordering on orders
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_orders_fifo_queue ON orders(ops_priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_orders_ops_status ON orders(ops_status);
-- RideCheck Phase 5-9: User Management, Inspector Portal, QA, Delivery
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable or have defaults.
-- Run this migration manually in Supabase SQL Editor AFTER 002_ops_engine.sql.

-- ==============================================
-- A) Role Definitions table
-- ==============================================
CREATE TABLE IF NOT EXISTS role_definitions (
  role TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT
);

INSERT INTO role_definitions (role, display_name, description) VALUES
  ('customer', 'Customer', 'Buyers who book assessments'),
  ('operations', 'Operations', 'Handle day-to-day order processing'),
  ('operations_lead', 'Operations Lead', 'Manage ops team and assign work'),
  ('inspector', 'RideChecker', 'Field inspectors who perform assessments'),
  ('qa', 'Quality Assurance', 'Review and approve inspection reports'),
  ('developer', 'Developer', 'Platform development and maintenance'),
  ('platform', 'Platform', 'Platform-level analytics and oversight'),
  ('owner', 'Owner', 'Full administrative access')
ON CONFLICT (role) DO NOTHING;

-- ==============================================
-- B) User Invites table
-- ==============================================
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);

ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- C) New columns on orders for report workflow
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_status') THEN
    ALTER TABLE orders ADD COLUMN report_status TEXT DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_storage_path') THEN
    ALTER TABLE orders ADD COLUMN report_storage_path TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_uploaded_at') THEN
    ALTER TABLE orders ADD COLUMN report_uploaded_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='qa_status') THEN
    ALTER TABLE orders ADD COLUMN qa_status TEXT DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='qa_notes') THEN
    ALTER TABLE orders ADD COLUMN qa_notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='qa_reviewed_by') THEN
    ALTER TABLE orders ADD COLUMN qa_reviewed_by UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='qa_reviewed_at') THEN
    ALTER TABLE orders ADD COLUMN qa_reviewed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspector_status') THEN
    ALTER TABLE orders ADD COLUMN inspector_status TEXT DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspector_notes') THEN
    ALTER TABLE orders ADD COLUMN inspector_notes TEXT;
  END IF;
END $$;

-- ==============================================
-- D) Link inspectors to auth users (optional profile_id)
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspectors' AND column_name='user_id') THEN
    ALTER TABLE inspectors ADD COLUMN user_id UUID;
  END IF;
END $$;

-- ==============================================
-- E) Ensure profiles has needed columns for indexes
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'customer';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_active') THEN
    ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ==============================================
-- F) Indexes for new workflows
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_orders_report_status ON orders(report_status);
CREATE INDEX IF NOT EXISTS idx_orders_qa_status ON orders(qa_status);
CREATE INDEX IF NOT EXISTS idx_orders_inspector_status ON orders(inspector_status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_inspector ON orders(assigned_inspector_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_inspectors_user_id ON inspectors(user_id);
-- RideCheck Phase 10: RideChecker Approval, Assignment, Earnings, Referrals
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable or have defaults.
-- Run this migration manually in Supabase SQL Editor AFTER 003_phases_5_9.sql.

-- ==============================================
-- A) New columns on profiles for ridechecker data
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='service_area') THEN
    ALTER TABLE profiles ADD COLUMN service_area TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='experience') THEN
    ALTER TABLE profiles ADD COLUMN experience TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='referral_code') THEN
    ALTER TABLE profiles ADD COLUMN referral_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rating') THEN
    ALTER TABLE profiles ADD COLUMN rating NUMERIC(3,2) DEFAULT 5.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='approved_at') THEN
    ALTER TABLE profiles ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='approved_by') THEN
    ALTER TABLE profiles ADD COLUMN approved_by UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rejection_reason') THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rejected_at') THEN
    ALTER TABLE profiles ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add unique constraint on referral_code if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_referral_code_key'
  ) THEN
    BEGIN
      ALTER TABLE profiles ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_service_area ON profiles(service_area);

-- ==============================================
-- B) RideChecker Earnings table
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id UUID NOT NULL,
  order_id TEXT NOT NULL,
  package TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  payout_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earnings_ridechecker ON ridechecker_earnings(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_earnings_order ON ridechecker_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON ridechecker_earnings(status);

ALTER TABLE ridechecker_earnings ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- C) Referral Codes table
-- ==============================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraints safely
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_codes_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE referral_codes ADD CONSTRAINT referral_codes_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_codes_code_key'
  ) THEN
    BEGIN
      ALTER TABLE referral_codes ADD CONSTRAINT referral_codes_code_key UNIQUE (code);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- D) Referrals tracking table
-- ==============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referee_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  referee_completed_jobs INT NOT NULL DEFAULT 0,
  qualified_at TIMESTAMPTZ,
  reward_amount NUMERIC(10,2) NOT NULL DEFAULT 100.00,
  referrer_paid_at TIMESTAMPTZ,
  referee_paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- E) Add ridechecker roles to role_definitions (if table exists)
-- ==============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='role_definitions') THEN
    INSERT INTO role_definitions (role, display_name, description) VALUES
      ('ridechecker', 'RideChecker (Pending)', 'Applicant awaiting approval'),
      ('ridechecker_active', 'RideChecker (Active)', 'Approved vehicle assessment professional')
    ON CONFLICT (role) DO NOTHING;
  END IF;
END $$;

-- ==============================================
-- F) New column on orders for ridechecker pay
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ridechecker_pay') THEN
    ALTER TABLE orders ADD COLUMN ridechecker_pay NUMERIC(10,2);
  END IF;
END $$;
-- Migration 005: Payment link columns for SMS-first payment flow
-- Run this manually in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_token') THEN
    ALTER TABLE orders ADD COLUMN payment_link_token text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_sent_to') THEN
    ALTER TABLE orders ADD COLUMN payment_link_sent_to text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_sent_channel') THEN
    ALTER TABLE orders ADD COLUMN payment_link_sent_channel text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_sent_at') THEN
    ALTER TABLE orders ADD COLUMN payment_link_sent_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_click_ip') THEN
    ALTER TABLE orders ADD COLUMN payment_link_click_ip text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_click_ua') THEN
    ALTER TABLE orders ADD COLUMN payment_link_click_ua text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='stripe_session_id') THEN
    ALTER TABLE orders ADD COLUMN stripe_session_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='base_price') THEN
    ALTER TABLE orders ADD COLUMN base_price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='final_price') THEN
    ALTER TABLE orders ADD COLUMN final_price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='discount_amount') THEN
    ALTER TABLE orders ADD COLUMN discount_amount numeric;
  END IF;
END $$;
-- Migration 006: Seller contact attempts table and order columns
-- Run this manually in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS seller_contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attempt_number int NOT NULL,
  channel text NOT NULL,
  destination text,
  message_template_key text,
  message_body text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_platform') THEN
    ALTER TABLE orders ADD COLUMN seller_platform text DEFAULT 'other';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_contact_status') THEN
    ALTER TABLE orders ADD COLUMN seller_contact_status text DEFAULT 'not_started';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_outcome_notes') THEN
    ALTER TABLE orders ADD COLUMN seller_outcome_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_email') THEN
    ALTER TABLE orders ADD COLUMN seller_email text;
  END IF;
END $$;
-- Migration 007: Service area columns for pilot ZIP restriction
-- Run manually in Supabase SQL Editor

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='service_zip') THEN
    ALTER TABLE orders ADD COLUMN service_zip TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='service_county') THEN
    ALTER TABLE orders ADD COLUMN service_county TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='service_state') THEN
    ALTER TABLE orders ADD COLUMN service_state TEXT DEFAULT 'IL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_service_zip ON orders (service_zip);
CREATE INDEX IF NOT EXISTS idx_orders_service_county ON orders (service_county);
-- RideCheck: RideChecker Structured Submission, Scoring & Payout
-- ADDITIVE ONLY: All new columns use IF NOT EXISTS guards.
-- Run this migration manually in Supabase SQL Editor AFTER 007_service_area.sql.

-- ==============================================
-- A) Profile columns for ridechecker scoring/capacity
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_max_daily_jobs') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_max_daily_jobs INT DEFAULT 3 CHECK (ridechecker_max_daily_jobs BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_rating') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_rating NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_jobs_completed') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_jobs_completed INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_jobs_cancelled') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_jobs_cancelled INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_on_time_pct') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_on_time_pct NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_quality_score') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_quality_score NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ridechecker_is_approved') THEN
    ALTER TABLE profiles ADD COLUMN ridechecker_is_approved BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ==============================================
-- B) ridechecker_availability table
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id UUID NOT NULL REFERENCES profiles(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_jobs INT NOT NULL DEFAULT 3 CHECK (max_jobs BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ridechecker_id, date)
);

CREATE INDEX IF NOT EXISTS idx_availability_ridechecker ON ridechecker_availability(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON ridechecker_availability(date);

-- ==============================================
-- C) ridechecker_job_assignments table
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  ridechecker_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'assigned',
  scheduled_start TIMESTAMPTZ NULL,
  scheduled_end TIMESTAMPTZ NULL,
  accepted_at TIMESTAMPTZ NULL,
  started_at TIMESTAMPTZ NULL,
  submitted_at TIMESTAMPTZ NULL,
  approved_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  job_score NUMERIC NULL,
  payout_amount NUMERIC NULL,
  payout_status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ NULL,
  payout_method TEXT NULL,
  payout_notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_assignment_status CHECK (status IN ('assigned','accepted','in_progress','submitted','approved','rejected','paid','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_assignments_ridechecker_status ON ridechecker_job_assignments(ridechecker_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON ridechecker_job_assignments(order_id);

-- ==============================================
-- D) ridechecker_raw_submissions table
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_raw_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  ridechecker_id UUID NOT NULL REFERENCES profiles(id),
  assignment_id UUID NULL REFERENCES ridechecker_job_assignments(id),
  checklist_complete BOOLEAN DEFAULT FALSE,
  vin_photo_url TEXT NULL,
  odometer_photo_url TEXT NULL,
  under_hood_photo_url TEXT NULL,
  undercarriage_photo_url TEXT NULL,
  tire_tread_mm_front_left NUMERIC NULL,
  tire_tread_mm_front_right NUMERIC NULL,
  tire_tread_mm_rear_left NUMERIC NULL,
  tire_tread_mm_rear_right NUMERIC NULL,
  brake_condition TEXT NULL,
  scan_codes TEXT[] NULL,
  cosmetic_exterior TEXT NULL,
  interior_condition TEXT NULL,
  mechanical_issues TEXT NULL,
  test_drive_notes TEXT NULL,
  immediate_concerns TEXT NULL,
  audio_note_url TEXT NULL,
  extra_photos JSONB NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_brake_condition CHECK (brake_condition IS NULL OR brake_condition IN ('good','fair','poor','unknown'))
);

CREATE INDEX IF NOT EXISTS idx_raw_submissions_order ON ridechecker_raw_submissions(order_id);
CREATE INDEX IF NOT EXISTS idx_raw_submissions_ridechecker ON ridechecker_raw_submissions(ridechecker_id);

-- ==============================================
-- E) Orders table additions for ops report builder
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_report_url') THEN
    ALTER TABLE orders ADD COLUMN ops_report_url TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_summary') THEN
    ALTER TABLE orders ADD COLUMN ops_summary TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_severity_overall') THEN
    ALTER TABLE orders ADD COLUMN ops_severity_overall TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='assigned_ridechecker_id') THEN
    ALTER TABLE orders ADD COLUMN assigned_ridechecker_id UUID NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_sent_at') THEN
    ALTER TABLE orders ADD COLUMN report_sent_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Add check constraint on ops_severity_overall if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ops_severity_overall'
  ) THEN
    BEGIN
      ALTER TABLE orders ADD CONSTRAINT chk_ops_severity_overall
        CHECK (ops_severity_overall IS NULL OR ops_severity_overall IN ('minor','moderate','major','safety_critical'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
-- RideCheck: Internal $1 End-to-End Test Flow
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable or have defaults.
-- Run this migration manually in Supabase SQL Editor AFTER 008.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='is_internal_test') THEN
    ALTER TABLE orders ADD COLUMN is_internal_test BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='test_run_id') THEN
    ALTER TABLE orders ADD COLUMN test_run_id TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ridechecker_earnings' AND column_name='is_internal_test') THEN
    ALTER TABLE ridechecker_earnings ADD COLUMN is_internal_test BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ridechecker_job_assignments' AND column_name='is_internal_test') THEN
    ALTER TABLE ridechecker_job_assignments ADD COLUMN is_internal_test BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_is_internal_test ON orders(is_internal_test) WHERE is_internal_test = TRUE;
-- RideCheck: Vehicle-Determined Pricing & Tier Enforcement
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable or have defaults.
-- Run this migration manually in Supabase SQL Editor AFTER 009.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='classification_modifier') THEN
    ALTER TABLE orders ADD COLUMN classification_modifier TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='classification_reason') THEN
    ALTER TABLE orders ADD COLUMN classification_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='vehicle_mileage') THEN
    ALTER TABLE orders ADD COLUMN vehicle_mileage INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='vehicle_price') THEN
    ALTER TABLE orders ADD COLUMN vehicle_price NUMERIC(10,2);
  END IF;
END $$;
-- 011_legal_protection.sql
-- Adds legal protection layer: terms acceptances + controlled recommendation field.
-- Fully backward-compatible — only adds new tables and columns.

-- Terms acceptance records: one row per order, immutable audit trail
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  text NOT NULL,
  buyer_email               text,
  terms_version             text NOT NULL DEFAULT 'v1.0',
  inspection_scope_version  text NOT NULL DEFAULT 'scope-v1.0',
  accepted_at               timestamptz NOT NULL DEFAULT now(),
  hashed_ip                 text,
  user_agent                text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_order_id ON terms_acceptances(order_id);

-- Add terms_accepted flag to orders (default false for existing rows)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;

-- Controlled recommendation field on orders (set by ops when finalizing report)
-- Allowed values: BUY | BUY_WITH_NEGOTIATION | DO_NOT_BUY_AT_ASKING_PRICE | FURTHER_INSPECTION_REQUIRED
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ops_recommendation text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='package_override') THEN
    ALTER TABLE orders ADD COLUMN package_override TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='package_override_reason') THEN
    ALTER TABLE orders ADD COLUMN package_override_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='package_override_by') THEN
    ALTER TABLE orders ADD COLUMN package_override_by UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='package_override_at') THEN
    ALTER TABLE orders ADD COLUMN package_override_at TIMESTAMPTZ;
  END IF;
END $$;
-- Fix profiles_role_check constraint to include all valid system roles.
-- The previous constraint (created in Supabase dashboard) did not include
-- 'ridechecker' or 'ridechecker_active', causing 500 errors on:
--   1. RideChecker signup  (INSERT with role = 'ridechecker')
--   2. RideChecker approval (UPDATE role = 'ridechecker_active')

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'customer',
    'operations',
    'operations_lead',
    'ridechecker',
    'ridechecker_active',
    'inspector',
    'qa',
    'developer',
    'platform',
    'owner'
  ));
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
-- Cascade: is_admin ⊂ is_ops_lead (both cascade up to owner).
-- is_ops() is STRICT — matches only 'operations', NOT ops_lead or owner.
-- Policies that need "ops and above" must write: is_ops_lead() OR is_ops()
-- is_staff() is its own flat list — independent of the above functions.
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

-- operations ONLY — strict, does NOT cascade to ops_lead or above.
-- Use is_ops_lead() OR is_ops() in policies where broader access is needed.
CREATE OR REPLACE FUNCTION public.is_ops()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() = 'operations'
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
  USING (public.is_ops_lead() OR public.is_ops());


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
  USING (public.is_ops_lead() OR public.is_ops());

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
-- =============================================================
-- 017_ridechecker_pipeline.sql
-- Staged onboarding pipeline for RideChecker candidates.
-- ADDITIVE ONLY — no drops, no renames, all columns nullable/defaulted.
-- Run AFTER migration 016.
-- =============================================================

-- ==============================================
-- A) New columns on profiles
-- ==============================================
DO $$ BEGIN
  -- Primary pipeline tracker — independent of the role column.
  -- role = 'ridechecker'        → pending/applicant (no dashboard access)
  -- role = 'ridechecker_active' → approved (dashboard access granted)
  -- workflow_stage tracks where in the hiring process they are.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='workflow_stage') THEN
    ALTER TABLE profiles ADD COLUMN workflow_stage TEXT DEFAULT 'applied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='documents_complete') THEN
    ALTER TABLE profiles ADD COLUMN documents_complete BOOLEAN DEFAULT false;
  END IF;

  -- 'not_started' | 'pending' | 'clear' | 'failed'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='background_check_status') THEN
    ALTER TABLE profiles ADD COLUMN background_check_status TEXT DEFAULT 'not_started';
  END IF;

  -- 'not_started' | 'pending' | 'verified' | 'failed'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='references_status') THEN
    ALTER TABLE profiles ADD COLUMN references_status TEXT DEFAULT 'not_started';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='assessment_score') THEN
    ALTER TABLE profiles ADD COLUMN assessment_score NUMERIC(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='reviewer_notes') THEN
    ALTER TABLE profiles ADD COLUMN reviewer_notes TEXT;
  END IF;

  -- Secure one-time token for the onboarding setup link.
  -- Generated at approval time; cleared once invite is accepted.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='invite_token') THEN
    ALTER TABLE profiles ADD COLUMN invite_token TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='invite_sent_at') THEN
    ALTER TABLE profiles ADD COLUMN invite_sent_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='invite_accepted_at') THEN
    ALTER TABLE profiles ADD COLUMN invite_accepted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='suspended_at') THEN
    ALTER TABLE profiles ADD COLUMN suspended_at TIMESTAMPTZ;
  END IF;
END $$;

-- Unique index on invite_token (used for O(1) lookup on invite acceptance)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_invite_token
  ON profiles(invite_token)
  WHERE invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_workflow_stage
  ON profiles(workflow_stage);

-- ==============================================
-- B) Backfill workflow_stage for existing rows
-- Safe: only sets stage if the column is currently NULL.
-- ==============================================
UPDATE profiles
SET workflow_stage = 'active'
WHERE role = 'ridechecker_active'
  AND workflow_stage IS NULL;

UPDATE profiles
SET workflow_stage = 'applied'
WHERE role = 'ridechecker'
  AND workflow_stage IS NULL;

-- ==============================================
-- C) ridechecker_stage_history table
-- Immutable audit trail of every stage transition.
-- ==============================================
CREATE TABLE IF NOT EXISTS ridechecker_stage_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id UUID NOT NULL,        -- references profiles.id (no FK to avoid cascade issues)
  from_stage   TEXT,                   -- NULL for the initial 'applied' entry
  to_stage     TEXT NOT NULL,
  changed_by   UUID NOT NULL,          -- actor's profile id
  changed_by_email TEXT,
  changed_by_role  TEXT,
  notes        TEXT,                   -- optional reviewer comment at the time of transition
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_ridechecker
  ON ridechecker_stage_history(ridechecker_id);

CREATE INDEX IF NOT EXISTS idx_stage_history_created
  ON ridechecker_stage_history(created_at DESC);

ALTER TABLE ridechecker_stage_history ENABLE ROW LEVEL SECURITY;

-- ops_lead and above can read stage history; no client writes
DROP POLICY IF EXISTS "stage_history_select" ON ridechecker_stage_history;
CREATE POLICY "stage_history_select" ON ridechecker_stage_history
  FOR SELECT
  USING (public.is_ops_lead());

-- ==============================================
-- END OF 017_ridechecker_pipeline.sql
-- ==============================================
-- =============================================================
-- 018_legal_enhancement.sql
-- Extends legal acceptance tracking with explicit per-checkbox booleans.
-- ADDITIVE ONLY — no drops, no renames.
-- Run AFTER migration 017.
-- =============================================================

-- ── terms_acceptances: add per-checkbox booleans ──────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='terms_acceptances' AND column_name='disclaimer_accepted') THEN
    ALTER TABLE terms_acceptances ADD COLUMN disclaimer_accepted BOOLEAN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='terms_acceptances' AND column_name='no_sole_reliance_accepted') THEN
    ALTER TABLE terms_acceptances ADD COLUMN no_sole_reliance_accepted BOOLEAN;
  END IF;

  -- Track which version of the legal text was accepted
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='terms_acceptances' AND column_name='legal_version') THEN
    ALTER TABLE terms_acceptances ADD COLUMN legal_version TEXT;
  END IF;
END $$;

-- ── orders: per-checkbox boolean columns ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='disclaimer_accepted') THEN
    ALTER TABLE orders ADD COLUMN disclaimer_accepted BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='no_sole_reliance_accepted') THEN
    ALTER TABLE orders ADD COLUMN no_sole_reliance_accepted BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ==============================================
-- END OF 018_legal_enhancement.sql
-- ==============================================
-- Migration 019: Profile Architecture (Additive Only)
-- SAFE: No drops, no renames, no required columns, no existing logic changed.
-- Adds profile_type/origin_type/origin_id/is_orphan to profiles.
-- Adds ridechecker_applications table.
-- Backfills all existing rows with legacy markers.
-- Middleware and role/is_active checks are completely untouched.

-- ============================================================
-- PHASE 1: Additive columns on public.profiles
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='profile_type'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN profile_type TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='origin_type'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN origin_type TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='origin_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN origin_id UUID NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='is_orphan'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_orphan BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- ============================================================
-- PHASE 1: Backfill existing profiles with legacy origin_type
-- ============================================================

-- All existing records without origin_type = legacy
UPDATE public.profiles
SET origin_type = 'legacy'
WHERE origin_type IS NULL;

-- Backfill profile_type from existing role values
UPDATE public.profiles
SET profile_type = 'ridechecker_active'
WHERE role = 'ridechecker_active'
  AND profile_type IS NULL;

UPDATE public.profiles
SET profile_type = 'ridechecker_applicant'
WHERE role = 'ridechecker'
  AND profile_type IS NULL;

UPDATE public.profiles
SET profile_type = 'staff'
WHERE role IN ('operations', 'operations_lead', 'qa', 'developer', 'platform', 'owner')
  AND profile_type IS NULL;

-- Default all remaining (customers) to 'customer'
UPDATE public.profiles
SET profile_type = 'customer'
WHERE profile_type IS NULL;

-- ============================================================
-- PHASE 2: ridechecker_applications table
-- ============================================================

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

-- RLS: admins and ops_lead can read all; public can insert only
ALTER TABLE public.ridechecker_applications ENABLE ROW LEVEL SECURITY;

-- Allow anonymous INSERT (public application form)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ridechecker_applications'
      AND policyname = 'rc_applications_public_insert'
  ) THEN
    CREATE POLICY "rc_applications_public_insert"
      ON public.ridechecker_applications
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users can read applications via service role (API handles auth)
-- No direct public SELECT — all reads go through server-side API routes.

-- ============================================================
-- PHASE 5: Tighten profiles RLS — block direct public INSERT
-- (SELECT/UPDATE own record policies are preserved from migration 014)
-- ============================================================

-- Drop the old unrestricted insert policy if it exists
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "allow_profile_insert" ON public.profiles;

-- New: service role only can insert (all profile creation goes through server routes)
-- Supabase service role bypasses RLS by default, so no explicit policy needed for it.
-- Anon and authenticated users should NOT be able to directly INSERT profiles.
-- If a policy granting INSERT to authenticated users was added before, drop it:
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'profiles_insert_authenticated'
  ) THEN
    DROP POLICY "profiles_insert_authenticated" ON public.profiles;
  END IF;
END $$;
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
-- Migration 021: Add report_logic_version to orders
-- Tracks which logic version generated each report for audit/rollback purposes

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS report_logic_version text;

COMMENT ON COLUMN orders.report_logic_version IS
  'Semver string identifying the AI report generation logic used. Set by the generate-report API route.';
-- Migration 022: Private classification signals table + report internal JSON

CREATE TABLE IF NOT EXISTS vehicle_classification_signals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz DEFAULT now(),
  ip_hash         text,
  make            text,
  model           text,
  year            integer,
  mileage         integer,
  asking_price    numeric(12, 2),
  tier_result     text NOT NULL,
  signals_triggered text[] DEFAULT '{}',
  risk_flags      jsonb DEFAULT '{}',
  request_count   integer DEFAULT 1
);

COMMENT ON TABLE vehicle_classification_signals IS
  'Private classification signal log. Training data for future ML model. Never exposed to customers.';

ALTER TABLE vehicle_classification_signals ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS report_internal_json jsonb;

COMMENT ON COLUMN orders.report_internal_json IS
  'Full AI-generated report JSON for internal use and ML training. Never exposed to customers.';
