# RideCheck - Pre-Car-Purchase Intelligence Platform

## Overview
RideCheck is a production-grade pre-car-purchase intelligence platform built with Next.js 14 App Router. Buyers can book vehicle assessments with different packages and service tiers, receiving intelligence reports with risk screening data and observational findings.

## Tech Stack
- **Framework**: Next.js 14 (App Router) on port 5000
- **Database/Auth/Storage**: Supabase (external)
- **Payments**: Stripe (Checkout Sessions)
- **Email**: Resend
- **SMS**: Twilio
- **Styling**: Tailwind CSS + shadcn/ui components
- **Language**: TypeScript

## Project Structure
```
app/
  (public)/           - Public pages (landing, pricing, how-it-works, booking, confirmation)
  (buyer)/            - Authenticated customer pages (dashboard, orders, profile)
  (ops)/              - Operations staff pages (order management)
  (admin)/            - Admin/owner pages (dashboard, users, orders, settings)
  (inspector)/        - Inspector/RideChecker portal (jobs, job detail, report upload)
  (qa)/               - QA reviewer portal (review queue, review detail)
  auth/               - Login, register, callback
  invite/[token]/     - Invite acceptance page (public, no auth required)
  api/                - API route handlers
    orders/create/    - Order creation (supports concierge + buyer-arranged)
    orders/[orderId]/ - Status, assign, send-payment
    health/app/       - App health check
    health/supabase/  - Supabase connectivity + write test
    webhooks/stripe/  - Stripe webhook handler
    admin/users/      - User role/status management + invite creation
    admin/orders/     - FIFO queue + order detail with ops actions + deliver-report
    admin/inspectors/ - Inspector CRUD
    admin/audit/      - Audit log viewer
    admin/roles/      - Role definitions
    admin/orders/[orderId]/seller-contact/ - Seller contact attempts + outcome
    inspector/jobs/   - Inspector job list + detail + status updates
    inspector/jobs/[orderId]/upload/ - Report file upload (Supabase Storage)
    inspector/profile/ - Inspector profile
    invites/[token]/  - Invite validation + acceptance
    qa/review/        - QA review queue + detail + approve/revision workflow
    ridechecker/availability/ - RideChecker availability GET/POST
    ridechecker/jobs/[assignmentId]/accept|start|submit - Job lifecycle actions
    ops/orders/[orderId]/raw-submission - View raw submission data
    ops/orders/[orderId]/report/save|send - Report builder save/send
    ops/orders/[orderId]/approve-submission - Approve + score + payout
    ops/orders/[orderId]/reject-submission - Reject with reason
    ops/payouts/[assignmentId]/mark-paid - Manual payout release
components/
  layout/             - Navbar, Footer, AppShell (with role-based nav for inspector/qa)
  orders/             - OrderTable, OrderDetailPanel, StatusUpdateDialog, AssignOpsDialog, SellerContactPanel
  ui/                 - shadcn/ui components
lib/
  supabase/           - Client, server, admin, middleware Supabase clients
  stripe/             - Server and client Stripe instances
  email/              - Resend + email templates
  sms/                - Twilio SMS
  notifications/      - Canonical SMS (Twilio) and email (Resend) notification helpers
  seller-contact/     - Platform detection + message templates for seller outreach
  rbac.ts             - Server-side RBAC helper (session validation + audit trail)
  utils/              - Pricing, roles, formatting, orderId generation, featureFlags
  i18n/               - EN/ES translations
  templates/          - Intelligence report + bill of sale HTML templates
types/                - TypeScript type definitions (Order, Profile, UserInvite, etc.)
supabase/migrations/  - Migration SQL files (run manually in Supabase)
middleware.ts         - Auth and role-based route protection
```

## Booking Types
- **Concierge** (default): RideCheck contacts seller, customer pays after confirmation
- **Self-Arranged**: Customer arranges appointment with seller, pays immediately
- **Buyer-Arranged** (feature flag): Customer coordinates with seller, gets 5% discount. Behind NEXT_PUBLIC_FEATURE_BUYER_ARRANGED flag.

## Packages (v3 — Vehicle-Determined, Flat Pricing)
- Standard: $139
- Plus (Euro/EV/HD): $169
- Premium (Luxury/Flagship): $189
- Exotic: $299
- $1 Test: $1 (internal testing, visible on booking page, marks order as is_internal_test, $1 RideChecker payout)

## Feature Flags (default OFF)
- NEXT_PUBLIC_FEATURE_BUYER_ARRANGED - Enables buyer-arranged booking option
- NEXT_PUBLIC_FEATURE_BILL_OF_SALE - Enables bill of sale template
- NEXT_PUBLIC_FEATURE_INTELLIGENCE_REPORT - Enables intelligence report templates

