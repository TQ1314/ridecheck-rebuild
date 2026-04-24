-- Migration 022: Private classification signals table + report internal JSON

CREATE TABLE IF NOT EXISTS vehicle_classification_signals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz DEFAULT now(),
  ip_hash         text,
  make            text,
  model           text,
  year            integer,
  mileage         integer,
  asking_price    numeric(12, 2),
  tier_result     text NOT NULL,
  signals_triggered text[] DEFAULT '{}',
  risk_flags      jsonb DEFAULT '{}',
  request_count   integer DEFAULT 1
);

COMMENT ON TABLE vehicle_classification_signals IS
  'Private classification signal log. Training data for future ML model. Never exposed to customers.';

ALTER TABLE vehicle_classification_signals ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS report_internal_json jsonb;

COMMENT ON COLUMN orders.report_internal_json IS
  'Full AI-generated report JSON for internal use and ML training. Never exposed to customers.';
