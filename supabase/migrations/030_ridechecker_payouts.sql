-- Migration 030: RideChecker Payout Tracking System
-- Tables: ridechecker_payout_batches, ridechecker_payouts
-- Supports: pending → approved → paid workflow with batch processing

-- ─────────────────────────────────────────────────────────────────
-- Payout Batches (process multiple payouts together)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ridechecker_payout_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name    TEXT,
  total_amount  INTEGER NOT NULL DEFAULT 0,
  payout_count  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  notes         TEXT,
  processed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_batch_status CHECK (status IN ('pending','processing','completed','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON ridechecker_payout_batches(status);

ALTER TABLE ridechecker_payout_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_payout_batches"
  ON ridechecker_payout_batches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operations','operations_lead','owner','admin','platform','developer')
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- Individual Payouts
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ridechecker_payouts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  base_pay         INTEGER NOT NULL DEFAULT 0,
  bonus            INTEGER NOT NULL DEFAULT 0,
  bonus_breakdown  JSONB,     -- e.g. {"same_day":5,"quality":10,"streak":15}
  total_pay        INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending',
  payout_batch_id  UUID REFERENCES ridechecker_payout_batches(id) ON DELETE SET NULL,
  notes            TEXT,
  approved_at      TIMESTAMPTZ,
  approved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  paid_at          TIMESTAMPTZ,
  paid_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_payout_status CHECK (status IN ('pending','approved','paid','cancelled')),
  CONSTRAINT uq_payout_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_payouts_ridechecker   ON ridechecker_payouts(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order         ON ridechecker_payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status        ON ridechecker_payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_batch         ON ridechecker_payouts(payout_batch_id);

ALTER TABLE ridechecker_payouts ENABLE ROW LEVEL SECURITY;

-- Ops/admin: full access
CREATE POLICY "staff_manage_payouts"
  ON ridechecker_payouts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operations','operations_lead','owner','admin','platform','developer')
    )
  );

-- RideCheckers: read their own payouts
CREATE POLICY "ridecheckers_read_own_payouts"
  ON ridechecker_payouts FOR SELECT
  TO authenticated
  USING (ridechecker_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- Triggers: auto-update updated_at
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_ridechecker_payouts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ridechecker_payouts_updated_at ON ridechecker_payouts;
CREATE TRIGGER trg_ridechecker_payouts_updated_at
  BEFORE UPDATE ON ridechecker_payouts
  FOR EACH ROW EXECUTE FUNCTION update_ridechecker_payouts_updated_at();

CREATE OR REPLACE FUNCTION update_payout_batches_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_payout_batches_updated_at ON ridechecker_payout_batches;
CREATE TRIGGER trg_payout_batches_updated_at
  BEFORE UPDATE ON ridechecker_payout_batches
  FOR EACH ROW EXECUTE FUNCTION update_payout_batches_updated_at();
