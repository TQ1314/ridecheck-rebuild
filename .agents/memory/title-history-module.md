---
name: Title & History Flags Module
description: Architecture and data flow for the observational title/VIN/flood/tampering/accident module added to the RideChecker inspection workflow (Part 9).
---

# Title & History Flags Module (Part 9)

## What it is
An optional step (step 9 of 16, id=`title_history`) inserted after the OBD step in the RideChecker inspection wizard. Purely observational — documents visible indicators only. Does NOT run title databases, certify history, or make legal conclusions.

## Core philosophy
- Observable indicators only — no accusatory language
- Never say: "stolen", "flood car", "title fraud", "rollback confirmed"
- Always use: "indicators observed", "discrepancy observed", "unable to verify", "independent verification recommended"
- "none" is mutually exclusive within each indicator group (flood/tampering/accident)

## Data shape (`title_history_module` JSONB)
```json
{
  "title_review_status": "yes_reviewed|partial|no_seller|dealer_unavailable|not_applicable",
  "title_type": "clean|salvage|rebuilt|bonded|lien|out_of_state|unknown|unable",
  "vin_match_title": "yes|no_mismatch|unable|unavailable",
  "seller_name_match": "yes|no_third_party|unable|dealer",
  "title_signed": "yes|no|unable",
  "dashboard_vin_verified": "yes|no|unable",
  "door_jamb_vin_verified": "yes|no|unable",
  "vins_matched": "yes|no_discrepancy|unable",
  "dashboard_vin_photo_url": "",
  "door_jamb_vin_photo_url": "",
  "lien_status": "release_present|lien_no_release|no_lien|unable",
  "lien_notes": "",
  "odometer_reading": 87234,
  "odometer_consistency": "yes|no_discrepancy|unable|unavailable",
  "odometer_tampering": "yes|no|unable",
  "odometer_notes": "",
  "flood_indicators": ["water_staining", "mold_odor", "interior_rust", "mud_silt", "corroded_wiring", "fogged_lights", "unusual_interior_rust", "none"],
  "flood_notes": "",
  "tampering_indicators": ["ignition_steering", "vin_plate_altered", "vin_mismatch", "door_jamb_sticker", "non_oem_keys", "aftermarket_wiring", "lock_damage", "none"],
  "tampering_notes": "",
  "accident_indicators": ["mismatched_paint", "overspray", "panel_gaps", "replacement_panels", "body_filler", "structural_weld", "airbag_cover", "none"],
  "accident_notes": "",
  "ops_review_status": "normal|ops_review_required|severe_attention_flag"
}
```

## Auto-flagging logic (server-side in submit route)
`severe_attention_flag` if: both vin_match_title AND vins_matched are mismatches, OR vin_plate_altered in tampering indicators.
`ops_review_required` if: salvage/rebuilt title, any VIN mismatch, odometer discrepancy, odometer tampering, lien_no_release, any tampering indicators, 2+ flood indicators.
Flag is INTERNAL ONLY — never shown to buyer, never in PDF.

## Files touched
- `lib/report/types.ts` — `TitleHistoryModule` interface; `title_history_module?` on `ReportInput`/`ReportMeta`
- `app/api/ridechecker/jobs/[assignmentId]/submit/route.ts` — `titleHistoryModuleSchema` Zod (strips ops_review_status from client), `computeOpsReviewStatus()`, DB insert with computed flag
- `app/api/ops/orders/[orderId]/generate-report/route.ts` — `buildTitleScopeRow()`, missing items (title unavailable, VIN mismatch, odometer discrepancy, lien), confidence boost/penalty, THF VIN photos in rawPhotos, module passed to reportInput/reportMeta
- `lib/report/claude-generate.ts` — `buildTitleHistorySection()` — neutral language section injected into Claude prompt after OBD/road test sections
- `lib/report/pdf-template.tsx` — `TitleHistoryFlagsSection` component (status banner, VIN/lien/odometer grid, indicator groups with dot indicators); `TitleHistoryFlagsSection` styles (`thfBanner`, `thfGrid3`, `thfBox`, `thfIndicatorGroup`, etc.); inserted after `OBDDiagnosticsSection`
- `app/ridechecker/(portal)/jobs/[assignmentId]/submit/page.tsx` — 22 `thf_*` FormData fields; EMPTY_FORM defaults; `title_history` step added after `obd`; `toggleTHFIndicator` helper; handleSubmit THF module payload; full title_history step JSX (7 sections)
- `supabase/migrations/039_title_history_module.sql` — migration file

## Key decisions
**Why observational only:** Protects RideCheck from legal liability. Keeps platform within its charter as a transparency/documentation tool, not a history verification service. CARFAX/AutoCheck remain paid upsells.

**Why server-side flagging:** `ops_review_status` computed in submit route — client cannot manipulate it. Zod schema uses `.strip()` to discard any client-sent ops_review_status value.

**Confidence impact:** 
- Title reviewed + VINs matched + no flags → effective missing -1 (boost)
- `ops_review_required` → effective missing +1 (penalty)
- `severe_attention_flag` → always LIMITED CONFIDENCE regardless

**Step placement:** step index 8 (0-based), step 9 of 16 total (after OBD, before Exterior). Always optional — `isStepComplete("title_history")` returns true always.

**VIN photos in PDF:** Dashboard/door jamb VIN photos added to `rawPhotos` for URL validation, then rendered in `TitleHistoryFlagsSection` component directly from module data.

**Migration:** Must run `039_title_history_module.sql` in Supabase SQL Editor before the submit API will persist `title_history_module` data.
