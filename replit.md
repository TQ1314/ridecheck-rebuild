# RideCheck - Pre-Car-Purchase Intelligence Platform

## Overview
RideCheck is a pre-car-purchase intelligence platform designed to empower buyers by offering vehicle assessments, various service packages, and comprehensive intelligence reports. These reports include risk screening data and observational findings. The platform aims to enhance buyer confidence and market transparency in the pre-owned vehicle market.

## User Preferences
The user prefers clear and concise communication. They value iterative development and expect the AI to ask for confirmation before implementing significant changes. The AI should prioritize architectural discussions over minute implementation details and ensure all new features are initially behind feature flags.

## System Architecture
The platform is built with Next.js 14 App Router and utilizes Supabase for authentication, database, and storage.

- **UI/UX**: Tailwind CSS and shadcn/ui components provide a modern interface. The application uses distinct route groups for role-based access control (public, buyer, operations, admin, inspector, QA).
- **Technical Implementations**:
    - **Proprietary Logic Protection**: Sensitive algorithms, AI prompts, scoring rules, and thresholds are server-only to protect intellectual property. Report generation APIs only return customer-safe outputs.
    - **Report Versioning**: Reports are versioned using `report_logic_version` (semver) to enable auditing and rollbacks.
    - **Database Management**: Supabase migrations manage the database schema, including core tables, triggers, and pending updates for new features.
    - **RideChecker Assignment Flow**: A comprehensive confirmation-based assignment lifecycle for RideCheckers, including acceptance, decline, and expiry mechanisms, with corresponding UI updates and audit trails.
    - **Manual Payment Verification**: Functionality for `owner` and `operations_lead` roles to manually verify payments with evidence when automated Stripe processes fail, including audit logging and UI indicators.
    - **RideChecker Payout System**: A full system for tracking payouts from calculation to approval and batch payment, with dedicated UI for operations.
    - **Ops Order Dashboard**: A comprehensive dashboard for operations to manage orders, including RideChecker assignment, broadcast offers, payment details, and report generation status.
    - **Vehicle Source Intelligence**: Integration of listing source, platform source, and vehicle seen location tracking into the order process, influencing booking form behavior and ops panel displays.
    - **Authentication & Authorization**: Supabase handles authentication, with middleware enforcing role-based access control (RBAC) and automatic profile creation.
    - **Idempotency**: Idempotency keys ensure reliable order creation.
    - **Feature Flags**: All new features are implemented behind feature flags for controlled release.
    - **Report Generation & Delivery**: A robust workflow for generating intelligence reports based on RideChecker submissions and an Ops Report Builder.
    - **RideChecker Dashboard** (`/ridechecker/dashboard`): Fully rebuilt dashboard with five tabs — Overview, My Jobs, Pay & Payouts, Availability, Training. "Action Required" section always renders at top when `awaiting_acceptance` assignments exist (live countdown + inline accept/decline). Active job flow cards shown before tabs. Overview tab: stats grid + earnings snapshot + quick links. Pay & Payouts tab: pulls from `ridechecker_payouts` table (not `ridechecker_earnings`), shows summary cards (total/pending/approved/paid) + full pay history table with status badges + referral program. My Jobs tab: partitioned by status (action required / active / past). Availability tab: 14-day calendar with add/edit slots. Training tab: unchanged. Auto-refresh (Refresh button). Powered by `/api/ridechecker/payouts` (new) and `/api/ridechecker/jobs`.
    - **Ops Dashboard** (`/operations`): Fully rebuilt from a minimal stat table into a production command center. Left column: 6-stat header row (Active Orders, Unassigned Paid, Awaiting RC, Active Inspections, Pending Review, Report Ready) + Order Queue table with computed "Next Action" column (color-coded by urgency: red=high, amber=medium, blue=low, gray=done), urgency filter dropdown, sortable by urgency then recency. Right sidebar: RC Availability Panel (all active RideCheckers grouped into Available/At Capacity/Unavailable with job slots display, auto-refreshes from `ridechecker_availability`), Payout Management Panel (pending/approved totals + direct link to full payouts page), Needs Assignment Panel (quick list of unassigned paid orders). Auto-refresh every 60 seconds. Powered by `/api/ops/dashboard` (new comprehensive API). Existing `/operations/orders`, `/operations/payouts` pages untouched.
    - **New APIs**: `GET /api/ops/dashboard` — single endpoint returning stats, order queue (with computed next_action/urgency), RC availability panel, payout summary; `GET /api/ridechecker/payouts` — RC-scoped payout history from `ridechecker_payouts` with bonus breakdown, vehicle labels, and summary totals.
    - **RideChecker Field Inspection Workflow**: An end-to-end mobile-optimized workflow for RideCheckers, covering job acceptance, inspection checklists, photo uploads to Supabase Storage, and communication with operations.
    - **Buyer Intelligence Blog**: An isolated blog module for content publishing, including file-based posts, SEO elements, and lead capture functionality.
    - **Legal Compliance**: Implementation of legal disclaimers, terms of service, and privacy policies with required acceptance checkboxes and versioning for auditability.
    - **Language Support**: Partial Spanish language support for public-facing content with locale-aware components.
- **Feature Specifications**:
    - **Booking Types**: Supports Concierge, Self-Arranged, and Buyer-Arranged bookings.
    - **Packages**: Vehicle-determined flat-rate pricing across multiple tiers (Basic, Plus, Exotic), with a classification engine and override capabilities for operations/admin.
    - **Concierge Workflow**: Includes a seller contact interface with platform detection and message templates.
    - **RideChecker Management**: Comprehensive management for RideCheckers, including signup, approval, assignment, earnings, and a dedicated portal.
    - **Quality Assurance**: A QA reviewer portal for managing and processing inspection report submissions.
    - **Payment System**: Integration with Stripe for secure payment processing and an SMS-first payment link system.
    - **Notification System**: Utilizes Resend for email and Twilio for SMS notifications.

## External Dependencies
- **Database/Auth/Storage**: Supabase
- **Payments**: Stripe (Checkout Sessions)
- **Email**: Resend
- **SMS**: Twilio