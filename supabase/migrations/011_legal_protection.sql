-- 011_legal_protection.sql
-- Adds legal protection layer: terms acceptances + controlled recommendation field.
-- Fully backward-compatible — only adds new tables and columns.

-- Terms acceptance records: one row per order, immutable audit trail
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  text NOT NULL,
  buyer_email               text,
  terms_version             text NOT NULL DEFAULT 'v1.0',
  inspection_scope_version  text NOT NULL DEFAULT 'scope-v1.0',
  accepted_at               timestamptz NOT NULL DEFAULT now(),
  hashed_ip                 text,
  user_agent                text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_order_id ON terms_acceptances(order_id);

-- Add terms_accepted flag to orders (default false for existing rows)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;

-- Controlled recommendation field on orders (set by ops when finalizing report)
-- Allowed values: BUY | BUY_WITH_NEGOTIATION | DO_NOT_BUY_AT_ASKING_PRICE | FURTHER_INSPECTION_REQUIRED
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ops_recommendation text;
