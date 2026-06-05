-- 041_risk_intelligence.sql
-- Risk Intelligence subsystem: VIN decode, recall, flood, theft, market-value, and composite scoring

-- ── Main composite risk record (one per order, upsertable) ─────────────────
CREATE TABLE IF NOT EXISTS vehicle_risk_checks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vin                TEXT,
  overall_risk_score INTEGER,
  overall_risk_level TEXT,
  score_reasons      JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_risk_checks_order_id
  ON vehicle_risk_checks(order_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_risk_checks_order_id
  ON vehicle_risk_checks(order_id);

-- ── VIN decode results ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_vin_checks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vin            TEXT,
  decoded_year   TEXT,
  decoded_make   TEXT,
  decoded_model  TEXT,
  vin_valid      BOOLEAN,
  source         TEXT,
  raw_response   JSONB,
  checked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_vin_checks_order_id
  ON vehicle_vin_checks(order_id);

-- ── Recall check results ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_recall_checks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vin              TEXT,
  recall_count     INTEGER,
  highest_severity TEXT,
  recall_data      JSONB,
  source           TEXT,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_recall_checks_order_id
  ON vehicle_recall_checks(order_id);

-- ── Flood risk assessment ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_flood_checks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  flood_risk_score INTEGER,
  flood_risk_level TEXT,
  findings         JSONB,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_flood_checks_order_id
  ON vehicle_flood_checks(order_id);

-- ── Theft / salvage record checks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_theft_checks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  theft_status TEXT,
  theft_source TEXT,
  theft_data   JSONB,
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_theft_checks_order_id
  ON vehicle_theft_checks(order_id);

-- ── Market value checks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_market_value_checks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_price           NUMERIC,
  estimated_market_value  NUMERIC,
  variance_percent        NUMERIC,
  pricing_risk_level      TEXT,
  source                  TEXT,
  checked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_market_value_checks_order_id
  ON vehicle_market_value_checks(order_id);
