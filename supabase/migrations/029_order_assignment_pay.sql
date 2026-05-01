-- Migration 029: Order assignment status, pay fields, and job_broadcasts table
-- Adds: base_pay, current_offer, boost_amount, assignment_status, seller_status on orders
-- Creates: job_broadcasts table for broadcast assignment flow

DO $$ BEGIN
  -- Pay fields (stored in dollars as integers, e.g. 75 = $75)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='base_pay') THEN
    ALTER TABLE orders ADD COLUMN base_pay INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='current_offer') THEN
    ALTER TABLE orders ADD COLUMN current_offer INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='boost_amount') THEN
    ALTER TABLE orders ADD COLUMN boost_amount INTEGER DEFAULT 0;
  END IF;

  -- Assignment status (distinct from ridechecker_assignments.status)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='assignment_status') THEN
    ALTER TABLE orders ADD COLUMN assignment_status TEXT DEFAULT 'unassigned';
  END IF;

  -- Seller status (simple ops-facing status, distinct from seller_contact_status history)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_status') THEN
    ALTER TABLE orders ADD COLUMN seller_status TEXT DEFAULT 'awaiting';
  END IF;
END $$;

-- Add check constraints idempotently
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'orders' AND constraint_name = 'chk_orders_assignment_status'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT chk_orders_assignment_status
      CHECK (assignment_status IN ('unassigned','assigned','accepted','en_route','completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'orders' AND constraint_name = 'chk_orders_seller_status'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT chk_orders_seller_status
      CHECK (seller_status IN ('awaiting','confirmed','no_response','invalid'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- job_broadcasts: tracks broadcast assignment offers sent to RideCheckers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ridechecker_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'sent',
  offered_pay      INTEGER NOT NULL DEFAULT 0,
  responded_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_broadcast_status CHECK (status IN ('sent','accepted','declined','expired'))
);

CREATE INDEX IF NOT EXISTS idx_job_broadcasts_order_id        ON job_broadcasts(order_id);
CREATE INDEX IF NOT EXISTS idx_job_broadcasts_ridechecker_id  ON job_broadcasts(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_job_broadcasts_order_status    ON job_broadcasts(order_id, status);

-- RLS
ALTER TABLE job_broadcasts ENABLE ROW LEVEL SECURITY;

-- RideCheckers see only their own broadcast offers
CREATE POLICY "ridecheckers_see_own_broadcasts"
  ON job_broadcasts FOR SELECT
  TO authenticated
  USING (ridechecker_id = auth.uid());

-- Ops/admin can manage all broadcasts
CREATE POLICY "staff_manage_broadcasts"
  ON job_broadcasts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operations','operations_lead','owner','admin','platform','developer')
    )
  );

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_job_broadcasts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_broadcasts_updated_at ON job_broadcasts;
CREATE TRIGGER trg_job_broadcasts_updated_at
  BEFORE UPDATE ON job_broadcasts
  FOR EACH ROW EXECUTE FUNCTION update_job_broadcasts_updated_at();
