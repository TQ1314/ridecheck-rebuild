-- Migration 056: RideChecker Compensation Offers
-- Run in Supabase SQL Editor
-- Additive only — does not modify any existing table columns or constraints

-- ── rc_compensation_offers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rc_compensation_offers (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  version                integer     NOT NULL DEFAULT 1,

  -- Offer breakdown (cents stored as integer dollars for simplicity)
  base_pay               integer     NOT NULL DEFAULT 0,
  distance_bonus         integer     NOT NULL DEFAULT 0,
  same_day_bonus         integer     NOT NULL DEFAULT 0,
  rush_bonus             integer     NOT NULL DEFAULT 0,
  surge_bonus            integer     NOT NULL DEFAULT 0,
  total_offer            integer     NOT NULL DEFAULT 0,

  -- Calculation inputs (stored for auditability)
  package_type           text,
  distance_miles         numeric,
  is_same_day            boolean     NOT NULL DEFAULT false,
  is_rush                boolean     NOT NULL DEFAULT false,

  -- Status lifecycle: draft → saved → override_requested → override_approved → assigned
  pay_status             text        NOT NULL DEFAULT 'draft'
                           CHECK (pay_status IN ('draft','saved','override_requested','override_approved','assigned')),

  -- Flags
  is_current             boolean     NOT NULL DEFAULT true,
  is_manual_review       boolean     NOT NULL DEFAULT false,   -- exotic / specialty
  requires_ops_lead      boolean     NOT NULL DEFAULT false,   -- 40+ miles

  -- Override tracking
  override_requested_by  uuid        REFERENCES profiles(id),
  override_requested_at  timestamptz,
  override_reason        text,
  override_approved_by   uuid        REFERENCES profiles(id),
  override_approved_at   timestamptz,
  override_rejected_by   uuid        REFERENCES profiles(id),
  override_rejected_at   timestamptz,
  override_rejection_reason text,

  -- Save tracking
  saved_by               uuid        REFERENCES profiles(id),
  saved_at               timestamptz,

  -- Surge tracking
  surge_added_by         uuid        REFERENCES profiles(id),
  surge_added_at         timestamptz,
  surge_note             text,

  -- Timestamps
  calculated_at          timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_comp_offers_order_id  ON rc_compensation_offers(order_id);
CREATE INDEX IF NOT EXISTS idx_rc_comp_offers_current   ON rc_compensation_offers(order_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_rc_comp_offers_status    ON rc_compensation_offers(pay_status);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE rc_compensation_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ops_rc_comp_offers_all" ON rc_compensation_offers;
CREATE POLICY "ops_rc_comp_offers_all"
  ON rc_compensation_offers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','owner','operations','operations_lead','ops_lead','ops')
    )
  );
