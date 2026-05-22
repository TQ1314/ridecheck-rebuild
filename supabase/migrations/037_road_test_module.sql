-- Migration 037: Add structured road test module to ridechecker_raw_submissions
-- Stores the full structured road test checklist data as JSONB

ALTER TABLE ridechecker_raw_submissions
  ADD COLUMN IF NOT EXISTS road_test_module JSONB NULL;

COMMENT ON COLUMN ridechecker_raw_submissions.road_test_module IS
  'Structured road test module data: { status: completed|not_permitted|not_possible, engine_behavior: [], transmission: [], brakes: [], steering: [], suspension: [], warning_lights: [], other_lights_noted: bool, other_lights_description: str, overall: [], concerns_notes: str, photo_1_url: str, photo_2_url: str }';
