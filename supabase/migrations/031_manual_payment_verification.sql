-- Migration 031: Manual payment verification columns
-- Adds fields for ops_lead/owner-initiated manual payment verification
-- These columns shadow but do not overwrite Stripe webhook columns

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_verification_note    TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_stripe_reference     TEXT,
  ADD COLUMN IF NOT EXISTS payment_evidence_url         TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_amount_verified      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_payer_email          TEXT;

-- Index for lookups by stripe reference
CREATE INDEX IF NOT EXISTS idx_orders_stripe_reference ON public.orders(payment_stripe_reference);

COMMENT ON COLUMN public.orders.payment_verification_note IS 'Freeform note recorded by ops_lead/owner when manually verifying payment';
COMMENT ON COLUMN public.orders.payment_verified_by IS 'Profile ID of the user who performed manual verification';
COMMENT ON COLUMN public.orders.payment_stripe_reference IS 'Stripe payment intent ID or checkout session ID supplied during manual verification';
COMMENT ON COLUMN public.orders.payment_evidence_url IS 'URL to screenshot or evidence document uploaded during manual verification';
COMMENT ON COLUMN public.orders.payment_verified_at IS 'Timestamp when manual verification was performed';
COMMENT ON COLUMN public.orders.payment_amount_verified IS 'Amount confirmed during manual verification in dollars';
COMMENT ON COLUMN public.orders.payment_payer_email IS 'Payer email recorded during manual verification';
