# RideCheck System Overview

**Document type:** Business and technical system map  
**Prepared:** August 28, 2026  
**Scope:** Current repository implementation, operational documentation, and explicitly identified gaps  
**Companion document:** [Operations Standard Operating Procedures](./ops-sop.md)

---

## Purpose and status labels

This document explains:

1. How RideCheck works from booking through report delivery
2. RideCheck's overall system architecture
3. The problem RideCheck solves
4. Every identified system user and access boundary
5. The technologies, services, APIs, and administrative tools involved

The following labels distinguish current capabilities from future intent:

| Label | Meaning |
|---|---|
| **Live in code** | A working implementation exists in the repository. Deployment configuration or third-party credentials may still be required. |
| **Manual / interim** | The workflow exists, but a person must complete some or all of it outside the platform. |
| **Planned / unconfigured** | The code describes a future provider or capability, but no active implementation is configured. |
| **Not verified** | The repository does not provide enough evidence to confirm the capability is active in production. |

This is a repository-based system map, not a production security audit. The presence of code or configuration does not prove that every database migration, credential, webhook, or feature flag is active in the published environment.

---

# 1. How RideCheck Works

## 1.1 End-to-end lifecycle

```text
Visitor or buyer
    |
    v
Public website and booking form
    |
    +--> Vehicle, seller, listing, location, and buyer details
    +--> Service-area eligibility check
    +--> Booking path selected
    +--> Vehicle/package classification and price calculation
    |
    v
Order created in Supabase
    |
    +--> Public tracking token created
    +--> Secure payment-link token created
    +--> Confirmation and payment communications sent
    |
    v
Stripe Checkout payment
    |
    v
Stripe webhook marks order paid
    |
    +--> Concierge: Operations contacts seller and coordinates appointment
    |
    +--> Self-/buyer-arranged: Buyer coordinates or supplies appointment details
    |
    v
Operations schedules and assigns a RideChecker
    |
    v
RideChecker accepts, travels to vehicle, and performs field assessment
    |
    +--> Structured checklist and observations
    +--> Photos and documents
    +--> Road test, where permitted
    +--> OBD-II scan evidence and codes
    +--> Title/VIN/history observations
    +--> Field messages, ETA, and status updates
    |
    v
RideChecker submits raw assessment
    |
    v
QA and/or Operations reviews submission
    |
    +--> Approve
    |       |
    |       +--> Risk intelligence, scoring, and report preparation
    |       +--> RideChecker payout becomes eligible/queued
    |
    +--> Reject/revise
            |
            +--> RideChecker corrects or resubmits
    |
    v
Operations generates and reviews buyer-ready report
    |
    +--> Claude-assisted narrative generation
    +--> Report scope and confidence disclosures
    +--> PDF rendering
    |
    v
Operations sends report to buyer
    |
    v
Order completed; buyer retains tracking/dashboard access
```

## 1.2 Stage-by-stage workflow

### Stage 1 — Discover and book

**Primary users:** Public visitor, guest buyer, authenticated buyer  
**Primary routes:** `/`, `/how-it-works`, `/pricing`, `/book`, `/es/*`

1. A buyer visits the public website and starts a booking.
2. The buyer supplies vehicle information, seller type, listing source, vehicle location, service ZIP code, preferred timing, and contact information.
3. The buyer selects an available booking path:
   - **Concierge:** RideCheck coordinates with the seller.
   - **Self-arranged:** The buyer coordinates the appointment.
   - **Buyer-arranged:** A feature-flagged variation of self-arranged booking in the UI; it is normalized to `self_arrange` when the order is submitted.
4. The server validates the request, checks the service area, classifies the vehicle, and calculates the package and price.
5. The platform creates the order, tracking token, and payment-link token.

**Current service-area behavior:** The booking implementation contains pilot controls for Lake County and McHenry County, Illinois, using ZIP-to-county rules. This is local business logic, not a live geocoding service.

**Evidence:** `app/(public)/book/page.tsx`, `app/api/orders/create/route.ts`, `lib/geo/resolveCounty.ts`, `lib/vehicleClassification.server.ts`

### Stage 2 — Pay and confirm

**Primary users:** Buyer, Stripe, Operations  
**Primary routes:** `/pay/[orderId]`, `/order/received`, `/track/[orderId]`

1. RideCheck sends a tokenized RideCheck payment page link by SMS, with email as a fallback where applicable.
2. The payment page creates a Stripe Checkout Session for a one-time card payment.
3. Stripe redirects the buyer after payment and sends a signed webhook to RideCheck.
4. The webhook marks the order paid, stores Stripe identifiers, updates the order and operations status, and sends a payment-confirmation email.
5. Staff can also request payment, resend a link, synchronize Stripe status, or perform authorized manual verification/override when automated confirmation fails.

**Important control:** Assignment, risk intelligence, and report generation are payment-gated unless an authorized override applies.

**Status:** **Live in code** for Stripe Checkout and webhooks; **manual / interim** for authorized payment verification and some exception handling.

