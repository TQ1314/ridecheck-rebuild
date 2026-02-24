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
