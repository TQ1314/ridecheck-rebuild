# Facebook Marketplace initial seller contact — completion report

## What changed

- Marketplace URLs are recognized by their Facebook host and `/marketplace` path. Ordinary Facebook profiles, groups, dealer posts, unrelated URLs, and look-alike hosts do not trigger this workflow. Explicit Marketplace source selection works when no listing URL is supplied; a supplied URL takes precedence.
- The public booking wizard replaces the ordinary initial-contact choices for Marketplace with the approved explanation, exact seller message, **Copy Seller Message**, **Open Facebook Listing**, and **Seller Agreed — Continue**.
- Clipboard success and failure are handled separately. The listing opens through a safe new-tab link; opening it does not send a message.
- A buyer can report agreement and proceed without seller name, phone, email, inspection address, date, or time. Those details can be supplied optionally.
- Reported agreement and optional details survive back navigation and are scoped to the listing in tab session storage. Different listings do not inherit consent.
- Marketplace continues at Concierge pricing: the buyer initiates Messenger, while RideCheck still performs subsequent coordination. The server validates this contract.
- Real-time actions are recorded through the existing audit infrastructure and signed intake session. At creation, buyer-reported handoff evidence is appended to the existing order timeline and linked to the intake session.
- Ops sees buyer-reported agreement, copied-message state, missing-contact guidance, and an explicit warning if agreement history could not be loaded.
- Existing payment-gated contact attempts, actual outbound sends, and seller outcomes can record the start of coordination for these new handoffs. They do not activate unpaid requests.
- Confirmation pages and the initial confirmation email distinguish buyer initiation from subsequent RideCheck coordination.

## What did not change

- Non-Facebook initial-contact choices, dealership and roadside flows, and the existing self-arranged discount.
- Vehicle classification, package pricing, pilot service-area rules, payment amount/linkage validation, or payment-first fulfillment activation.
- Authentication, authorization roles, seller reply capture, communications providers, assignment/compensation, the inspection wizard, QA, report generation, and report delivery.
- Historical order records. No historical backfill, rewrite, deletion, or destructive migration occurred.
- Authoritative seller confirmation, scheduled appointment fields, and inspection completion. Buyer-reported agreement never sets them automatically.
- No Facebook-specific inspection-completed state, duplicate messaging system, or speculative Meta/Muse integration was added.

## Files added

### Application

- `lib/seller-contact/facebook-marketplace.ts`
- `lib/seller-contact/facebook-coordination.server.ts`
- `components/booking/FacebookSellerContact.tsx`
- `app/api/booking-intake/seller-contact-events/route.ts`

### Regression tests

- `lib/seller-contact/__tests__/facebook-marketplace.test.ts`
- `lib/seller-contact/__tests__/facebook-coordination.test.ts`
- `app/api/booking-intake/seller-contact-events/__tests__/route.test.ts`
- `app/api/orders/create/__tests__/facebook-route.test.ts`

### Documentation and local verification

- `docs/facebook-marketplace-contact-report.md`
- `.agents/memory/facebook-initial-contact.md` — durable product-policy notes.
- `.local/tests/facebook-booking-smoke.cjs` — local Chromium smoke helper; all API traffic mocked, not an application route.

## Files modified

- `app/(public)/book/page.tsx`
- `app/(public)/order/confirmation/page.tsx`
- `app/(public)/order/received/page.tsx`
- `app/api/orders/create/contract.ts`
- `app/api/orders/create/route.ts`
- `app/api/orders/[orderId]/public-status/route.ts`
- `app/api/admin/orders/[orderId]/seller-contact/route.ts`
- `app/api/admin/orders/[orderId]/seller-contact/attempt/route.ts`
- `app/api/admin/orders/[orderId]/seller-contact/send/route.ts`
- `app/api/admin/orders/[orderId]/seller-contact/outcome/route.ts`
- `components/orders/SellerContactPanel.tsx`
- `lib/seller-contact/platforms.ts`
- `lib/order-journey.ts`
- `lib/email/templates/order-confirmation.ts`
- `lib/email/templates/__tests__/order-confirmation.test.ts`
- `lib/rbac.ts` — additive nullable guest actors and opt-in audit error propagation; existing callers keep their behavior.
- `.agents/memory/MEMORY.md` — policy-note index.
- `tsconfig.tsbuildinfo` — generated incremental-check cache refreshed by TypeScript; not runtime logic.

