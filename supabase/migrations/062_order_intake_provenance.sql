-- Buyer intake provenance is optional metadata for proposed/extracted fields.
-- Additive and idempotent; existing orders are unchanged.
DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'intake_provenance'
    ) THEN
    ALTER TABLE public.orders ADD COLUMN intake_provenance JSONB;
  END IF;
END $$;
