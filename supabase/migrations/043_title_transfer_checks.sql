-- 043_title_transfer_checks.sql
-- Stores Title & Transfer Readiness assessment results from the RideChecker workflow.

CREATE TABLE IF NOT EXISTS vehicle_title_transfer_checks (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vin                             TEXT,

  -- Checklist fields
  title_present                   BOOLEAN,
  seller_name_on_title            TEXT,
  buyer_name_completed            TEXT,   -- yes | no | not_applicable | unable_to_verify
  odometer_disclosure_completed   TEXT,   -- yes | no | not_applicable | unable_to_verify
  lien_release_present            TEXT,   -- yes | no | not_applicable | unable_to_verify
  title_signed                    TEXT,   -- yes | no | not_applicable | unable_to_verify
  open_title                      TEXT,   -- yes | no | unable_to_verify
  vin_matches_title               TEXT,   -- yes | no | unable_to_verify
  state_of_title                  TEXT,

  -- Document photos
  title_photo_url                 TEXT,
  lien_release_photo_url          TEXT,
  odometer_disclosure_photo_url   TEXT,

  -- Computed status
  transfer_readiness_status       TEXT NOT NULL DEFAULT 'unknown'
    CHECK (transfer_readiness_status IN ('ready','caution','concern','unknown')),

  risk_flags                      JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes                           TEXT,

  checked_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vttc_order_id ON vehicle_title_transfer_checks(order_id);
CREATE INDEX IF NOT EXISTS idx_vttc_vin ON vehicle_title_transfer_checks(vin);
CREATE INDEX IF NOT EXISTS idx_vttc_status ON vehicle_title_transfer_checks(transfer_readiness_status);
