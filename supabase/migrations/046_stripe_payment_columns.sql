-- ============================================================
-- MIGRATION 046: Canonical Stripe payment ID columns on orders
--
-- 1. Adds payment_intent_id (base-schema column missing in some
--    deployments) as a catch-up, idempotent step.
-- 2. Adds stripe_checkout_session_id and stripe_payment_intent_id
--    as the canonical, well-named column pair.
-- 3. Backfills canonical columns from legacy ones where present.
--
-- All operations are idempotent — safe to run multiple times.
-- ============================================================

-- Step 1: Ensure legacy base-schema column exists (catch-up)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

-- Step 2: Add canonical columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id   TEXT;

-- Step 3: Backfill canonical columns from legacy columns
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orders'
      AND column_name  = 'stripe_session_id'
  ) THEN
    UPDATE public.orders
      SET stripe_checkout_session_id = stripe_session_id
      WHERE stripe_checkout_session_id IS NULL
        AND stripe_session_id IS NOT NULL;
    RAISE NOTICE 'Backfilled stripe_checkout_session_id from stripe_session_id';
  ELSE
    RAISE NOTICE 'stripe_session_id absent — skipping checkout session backfill';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orders'
      AND column_name  = 'payment_intent_id'
  ) THEN
    UPDATE public.orders
      SET stripe_payment_intent_id = payment_intent_id
      WHERE stripe_payment_intent_id IS NULL
        AND payment_intent_id IS NOT NULL;
    RAISE NOTICE 'Backfilled stripe_payment_intent_id from payment_intent_id';
  ELSE
    RAISE NOTICE 'payment_intent_id absent — skipping payment intent backfill';
  END IF;
END $$;

-- Step 4: Indexes
CREATE INDEX IF NOT EXISTS idx_orders_stripe_checkout_session_id
  ON public.orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id
  ON public.orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id
  ON public.orders (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

COMMENT ON COLUMN public.orders.payment_intent_id IS
  'Stripe PaymentIntent ID (pi_...) — legacy column, kept for backward compatibility.';

COMMENT ON COLUMN public.orders.stripe_checkout_session_id IS
  'Stripe Checkout Session ID (cs_...) linked to this order. Written by pay/create-session and webhook.';

COMMENT ON COLUMN public.orders.stripe_payment_intent_id IS
  'Stripe PaymentIntent ID (pi_...) confirmed as succeeded. Canonical column written by webhook and sync-payment.';
