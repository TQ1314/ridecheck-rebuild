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

## Packages (Updated v2)
- Standard: $119 concierge / $113 buyer-arranged (5% discount)
- Plus (Euro/EV/HD): $149 concierge / $142 buyer-arranged
- Premium: $179 concierge / $170 buyer-arranged
- Comprehensive: $299+ concierge / $284 buyer-arranged

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
