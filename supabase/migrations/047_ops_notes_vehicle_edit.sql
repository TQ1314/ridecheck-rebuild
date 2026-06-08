-- ============================================================
-- MIGRATION 047: ops_notes catch-up + ops_internal_note
-- ops_notes:          general notes written alongside ops_status updates
-- ops_internal_note:  internal note recorded by ops when editing vehicle/listing info
-- Safe to run multiple times (idempotent).
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ops_notes          TEXT,
  ADD COLUMN IF NOT EXISTS ops_internal_note  TEXT;

COMMENT ON COLUMN public.orders.ops_notes IS
  'Free-form notes recorded by ops alongside status transitions.';

COMMENT ON COLUMN public.orders.ops_internal_note IS
  'Internal-only ops note recorded when vehicle/listing info is corrected. Never surfaced to buyer.';
