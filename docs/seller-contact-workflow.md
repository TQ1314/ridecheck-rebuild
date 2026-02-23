# Seller Contact Workflow

## Overview

RideCheck supports two booking types that determine how seller outreach is handled:

1. **Concierge** — RideCheck Ops contacts the seller on behalf of the buyer
2. **Self-Arranged** — The buyer coordinates directly with the seller

Both flows are managed through the Seller Contact Panel on the Admin Order Detail page.

---

## Concierge Flow

When a buyer books a concierge inspection, the Ops team is responsible for reaching out to the seller to schedule the vehicle inspection.

### Platform Detection

The system automatically detects the seller's listing platform from the `listing_url` field on the order:

| Platform    | Detection                        | Allowed Channels                     |
|-------------|----------------------------------|--------------------------------------|
| Facebook    | URL contains `facebook.com` or `fb.com` | FB Message, Call, SMS, Email   |
| Craigslist  | URL contains `craigslist.org`    | Email, SMS, Call                     |
| Dealer      | URL contains known dealer domains | Call, Email, SMS                    |
| Other       | Default / unrecognized URL       | Call, Email, SMS                     |

### Facebook Manual Messaging

Facebook Marketplace does not support automated outreach. The workflow is:

1. Ops opens the listing via the "Open Listing" link
2. Clicks "New Attempt" and selects the `fb_message` channel
3. The system pre-fills a message template in an editable textarea
4. Ops clicks "Copy Message" to copy to clipboard
5. Ops pastes the message into Facebook Messenger manually
6. Ops returns to the panel and clicks "Log Sent" to record the attempt

This copy/paste approach ensures compliance with Facebook's terms of service while maintaining a complete audit trail.

### 3-Attempt Policy

For concierge orders, Ops must make at least **3 contact attempts** before marking an order as `no_response`. This policy ensures buyers receive thorough service.

- Each attempt is logged with: channel, destination, message content, status, and timestamp
- The attempt number is auto-calculated (max existing + 1)
- After 3 attempts are logged, the "Mark No Response" button becomes enabled
- Attempting to set `no_response` via the API with fewer than 3 attempts returns an error

### Contact Statuses

| Status           | Meaning                                         |
|------------------|--------------------------------------------------|
| `not_started`    | No outreach has been made yet                    |
| `attempting`     | At least one attempt logged, awaiting response   |
| `accepted`       | Seller agreed to the inspection                  |
| `declined`       | Seller refused the inspection                    |
| `no_response`    | 3+ attempts made with no reply (concierge only)  |
| `invalid_contact`| Contact info is wrong or unreachable             |

### Attempt Statuses

Each individual attempt can have one of these statuses:

| Status   | Meaning                              |
|----------|--------------------------------------|
| `sent`   | Message/call was successfully made   |
| `failed` | Attempt failed (wrong number, etc.)  |

---

## Self-Arranged Flow

When a buyer selects `self_arrange`, they coordinate with the seller themselves. The Ops console switches to **Buyer Coordination Mode**.

### How It Works

1. The panel displays a pre-written message template the buyer can send to the seller
2. Ops can click "Copy Message for Buyer" to share it
3. Ops logs updates from the buyer using the "Log Buyer Update" button (channel = `buyer_message`)
4. A checkbox tracks whether the buyer has confirmed the seller agreed to the inspection
5. Notes field allows Ops to record any relevant details

### Key Differences from Concierge

- No 3-attempt policy applies
- Attempt numbers are always `1` for `buyer_message` channel entries
- Ops acts as a coordinator, not the primary contact
- The panel does not show concierge-specific attempt tracking UI

---

## Ops Lead Review

The Ops Lead can review all seller contact activity from the Admin Order Detail page:

- View the full attempt history with timestamps and message previews
- See the current `seller_contact_status` at a glance via color-coded badges
- Read outcome notes explaining the final resolution
- All actions (attempts and outcomes) are recorded in the order event log and audit trail

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/orders/[orderId]/seller-contact` | GET | List all contact attempts |
| `/api/admin/orders/[orderId]/seller-contact/attempt` | POST | Log a new contact attempt |
| `/api/admin/orders/[orderId]/seller-contact/outcome` | POST | Set the contact outcome |

All endpoints require `operations`, `operations_lead`, or `owner` role.

---

## Migration

Run the migration to add the required database objects:

```sql
-- File: supabase/migrations/006_seller_contact_attempts.sql

-- Creates the seller_contact_attempts table
-- Adds columns to orders: seller_platform, seller_contact_status, seller_outcome_notes, seller_email
```

Apply via Supabase CLI:

```bash
supabase db push
```

Or run directly against the database:

```bash
psql $DATABASE_URL -f supabase/migrations/006_seller_contact_attempts.sql
```
