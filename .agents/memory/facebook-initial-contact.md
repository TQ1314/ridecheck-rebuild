---
name: Facebook Marketplace initial seller contact
description: Buyer initiation, optional seller details, consent evidence, and coordination/payment boundaries.
---

Facebook Marketplace initial Messenger contact must be initiated by the buyer, not advertised as RideCheck Concierge initiating it. Meta messaging restrictions are a product constraint, not merely a missing integration.

**Why:** The user stated that business APIs cannot initiate the seller conversation in this Marketplace workflow.

**How to apply:** Detect Facebook Marketplace, select the existing Self-Arrange service, and block Concierge. Phase 1 requires the existing preferred date only; do not add a requested-time field or a new buyer-facing form. Use universal checkout before seller contact. Provide the appointment-proposal message, requested date, original listing, and instruction to reply with confirmed date, time, and vehicle address through existing confirmation communications. The buyer sends the seller message through Messenger. Reuse existing Self-Arrange fulfillment; do not add a speculative Meta/Muse integration or a second messaging system.

Buyer-reported agreement is not independently confirmed seller consent, an appointment, or verified date/time/location.

**Why:** The user expressly required these states to stay separate, so a buyer action cannot fabricate confirmation.

**How to apply:** Keep the source and reported actions as evidence in existing audit/order events; rely on the existing seller, scheduling, payment, and inspection lifecycles for authoritative states. Never add a Facebook-specific inspection-completed flag.

Payment plus a buyer-requested date is not seller confirmation or dispatch readiness for Facebook Self-Arrange. Payment eligibility, seller contact confirmation, and non-blank confirmed inspection date, confirmed inspection time, and vehicle/inspection address must all pass before individual assignment or broadcast.

**Why:** The user explicitly required: "PAID + REQUESTED ≠ CONFIRMED. NO DISPATCH UNTIL SELLER CONFIRMS."

**How to apply:** Phase 1 explicitly authorizes narrowly adding this Facebook-only dispatch guard using the existing Ops seller-confirm mechanism and fields. Return an Ops error identifying the missing appointment field and show awaiting seller confirmation until all appointment conditions pass. Do not change non-Facebook dispatch gating, add a status, or alter historical records. Do not add stalled-order automation or reminders. Preserve existing rescheduling, credit/transfer and decline handling.

Facebook Marketplace uses the existing Self-Arrange service, with no Concierge handoff and no Facebook-specific pricing, discounts, payment, checkout, refunds, assignment, or inspection lifecycle.

**Why:** The user explicitly superseded the earlier Concierge coordination approach with existing Self-Arrange routing and required everything else to remain unchanged.

**How to apply:** Preserve normal Self-Arrange behavior, universal payments, non-Facebook choices, and historical orders. Seller details must not convert Facebook Self-Arrange to Concierge or trigger automated seller outreach. Preserve non-Facebook pre-payment requirements; do not create a status/queue or invent financial policy. Promise another-vehicle use only when existing credit/transfer handling actually supports it.

Optional Facebook enrichment must not prevent the buyer's standard payment confirmation from being sent.

**Why:** The user explicitly required standard confirmation delivery plus an Ops-investigable failure log when enrichment fails, rather than skipping confirmation.

**How to apply:** Preserve the standard confirmation as the fallback and log the enrichment failure. Verify notification content through the actual workflow caller, not just a helper; isolated helper tests can pass while another email path bypasses enrichment.

Facebook routing work must stay within the approved routing, existing pricing/checkout, buyer instructions, and confirmed-appointment dispatch outcomes.

**Why:** The user explicitly required: "No architecture cleanup. No new services. No database work. No new statuses. No additional workflow development."

**How to apply:** Make only the smallest necessary correction. List unrelated findings as backlog rather than investigating or fixing them as part of this ticket. Do not deploy this ticket.