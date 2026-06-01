-- 040_payment_gate.sql
-- Add payment override tracking columns to orders table

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_required') THEN
    ALTER TABLE orders ADD COLUMN payment_required BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_override_approved') THEN
    ALTER TABLE orders ADD COLUMN payment_override_approved BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_override_reason') THEN
    ALTER TABLE orders ADD COLUMN payment_override_reason TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_override_by') THEN
    ALTER TABLE orders ADD COLUMN payment_override_by UUID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_override_at') THEN
    ALTER TABLE orders ADD COLUMN payment_override_at TIMESTAMPTZ;
  END IF;
END $$;
