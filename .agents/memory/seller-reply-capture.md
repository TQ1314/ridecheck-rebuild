---
name: Seller Reply Capture System
description: Architecture for capturing inbound seller replies (SMS + email) and surfacing them in the ops order panel.
---

## Key decisions

**Reply-to address (outbound email)**
Outbound seller emails now set `reply_to: RideCheck Ops <replies+RC-XXXX-XXXXXX@domain>`. This encodes the order number so inbound email can be matched back to the order without relying on sender email alone.

**Why:** Sellers often reply from a different email than the one on file. Encoding the order number in the reply-to tag is the highest-confidence matching method.

**Match priority in replyMatcher.ts**
1. `reply_to_tag` — parse RC-XXXX from the "To" address of the inbound email
2. `subject_order_ref` — scan for RC-XXXX in the subject line
3. `phone_lookup` — match sender phone against seller_phone (E.164 normalized, leading 1 stripped)
4. `email_lookup` — match sender email against seller_email

**How to apply:** The match_method column on seller_messages records which strategy succeeded for debugging.

**Data extraction — regex only**
No external AI API is used. lib/seller-contact/dataExtractor.ts uses regex patterns for dates, times, addresses, and phones. Extracted values are stored in array columns and displayed as clickable chips in the Replies tab. Clicking a chip calls PATCH /api/admin/orders/[orderId]/seller-replies with the field to apply.

**Why:** Regex is free, synchronous, and has no latency. Accuracy is sufficient for scheduling signals (dates, times, addresses).

**Notifications**
lib/notifications/notifyOps.ts queries profiles for role IN ('operations','operations_lead','ops_lead','owner') and sends SMS if phone is set, email otherwise. Called at end of both webhook handlers.

**seller_messages table (migration 055)**
Key columns: order_id, channel, direction, from_address, to_address, subject, body, match_method, extracted_dates[], extracted_times[], extracted_addresses[], extracted_phones[], is_read.
New order columns: seller_replied_at, seller_available_date, seller_available_time, seller_inspection_address.

**IMPORTANT: migration 055 must be run in Supabase SQL Editor before seller_messages features work.**

**Webhook setup required**
- Twilio: Set "A message comes in" webhook on your Twilio number → https://yourdomain/api/webhooks/twilio/inbound-sms
- Email: Configure Resend Email Routing or similar to forward replies+*@domain to https://yourdomain/api/webhooks/inbound-email
- Optional: Set INBOUND_EMAIL_WEBHOOK_SECRET env var for email webhook auth in production

**Communication Center UI**
Added as a second Card in SellerContactPanel, below the main seller outreach card.
- Tabs: Replies | Email | SMS | Calls
- Replies tab: inbound messages with extracted data chips (click to apply to order fields)
- Unread badge on Replies tab and card header
- Action buttons: Schedule Inspection (opens dialog), Assign RideChecker (scroll to section), Mark Seller Confirmed (POST /seller-confirm)
- "Seller Provided" summary strip shows confirmed date/time/address when set

**API routes added**
- GET  /api/admin/orders/[orderId]/seller-replies — returns inbound messages, marks all as read
- PATCH /api/admin/orders/[orderId]/seller-replies — applies extracted data to order fields
- POST  /api/admin/orders/[orderId]/seller-confirm — sets seller_contact_status='confirmed'
