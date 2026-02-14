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
  auth/               - Login, register, callback
  api/                - API route handlers
    orders/create/    - Order creation (supports concierge + buyer-arranged)
    orders/[orderId]/ - Status, assign, send-payment
    health/app/       - App health check
    health/supabase/  - Supabase connectivity + write test
    webhooks/stripe/  - Stripe webhook handler
    admin/users/      - User role/status management
    admin/orders/     - FIFO queue + order detail with ops actions
    admin/inspectors/ - Inspector CRUD
    admin/audit/      - Audit log viewer
components/
  layout/             - Navbar, Footer, AppShell
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
types/                - TypeScript type definitions
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
- customer, operations, operations_lead, qa, developer, platform, owner

## Database (Supabase)
Tables: profiles, orders, activity_log, health_pings, intelligence_reports, title_ownership_review, bill_of_sale_documents, inspectors, order_events, audit_log
Migration SQL in /supabase/migrations/ (run manually):
- 001_add_upgrade_columns.sql - Initial schema upgrades
- 002_ops_engine.sql - Ops engine: new order columns (ops_status, seller_contact_attempts, inspector assignments, timestamps), inspectors table, order_events table, audit_log table

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
