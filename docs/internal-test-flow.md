# Internal $1 End-to-End Test Flow

## Overview

The internal test flow allows admin/ops staff to simulate the full RideCheck order lifecycle using a $1 Stripe payment. This verifies the entire pipeline without processing real payment amounts.

## Prerequisites

- Migration `009_internal_test_flow.sql` must be run in Supabase SQL Editor
- The environment must NOT be production (`NODE_ENV !== 'production'`)
- Staff must have `operations`, `operations_lead`, `admin`, or `owner` role
- Stripe must be configured with test mode keys

## How to Run a Full Test

### Step 1: Create or Select an Order
Navigate to the Admin Order Detail page for any order.

### Step 2: Start the $1 Test Flow
Click the **"Run Internal $1 Test Flow"** button (amber/yellow border).

This will:
- Mark the order as `is_internal_test = true`
- Generate a unique `test_run_id`
- Create a Stripe Checkout session for $1.00
- Open the Stripe checkout page in a new tab

### Step 3: Complete Payment
Use Stripe test card `4242 4242 4242 4242` with any future expiry and any CVC.

After payment:
- Webhook sets `payment_status = "paid_test"` (not "paid")
- Activity log records `test_payment_received`

### Step 4: RideChecker Workflow
Assign a RideChecker and have them complete the structured submission as normal.

### Step 5: Approve Submission
When ops approves the submission for a test order:
- Payout amount is forced to **$1.00** (regardless of package tier)
- Earnings record is created with `is_internal_test = true`
- Job assignment marked with `is_internal_test = true`

### Step 6: Send Report
When ops clicks "Deliver Report" for a test order:
- Email subject is prefixed with `[INTERNAL TEST]`
- Everything else works identically to production

### Step 7: Mark Payout Paid
Use the existing "Mark as Paid" button. The payout of $1.00 is recorded normally.

## Safety Guardrails

| Rule | Implementation |
|------|---------------|
| No $1 payments in production | API returns 403 if `NODE_ENV === 'production'` |
| Buyers never see test option | Button only appears in admin order detail |
| Test payments clearly labeled | `payment_status = "paid_test"` distinguishes from real |
| Test payouts clearly labeled | `is_internal_test = true` on earnings + assignments |
| Report emails prefixed | Subject line includes `[INTERNAL TEST]` |
| Role-protected | Only ops/admin roles can trigger |

## Database Changes (Migration 009)

- `orders.is_internal_test` (boolean, default false)
- `orders.test_run_id` (text, nullable)
- `ridechecker_earnings.is_internal_test` (boolean, default false)
- `ridechecker_job_assignments.is_internal_test` (boolean, default false)

## What Gets Tested

- Buyer receives link and pays $1
- Webhook updates payment status to `paid_test`
- RideChecker workflow produces raw data
- Ops builds report and sends to buyer (with [INTERNAL TEST] prefix)
- Payout record gets created ($1.00) and can be marked paid
