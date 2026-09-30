# RideCheck staging payment-path database

This is a **focused SQL setup plan** for a new, empty RideCheck-Staging Supabase
project. It supports the current order-booking and payment path:

`order create → /pay validate → accept terms → Stripe Checkout → Stripe webhook → ops status activation → payment gate`

It is not a full application schema. It deliberately creates no orders, users,
fixtures, payment records, or other production data. Do not run this against
production or a database containing data.

## Apply in this exact order

Run each file individually in the Supabase SQL Editor, waiting for success
before continuing:

1. `supabase/migrations/000_base_schema.sql`
2. `supabase/migrations/005_payment_link_columns.sql`
3. `supabase/migrations/007_service_area.sql`
4. `supabase/migrations/011_legal_protection.sql`
5. `supabase/migrations/018_legal_enhancement.sql`
6. `supabase/migrations/026_listing_source.sql`
7. `supabase/migrations/027_platform_source.sql`
8. `supabase/migrations/040_payment_gate.sql`
9. `supabase/migrations/042_seller_type.sql`
10. `supabase/migrations/046_stripe_payment_columns.sql`
11. `supabase/migrations/062_order_intake_provenance.sql`
12. `supabase/migrations/063_order_listing_claimed_vin.sql`
13. `supabase/staging/001_payment_path_compat.sql`
14. `supabase/staging/002_synthetic_ops_fixture.sql` (synthetic recipient only)

The selected numbered migrations are additive. The staging compatibility
migration supplies the current booking/ops columns not covered by that subset
and tightens the base profile RLS policy. `000_base_schema.sql` itself creates
some legacy/base tables beyond this flow; they are retained because it is the
project's existing fresh-database bootstrap, not recreated here. No storage
buckets or storage policies are needed for this path.

## Why these dependencies

- `000_base_schema.sql` supplies `profiles`, `orders`, `activity_log`, audit
  logging, buyer-own-order read RLS, and the auth profile trigger.
- `005_payment_link_columns.sql` supplies the payment-link click metadata and
  legacy Stripe Checkout session field read/written by the pay routes.
- `007_service_area.sql`, `026_listing_source.sql`, `027_platform_source.sql`,
  and `042_seller_type.sql` cover fields unconditionally inserted by current
  order creation.
- `011_legal_protection.sql` and `018_legal_enhancement.sql` supply the terms
  ledger and all current terms/checkbox columns.
- `040_payment_gate.sql` supplies the payment-required/override columns read
  by payment-gated operations routes.
- `046_stripe_payment_columns.sql` supplies canonical Checkout Session and
  PaymentIntent linkage used by Checkout/webhook validation.
- `062` and `063` support optional intake provenance and claimed-VIN booking
  submissions. No intake-storage bucket is included: it is not used in the
  booking-to-payment path.
- `001_payment_path_compat.sql` adds optional booking intake columns used by
  the current order contract and `ops_status`, which the webhook sets to
  `contact_seller` (concierge) or `payment_received` (self-arranged).

The payment webhook's durable activation event uses the base `activity_log`.
The payment gate itself is application logic; the database columns it checks
are supplied by migration 040. This setup does not install the broader ops,
assignment, inspection, reporting, or notification schema.

The only seed is a non-login Ops profile with a reserved `example.invalid`
address and a reserved 555 phone number. Synthetic buyer and seller details
belong to the later approved booking test; no order or Auth user is seeded here.
An authenticated Ops account for an override test must be created later,
without triggering an external Auth email, after staging is separately secured.

## Migration gap 049–054

Do **not** fill the gap by applying `FULL_SETUP.sql` or
`PENDING_RUN_ALL.sql`. The repository has no standalone migration files
049–054. The `PENDING_RUN_ALL.sql` bundle contains sections labelled 049–052
(buyer notification/service radius, seller-trust/transferable credit, seller
message delivery tracking, and report delivery safety); no 053 or 054 section
is present there. These capabilities are outside this payment path and are
not dependencies of the listed routes/migrations. None of 049–054 is run here.

## RLS and access boundary

- `orders` retains the base policy permitting a signed-in buyer to read only
  their own order. No client insert/update/delete policy is added.
- `profiles` retains own-profile reads, but the base own-row UPDATE policy is
  removed because it also permits changing privileged profile fields.
- `terms_acceptances`, `activity_log`, and `audit_log` have RLS enabled with
  no client-facing policy for the payment flow. Server routes must use the
  service role for writes.
- Never expose the service-role key in a browser or client bundle. Confirm
  RLS/policies in the staging project's dashboard after applying the scripts.

## Runtime configuration and limits

Create a **separate Replit project** by importing a code ZIP into a new
workspace. Do not remix this owner-owned app: remixing an app you own can copy
secret values. Do not transfer this running workspace or change its shared
secrets. Verify the imported workspace has no inherited credentials before
starting it; never include uploaded customer data, logs, caches, or `.env` files
in the import. The main app's existing workflow/preview remains unchanged.

Configure the new workspace, pointed only at RideCheck-Staging and Stripe
**test mode**:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: staging
  project values.
- `SUPABASE_SERVICE_ROLE_KEY`: staging project service-role key, server only.
- `STRIPE_SECRET_KEY`: Stripe test secret key; configure the test-mode webhook
  secret as `STRIPE_WEBHOOK_SECRET`. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must
  also belong to the same Stripe TEST account. Do not copy live keys.
- `NEXT_PUBLIC_APP_URL`: staging application origin, used to construct the pay
  and Checkout return URLs.
- `APP_ENV=staging`, `STAGING_NOTIFICATION_CAPTURE=true`, and
  `STAGING_SUPABASE_PROJECT_REF=mdbcdxmtbscapvnduxqu` are mandatory for the
  staging capture guard. Set `STAGING_NOTIFICATION_CAPTURE_FILE` to an absolute
  writable path in the separate staging workspace, with restricted access.
  Never copy production email/SMS keys or `ADMIN_EMAIL` into staging. Captured
  notification content is sensitive test data; rotate/delete the sink on cleanup.
- `ENABLE_STRIPE_TAX=false` for the focused baseline path. If enabled, Stripe
  must be configured for automatic tax and webhook amounts include tax.
- Keep `DEBUG_PAYMENT_LINKS=false`; the code only reveals payment URLs when
  explicitly enabled outside production.

Register the Stripe test webhook for the deployed webhook handler. The
payment-success path uses `checkout.session.completed`; the code also handles
PaymentIntent success and failure plus Checkout expiration/failure events.
Never use live Stripe keys or production webhook secrets in this project.
Confirm the configured TEST webhook destination is the separate staging
workspace's `/api/webhooks/stripe` and that its signing secret belongs to that
destination. Do not substitute the current development preview's domain.

Before a first booking, prove the running app's database URL resolves to
`mdbcdxmtbscapvnduxqu`, not the live project; the active Stripe secret and
publishable keys are TEST keys for the same account; the Stripe TEST webhook
destination and signing secret match; capture is active and its sink is
writable; and email, SMS, seller, and RideChecker outbound calls cannot reach
providers. Static unit tests alone do **not** prove these runtime gates. If
any assertion cannot be established, do not submit a booking or payment.

This is schema preparation only—not an end-to-end test, Stripe configuration,
operational runbook, or guarantee that all application routes work. It does
not execute SQL. Review each migration and the target project before manually
applying it.