**Evidence:** `app/api/pay/create-session/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/orders/[orderId]/send-payment/route.ts`, `lib/payment/payment-gate.ts`

### Stage 3 — Coordinate with the seller

**Primary users:** Seller, buyer, Operations  
**Primary workspace:** `/operations/orders/[orderId]`

#### Concierge flow

1. Operations reviews the listing source and seller information.
2. Operations contacts the seller using approved templates and logs each attempt.
3. Seller replies can arrive by SMS or email and be matched to the order.
4. Operations records the outcome and captures confirmed date, time, and address.
5. If the seller declines or does not respond, Operations follows the cancellation, alternate-vehicle, or escalation procedure.

#### Self-/buyer-arranged flow

The buyer coordinates with the seller and supplies the inspection details. RideCheck Operations verifies that payment, timing, and address are ready before assignment.

**Seller access boundary:** The seller is a workflow participant, but no dedicated seller account or seller portal is verified. Seller communications are mediated through Operations and inbound/outbound messaging.

**Status:** **Live in code**, with human coordination as a core part of the service.

**Evidence:** `app/api/admin/orders/[orderId]/seller-contact/`, `app/api/admin/orders/[orderId]/seller-replies/route.ts`, `app/api/webhooks/twilio/inbound-sms/route.ts`, `app/api/webhooks/inbound-email/route.ts`

### Stage 4 — Schedule and assign a RideChecker

**Primary users:** Operations, Operations Lead, RideChecker  
**Primary workspaces:** `/operations`, `/operations/orders/[orderId]`, `/ridechecker/dashboard`

1. Operations confirms that payment, appointment, and location requirements are met.
2. Operations reviews RideChecker availability, workload, rating, and proximity suggestions.
3. Operations can make a direct assignment or use broadcast/offer workflows.
4. The RideChecker reviews the offer and accepts or declines.
5. Acceptance activates the field workflow; declines, expirations, and cancellations remain auditable.

**Known gap:** Existing operations documentation states that direct assignment does not reliably send an automatic email or SMS notification to the RideChecker. The interim process is to call or text them and direct them to the dashboard. Some reminder/nudge messaging endpoints exist, but they should not be treated as proof of universal assignment notification.

**Status:** Assignment and acceptance are **live in code**; assignment notification remains **manual / interim** unless separately verified in production.

**Evidence:** `app/api/ops/orders/[orderId]/ridechecker-assign/route.ts`, `app/api/ops/orders/[orderId]/broadcast/route.ts`, `app/api/ridechecker/jobs/[assignmentId]/accept/route.ts`, `docs/ops-sop.md`

### Stage 5 — Perform the field assessment

**Primary user:** Active/authorized RideChecker  
**Primary routes:** `/ridechecker/dashboard`, `/ridechecker/jobs/[assignmentId]`, `/ridechecker/jobs/[assignmentId]/submit`

1. The RideChecker reviews the job, timing, location, compensation, and instructions.
2. The RideChecker accepts, starts the job, reports ETA/status, and opens the mobile-oriented inspection flow.
3. The RideChecker records structured observations, including:
   - VIN and odometer evidence
   - Exterior, interior, engine, tires, brakes, underbody, and immediate concerns
   - Road-test observations or the reason a road test was not performed
   - OBD-II scan status, warning lights, diagnostic trouble codes, and uploaded scanner evidence
   - Title, VIN consistency, lien, flood, tampering, and accident indicators observable at the vehicle
4. The RideChecker uploads photos and supported diagnostic files.
5. The RideChecker can send messages to Operations and record job/location status.
6. The RideChecker submits the raw assessment for review.

The system is designed to report observations, scope, and limitations rather than give an unconditional purchase recommendation.

**Status:** **Live in code**.

**Evidence:** `app/ridechecker/(portal)/jobs/[assignmentId]/submit/page.tsx`, `app/api/ridechecker/jobs/[assignmentId]/inspect/`, `app/api/ridechecker/photos/upload/route.ts`

### Stage 6 — Review and quality assurance

**Primary users:** QA reviewer, Operations, Operations Lead, Owner  
**Primary routes:** `/qa/review`, `/operations/orders/[orderId]`

1. Submitted assessments enter review.
2. Reviewers check required evidence, completeness, legibility, consistency, OBD information, road-test scope, and written findings.
3. A submission may be approved or rejected with revision notes.
4. Approval makes the submission available for report generation and payout processing.
5. Rejection requires correction, resubmission, or reassignment.

**Access nuance:** The dedicated QA queue is restricted in code to `qa` and `owner`. Separate Operations APIs also support submission approval/rejection. Therefore, quality review is not implemented as a single QA-only boundary.

**Status:** **Live in code**, with role normalization recommended.

**Evidence:** `app/api/qa/review/route.ts`, `app/api/qa/review/[orderId]/route.ts`, `app/api/ops/orders/[orderId]/approve-submission/route.ts`, `app/api/ops/orders/[orderId]/reject-submission/route.ts`

### Stage 7 — Run risk intelligence

**Primary users:** Operations/system automation  
**Primary route:** `/api/orders/[orderId]/risk-intelligence/run`

