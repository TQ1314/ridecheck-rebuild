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
    inspector/jobs/   - Inspector job list + detail + status updates
    inspector/jobs/[orderId]/upload/ - Report file upload (Supabase Storage)
    inspector/profile/ - Inspector profile
    invites/[token]/  - Invite validation + acceptance
    qa/review/        - QA review queue + detail + approve/revision
components/
  layout/             - Navbar, Footer, AppShell (with role-based nav for inspector/qa)
  orders/             - OrderTable, OrderDetailPanel, StatusUpdateDialog, AssignOpsDialog
  ui/                 - shadcn/ui components
lib/
  supabase/           - Client, server, admin, middleware Supabase clients
  stripe/             - Server and client Stripe instances
  email/              - Resend + email templates
  sms/                - Twilio SMS
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

## Packages (Updated v2)
- Standard: $119 concierge / $113 buyer-arranged (5% discount)
- Plus (Euro/EV/HD): $149 concierge / $142 buyer-arranged
- Premium: $179 concierge / $170 buyer-arranged
- Comprehensive: $299+ concierge / $284 buyer-arranged

## Feature Flags (default OFF)
- NEXT_PUBLIC_FEATURE_BUYER_ARRANGED - Enables buyer-arranged booking option
- NEXT_PUBLIC_FEATURE_BILL_OF_SALE - Enables bill of sale template
- NEXT_PUBLIC_FEATURE_INTELLIGENCE_REPORT - Enables intelligence report templates
- NEXT_PUBLIC_FEATURE_PAYMENT_HOLD - Enables payment hold/escrow functionality

## Roles
- customer, operations, operations_lead, inspector, qa, developer, platform, owner, ridechecker, ridechecker_active
- Inspector role called "RideChecker" in UI; no direct buyer contact allowed
- ridechecker = pending approval applicant, ridechecker_active = approved professional
- operations_lead can manage users (invite, role changes) in addition to owner

## Database (Supabase)
Tables: profiles, orders, activity_log, health_pings, intelligence_reports, title_ownership_review, bill_of_sale_documents, inspectors, order_events, audit_log, role_definitions, user_invites, ridechecker_earnings, referral_codes, referrals
Migration SQL in /supabase/migrations/ (run manually):
- 001_add_upgrade_columns.sql - Initial schema upgrades
- 002_ops_engine.sql - Ops engine: new order columns, inspectors table, order_events table, audit_log table
- 003_phases_5_9.sql - Role definitions table, user_invites table, order report columns (report_status, qa_status, inspector_status, report_storage_path, etc.)
- 004_ridechecker_features.sql - ridechecker_earnings, referral_codes, referrals tables + profile columns (service_area, experience, referral_code, rating, approval tracking)

## Report Workflow
1. Inspector completes assessment -> inspector_status = "completed", report_status = "pending_upload"
2. Inspector uploads report file -> report_status = "uploaded", file stored in Supabase Storage (reports bucket)
3. QA reviewer reviews report -> qa_status = "approved" or "revision_needed"
4. If approved -> report_status = "approved"
5. Admin delivers report -> sends email with signed URL, report_status = "delivered"

## Inspector Portal
- Route: /inspector (requires inspector or owner role)
- Dashboard shows assigned jobs with stats (active, needing upload, completed)
- Job detail page: vehicle info, schedule, location, status updates, report upload
- Inspector statuses: en_route, on_site, inspecting, wrapping_up, completed
- Report upload supports PDF, DOCX, JPEG, PNG, WebP (max 50MB)
- No buyer contact info shown to inspectors

## QA Portal
- Route: /qa/review (requires qa or owner role)
- Review queue shows reports pending review, needing revision, and approved
- Detail page: vehicle info, report download link (signed URL), approve/revision decision
- QA notes sent back to inspector when revision needed

## User Invite System
- operations_lead and owner can create invites from admin users page
- Invites generate a unique token URL valid for 7 days
- Accept page: /invite/[token] (public, no auth required)
- On acceptance: creates auth user + profile with invited role
- If role is inspector, also creates inspectors table entry
- Used invites are marked and cannot be reused

## Key Decisions
- Using Supabase for auth, NOT local auth
- Route groups for layout organization
- Idempotency keys for order creation
- Stripe Checkout (not Elements) for payment
- Middleware handles auth + RBAC
- EN/ES language support on booking + confirmation pages
- Auto-detect package tier from vehicle make/model (getPackageTier)
- Platform detection from listing URL (detectListingPlatform)
- All new features behind feature flags (default OFF)
- No "guarantee" language - use "review/screening/flags/observed at time of inspection"
- Reports stored in Supabase Storage "reports" bucket
- Signed URLs for report access (1hr for QA, 7 days for delivery)

