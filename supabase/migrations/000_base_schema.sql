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
