-- ============================================================
-- MIGRATION 036: Fix orders.assignment_status CHECK constraint
-- Migration 029 created the constraint with a limited set of
-- values. Migration 032 introduced 'awaiting_acceptance' for
-- the RC acceptance flow but never updated the orders CHECK.
-- This causes the ridechecker-assign API to fail with a
-- constraint violation when ops assigns a RideChecker.
-- Safe to re-run (idempotent).
-- ============================================================

-- Drop old constraint (only one can exist with this name)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_orders_assignment_status;

-- Re-create with full set of valid statuses
ALTER TABLE public.orders
  ADD CONSTRAINT chk_orders_assignment_status CHECK (
    assignment_status IN (
      'unassigned',
      'awaiting_acceptance',
      'assigned',
      'accepted',
      'declined',
      'expired',
      'en_route',
      'in_progress',
      'completed',
      'cancelled'
    )
  );
