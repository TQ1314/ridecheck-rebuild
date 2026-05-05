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