## User Preferences
The user prefers clear and concise communication. They value iterative development and expect the AI to ask for confirmation before implementing significant changes. The AI should prioritize architectural discussions over minute implementation details and ensure all new features are initially behind feature flags.

## Key Architectural Decisions
- Supabase for auth (not NextAuth)
- Route groups for organization ((public), (buyer), (ops), (admin), (inspector), (qa))
- Idempotency keys on order creation
- Strict no-"guarantee" language in reports
- Feature flags for new features
- Profile auto-creation via secured /api/auth/ensure-profile (uses SESSION_SECRET for internal auth)
- Middleware auto-creates missing profiles on login
- Security: No user can self-assign admin/operations roles; all signups hardcode role='customer'

## Migration History
- 001-003: Core schema (orders, profiles, roles, invites, report workflow columns)
- 004_ridechecker_features.sql: ridechecker_earnings, referral_codes, referrals tables + profile columns
- 005_payment_link_columns.sql: payment_link_token, payment_link_sent_to/channel/at, stripe_session_id, payment_status, paid_at, base_price, final_price, discount_amount, tracking_token, click tracking columns
- 006_seller_contact_attempts.sql: seller_contact_attempts table + order columns (seller_platform, seller_contact_status, seller_outcome_notes, seller_email)
- 007_service_area.sql: service_zip, service_county, service_state columns on orders + indexes
- 008_ridechecker_submission_and_scoring.sql: ridechecker_availability, ridechecker_job_assignments, ridechecker_raw_submissions tables + profile scoring columns + orders ops report columns
- 009_internal_test_flow.sql: is_internal_test + test_run_id on orders, is_internal_test on ridechecker_earnings + ridechecker_job_assignments

## Feature Implementation History
- Phase 1-4: Core booking, auth, admin, ops
- Phase 5-9: Inspector/QA/Reports system, user invites, report delivery
- Phase 10 (RideChecker Features):
  - RideChecker signup, approval flow, assignment engine
  - Earnings system (auto-generated on QA approval)
  - Referral engine (RC-[NAME4]-[RANDOM6] codes, 3-jobs-in-30-days qualification, $100 rewards)
  - RideChecker dashboard with job stats, earnings, referral section
- SMS-First Payment Link System:
  - Order creation auto-sends payment link via SMS (primary) or email (fallback)
  - Token-gated /pay/[orderId] page with Stripe Checkout session creation
  - Production safety: token URLs never logged in production
  - DEBUG_PAYMENT_LINKS=true env var for dev testing
  - Notification helpers: lib/notifications/sms.ts, lib/notifications/email.ts
- Seller Contact Interface:
  - Migration 006: seller_contact_attempts table + order columns
  - Platform detection (lib/seller-contact/platforms.ts): Facebook, Craigslist, Dealer, Other
  - Channel-specific templates (lib/seller-contact/templates.ts): FB message, email, SMS, call script, buyer self-arranged
  - 3 admin API routes: GET attempts, POST attempt, POST outcome — role-protected
  - Concierge mode: 3-attempt policy enforced server-side before no_response
  - Self-arranged mode: Buyer Coordination tracker, no 3-attempt requirement
  - Facebook: manual messaging only (copy + paste), no automation
  - SellerContactPanel component in admin order detail page
  - Documentation: docs/seller-contact-workflow.md
- Pilot ZIP Restriction (Feb 2026):
  - Migration 007_service_area.sql: service_zip, service_county, service_state columns + indexes
  - ZIP allowlist (lib/geo/lakeCountyZips.ts): Lake, McHenry, Cook county ZIPs
  - County resolver (lib/geo/resolveCounty.ts): resolveCounty, getServiceAreaFromZip, checkPilotPhase
  - Pilot config: lake_cap=50, mchenry_cap=50, pilot_total_cap=200
  - Phase sequencing: Lake only → Lake+McHenry (after 50) → Lake+McHenry+Cook (after 100) → capacity (200)
  - API enforcement: service_zip required on order creation, 409 for blocked ZIPs
  - UI enforcement: ZIP field on booking step 1, disabled Next until valid Lake County ZIP
  - Global pilot banner on all public pages: "Now serving: Lake County, IL only"
  - Booking page banner: "Pilot Mode: Lake County, IL only"
  - Test documentation: docs/pilot-zip-test.md
