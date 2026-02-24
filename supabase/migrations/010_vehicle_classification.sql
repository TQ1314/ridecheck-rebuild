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
