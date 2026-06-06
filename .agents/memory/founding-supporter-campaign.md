---
name: Founding Supporter Campaign
description: Architecture decisions for the isolated founding supporter campaign feature (migration 044, ridecheck_credits, webhook branch, public routes).
---

## Key decisions

**Webhook routing:** The existing single webhook at `/api/webhooks/stripe/route.ts` handles all Stripe events. Founding supporter sessions are identified by `metadata.session_type === "founding_supporter"` and branched at the TOP of the `checkout.session.completed` handler — before the `order_id` check — with an early return. This preserves full isolation from the order flow.

**Why:** Adding a separate webhook endpoint would require a second Stripe webhook registration in the dashboard. Branching on metadata keeps a single endpoint and matches the existing pattern.

**Credit code format:** `RC-T1-YYYY-XXXXXX` / `RC-T2-YYYY-XXXXXX` / `RC-T3-YYYY-XXXXXX`. T1=backer, T2=believer, T3=founding_partner. Random chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I, O, 0, 1).

**Status values:** `active`, `redeemed`, `expired` — no "used".

**Idempotency:** `handleFoundingSupporter` checks for existing row by `stripe_session_id` before inserting. Safe for Stripe retries.

**Success page polling:** `/founding-supporters/success` polls `/api/founding/session/[sessionId]` up to 8× at 2s intervals to handle webhook lag after Stripe redirect. Falls back to "check your email" state gracefully.

**Middleware:** Three new public routes must stay in `PUBLIC_ROUTES` in `middleware.ts`: `/founding-supporters`, `/founding-supporters/success`, `/founding-partners`.

**Schema cache:** After running migration 044 via psql, PostgREST schema cache needed `NOTIFY pgrst, 'reload schema'` to pick up the new table immediately.

## Files created (Phase 1)
- `supabase/migrations/044_founding_supporters.sql`
- `lib/founding/credit-code.ts` — generateCreditCode(), TIER_CONFIG
- `lib/email/founding-supporter.ts` — buildSupporterConfirmationEmail(), buildGiftRecipientEmail()
- `app/api/founding/create-session/route.ts`
- `app/api/founding/stats/route.ts`
- `app/api/founding/partners/route.ts`
- `app/api/founding/session/[sessionId]/route.ts`
- `app/api/admin/founding-supporters/route.ts`
- `app/api/admin/founding-supporters/export/route.ts`
- `app/(public)/founding-supporters/page.tsx`
- `app/(public)/founding-supporters/success/page.tsx`
- `app/(public)/founding-partners/page.tsx`
- `app/(admin)/admin/founding-supporters/page.tsx`

## Files modified
- `app/api/webhooks/stripe/route.ts` — added imports + handleFoundingSupporter() + branch
- `middleware.ts` — added 3 routes to PUBLIC_ROUTES

## Phase 2 (not yet built)
- Credit redemption in booking flow (enter code at checkout, apply discount)
