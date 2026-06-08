-- ============================================================
-- MIGRATION 046: Canonical Stripe payment ID columns on orders
-- Adds stripe_checkout_session_id and stripe_payment_intent_id
-- as proper named columns (alongside legacy stripe_session_id
-- and payment_intent_id which remain for backward compat).
-- Backfills from existing columns.
-- Safe to run multiple times (idempotent).
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id   TEXT;

-- Backfill from legacy columns where the new ones are empty
UPDATE public.orders
  SET stripe_checkout_session_id = stripe_session_id
  WHERE stripe_checkout_session_id IS NULL
    AND stripe_session_id IS NOT NULL;

UPDATE public.orders
  SET stripe_payment_intent_id = payment_intent_id
  WHERE stripe_payment_intent_id IS NULL
    AND payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_checkout_session_id
  ON public.orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id
  ON public.orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

COMMENT ON COLUMN public.orders.stripe_checkout_session_id IS
  'Stripe Checkout Session ID (cs_...) linked to this order. Written by pay/create-session and webhook.';

COMMENT ON COLUMN public.orders.stripe_payment_intent_id IS
  'Stripe PaymentIntent ID (pi_...) confirmed as succeeded. Written by webhook and sync-payment.';