After payment and once field data is available, the risk-intelligence pipeline can:

1. Decode and validate the VIN through the NHTSA vPIC API.
2. Query NHTSA vehicle recalls.
3. Convert RideChecker-observed flood indicators into a local flood-risk result.
4. Check theft/salvage status through a provider abstraction.
5. Compare listing price with a market-value estimate through a provider abstraction.
6. Combine results with VIN mismatches and OBD findings into a composite risk score, level, reasons, and hard-stop indicators.
7. Save the latest result and historical sub-check records in Supabase.

**Important limitations:**

- **Theft/salvage provider:** **Planned / unconfigured.** The current implementation returns `UNABLE_TO_VERIFY` and recommends a manual NICB VINCheck, NMVTIS, AutoCheck, or Carfax lookup.
- **Market-value provider:** **Planned / unconfigured.** Black Book, MarketCheck, and CarsXE are named as possible future providers, but the active implementation returns unavailable.
- **Flood check:** **Live in code**, but it is based on field-observed indicators rather than an external flood-history database.

**Evidence:** `lib/risk-intelligence/risk-runner.ts`, `lib/risk-intelligence/vin-decode.ts`, `lib/risk-intelligence/recall-check.ts`, `lib/risk-intelligence/theft-check.ts`, `lib/risk-intelligence/market-value.ts`

### Stage 8 — Generate and deliver the report

**Primary users:** Operations, Operations Lead, Owner, buyer  
**Primary workspace:** `/operations/orders/[orderId]`

1. Operations opens the approved order and starts report generation.
2. The server verifies payment and loads the order, submission, photos, OBD data, title/history observations, and available risk information.
3. The system calculates assessment scope, missing items, and confidence level.
4. Anthropic Claude generates structured, buyer-facing narrative content using server-only prompts and rules.
5. The report is rendered as a PDF and stored/referenced with report metadata and a report-logic version.
6. Operations reviews the generated report before sending.
7. The buyer receives the report link by email, and the order moves toward completion.

**Human control:** Report generation is AI-assisted, but review and delivery are operational decisions. The system should not present unverified third-party results as confirmed facts.

**Status:** **Live in code**.

**Evidence:** `app/api/ops/orders/[orderId]/generate-report/route.ts`, `lib/report/claude-generate.ts`, `lib/report/pdf/`, `app/api/ops/orders/[orderId]/report/send/route.ts`

### Stage 9 — Buyer access, support, and payout

**Primary users:** Buyer, RideChecker, Operations

- Authenticated buyers can view their orders in `/dashboard`.
- Token holders can view a public, limited tracking page at `/track/[orderId]`.
- RideCheckers can review jobs, availability, training, scorecard, referrals, and payout history.
- Operations approves and manages payout records and batches.
- Current payout execution is documented as manual bank transfer or Zelle; automated Stripe Connect payouts are planned.

**Known limitation:** A guest order has a nullable `customer_id`. The Stripe webhook attempts to link a paid order to an existing profile with the same email, but a buyer who has not created an account may not see the order in the authenticated dashboard.

**Status:** Tracking/dashboard and payout records are **live in code**; payout transfer is **manual / interim**; Stripe Connect is **planned / unconfigured**.

**Evidence:** `app/(buyer)/dashboard/page.tsx`, `app/track/[orderId]/page.tsx`, `app/ridechecker/(portal)/dashboard/page.tsx`, `app/(ops)/operations/payouts/page.tsx`, `docs/ops-sop.md`

---

# 2. RideCheck System Overview

## 2.1 Plain-language overview

RideCheck is a two-sided service platform that coordinates a used-vehicle assessment between a buyer, a seller, RideCheck Operations, and an independent RideChecker. It combines:

- Online booking and payment
- Human seller/appointment coordination
- Mobile field data collection
- Photo and diagnostic evidence
- Quality review
- Vehicle-risk data from available sources
- AI-assisted report preparation
- Digital report delivery and contractor payout tracking

The application is not only a marketing website. It is also an operations system, field-work portal, review system, report-production system, and customer tracking system.

## 2.2 High-level technical architecture

```text
Web browsers and mobile browsers
    |
    | Public pages, buyer dashboard, operations, admin,
    | QA, RideChecker portal, payment and tracking pages
    v
Next.js 14 application on Replit
    |
    +--> React pages and server components
    +--> Next.js route-handler APIs
    +--> Middleware session gate
    +--> Server-side RBAC checks
    +--> Server-only business rules, prompts, scoring, and classification
    |
    +----------------------+----------------------+----------------------+
    |                      |                      |                      |
    v                      v                      v                      v
Supabase                Stripe                Communications          Intelligence
PostgreSQL              Checkout              Resend email            Anthropic Claude
Auth                    Webhooks              Twilio SMS              NHTSA vPIC/recalls
Storage                 Payment status        Inbound replies         Local risk logic
RLS                     Manual overrides      Templates               Provider abstractions
```

## 2.3 Core application layers

### Experience layer