## Database changes

**No new database migration was created or applied. No new table or column was added. No migration needs to be manually run for this feature.**

The implementation uses the application's existing schema. Newly submitted Marketplace bookings will append audit/timeline evidence during normal use, but tests did not create real orders or audit records.

## Existing fields and tables reused

- `orders`: `listing_url`, `listing_source`, `platform_source`, `booking_type`, `booking_method`, `seller_name`, `seller_phone`, `seller_email`, `inspection_address`, `preferred_date`, `seller_available_date`, and `seller_available_time`.
- Existing unpaid request, payment, seller-contact, scheduling, assignment, and inspection fields remain authoritative.
- `order_events`: reported agreement, handoff action snapshots, and coordination-start evidence.
- `audit_log`: pre-booking actions and intake-to-order correlation.
- Existing signed intake cookie/session: correlation before an order exists.
- Existing `seller_contact_attempts` and seller-contact routes remain the contact/coordinator workflow.

Optional seller details are checked against available existing columns. Supplied data is not silently discarded when storage is unavailable.

## Audit / analytics events added

- `facebook_marketplace_detected`
- `facebook_concierge_initial_contact_unavailable`
- `seller_message_displayed`
- `seller_message_copied`
- `facebook_listing_opened`
- `seller_consent_reported`
- `seller_contact_details_provided`
- `seller_coordination_started`
- `facebook_seller_contact_handoff` — intake-to-order audit correlation.

Evidence includes `source = facebook_marketplace`, the initial-contact reason `meta_messaging_restriction`, timestamps, available actors, reported action flags, and `independently_confirmed = false` for buyer-reported evidence. No separate analytics database or platform integration was introduced.

## Tests performed

### Automated regressions

**31 test files, 188 tests passed.** Coverage includes the new Marketplace detection/contract/audit/creation/coordination tests and the existing booking, journey, pricing, payment-safety, assignment, inspection-payment-gate, intake, and report-related regression suites.

`npx tsc --noEmit --incremental false --pretty false` passed. `git diff --check` passed.

### Mocked browser checks

- Detected a submitted Marketplace URL and replaced ordinary booking choices.
- Verified the exact approved seller message, clipboard success, clipboard failure, and post-copy guidance.
- Verified the original listing URL and `noopener noreferrer` new-tab attributes; prevented outbound Facebook navigation.
- Reported agreement, continued with no seller phone/email/address, and submitted the existing booking flow with a mocked creation endpoint.
- Captured optional name, phone, email, address, date, and time in the submitted existing fields.
- Verified session restoration and consent reset for a different listing.
- Verified normal choices for Craigslist, dealership, roadside, and an ordinary Facebook profile URL.
- Verified explicit Marketplace selection without a URL, and audit failure/retry.
- Checked a 390px mobile viewport with no horizontal overflow.
- Verified confirmation language distinguishes a report from an independently confirmed appointment.

The browser run intercepted every API request: **10 mocked audit requests and 2 mocked order submissions**. No real booking, payment, outbound email/SMS, Facebook conversation, or audit write was performed by these checks.

The running booking page was also inspected through the application preview.

## Risks identified / verification limits

- Signed-in Ops rendering was not verified in a real authenticated browser session. Its handoff data path and event behavior were checked through code, type checking, and mocked regressions.
- Live Supabase schema and actual audit persistence were not verified against production in this run. Database identity must be established through a non-disclosing approved workflow before any live schema operation.
- Missing seller contact details intentionally leave coordination pending; Ops must obtain them through the buyer's existing Messenger conversation before direct outreach.
- Auditing is append-only. Real-time actions and creation snapshots are separate evidence points; retries or concurrent coordination actions can produce repeated audit entries. Business confirmation is not derived from event counts.
- A database failure after an order is created can prevent its timeline snapshot from saving. The booking response exposes an explicit warning rather than claiming agreement was saved. Pre-creation checks catch missing event storage and missing supplied-detail columns.
- Tab session storage is browser-local, not cross-device evidence or a seller verification mechanism. Server order/timeline evidence becomes authoritative for the report once saved.

## Any one-time setup required

**No new integration, dependency, secret, cron job, or feature-specific schema setup is required.**

The existing application schema must already support the reused audit/order-event infrastructure and the seller columns listed above. If an installation lacks existing schema upgrades, verify the database target and use the project's established migration process; do not create a competing Facebook schema.

The project was not published or deployed during this work.