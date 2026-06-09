---
name: Seller Trust + Buyer Retention Workflow
description: 8-part workflow — seller trust message on RC accept, buyer retention on seller decline, transferable credit, transfer API, buyer UI, ops analytics.
---

## Key files
- `lib/notifications/send-preferred.ts` — routes to email/SMS/both based on `notification_preferences` field; `sendDirect(channel, dest, payload)` for explicit channel
- `lib/email/templates/seller-trust-confirmation.ts` — HTML + SMS for seller when RC accepts
- `lib/email/templates/buyer-retention.ts` — HTML + SMS for buyer when seller declines
- `app/api/ridechecker/jobs/[assignmentId]/accept/route.ts` — seller trust fires here (non-fatal void IIFE), guards: isPaid + seller_contact_status==="accepted" + RC=ridechecker_active; logs attempt_number:99 in seller_contact_attempts
- `app/api/admin/orders/[orderId]/seller-contact/outcome/route.ts` — buyer retention fires when outcome==="declined": creates transferable_order_credit, emits seller_refused_inspection order_event, sends preferred notification
- `app/api/buyer/orders/[orderId]/transfer/route.ts` — POST creates new order from credit; guards: declined + not completed + credit active + not expired
- `app/api/buyer/orders/[orderId]/credit/route.ts` — GET returns credit for buyer
- `app/api/ops/orders/[orderId]/seller-refusal-analytics/route.ts` — GET credit for ops
- `components/orders/BuyerRetentionBanner.tsx` — shown on buyer order detail when seller_contact_status==="declined"
- `components/orders/SellerRefusalAnalyticsCard.tsx` — shown in ops order detail sidebar when declined
- `app/(buyer)/orders/[orderId]/transfer/page.tsx` — transfer form UI

## Key patterns
- All supabase `supabaseAdmin.from(...).maybeSingle()` results must be cast `as any` to avoid `GenericStringError` TS errors. This is consistent throughout all new routes.
- Non-fatal side-effects use `void (async () => { try { ... } catch (err) { console.error(...) } })()` pattern.
- `transferable_order_credit` is brand new (migration 050). `ridecheck_credits` is a separate founding-supporter table — do not confuse them.
- Credit expires 365 days from creation. `status` values: active → used (on transfer) or expired or refunded.
- Transfer creates a NEW order with `payment_status: "paid"` (credit-backed), `ops_status: "new"`, same package/price as original. Ops sees it as a normal fresh order.

**Why:** Seller refusal is a conversion risk. This workflow retains the buyer by auto-creating a transferable credit and giving them a zero-friction path to inspect another vehicle.