The same Next.js application provides distinct experiences for public visitors, buyers, Operations, administrators, QA reviewers, RideCheckers, and legacy inspectors. Route groups organize these surfaces, while reusable Tailwind/shadcn components provide the interface.

### Application and API layer

Next.js route handlers implement booking, payments, seller contact, assignments, field submissions, QA, report generation, communications, payouts, training, invitations, and webhook processing. Sensitive classification rules, risk scoring, report prompts, and privileged Supabase access stay server-side.

### Data and identity layer

Supabase provides:

- PostgreSQL records
- Supabase Auth sessions
- User profiles and roles
- Row Level Security policies
- Storage for photos and files
- Service-role access for privileged server routes

The `orders` table is the central business record. It connects buyer/contact information, vehicle and seller data, booking type, price, payment, assignment, report, tokens, and lifecycle status. Later migrations add specialized assignment, submission, communication, risk, payout, training, and campaign records.

### Integration layer

Stripe, Resend, Twilio, Anthropic, and NHTSA are called from server-side code. Inbound webhooks update RideCheck after payment or message events. External intelligence providers that are not configured return an explicit unavailable state instead of silently fabricating a result.

### Operations and control layer

Operations and Admin portals expose order queues, assignment tools, seller communications, payment status, report generation, delivery, payout management, staff/user management, audit information, and RideChecker management. Feature flags and report-logic versioning support controlled changes.

## 2.4 Primary business entities

| Entity | Purpose |
|---|---|
| Profile | Authenticated identity, role, contact information, and active status |
| Order | Central booking, vehicle, seller, price, payment, lifecycle, tracking, and report record |
| RideChecker application/profile | Applicant screening, verification, agreement, training, availability, and activation |
| Job assignment | Offer/assignment, acceptance, timing, status, RideChecker, compensation, and audit trail |
| Raw submission / inspection session | Structured field observations, issue records, photos, OBD, road-test, and title/history data |
| Seller communication/message | Contact attempts, outbound messages, inbound replies, extracted scheduling details, and outcomes |
| Risk check | VIN, recall, flood, theft, market-value, and composite risk results |
| Report | Structured AI output, PDF/report URL, report status, QA status, version, and delivery |
| Payout / compensation offer / batch | RideChecker compensation calculation, approval, and payment tracking |
| Training result/progress | Training status, quiz results, and guide completion |
| Audit/activity/order event | Privileged actions and order history |

---

# 3. What Problem Does RideCheck Solve?

## 3.1 The buyer's problem

Used-car buyers often have to make expensive decisions with incomplete and uneven information. A listing may omit mechanical issues, warning lights, title concerns, accident indicators, or inconsistencies between the advertised vehicle and the vehicle presented for sale. Buyers may also lack:

- The tools or experience to assess the vehicle
- The ability to visit the vehicle themselves
- A repeatable checklist
- Usable photo and diagnostic evidence
- Time to coordinate with the seller
- A clear record of what was and was not inspected
- Confidence that findings have been reviewed before delivery

## 3.2 RideCheck's solution

RideCheck reduces this information and coordination gap by providing:

1. **A structured service request** — The buyer submits the vehicle, seller, listing, and location details in one place.
2. **Seller coordination options** — The buyer can coordinate directly or use the Concierge service.
3. **An assigned field specialist** — A RideChecker follows a standardized inspection and evidence-collection workflow.
4. **Objective documentation** — Photos, OBD evidence, measurements, warning lights, test-drive observations, and title/VIN observations are captured in a consistent format.
5. **Quality control** — A review stage identifies incomplete, unclear, or inconsistent submissions.
6. **Available risk data** — VIN decoding, recalls, and local risk scoring augment field evidence where supported.
7. **A buyer-ready report** — The platform turns raw evidence into an organized report with scope and confidence disclosures.
8. **A trackable process** — Buyers and Operations can follow status from booking through report delivery.

## 3.3 What RideCheck is not

Based on the current implementation and report language, RideCheck should not be represented as:

- A guarantee that a vehicle has no hidden defects
- A replacement for a repair estimate, title agency, law-enforcement database, or licensed legal advice
- A complete Carfax/AutoCheck/NMVTIS substitute while those providers are unconfigured
- A full mechanical teardown or lift inspection unless the report explicitly says that scope was completed
- An autonomous AI purchase-decision service

Its value is structured, evidence-backed pre-purchase intelligence with explicit limitations—not certainty.

---

# 4. System Users, Roles, Portals, and Access

## 4.1 User and participant inventory

