---
name: Seller Type & Title Transfer Feature
description: seller_type column on orders drives private-party title transfer workflow; DB, logic, API, inspect wizard, ops UI, PDF, and QC gate.
---

## Rule
seller_type is stored on `orders` (values: private_party | dealership | auction | other). When seller_type = private_party, an additional title transfer check is required before report delivery.

**Why:** Private-party transactions carry unique title fraud risk (open titles, VIN mismatches, missing lien releases). Dealerships handle title transfers through their own F&I process.

## Key files
- DB: `supabase/migrations/042_seller_type.sql`, `043_title_transfer_checks.sql`
- Logic: `lib/seller-type/index.ts` (labels/icons), `lib/risk-intelligence/title-transfer-check.ts` (calculateTransferReadiness — flags CONCERN vs CAUTION, returns summary string)
- API: `app/api/ridechecker/orders/[orderId]/title-transfer-check/route.ts` (POST+GET; payment-gated; ridechecker assignment-scoped)
- QC gate: `app/api/admin/orders/[orderId]/deliver-report/route.ts` — blocks delivery if seller_type=private_party and no `vehicle_title_transfer_checks` row
- Inspect wizard: `app/ridechecker/(portal)/jobs/[assignmentId]/inspect/page.tsx` — after `title_paperwork` step (index 2), if seller_type=private_party, shows `TitleTransferInterstitial` modal before advancing; sellerType loaded from `/api/ridechecker/jobs/[id]/detail` via `d.order.seller_type`
- Ops order detail: `app/(ops)/operations/orders/[orderId]/page.tsx` — seller type badge in header; `TitleTransferCard` component (inline) after RiskFlagsPanel; fetches from GET API
- PDF: `lib/report/pdf-template.tsx` — `TitleTransferReadinessSection` inserted after TitleHistoryFlagsSection; reads `meta.title_transfer_readiness`
- Types: `lib/report/types.ts` — `TitleTransferReadinessSummary`, `ReportMeta.title_transfer_readiness`, `ReportMeta.seller_type`
- Booking: `app/(public)/book/page.tsx` step 0 — seller type selector (4 cards) added above listing source selector; state `sellerType` defaults to `private_party`; passed to orders/create
- orders/create: `app/api/orders/create/route.ts` — `seller_type` in createOrderSchema + insertPayload

## How to apply
- Any new workflow that should differ by seller type: check `orders.seller_type`
- The `calculateTransferReadiness` function is `server-only` — never import on client
- TypeScript: casting `order` to `unknown as Record<string, unknown>` is needed to access dynamic fields like `seller_type` not in the Order type definition
