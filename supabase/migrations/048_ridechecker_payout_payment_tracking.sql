-- Migration 048: Add payment_method + payment_reference to ridechecker_payouts
-- These allow Ops Lead to record HOW a RideChecker was paid (Zelle, PayPal, ACH, etc.)
-- and a reference number / transaction ID for reconciliation.
-- The ridechecker_payouts table already has: total_pay, status, paid_at, approved_at.
-- This migration only adds the two missing tracking columns.

ALTER TABLE public.ridechecker_payouts
  ADD COLUMN IF NOT EXISTS payment_method    TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

COMMENT ON COLUMN public.ridechecker_payouts.payment_method IS
  'How the RideChecker was paid: zelle, paypal, cashapp, venmo, ach, check, cash, other';

COMMENT ON COLUMN public.ridechecker_payouts.payment_reference IS
  'Transaction ID, check number, or other reference for the payment method';