| User or actor | Account/role | Primary access | Responsibilities and boundaries |
|---|---|---|---|
| Public visitor | No account required | Public website, blog, pricing, FAQ, legal pages | Learns about RideCheck and can begin booking or RideChecker signup. |
| Guest buyer | No authenticated profile required at order creation | `/book`, tokenized `/pay/*`, tokenized `/track/*` | Creates an order, pays, and tracks it by secure token. May not see the order in `/dashboard` until an account is linked. |
| Authenticated buyer/customer | `customer` | `/dashboard`, order details, booking, tracking | Creates and views own orders, pays, accepts terms, and receives reports. Database policies are intended to restrict buyers to their own data. |
| Seller | No dedicated role verified | SMS/email/phone through Operations | Confirms access, timing, address, road-test permission, or declines. Does not receive buyer portal or RideChecker contact details. |
| RideChecker applicant | Application record; may begin without an active portal role | `/ridechecker/signup`, application/verification pages | Applies, supplies qualifications, completes screening, agreement, and identity verification. |
| Pending RideChecker | `ridechecker` | Limited RideChecker portal and verification flow | Completes verification/training. Normally cannot operate as a fully active RideChecker, although active assignment exceptions exist for legacy/pending flows. |
| Active RideChecker | `ridechecker_active` | `/ridechecker/dashboard`, `/ridechecker/jobs/*`, training, availability, payouts | Accepts jobs, performs field assessments, uploads evidence, communicates with Operations, submits work, and views compensation status. |
| Legacy inspector | `inspector` or legacy inspector routes | `/inspector` and `/api/inspector/*` | Earlier assignment/report-upload experience. The UI labels this a RideChecker portal, but it coexists with the newer `/ridechecker/*` system. |
| Operations staff | `operations`; legacy aliases include `ops` | `/operations`, order workspaces | Manages orders, seller contact, scheduling, assignment, buyer/RideChecker messages, inspection progress, report workflow, and payouts within allowed endpoints. |
| Operations Lead | `operations_lead`; some routes reference `ops_lead` | Operations and selected privileged tools | Performs Operations work plus higher-trust actions such as applicant approval, payment verification, overrides, and staff-level management where authorized. |
| QA reviewer | `qa`; some docs/code reference `qa_reviewer` | `/qa/review` | Reviews uploaded/submitted work, records notes, approves or requests revision within permitted routes. |
| Administrator | Legacy/application role `admin` | `/admin` and often `/operations` | Platform and order management. This alias appears in layouts and APIs but is not consistently represented in the canonical database helper roles. |
| Owner | `owner` | All major portals and privileged APIs | Highest-privilege business user; manages users, roles, applicants, orders, payment overrides, reports, and operational exceptions. |
| Developer/platform staff | `developer`, `platform` in database helper logic | No dedicated portal verified | Internal staff roles included in staff-level database authorization. Exact UI access is **not verified** and varies by route allowlist. |
| System automation | No interactive account; server/service actors | API routes, scheduled/triggered logic, webhooks | Classifies vehicles, creates tokens, sends notifications, updates status, processes Stripe/message webhooks, runs intelligence, generates reports, and writes audit/activity records. |
| Third-party service actor | Stripe, Resend, Twilio, Anthropic, NHTSA | Webhook/API boundaries | Performs payment, communication, AI, and federal vehicle-data functions; never receives general portal access. |

## 4.2 Portal map

| Portal or surface | Primary path | Intended users |
|---|---|---|
| Public site | `/` | Anyone |
| Booking | `/book` | Guest or authenticated buyer |
| Public payment | `/pay/[orderId]` | Token-authorized buyer |
| Public tracking | `/track/[orderId]` | Token-authorized buyer |
| Authentication | `/auth/*` | Buyers and staff |
| Staff invitation | `/invite/*` | Invited staff |
| Buyer dashboard | `/dashboard` | Authenticated customer |
| Operations command center | `/operations` | Operations, Operations Lead, Admin, Owner and accepted aliases |
| Operations order workspace | `/operations/orders/[orderId]` | Operations staff |
| QA queue | `/qa/review` | QA and Owner in the dedicated API |
| Admin dashboard | `/admin` | Owner/Admin and accepted staff aliases |
| RideChecker signup | `/ridechecker/signup` | Applicants |
| RideChecker portal | `/ridechecker/dashboard` | RideChecker, active RideChecker, Owner |
| RideChecker job flow | `/ridechecker/jobs/[assignmentId]` | Authorized assigned RideChecker and privileged staff |
| RideChecker training | `/ridechecker/training` | RideChecker users |
| Legacy inspector portal | `/inspector` | Legacy inspector role/flow |

## 4.3 Authentication and authorization model

1. Supabase Auth manages user sessions.
2. A `profiles` row mirrors the authenticated user and stores one current role plus an active flag.
3. Root middleware allows public routes and requires a Supabase session for other page routes.
4. Page layouts and API handlers perform role checks.
5. PostgreSQL Row Level Security is intended to protect direct client access.
6. Privileged server routes use a Supabase service-role client, which bypasses RLS; those routes therefore depend on correct server-side role checks and object-ownership checks.

## 4.4 Access-control inconsistencies to resolve

The repository currently contains overlapping role names and generations of the field workflow:

- Canonical database helper roles include `owner`, `operations_lead`, `operations`, `qa`, `developer`, `platform`, `ridechecker`, and `ridechecker_active`.
- Some layouts and APIs also accept `admin`, `ops`, `ops_lead`, `qa_reviewer`, or `inspector`.
- The dedicated QA queue is narrower than some Operations approval endpoints.
- Both `/inspector/*` and `/ridechecker/*` systems exist.
- RLS migrations and the operations security-review document do not fully agree on which migration state is deployed.

