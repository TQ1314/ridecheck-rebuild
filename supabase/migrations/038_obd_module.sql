-- ── 038: OBD-II Module ────────────────────────────────────────────────────────
-- Adds structured OBD diagnostic data to raw inspection submissions.

ALTER TABLE ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS obd_module JSONB NULL;

COMMENT ON COLUMN ridechecker_raw_submissions.obd_module IS
  'Structured OBD-II diagnostic module: { scan_performed: yes|no|not_available|not_permitted, uploaded_files: [{url, fileName, fileType, reviewStatus}], dtc_codes: [{system, code, description, status}], notes, emissions_readiness: ready|not_ready|unknown, warning_lights: [], warning_other_desc }';
