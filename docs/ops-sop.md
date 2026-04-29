# RideCheck — Operations Standard Operating Procedures
**Version 1.0 | Effective: April 2026**
**Audience: Operations Team (Ops Leads, Admin)**

---

## Table of Contents
1. [System Overview & Access](#1-system-overview--access)
2. [Order Lifecycle — Full Flow](#2-order-lifecycle--full-flow)
3. [Concierge Order Workflow](#3-concierge-order-workflow)
4. [Self-Arranged Order Workflow](#4-self-arranged-order-workflow)
5. [Seller Contact Protocol](#5-seller-contact-protocol)
6. [Assigning a RideChecker](#6-assigning-a-ridechecker)
7. [Monitoring the RideChecker in the Field](#7-monitoring-the-ridechecker-in-the-field)
8. [QA & Submission Review](#8-qa--submission-review)
9. [Report Generation & Delivery](#9-report-generation--delivery)
10. [RideChecker Pipeline Management](#10-ridechecker-pipeline-management)
11. [Payment & Payout Management](#11-payment--payout-management)
12. [Edge Cases & Exception Handling](#12-edge-cases--exception-handling)
13. [SLA Targets & Red Flags](#13-sla-targets--red-flags)
14. [System Roles & Access Control](#14-system-roles--access-control)
15. [Platform Audit Findings & Known Gaps](#15-platform-audit-findings--known-gaps)

---

## 1. System Overview & Access

### Portals
| Portal | URL Path | Who Uses It |
|---|---|---|
| **Operations Dashboard** | `/operations` | Ops Leads (primary workspace) |
| **Admin Panel** | `/admin` | Owner/Admin only |
| **Buyer Dashboard** | `/dashboard` | Customers |
| **RideChecker Portal** | `/ridechecker/dashboard` | Active RideCheckers |
| **QA Portal** | `/qa/review` | QA Reviewers |
| **Public Site** | `/` | Anyone |

### Login
All internal staff log in at `/auth/login`. Your role determines which portal you see. If you land on the public site after login, contact the owner to verify your role assignment.

### Roles That Can Access Ops Portal
`operations_lead`, `operations`, `ops`, `admin`, `owner`

---

## 2. Order Lifecycle — Full Flow

Every order flows through these statuses in sequence:

```
submitted → payment_requested → payment_received
  → seller_contacted → seller_confirmed
  → inspection_scheduled → inspection_in_progress
  → report_drafting → report_ready → completed
```

**Shortcut for Self-Arranged orders:** Payment is collected upfront so they skip `payment_requested` and often `seller_contacted`.

### Status Definitions
| Status | Meaning | Who Triggers |
|---|---|---|
| `submitted` | Order form completed, payment not yet collected | System (buyer books) |
| `payment_requested` | Payment link sent to buyer | Ops |
| `payment_received` | Stripe payment confirmed | System (webhook) |
| `seller_contacted` | Ops has reached out to seller | Ops |
| `seller_confirmed` | Seller agrees to appointment | Ops |
| `inspection_scheduled` | Date/time locked | Ops |
| `inspection_in_progress` | RideChecker is at the vehicle | System / Ops |
| `report_drafting` | Submission received, report being built | Ops / AI |
| `report_ready` | Report generated, pending delivery | Ops |
| `completed` | Report sent to buyer | Ops |
| `cancelled` | Order cancelled | Ops / Admin |

---

## 3. Concierge Order Workflow

In the **Concierge** flow, RideCheck contacts the seller on behalf of the buyer.

### Step-by-Step

**Step 1 — Order Arrives**
- New orders appear in `/operations/orders` with status `submitted`
- The system auto-classifies the vehicle (Basic $139 / Plus $169 / Exotic $299)
- An SMS/email with a payment link is sent to the buyer automatically on order creation

**Step 2 — Send Payment Link (if not already paid)**
- Open the order → click **"Send Payment Link"**
- System sends SMS (primary) then email (fallback) to the buyer
- Status updates to `payment_requested`
- After buyer pays, status auto-updates to `payment_received` (Stripe webhook)
- Buyer receives an automated payment confirmation email from RideCheck

**Step 3 — Seller Contact**
> See full protocol in Section 5

- Click **"Contact Seller"** in the Seller Contact Panel
- Log each attempt (platform + outcome)
- Maximum 3 attempts before marking "No Response"

**Step 4 — RideChecker Assignment**
> See Section 6

**Step 5 — Inspection & Submission**
- RideChecker performs the assessment in the field
- Raw data + photos submitted via `/ridechecker/jobs/[id]/submit`
- Order status moves to `inspection_in_progress` → `report_drafting`

**Step 6 — QA Review**
> See Section 8

**Step 7 — Report Generation & Delivery**
> See Section 9

---

## 4. Self-Arranged Order Workflow

In **Self-Arranged**, the buyer coordinates directly with the seller and pays upfront.

**Step 1 — Payment Collected**
- Buyer pays at checkout — no payment follow-up needed
- Order arrives with status `payment_received`

**Step 2 — Confirm Appointment Details**
- Verify the buyer has confirmed date, time, and address with the seller
- If missing, contact the buyer via email/phone to collect
- Update `inspection_address` and `scheduled_date` in the order if needed

**Step 3 — Assign RideChecker**
> See Section 6

**Step 4 — Monitor & Process**
Same as Steps 5–7 of the Concierge flow.

---

## 5. Seller Contact Protocol

This applies to all **Concierge** orders. Never contact sellers for Self-Arranged orders — the buyer handles it.

### Platform Priority Order
1. **Facebook Marketplace** (where most listings originate)
2. **Craigslist / Other Listing Site**
3. **Phone/SMS** (last resort)

### Message Templates
Use the pre-written templates in the Seller Contact Panel. Do not go off-script.
- Templates confirm: who RideCheck is, that the buyer hired us, that we need a 1-hour window
- Never disclose the buyer's personal information to the seller

### Attempt Logging
Log every contact attempt immediately after making it:
- **Platform used** (FB, Craigslist, Phone)
- **Outcome**: Pending / Agreed / Declined / No Response

### 3-Attempt Limit
If the seller does not respond after **3 attempts** across 2+ days:
1. Mark outcome as "No Response"
2. Update order status to `cancelled` or escalate to owner
3. Contact the buyer to inform them and offer a refund or alternate vehicle

### Seller Confirms
Once the seller agrees:
1. Set outcome to "Agreed"
2. Collect exact date, time, and address from seller
3. Update `scheduled_date`, `scheduled_time`, and `inspection_address` in the order
4. Update order status to `seller_confirmed`
5. Proceed to assign a RideChecker (Section 6)

---

## 6. Assigning a RideChecker

### Prerequisites Before Assigning
- [ ] Seller has confirmed (Concierge) or buyer has confirmed appointment (Self-Arranged)
- [ ] `inspection_address` is filled in (not just vehicle_location)
- [ ] `scheduled_date` and `scheduled_time` are set
- [ ] Payment has been received

### Assignment Process
1. Open the order in `/operations/orders/[orderId]`
2. Click **"Assign RideChecker"**
3. The system suggests RideCheckers based on proximity and rating
4. Select the most appropriate one
5. A `ridechecker_job_assignments` record is created with status `assigned`

### RideChecker Notification
> **Current Gap:** The RideChecker is NOT automatically notified by SMS/email when assigned. They must check their dashboard at `/ridechecker/dashboard`.
> **Interim Process:** After assigning, call or text the RideChecker directly to inform them of the new job. Ask them to accept the assignment in the portal.

### If No RideCheckers Are Available
- Check `/admin/ridecheckers` to see active RideChecker list
- Check their availability (some mark themselves unavailable)
- Contact available RideCheckers directly to see who can take the job
- If no one is available, escalate to owner to renegotiate timing with seller

---

## 7. Monitoring the RideChecker in the Field

### Assignment Statuses
| Status | Meaning |
|---|---|
| `assigned` | Job created, RideChecker hasn't accepted yet |
| `accepted` | RideChecker confirmed they'll do the job |
| `in_progress` | RideChecker clicked "Start Inspection" |
| `submitted` | RideChecker submitted raw data |
| `approved` | QA approved submission |
| `rejected` | QA rejected; needs resubmission or reassignment |

### Field Communication
RideCheckers can message ops directly from their job detail page (`/ridechecker/jobs/[id]`).
- Messages arrive in your email (at the `ADMIN_EMAIL` address)
- Respond to the RideChecker by phone or text (their contact is in their profile at `/admin/ridecheckers`)
- **RideCheckers do not have the seller's phone number** — if they need to contact the seller, handle it through ops

### If a RideChecker Doesn't Arrive
1. Contact the RideChecker directly by phone
2. If unreachable, check their assignment status in the portal
3. If they've gone silent, reassign the job to another RideChecker
4. Contact the seller to apologize for the delay and reschedule

---

## 8. QA & Submission Review

### Accessing the Queue
Go to `/qa/review` — all submitted inspections appear here, newest first.

### What to Check in a Submission
- [ ] All 4 required photos present and usable (VIN, odometer, engine bay, undercarriage)
- [ ] VIN is legible — all 17 characters visible
- [ ] Tire tread measurements are complete (all 4 tires)
- [ ] Brake condition is selected
- [ ] All 5 written sections are substantive (not just "good" or "ok")
- [ ] Test drive notes describe specific observations
- [ ] Immediate concerns section is explicit (either flags something or explicitly says "None")
- [ ] OBD codes logged (or confirmed clean scan)

### Approving a Submission
1. Click **"Approve"** — this triggers the scoring engine and marks the RideChecker's payout
2. Status updates to `approved`; payout is queued

### Rejecting a Submission
1. Click **"Reject"** with a reason (e.g., "VIN photo unreadable", "Missing interior notes")
2. The rejection reason is stored in the system
3. **Manual action required:** Contact the RideChecker directly and ask them to resubmit with the corrected information
4. They can access the submission form again from their dashboard

### Edge Case — Partial Submission
If a RideChecker could not complete one part (e.g., couldn't do test drive, car wouldn't start):
- Accept the submission if the reason is documented clearly in the notes
- Flag the order for manual review before generating the report
- Note the limitation prominently in the report generation prompt

---

## 9. Report Generation & Delivery

### Generating the AI Report
1. Open the order → find the **"Generate AI Report"** section
2. Click **"Generate Report"** — this sends the raw submission data to Claude AI
3. Claude generates a structured buyer-ready PDF
4. The `report_logic_version` is stored on the order for audit purposes (current: 1.1.0)
5. Review the generated report before sending

### What the Report Contains
- Vehicle risk score and verdict
- Condition findings (exterior, interior, mechanical)
- OBD code analysis
- Tire and brake condition summary
- Test drive notes
- Photo documentation
- RideCheck disclaimer

### Sending the Report
1. Review the generated PDF for accuracy and tone
2. If acceptable, click **"Send Report"**
3. Buyer receives a download link via email
4. Order status updates to `completed`

### If the Report Quality is Poor
- Do not send — regenerate with additional notes in the prompt
- Check the raw submission for incomplete data (see Section 8)
- If the issue is in the submission, follow the rejection flow first

---

## 10. RideChecker Pipeline Management

### Hiring Pipeline (Admin Panel)
Go to `/admin/ridecheckers`. Stages in order:

```
Applied → Under Review → Docs Requested → Docs Received
→ Background Pending → Background Clear
→ Reference Pending → Assessment Pending
→ Ready for Approval → Approved → Active
```

### Reviewing a New Application
1. Go to `/admin/applications`
2. Review submitted info — name, location, experience, referral
3. Move to "Under Review"
4. Request documents (ID, any certifications) using the stage update tool
5. Once documents received → move to "Docs Received" → initiate background check (external tool)
6. Once clear → move to "Background Clear"
7. Check 2 references before moving to "Ready for Approval"

### Approving a RideChecker
1. Confirm all stages are complete
2. Click **"Approve"** — system sends the applicant a verification link to their email
3. Applicant completes identity verification (ID + selfie upload)
4. Review the verification at `/admin/ridecheckers/[userId]/verification-review`
5. Approve verification → applicant receives welcome email and becomes `ridechecker_active`
6. They can now see jobs, accept assignments, and submit inspections

### Suspending a RideChecker
Go to `/admin/ridecheckers` → find the RideChecker → click **"Suspend"**. This immediately removes their access to jobs. Use for performance issues, code of conduct violations, or inactivity.

### Training Requirement
All active RideCheckers must complete the **SIP-4 Training Module** at `/ridechecker/training` before being able to access inspection workflows. The quiz requires 80% (4/5 correct). If they fail, they can retake it.

---

## 11. Payment & Payout Management

### Buyer Payment Flow
- **Self-Arranged**: Buyer pays at checkout via Stripe. No action needed.
- **Concierge**: Ops sends payment link via the order detail page. Buyer pays via Stripe.
- Payment confirmation email is automatically sent to buyer by RideCheck upon successful payment.

### Package Pricing
| Package | Price | Triggered By |
|---|---|---|
| Basic | $139 | Standard vehicles |
| Plus | $169 | EVs, hybrids, luxury brands |
| Exotic | $299 | High-value or exotic vehicles |

### Overriding the Package
If the system classified a vehicle incorrectly:
1. Open the order → find the **"Package Override"** section
2. Select the correct package tier
3. Changes are logged in the audit trail
4. Re-send the payment link if the buyer hasn't paid yet

### RideChecker Payouts
- Payouts are queued automatically when a submission is approved
- Go to `/api/ops/payouts/[assignmentId]/mark-paid` to mark payout complete after transferring funds
- **Current method**: Manual bank transfer or Zelle. Track in the payout queue.
- Future: Automated Stripe Connect payouts (planned)

---

## 12. Edge Cases & Exception Handling

### Seller Declines the Inspection
1. Log outcome as "Declined" in the Seller Contact Panel
2. Mark order status as `cancelled`
3. Email the buyer immediately with an explanation and offer:
   - Full refund, OR
   - The option to provide a different vehicle listing
4. Issue refund through Stripe Dashboard (not the platform — use Stripe directly)

### Buyer Wants to Cancel
1. Check payment status:
   - If not paid: cancel order, no refund needed
   - If paid: issue refund via Stripe Dashboard (full refund within 24hrs of booking, prorated after)
2. Update order status to `cancelled`
3. If a RideChecker was already assigned, notify them the job is cancelled

### RideChecker Arrives and Vehicle Condition is Dangerous
1. RideChecker should note this in "Immediate Concerns" and contact ops via the "Message Ops" button
2. Ops should instruct the RideChecker whether to proceed or leave
3. If dangerous (e.g., structural damage, non-functional brakes): abort inspection
4. Flag in the report; buyer receives findings with a strong advisory

### Buyer Disputes Report Findings
1. Review the raw submission photos and notes
2. If the finding is documented: support the report with evidence
3. If the finding was a data entry error: issue a corrected report
4. All disputes escalate to the owner for final resolution

### Vehicle Is Different Than Listed
If the RideChecker confirms the VIN or model does not match what the buyer provided:
1. Halt the inspection
2. Contact ops immediately via "Message Ops"
3. Ops contacts the buyer to verify
4. If fraud is suspected: abort, document, escalate to owner

---

## 13. SLA Targets & Red Flags

### Target Response Times
| Stage | Target |
|---|---|
| New order → Payment link sent | < 2 hours |
| Payment received → Seller first contact | < 4 hours |
| Seller confirms → RideChecker assigned | < 24 hours |
| Submission received → QA reviewed | < 4 hours |
| QA approved → Report generated | < 2 hours |
| Report generated → Delivered to buyer | < 1 hour |

### Red Flags on the Orders Page
The system flags orders automatically:
- **Stale** — New order with no ops action in 2+ hours
- **Seller Lag** — 3+ contact attempts, no confirmation
- **Payment Lag** — Payment link sent but unpaid for 6+ hours
- **Overdue** — Scheduled inspection time has passed with no submission

When you see a red flag, take immediate action and document your steps in the order activity log.

---

## 14. System Roles & Access Control

| Role | Access |
|---|---|
| `owner` | Full access to everything |
| `admin` | Admin panel + ops panel |
| `operations_lead` | Ops panel, can assign RideCheckers, approve submissions |
| `operations` / `ops` | Ops panel, standard order management |
| `qa` / `qa_reviewer` | QA portal only |
| `ridechecker_active` | RideChecker portal, jobs, training |
| `ridechecker` | Limited — pending approval, cannot see jobs |
| `customer` | Buyer dashboard only |

### Adding New Staff
1. Go to `/admin/invite`
2. Enter the staff member's email and select their role
3. They receive a one-time invite link by email
4. They must use that link to set up their account — invite links expire after 48 hours

### Resetting Access Issues
If a staff member cannot log in or sees the wrong portal:
1. Go to `/admin/users`
2. Find the user by email
3. Verify their role is correct — update if needed
4. If their account is inactive, toggle it back to active

---

## 15. Platform Audit Findings & Known Gaps

This section documents gaps identified during the April 2026 platform audit. Items are categorized by severity.

---

### FIXED — Issues Resolved in This Update

| Issue | Fix Applied |
|---|---|
| RideChecker dashboard "Submit" button bypassed job detail page | Fixed: now routes to job detail first |
| No buyer payment confirmation email sent after Stripe payment | Fixed: email now sent automatically by webhook |
| `new-inspection` page was a dead stub ("Coming Soon") | Fixed: now redirects to `/ridechecker/jobs` |
| RideChecker invite email links pointed to dev URL instead of production | Fixed: `RIDECHECKAUTO_DOMAIN` env var used |
| Build failure from missing `<Suspense>` on verify page | Fixed: Suspense wrapper + force-dynamic added |

---

### HIGH — Functional Gaps That Need Attention

**1. No automated notification to RideChecker when assigned a job**
- When ops assigns a RideChecker via the portal, no email or SMS is sent to them
- **Interim:** Call or text the RideChecker manually after assigning
- **Fix needed:** Add email + SMS notification in the assignment API

**2. No in-app inbox for RideChecker field messages**
- RideCheckers can send messages to ops from the field via the "Message Ops" button
- Ops receives these via email (to the ADMIN_EMAIL address), but there is no in-platform inbox to track and reply
- **Interim:** Monitor the ops email inbox; reply by phone or SMS
- **Fix needed:** Add a "Messages" tab in the ops order detail page

**3. Guest checkout orders may not link to buyer account**
- Buyers who pay without creating a RideCheck account won't see their order in the dashboard
- The system attempts to backfill the customer ID if an account exists with the matching email, but a non-registered buyer has no dashboard access
- **Interim:** For Concierge orders, encourage buyers to create an account when sending the payment link
- **Fix needed:** Add account creation prompt on the order confirmation page

---

### MEDIUM — UX & Branding Issues

**4. Footer credits a third-party dev studio**
- The footer currently shows "Powered by Fon Web Studios" — this links to an external company
- In a production SaaS this may not be desired
- **Action needed:** Decision from owner on whether to keep or remove

**5. No RideChecker push notification for new jobs**
- Active RideCheckers have no way to know a new job is available unless they actively check their dashboard
- **Interim:** Ops calls/texts the RideChecker after assigning
- **Fix needed:** SMS or email notification on job assignment

**6. Sample report link (`/ridecheck-sample-report.html`) on homepage**
- The file exists in the public directory and is accessible
- Verify the sample report is using current RideCheck branding and is up to date with current report format before publicizing

---

### LOW — Minor Gaps (Not Breaking)

**7. QA rejection does not auto-notify RideChecker**
- When a QA reviewer rejects a submission, the RideChecker is not automatically emailed
- **Interim:** Ops contacts the RideChecker manually after rejection
- **Fix needed:** Send rejection reason email to RideChecker on rejection

**8. No dispute or escalation workflow**
- There is no formal in-platform process for a buyer to dispute a report finding
- **Interim:** Handle via email — `support@ridecheckauto.com`
- **Future:** Add a "Dispute" flag on delivered orders

**9. Payout tracking is manual**
- RideChecker payouts are tracked in the system but paid out manually (Zelle/bank transfer)
- **Future:** Stripe Connect integration for automated payouts

**10. Spanish booking flow has no matching ops label**
- Orders booked from `/es/book` (Spanish flow) appear in ops with the same status labels as English orders — no locale indicator
- Not a breaking issue but may create confusion when reviewing order details

---

### ROUTES & NAVIGATION HEALTH CHECK

| Page | Status | Notes |
|---|---|---|
| `/` | ✅ Good | Homepage — all links functional |
| `/pricing` | ✅ Good | Pricing tiers accurate |
| `/how-it-works` | ✅ Good | EN version complete |
| `/es/how-it-works` | ✅ Good | ES version complete |
| `/book` | ✅ Good | Booking form + vehicle classification |
| `/es/book` | ✅ Good | Spanish booking form |
| `/pay/[orderId]` | ✅ Good | Legal checkboxes + Stripe checkout |
| `/track/[orderId]` | ✅ Good | Public order tracker |
| `/dashboard` | ✅ Good | Buyer order list |
| `/orders/[orderId]` | ✅ Good | Buyer order detail |
| `/blog` | ✅ Good | Buyer Intel blog |
| `/careers` | ✅ Good | Public RideChecker signup |
| `/join` | ✅ Good | Links to careers |
| `/faq` | ✅ Good | FAQ page |
| `/contact` | ✅ Good | Contact page with email |
| `/terms` | ✅ Good | Terms of Service |
| `/privacy` | ✅ Good | Privacy Policy |
| `/inspection-disclaimer` | ✅ Good | Disclaimer page |
| `/customer-agreement` | ✅ Good | Agreement page |
| `/ridechecker/dashboard` | ✅ Good | RideChecker home |
| `/ridechecker/jobs` | ✅ Good | Job list (assignments) |
| `/ridechecker/jobs/[id]` | ✅ Good | Job brief + field guide |
| `/ridechecker/jobs/[id]/submit` | ✅ Good | Submission form with photo upload |
| `/ridechecker/training` | ✅ Good | SIP-4 quiz |
| `/ridechecker/signup` | ✅ Good | Application form |
| `/operations/orders` | ✅ Good | Ops order queue |
| `/operations/orders/[id]` | ✅ Good | Ops order detail |
| `/admin` | ✅ Good | Admin dashboard |
| `/admin/ridecheckers` | ✅ Good | RideChecker management |
| `/admin/applications` | ✅ Good | Application review |
| `/admin/users` | ✅ Good | User role management |
| `/admin/invite` | ✅ Good | Staff invite |
| `/admin/audit` | ✅ Good | Audit log |
| `/qa/review` | ✅ Good | QA submission queue |
| `/ridechecker/new-inspection` | 🔄 Redirects | Now redirects to `/ridechecker/jobs` |
| `/ridecheck-sample-report.html` | ⚠️ Review | Verify branding is current |

---

*Document maintained by: RideCheck Operations*
*Last updated: April 2026*
*To update this document, contact the platform owner or engineering team.*
