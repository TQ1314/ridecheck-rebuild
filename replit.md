# RideCheck - Pre-Car-Purchase Intelligence Platform

## Overview
RideCheck is a production-grade pre-car-purchase intelligence platform. It enables buyers to book vehicle assessments, offering various packages and service tiers. The platform delivers intelligence reports containing risk screening data and observational findings, streamlining the car-buying process. The project aims to become the leading intelligence platform for pre-owned vehicle purchases, enhancing buyer confidence and market transparency.

## User Preferences
The user prefers clear and concise communication. They value iterative development and expect the AI to ask for confirmation before implementing significant changes. The AI should prioritize architectural discussions over minute implementation details and ensure all new features are initially behind feature flags.

## System Architecture
The platform is built with Next.js 14 App Router and utilizes Supabase for authentication, database, and storage. Key architectural decisions include:
- **UI/UX**: Tailwind CSS and shadcn/ui components are used for a consistent and modern interface. The application features distinct route groups for different user roles (public, buyer, operations, admin, inspector, QA), ensuring role-based navigation and access control.
- **Technical Implementations**:
    - Supabase is used for authentication instead of NextAuth, with middleware handling role-based route protection and automatic profile creation on login.
    - Idempotency keys are implemented for reliable order creation.
    - All new features are introduced behind feature flags for controlled rollout.
    - A server-side RBAC helper (`rbac.ts`) validates sessions and provides an audit trail.
    - The system includes a comprehensive report generation and delivery workflow, integrating structured data submission from RideCheckers and an Ops Report Builder.
    - An internal `$1` test flow is available for end-to-end testing without impacting production.
    - The platform supports a pilot ZIP restriction feature, allowing phased rollout based on geographical areas and capacity limits.
    - Buyer ownership and payment reconciliation are handled by associating orders with authenticated user IDs and backfilling customer IDs via webhooks.
    - The system fully rebrands "Inspectors" to "RideCheckers" across the UI and integrates RideChecker data management directly with the `profiles` table for a single source of truth.
    - Spanish language support is implemented for key public-facing pages, with an EN|ES language toggle and locale-aware components.
    - A Buyer Intelligence Blog is implemented as an isolated, non-destructive extension under `/blog`. Content is file-based TypeScript posts in `content/blog/`. Components live in `components/blog/` (BlogCard, CategoryTag, VerdictBadge, EvidenceGallery, YouTubeEmbed, BlogLeadCapture). Loader at `lib/blog/loader.ts`. Hub page at `app/(public)/blog/page.tsx`; post page at `app/(public)/blog/[slug]/page.tsx` with Article + BreadcrumbList + LocalBusiness JSON-LD, evidence gallery with lightbox, inline YouTube embeds, and a lead capture widget. Lead submissions POST to `/api/blog/lead` which notifies via Resend. Adding new posts requires only a new file in `content/blog/` and an import in `lib/blog/loader.ts`.
    - A legal protection layer is implemented: terms acceptance checkbox on the `/pay/[orderId]` page (required before Stripe session creation), `terms_acceptances` table storing immutable acceptance records (hashed IP, user agent, terms version), `APPROVED_RECOMMENDATIONS` constant controlling valid inspector recommendation values (BUY / BUY_WITH_NEGOTIATION / DO_NOT_BUY_AT_ASKING_PRICE / FURTHER_INSPECTION_REQUIRED), legal disclaimer block appended to the intelligence report HTML template, inspection scope table (performed/not performed) in reports, and a standalone `legal-shield/` Express prototype package. Legal constants live in `lib/legal/constants.ts`.
- **Feature Specifications**:
    - **Booking Types**: Supports Concierge (RideCheck contacts seller), Self-Arranged (customer arranges appointment), and Buyer-Arranged (customer coordinates, gets discount, feature-flagged).
    - **Packages**: Vehicle-determined flat-rate pricing — 3 tiers: Basic ($139), Plus ($169), Exotic ($299), plus a `$1` internal test option. Classification engine in `lib/vehicleClassification.ts` with `TIER_CONFIG` export (plus_brands, exotic_brands, exotic_model_overrides, value_thresholds). Premium tier retired; legacy DB rows with `package='premium'` display as "Plus". EVs and hybrids → Plus. Ops/admin can force-override a package via `PATCH /api/ops/orders/[orderId]/package-override`.
    - **Concierge Workflow**: Includes a seller contact interface with platform detection and channel-specific message templates, enforcing a 3-attempt policy.
    - **RideChecker Management**: Features RideChecker signup, approval flow, job assignment engine, earnings system, and a referral program. RideCheckers have a dedicated portal for jobs, availability, earnings, and training.
    - **Quality Assurance**: A QA reviewer portal handles review queues, detailed reviews, and an approve/revision workflow for submissions.
    - **Payment System**: Integrated with Stripe for Checkout Sessions, featuring an SMS-first payment link system.
    - **Notification System**: Utilizes Resend for email and Twilio for SMS notifications.
    - **Security**: Strict role-based access control; users cannot self-assign elevated roles. All signups default to 'customer'.
    - **Internationalization**: Partial Spanish language support for public-facing content.

## External Dependencies
- **Database/Auth/Storage**: Supabase
- **Payments**: Stripe (Checkout Sessions)
- **Email**: Resend
- **SMS**: Twilio