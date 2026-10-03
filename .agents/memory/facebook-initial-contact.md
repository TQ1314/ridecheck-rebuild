---
name: Facebook Marketplace initial seller contact
description: Buyer initiation, optional seller details, consent evidence, and coordination/payment boundaries.
---

Facebook Marketplace initial Messenger contact must be initiated by the buyer, not advertised as RideCheck Concierge initiating it. Meta messaging restrictions are a product constraint, not merely a missing integration.

**Why:** The user stated that business APIs cannot initiate the seller conversation in this Marketplace workflow.

**How to apply:** Detect Facebook Marketplace, select the existing Self-Arrange service, and block Concierge. Use universal checkout before seller contact. After payment, provide the approved seller message and original listing; the buyer sends it through Messenger and returns confirmed date/time/location and available contact/access details. Reuse existing Self-Arrange fulfillment; do not add a speculative Meta/Muse integration or a second messaging system.

Buyer-reported agreement is not independently confirmed seller consent, an appointment, or verified date/time/location.

**Why:** The user expressly required these states to stay separate, so a buyer action cannot fabricate confirmation.

**How to apply:** Keep the source and reported actions as evidence in existing audit/order events; rely on the existing seller, scheduling, payment, and inspection lifecycles for authoritative states. Never add a Facebook-specific inspection-completed flag.

Facebook Marketplace uses the existing Self-Arrange service, with no Concierge handoff and no Facebook-specific pricing, discounts, payment, checkout, refunds, assignment, or inspection lifecycle.

**Why:** The user explicitly superseded the earlier Concierge coordination approach with existing Self-Arrange routing and required everything else to remain unchanged.

**How to apply:** Preserve normal Self-Arrange behavior, universal payments, non-Facebook choices, and historical orders. Seller details must not convert Facebook Self-Arrange to Concierge or trigger automated seller outreach. Stop rather than relaxing existing pre-payment requirements, creating a status/queue, or inventing financial policy; promise another-vehicle use only when existing credit/transfer handling actually supports it.