**Impact:** Access may be correct on an individual route while remaining inconsistent at the platform level. A future role-normalization and authorization audit should define one canonical role list, one QA boundary, and a migration plan for legacy inspector routes.

**Evidence:** `middleware.ts`, `lib/rbac.ts`, `app/ridechecker/(portal)/layout.tsx`, `supabase/migrations/028_rls_security_fix.sql`, `docs/rls-policy-review.md`

---

# 5. Technologies and Services Involved

## 5.1 Verified technology inventory

| Area | Technology/service | Status | Role in RideCheck |
|---|---|---|---|
| Frontend | Next.js 14 App Router | **Live in code** | Page routing, layouts, server/client components, metadata, and API co-location |
| Frontend | React 18 + TypeScript 5.6 | **Live in code** | Interactive application UI and typed business workflows |
| Frontend | Tailwind CSS 3 | **Live in code** | Styling and responsive/mobile layouts |
| Frontend | shadcn/ui pattern + Radix UI primitives | **Live in code** | Accessible buttons, forms, dialogs, tabs, tables, menus, and other reusable UI |
| Frontend | Lucide React | **Live in code** | Interface icons |
| Frontend | React Hook Form, Zod | **Live/dependency present** | Form handling and validation; server order creation explicitly uses Zod |
| Frontend/data | TanStack React Query | **Dependency present** | Available for client data fetching; not the universal fetching pattern because many pages use native `fetch` or Supabase directly |
| Charts/visualization | Recharts | **Dependency present** | Available for dashboards; usage is not required for core workflow |
| Backend | Next.js route handlers | **Live in code** | Primary HTTP/API backend |
| Backend runtime | Node.js 20 | **Configured** | Server runtime in Replit |
| Backend validation | Zod | **Live in code** | Request schema validation |
| Backend/legacy | Express, Passport, session packages, Drizzle, `pg` | **Present but not primary** | Legacy/scaffold dependencies and `server/` code exist; the verified RideCheck application flow runs through Next.js and Supabase |
| Database | Supabase PostgreSQL | **Live in code** | Orders, profiles, assignments, submissions, reports, messages, risk checks, payouts, training, audits, and related records |
| Database access | `@supabase/supabase-js` | **Live in code** | Browser, route-handler, and privileged server access |
| Database changes | SQL migrations in `supabase/migrations/` | **Live project practice** | Schema, functions, policies, indexes, tables, and feature evolution |
| Database security | PostgreSQL RLS | **Implemented in migrations** | Direct-client row isolation and staff/owner access rules; production application state is **not verified** |
| Authentication | Supabase Auth + Next.js auth helpers | **Live in code** | Registration, login, password reset, session cookies, callbacks, and user identity |
| Authorization | Profile roles, page layouts, API role checks, ownership checks, RLS | **Live in code** | Portal and action access; role-name inconsistencies remain |
| Payments | Stripe server SDK + Stripe.js | **Live in code** | One-time card payments and Checkout Session creation |
| Payments | Stripe webhooks | **Live in code** | Marks orders paid, records payment identifiers, sends confirmations, processes campaign/supporter payments |
| Payments | Manual payment verification/override | **Manual / interim** | Authorized recovery when Stripe automation does not reflect payment correctly |
| Contractor payouts | Internal payout records/batches | **Live in code** | Tracks pending, approved, and paid RideChecker compensation |
| Contractor payouts | Bank transfer/Zelle | **Manual / interim** | Documented method of transferring RideChecker funds |
| Contractor payouts | Stripe Connect | **Planned / unconfigured** | Future automated contractor payouts |
| Email | Resend | **Live in code** | Transactional email, confirmations, report delivery, reminders, and operational notifications |
| Email | Resend/inbound-email webhooks | **Live in code** | Delivery events and seller reply capture |
| SMS | Twilio | **Live in code** | Payment links, buyer/seller/RideChecker communications, reminders, and alerts |
| SMS | Twilio inbound webhooks | **Live in code** | Captures seller/buyer replies and message events |
| AI | Anthropic Claude SDK | **Live in code** | Buyer-ready report generation and OBD image/PDF extraction |
| AI model example | `claude-haiku-4-20250514` | **Live in OBD extraction code** | Reads scanner images/PDFs, extracts codes, warning lights, scanner information, and confidence |
| Vehicle data | NHTSA vPIC API | **Live in code** | VIN decoding and basic VIN validity/vehicle identity data |
| Vehicle data | NHTSA Recalls API | **Live in code** | Recall retrieval by make, model, and model year |
| Vehicle classification | Server-only RideCheck rules | **Live in code** | Assigns package tier and price based on vehicle complexity, brand, model, value, age, and mileage |
| Flood risk | Local scoring from field indicators | **Live in code** | Converts observed flood indicators into a risk result; not an external vehicle-history search |
| Theft/salvage data | Provider abstraction only | **Planned / unconfigured** | Returns unable-to-verify until NICB, NMVTIS, AutoCheck, Carfax, or another provider is connected |
| Market value | Provider abstraction only | **Planned / unconfigured** | Returns unavailable until a valuation provider such as Black Book, MarketCheck, or CarsXE is connected |
| Maps/navigation | Google Maps directions URL | **Live in code** | Opens turn-by-turn directions from the RideChecker job using a generated link |
| Service area | Local ZIP/county rules | **Live in code** | Determines pilot service eligibility and capacity |
| Geocoding/maps platform | No dedicated maps SDK or geocoding API verified | **Not configured/verified** | Proximity and addresses should not be described as powered by Google Maps APIs; only directions linking is verified |
| File/photo storage | Supabase Storage | **Live in code** | Stores RideChecker photos, PDFs, text, and CSV diagnostic evidence |
| Storage bucket | `ridechecker-photos` | **Live in code** | Public bucket created/used by the upload endpoint with structured order/assignment paths |
| Upload controls | 20 MB limit; JPEG, PNG, WebP, HEIC/HEIF, PDF, TXT, CSV | **Live in code** | Field-photo and OBD evidence validation |
| PDF generation | `@react-pdf/renderer` | **Live in code** | Buyer reports and training/guide PDF outputs |
| Report intelligence | Server-only prompts, scoring, photo validation, scope/confidence logic | **Live in code** | Protects proprietary logic and creates auditable buyer-facing output |
| Hosting/runtime | Replit workflows and Autoscale deployment | **Configured** | Development runs `npm run dev`; deployment builds with `npm run build` and serves with `npm run start` |
| Hosting/runtime | Port 5000, proxied externally | **Configured** | Next.js server listen target |
| Environment | Nix stable 24.05; Node 20 module | **Configured** | Reproducible Replit runtime/tooling |
| Source control | Git + GitHub | **Configured** | Repository remote points to `github.com/TQ1314/ridecheck-rebuild`; Replit gitsafe backup remote is also configured |
| Admin tools | RideCheck Admin portal | **Live in code** | Users, roles, applications, RideCheckers, orders, audit, diagnostics, and privileged actions |
| Operations tools | RideCheck Operations portal | **Live in code** | Command center, queues, seller communications, assignment, reports, revenue, payouts, and live board |
| QA tools | RideCheck QA portal | **Live in code** | Review queue, notes, approvals, and revisions |
| Field tools | RideChecker portal | **Live in code** | Jobs, inspection submission, evidence, availability, training, messages, referrals, scorecard, and payouts |
| Observability | Health endpoints and application logs | **Live in code** | Basic application/Supabase checks and server logging; no dedicated third-party APM provider is verified |

