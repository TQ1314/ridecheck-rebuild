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
