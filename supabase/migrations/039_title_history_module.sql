-- ── 039: Title & History Flags Module ────────────────────────────────────────
-- Adds structured title/history observable-indicator data to raw submissions.

ALTER TABLE ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS title_history_module JSONB NULL;

COMMENT ON COLUMN ridechecker_raw_submissions.title_history_module IS
  'Structured title & history flags module (observable indicators only): { title_review_status, title_type, vin_match_title, seller_name_match, title_signed, dashboard_vin_verified, door_jamb_vin_verified, vins_matched, dashboard_vin_photo_url, door_jamb_vin_photo_url, lien_status, lien_notes, odometer_reading, odometer_consistency, odometer_tampering, odometer_notes, flood_indicators[], flood_notes, tampering_indicators[], tampering_notes, accident_indicators[], accident_notes, ops_review_status: normal|ops_review_required|severe_attention_flag }';