## 5.2 Third-party API and webhook map

| Provider | Direction | RideCheck use | Current status |
|---|---|---|---|
| Stripe | Outbound API + inbound webhook | Checkout Sessions, payment confirmation, payment metadata, campaign payments | **Live in code** |
| Resend | Outbound API + inbound/delivery webhook | Transactional email and reply/delivery processing | **Live in code** |
| Twilio | Outbound API + inbound webhook | SMS payment links, operational messaging, and reply capture | **Live in code** |
| Anthropic | Outbound API | Report generation and OBD document/image extraction | **Live in code** |
| NHTSA vPIC | Outbound public API | VIN decode/validation | **Live in code** |
| NHTSA Recalls | Outbound public API | Vehicle recall data | **Live in code** |
| Google Maps | Browser link-out | Directions to inspection location | **Live link**, not a verified API integration |
| NICB/NMVTIS/AutoCheck/Carfax | None configured | Theft/salvage/history verification | **Manual recommendation / planned provider** |
| Black Book/MarketCheck/CarsXE | None configured | Market-value estimate | **Planned provider** |
| Connecteam | Admin/Operations routes and data references exist | Workforce/assignment synchronization | **Implementation surface present; production connection not verified** |

## 5.3 Administrative and operational tools

### Operations command center

The Operations dashboard provides active-order metrics, urgency and next-action queues, RideChecker availability, unassigned paid orders, payout summaries, live-board access, and direct navigation to order workspaces.

### Order workspace

The order workspace is the primary operational control surface. Depending on status and role, it supports:

- Buyer, seller, listing, vehicle, payment, and appointment details
- Seller contact attempts, messages, outcomes, and replies
- Package and payment overrides
- RideChecker suggestions, assignment, broadcast, cancellation, reminders, and compensation
- Raw submission and photo review
- Risk flags and intelligence
- Submission approval/rejection
- Report generation, editing/saving, sending, and delivery diagnostics
- Activity and audit history

### Admin portal

The Admin portal covers platform overview, recent orders, revenue, users, roles, staff invitations, applicant pipeline, RideChecker records, verification review, account status, audit data, and selected delivery diagnostics.

### QA portal

The QA portal provides a focused report/submission queue for uploaded, in-review, revision-needed, and approved records. Some approval functions also exist in Operations, so the portal is a specialized interface rather than the only quality-control path.

### RideChecker management tools