## Recent Changes (Feb 2026)
- Phase 1: Upgraded from "inspection" to "intelligence" positioning across ALL pages, emails, and templates
- Updated copy: Navbar, Footer, landing page stats, register page, dashboard, orders pages, email templates
- Added /order/confirmation to middleware PUBLIC_ROUTES
- Health/supabase endpoint now reports connectivity: true when table is missing but Supabase is reachable
- Added Plus package tier for Euro/EV/heavy-duty vehicles
- Added buyer-arranged booking flow (behind feature flag)
- Added EN/ES language toggle on booking + confirmation
- Added intelligence report + bill of sale templates (behind flags)
- Added health check endpoints (/api/health/app, /api/health/supabase)
- Added listing URL platform detection
- Added auto-tier suggestion based on vehicle make/model
- Created migration SQL for new DB columns and tables
- All changes are backward-compatible with existing Concierge flow
- Phase 2 (Ops Engine B):
  - Migration 002_ops_engine.sql: new order tracking columns, inspectors/order_events/audit_log tables
  - RBAC helper (lib/rbac.ts) for server-side session + role validation with audit trail
  - Admin API routes: FIFO queue, order detail with events/audit, ops status updates, seller contact logging, payment requests, inspector CRUD, audit log viewer
  - 5 admin UI pages: dashboard stats, FIFO queue with SLA badges/filters, order detail with timeline/actions, inspector management, audit log viewer
  - Middleware updated: operations/operations_lead roles access /admin pages
  - SLA badge logic: Stale (>2hr new), Seller Lag (3+ attempts), Payment Lag (>6hr), Overdue (past scheduled)
  - FIFO ordering: ops_priority DESC, created_at ASC
  - PAYMENT_HOLD feature flag added
  - All admin actions logged to both audit_log and order_events
- Auth flow fixes (Feb 2026):
  - Server-side registration API (/api/auth/register) creates auth user + profile with role='customer'
  - Profile auto-creation via secured /api/auth/ensure-profile (uses SESSION_SECRET for internal auth)
  - Middleware auto-creates missing profiles on login via ensure-profile API
  - Password visibility toggle on login, register, and reset-password pages
  - Forgot password flow (/auth/forgot-password) and reset password flow (/auth/reset-password)
  - Security: No user can self-assign admin/operations roles; all signups hardcode role='customer'
- Phase 5-9 (Inspector/QA/Reports):
  - Migration 003_phases_5_9.sql: role_definitions, user_invites tables, report workflow columns on orders
  - Inspector role added system-wide (called "RideChecker" in UI)
  - User invite system: create invites, acceptance page, token-based onboarding
  - Inspector portal: /inspector with job list, detail, status updates, report upload
  - QA review portal: /qa/review with queue, detail, approve/revision workflow
  - Report delivery API: /api/admin/orders/[orderId]/deliver-report with email notification
  - Admin order detail: Deliver Report button + report status badge
  - AppShell nav updated for inspector and qa roles
  - Middleware updated: /invite/[token] routes are public, /inspector and /qa routes protected
- Phase 10 (RideChecker Features - Feb 2026):
  - Migration 004_ridechecker_features.sql: ridechecker_earnings, referral_codes, referrals tables + profile columns
  - RideChecker signup (/ridechecker/signup) with referral code input (?ref= URL param support)
  - RideChecker registration API (/api/ridechecker/register) creates user with role='ridechecker' (pending approval)
  - Approval Flow: Admin API (/api/admin/ridecheckers) to list, approve, reject ridechecker applications with email notification via Resend
  - Admin RideCheckers page (/admin/ridecheckers) with approval/rejection UI
  - Assignment Engine: /api/admin/ridecheckers/suggest ranks active ridecheckers by service area match (+50), rating (+5/pt), workload (-10/job)
  - Assignment integrated into admin order detail page
  - Earnings System: auto-generated earnings when QA approves reports; pay rates: standard $55, plus $70, premium $85, comprehensive $140
  - Earnings API (/api/ridechecker/earnings) returns summary (totalEarned, pendingPayout, paidOut)
  - Referral Engine: auto-generated codes (RC-[NAME4]-[RANDOM6]), 3-jobs-in-30-days qualification, $100 rewards
  - Referral API (/api/ridechecker/referrals) returns code + stats
  - RideChecker dashboard (/ridechecker/dashboard) with job stats, earnings widgets, referral section
  - RideChecker portal routes: /ridechecker/dashboard, /ridechecker/jobs, /ridechecker/signup
  - Middleware updated: /ridechecker routes protected for ridechecker/ridechecker_active roles, /ridechecker/signup is public
