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
  order_id TEXT REFERENCES orders(id),
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
  order_id TEXT REFERENCES orders(id),
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
  order_id TEXT REFERENCES orders(id),
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