RideChecker tools span application, verification, contractor agreement, training, availability, assignments, mobile inspection, OBD evidence extraction, messaging, scorecard, referrals, compensation, and payout history.

---

# 6. Known Gaps, Manual Dependencies, and Risks

| Area | Current condition | Classification |
|---|---|---|
| RideChecker assignment notification | Universal automatic email/SMS on assignment is not established; Operations may need to contact the RideChecker manually | **Manual / interim** |
| Guest buyer account linkage | Guest orders may not appear in a later buyer dashboard unless the profile is linked by matching email or another process | **Known limitation** |
| Theft/salvage verification | No live provider is configured; result is unable to verify | **Planned / unconfigured** |
| Market valuation | No live valuation provider is configured | **Planned / unconfigured** |
| Contractor money movement | Payout records exist, but funds are documented as manual bank transfer/Zelle | **Manual / interim** |
| Stripe Connect | Mentioned as a future payout solution, not active | **Planned / unconfigured** |
| Maps/geocoding | Google Maps direction links and local ZIP rules exist; no full maps/geocoding SDK is verified | **Limited live capability** |
| Role vocabulary | `operations`/`ops`, `operations_lead`/`ops_lead`, `qa`/`qa_reviewer`, `ridechecker`/`inspector`, and `owner`/`admin` overlap | **Architecture risk** |
| QA boundary | Dedicated QA API and Operations approval routes do not use one consistent role boundary | **Authorization consistency risk** |
| RLS deployment state | Migrations implement RLS, but repository files alone cannot confirm exactly which policies are active in production | **Not verified** |
| Service-role APIs | Server routes bypass RLS and rely on correct route-level RBAC and ownership checks | **Control requiring continued audit** |
| Legacy inspector flow | `/inspector/*` coexists with the newer `/ridechecker/*` workflow | **Legacy/duplication risk** |
| Connecteam | Routes and references exist, but an active production connection is not established by repository evidence | **Not verified** |
| Monitoring | Health checks and logs exist, but no dedicated APM/error-monitoring vendor is verified | **Not verified** |

---

# 7. Recommended Next Documentation and Architecture Actions

These are recommendations, not claims about current scope:

1. **Normalize roles and portals** — Define one canonical role list and retire or map legacy aliases.
2. **Document a canonical state machine** — Align order, payment, assignment, inspection, QA, report, and payout statuses in one reference.
3. **Create a data-flow and trust-boundary diagram** — Show browser, Next.js, Supabase, service-role routes, storage, and external providers.
4. **Verify production configuration** — Confirm applied migrations, webhooks, storage policies, feature flags, and connected providers.
5. **Automate assignment notifications** — Send and track RideChecker email/SMS when an offer or assignment is created.
6. **Improve guest conversion/linkage** — Provide a reliable account-claim process for guest orders.
7. **Choose intelligence providers** — Select and integrate theft/salvage/title-history and market-value sources with clear licensing and disclosure rules.
8. **Automate payouts when ready** — Evaluate Stripe Connect or another compliant contractor-payout system.
9. **Reconcile the legacy inspector system** — Migrate remaining functionality to the RideChecker portal or clearly separate the two.
10. **Add formal observability** — Centralize production errors, webhook failures, delivery failures, and critical workflow alerts.

---

# 8. Repository Evidence Index

The main sources used to produce this overview are:

- `replit.md`
- `docs/ops-sop.md`
- `docs/rls-policy-review.md`
- `package.json`
- `.replit`
- `next.config.js`
- `middleware.ts`
- `app/(public)/how-it-works/page.tsx`
- `app/(public)/book/page.tsx`
- `app/(buyer)/dashboard/page.tsx`
- `app/(ops)/operations/page.tsx`
- `app/(admin)/admin/page.tsx`
- `app/(inspector)/inspector/page.tsx`
- `app/ridechecker/(portal)/`
- `app/api/orders/`
- `app/api/pay/`
- `app/api/webhooks/`
- `app/api/ops/`
- `app/api/admin/`
- `app/api/qa/`
- `app/api/ridechecker/`
- `lib/rbac.ts`
- `lib/supabase/`
- `lib/stripe/`
- `lib/email/`
- `lib/sms/`
- `lib/notifications/`
- `lib/report/`
- `lib/risk-intelligence/`
- `lib/vehicleClassification.server.ts`
- `lib/geo/resolveCounty.ts`
- `supabase/migrations/`

---

## Summary

RideCheck is a Next.js and Supabase-based pre-purchase vehicle intelligence platform that joins customer booking, payment, seller coordination, RideChecker field work, evidence storage, quality review, risk checks, AI-assisted report production, delivery, and payout tracking in one operational system.

Its strongest verified capabilities are structured workflow coordination, field evidence collection, Stripe payments, Resend/Twilio communications, Supabase-backed data and identity, Anthropic-assisted reports and OBD extraction, and NHTSA vehicle data. Its most important current limitations are manual RideChecker notification and payout steps, guest-account linkage, unconfigured theft and market-value providers, and inconsistent legacy role/portal definitions.