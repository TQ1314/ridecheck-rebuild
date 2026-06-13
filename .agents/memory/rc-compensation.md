---
name: RC Compensation Workflow
description: Standardized pre-assignment RideChecker offer system — calculation, save, override, surge, audit trail.
---

## Architecture

**Table:** `rc_compensation_offers` (migration 056)
- One row per calculated offer per order; versioned (v1, v2, …)
- `is_current=true` on active row; previous rows set to `is_current=false` when a new offer is saved
- `pay_status` lifecycle: `draft` → `saved` → `override_requested` → `override_approved` → `assigned`
- Stores calculation inputs (package_type, distance_miles, is_same_day, is_rush) for auditability

**Calc library:** `lib/compensation/calcOffer.ts`
- Offer rates (NOT payout rates): standard=$45, plus=$55, premium=$65, exotic=0/manual
- Distance bonus: 0-10mi=$0, 11-20mi=$5, 21-30mi=$10, 31-40mi=$15, 40+mi=requires_ops_lead flag
- Same-day: +$10. Rush (<4hrs): +$15. Rush supersedes same-day (no double-count).
- Returns `requiresOpsLead` flag and `isManualReview` flag for exotic/comprehensive

**Why separate from lib/payout/calcPayout.ts:** calcPayout is for post-inspection payouts (different rates: $50/$65/$80/$130). calcOffer is for pre-assignment offers to attract RideCheckers. Never merge these.

**API:** `GET/POST /api/ops/orders/[orderId]/compensation`
- GET: returns `current` (is_current=true) + `history` (last 10 by version)
- POST actions: `calculate` (preview, no DB), `save`, `request_override`, `approve_override`, `reject_override`, `add_surge`
- On `save`: marks old is_current=false, inserts new row, updates `orders.base_pay` and `orders.current_offer` so existing ridechecker-assign gate continues to work without any changes
- `approve_override` and `add_surge` are ops_lead/admin/owner only
- All actions emit `writeOrderEvent` + `writeAuditLog`; use `oldValue` not `previousValue` for writeAuditLog

**UI:** `components/orders/RideCheckerCompensationPanel.tsx`
- Placed above `RideCheckerAssignmentPanel` in `/operations/orders/[orderId]/page.tsx`
- id="rc-compensation-panel" for scroll targeting
- `highlighted` prop triggers 3s amber ring pulse (wired from ops order page)
- Role-aware: surge + approve/reject only shown to ops_lead roles

**Assignment gate integration:**
- `RideCheckerAssignmentPanel` got `onNoPay?: () => void` prop (additive, backward compatible)
- When API returns 400 with "pay rate must be set" error, calls `onNoPay()` which scrolls to + highlights the compensation panel
- Existing ridechecker-assign route is NOT modified

**IMPORTANT:** Run migration 056 in Supabase SQL Editor before using the panel in production.