- RideChecker Structured Submission & Ops Report Builder (Feb 2026):
  - Migration 008: ridechecker_availability, ridechecker_job_assignments, ridechecker_raw_submissions tables
  - Profile scoring columns: ridechecker_max_daily_jobs, ridechecker_rating, ridechecker_quality_score, ridechecker_on_time_pct, etc.
  - Orders ops columns: ops_report_url, ops_summary, ops_severity_overall, assigned_ridechecker_id, report_sent_at
  - RideChecker APIs: /api/ridechecker/availability (GET/POST), /api/ridechecker/jobs/[assignmentId]/accept|start|submit|decline|eta
  - Ops APIs: /api/ops/orders/[orderId]/raw-submission, report/save, report/send, approve-submission, reject-submission
  - Payout API: /api/ops/payouts/[assignmentId]/mark-paid
  - Scoring algorithm (lib/ridechecker/scoring.ts): 0-100 score per job (checklist 40pt, photos 20pt, text 20pt, timeliness 20pt)
  - Payout rates (lib/ridechecker/payouts.ts): standard=$50, plus=$65, premium=$80, comprehensive=$130
  - Dynamic payout calculator (lib/payout/calcPayout.ts): base + distance addon + urgency + multiplier
  - Enhanced RideChecker dashboard with tabs: Availability, My Jobs, Earnings, Kudos, Training
  - Dashboard features: Accept/Decline buttons, payout amount display, declined status badge
  - Structured raw data submission form: required photos, tread depth, brake condition, scan codes, 5 text sections
  - OpsReportBuilderPanel in admin order detail: raw submission viewer, severity/summary report builder, approve/reject, payout management
  - Privacy: RideCheckers never see buyer identity; buyers never see RideChecker identity
  - RideChecker max daily capacity: 5 jobs
- Internal $1 End-to-End Test Flow (Feb 2026):
  - Migration 009_internal_test_flow.sql: is_internal_test + test_run_id columns on orders, earnings, assignments
  - Admin-only "Run Internal $1 Test Flow" button on order detail page
  - Creates $1 Stripe Checkout session with is_internal_test metadata
  - Production blocked: API returns 403 if NODE_ENV === 'production'
  - Webhook sets payment_status = "paid_test" for test payments
  - Approve-submission forces payout_amount = $1.00 for test orders
  - Report delivery email prefixed with "[INTERNAL TEST]"
  - Documentation: docs/internal-test-flow.md
- Buyer Ownership & Payment Reconciliation Fix (Mar 2026):
  - Order creation now saves customer_id = authenticated user's Supabase ID (was always NULL)
  - Stripe webhook (app/api/webhooks/stripe/route.ts) backfills customer_id from profile if missing
  - Webhook logs: order_id, payment_intent, customer_email, update success/failure
  - Buyer dashboard queries by customer_id — now works for logged-in buyers
  - Stripe webhook URL is /api/webhooks/stripe (NOT /api/stripe/webhook)
  - activity_log tracks customer_id_backfilled boolean
- Operations Role Expansion & RideChecker Naming (Mar 2026):
  - Expanded operations role: can now assign RideCheckers (canAssignOps) and upload reports (canUploadReport)
  - Operations sidebar now includes: Dashboard, Order Queue, RideCheckers
  - Removed "Inspectors" nav item from all admin roles — consolidated to "RideCheckers" (points to /admin/inspectors page)
  - All admin UI text renamed from "Inspector" to "RideChecker": badges, toasts, table headers, management page
  - Removed duplicate "Assign Inspector" dialog — only "Assign RideChecker" dialog remains on order detail
  - Enhanced assignment modal: shows Active badge, phone, email, region, rating, jobs/capacity for each RideChecker
  - Suggest API returns max_daily_jobs for capacity display
  - Role permissions: operations can run full order lifecycle; operations_lead/owner for user mgmt, audit, settings
  - Backend tables still use inspectors/assigned_inspector_id internally — UI is fully rebranded
- RideChecker Data Unification (Mar 2026):
  - /api/admin/inspectors GET/POST now queries `profiles` table (role IN ridechecker, ridechecker_active) instead of old `inspectors` table
  - /api/admin/inspectors/[id] PATCH now updates `profiles` table — toggling is_active flips role between ridechecker/ridechecker_active
  - /api/admin/orders/[orderId] now looks up assigned RideChecker from `profiles` instead of `inspectors` table
  - Single data source: both management page and assignment modal now use `profiles` table
  - Order detail page shows RC preview summary: Active RideCheckers count, Available now count, Top match name
  - Users page: invite role default changed from "inspector" to "ridechecker"; role dropdown includes ridechecker/ridechecker_active
  - RideChecker login: use standard /auth/login page; signup at /ridechecker/signup; dashboard at /ridechecker/dashboard
  - To activate a RideChecker: set their role to ridechecker_active via Users page or click Active/Pending badge on RideCheckers management page
