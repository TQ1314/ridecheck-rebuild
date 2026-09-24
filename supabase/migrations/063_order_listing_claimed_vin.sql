-- VIN supplied by a buyer/listing is a claim, not inspection verification.
-- Keep it separate from verified VIN evidence and make this migration additive.
DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'listing_claimed_vin'
    ) THEN
    ALTER TABLE public.orders ADD COLUMN listing_claimed_vin TEXT;
  END IF;
END $$;
