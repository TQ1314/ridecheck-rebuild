---
name: Payment-first order policy
description: Why a stored RideCheck customer request must remain separate from paid fulfillment
---

A customer request may be stored before payment so the buyer has a link to complete Checkout, but its existence, seller details, Ops visibility, and pending-request email do not authorize seller outreach, dispatch, or inspection. Only verified server-side payment or a separately authenticated, audited Ops override activates work.

**Why:** A real unpaid Concierge request appeared as a new Ops order and received a creation email, leading the buyer to believe seller coordination would begin. Neither the record nor the email proved Stripe payment. The historical reason payment did not complete remains unverified.

**How to apply:** Treat all entry points, including older inspector routes, alternate Checkout creators, Ops status edits, and customer-facing copy as part of the payment boundary. Keep pending creation and payment-success notifications distinct; never infer paid from a browser redirect or an order row alone. Do not mutate historical incidents when investigating them.

Stripe test mode alone does not isolate order data. Confirm the app's development Supabase target is a safe test database or branch before creating test orders: in the payment-first verification investigation the development app resolved to the main RideCheck Supabase project, so a test-mode charge could still produce a record alongside production data.