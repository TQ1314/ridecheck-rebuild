---
name: Training Center Architecture
description: How guide progress tracking, PDF generation, and Ops visibility are wired for the RideChecker Training Center.
---

## Guide Completion Tracking
- Server-side: upsert into `ridechecker_training_results` with `module_id = 'operations_guide'`, `passed = true`.
- Same unique constraint `(ridechecker_id, module_id)` as SIP-4 cert — no migration needed.
- API: `GET /api/ridechecker/training/guide-progress` → `{ completed, completed_at, score, attempts }`.
- API: `POST /api/ridechecker/training/guide-progress` → upserts row, returns `{ completed, completed_at }`.

## Section Progress (Per-Section Read State)
- Stored in `localStorage` key `rc_guide_section_progress` as `Record<string, boolean>`.
- No server round-trips per section — snappy UX.
- Dashboard training tab reads same localStorage key to show `X/10 read` indicator.

## PDF Download
- Component: `lib/training/training-guide-pdf.tsx` — exports `TrainingGuidePDF` (react-pdf `Document`).
- No server route needed. Client-side dynamic import pattern:
  ```ts
  const { pdf } = await import("@react-pdf/renderer");
  const ReactLib = await import("react");
  const { TrainingGuidePDF } = await import("@/lib/training/training-guide-pdf");
  const blob = await pdf(ReactLib.default.createElement(TrainingGuidePDF)).toBlob();
  ```
- `@react-pdf/renderer` v4.5.1 is already in package.json.

## Ops/Admin Visibility
- Admin GET `/api/admin/ridecheckers` enriches each row with `guide_completed` (boolean) and `guide_completed_at` (timestamp) via a bulk `ridechecker_training_results` query after the profiles fetch.
- Admin table now has two columns: "SIP-4 Cert" and "Guide" side by side.

## Server Client Function
- Use `createSupabaseServer()` from `@/lib/supabase/server` in App Router API routes (not `createClient` which is the browser client).

**Why:** The `ridechecker_training_results` table already supports multiple module IDs — reusing it with `module_id='operations_guide'` avoids any new migration.
