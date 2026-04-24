-- Migration 021: Add report_logic_version to orders
-- Tracks which logic version generated each report for audit/rollback purposes

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS report_logic_version text;

COMMENT ON COLUMN orders.report_logic_version IS
  'Semver string identifying the AI report generation logic used. Set by the generate-report API route.';
