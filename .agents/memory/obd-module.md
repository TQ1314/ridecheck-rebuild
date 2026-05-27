---
name: OBD-II Diagnostic Module
description: Architecture and data flow for the structured OBD diagnostic module added to the RideChecker inspection workflow.
---

# OBD-II Diagnostic Module

## What it is
A structured optional module (step 8 of 15, id=`obd`) in the RideChecker inspection wizard that replaces the old plain text `scan_codes` entry.

## Data shape (`obd_module` JSONB)
```json
{
  "scan_performed": "yes|no|not_available|not_permitted",
  "uploaded_files": [{ "url": "", "fileName": "", "fileType": "image|pdf", "reviewStatus": "approved_for_report|needs_review|excluded_from_report" }],
  "dtc_codes": [{ "system": "", "code": "", "description": "", "status": "Active|Pending|Stored|Unknown" }],
  "notes": "",
  "emissions_readiness": "ready|not_ready|unknown",
  "warning_lights": ["check_engine", "abs", "airbag_srs", "battery", "oil_pressure", "brake", "tpms", "other", "none"],
  "warning_other_desc": ""
}
```

## Files touched
- `lib/report/types.ts` — `OBDUploadedFile`, `OBDDTCCode`, `OBDModule` interfaces; `obd_module` on `ReportInput`/`ReportMeta`
- `app/api/ridechecker/photos/upload/route.ts` — PDF MIME type allowed
- `app/api/ridechecker/jobs/[assignmentId]/submit/route.ts` — `obdModuleSchema` Zod schema; `obd_module` persisted to DB
- `app/api/ops/orders/[orderId]/generate-report/route.ts` — `resolveOBDScope()`, updated `buildScopeTable`, `buildMissingItems`, `buildConfidenceLevel`, OBD images added to photo validation list, `obd_module` passed to `reportInput`/`reportMeta`
- `lib/report/claude-generate.ts` — `buildOBDSection()` injects structured OBD data into Claude prompt
- `lib/report/pdf-template.tsx` — `OBDDiagnosticsSection` component, renders after Road Test section
- `app/ridechecker/(portal)/jobs/[assignmentId]/submit/page.tsx` — full OBD step UI (scan status, warning lights, file upload, DTC codes, emissions, notes)
- `supabase/migrations/038_obd_module.sql` — migration file
- `supabase/migrations/PENDING_RUN_ALL.sql` — OBD migration appended at end

## Key decisions
**Why:** `scan_codes` (plain array) was too sparse for report generation. Structured module captures scan status, evidence files, per-system DTC codes with status, warning lights, and emissions readiness — all of which improve Claude's analysis and the PDF output.

**Backward compat:** Legacy `scan_codes` array is still populated from `dtc_codes` on submit so old report generation logic continues to work.

**Warning lights "none" is exclusive:** selecting "none" clears all other lights; selecting any real light clears "none".

**Confidence scoring:** OBD scan with evidence (codes or files) reduces `missingCount` by 1, boosting confidence level.

**PDF photo validation:** OBD image files (fileType==="image") are included in `rawPhotos` for URL validation. PDF files are shown as text labels in the PDF, not validated as images.

**Migration:** Must run `038_obd_module.sql` (or the appended block in `PENDING_RUN_ALL.sql`) against Supabase before the submit API will persist `obd_module` data.
