# Payment Link Test Plan

## Prerequisites

- Supabase migration `005_payment_link_columns.sql` has been run
- App is running (`npm run dev`)
- `DEBUG_PAYMENT_LINKS=true` set in Replit Secrets (development only)

## 1. Create Order (sends payment link automatically)

```bash
curl -X POST http://localhost:5000/api/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_year": 2024,
    "vehicle_make": "Honda",
    "vehicle_model": "Civic",
    "vehicle_location": "Austin, TX",
    "booking_type": "concierge",
    "package": "standard",
    "buyer_phone": "+1YOURPHONE",
    "buyer_email_input": "you@example.com"
  }'
```

**Expected response:**

```json
{
  "order": { "id": "UUID", "order_number": "N", "created_at": "..." },
  "pricing": { "basePrice": 119, "finalPrice": 119, "discountAmount": 0 },
  "track_url": "/track/UUID?t=TRACKING_TOKEN",
  "payment_channel": "sms",
  "debug": {
    "payment_url": "https://APP_URL/pay/UUID?t=PAYMENT_TOKEN",
    "channel": "sms"
  }
}
```

**DB columns set after this step:**

| Column | Value |
|---|---|
| `payment_link_token` | UUID (generated at insert) |
| `payment_link_sent_channel` | `sms` or `email` |
| `payment_link_sent_to` | phone or email |
| `payment_link_sent_at` | timestamp |
| `payment_status` | `unpaid` |
| `base_price` | 119 |
| `final_price` | 119 |

**SMS fallback behavior:**
- If Twilio credentials exist and phone is valid: SMS sent, `channel=sms`
- If SMS fails (bad number, no creds): falls back to email, `channel=email`
- If no credentials at all: `[SMS-TEST]` / `[EMAIL-TEST]` logged to console

## 2. Send Payment Link (resend)

```bash
curl -X POST http://localhost:5000/api/orders/{ORDER_ID}/send-payment-link
```

**Expected response:**

```json
{
  "ok": true,
  "channel": "sms",
  "debug": {
    "payment_url": "https://APP_URL/pay/ORDER_ID?t=TOKEN",
    "channel": "sms"
  }
}
```

**DB columns updated:**

| Column | Value |
|---|---|
| `payment_link_sent_channel` | `sms` or `email` |
| `payment_link_sent_to` | updated destination |
| `payment_link_sent_at` | updated timestamp |

## 3. Validate Token

```bash
curl "http://localhost:5000/api/pay/validate?orderId={ORDER_ID}&t={PAYMENT_TOKEN}"
```

**Expected response:**

```json
{
  "valid": true,
  "order": {
    "id": "UUID",
    "vehicle_year": 2024,
    "vehicle_make": "Honda",
    "vehicle_model": "Civic",
    "booking_type": "concierge",
    "package": "standard"
  },
  "price": 119
}
```

**Error cases:**
- Missing params: `400 { "valid": false, "error": "Missing parameters" }`
- Wrong token: `403 { "valid": false, "error": "Invalid token" }`
- Already paid: `400 { "valid": false, "error": "Already paid", "paid": true }`

## 4. Create Stripe Checkout Session

```bash
curl -X POST http://localhost:5000/api/pay/create-session \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORDER_ID", "token": "PAYMENT_TOKEN"}'
```

**Expected response:**

```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**DB columns updated:**

| Column | Value |
|---|---|
| `stripe_session_id` | `cs_test_...` |
| `payment_status` | `pending` |

## 5. After Stripe Payment (webhook)

When the buyer completes payment on the Stripe checkout page, the webhook at `/api/webhooks/stripe` fires.

**DB columns updated:**

| Column | Value |
|---|---|
| `payment_status` | `paid` |
| `paid_at` | timestamp |
| `payment_intent_id` | `pi_...` |
| `status` | `payment_received` |
| `ops_status` | `payment_received` |

## Middleware Verification

The following routes are public (no auth required):

| Route | Method | Auth |
|---|---|---|
| `/pay/*` | GET | Public (PAY_PREFIX) |
| `/api/pay/validate` | GET | Public (SKIP /api) |
| `/api/pay/create-session` | POST | Public (SKIP /api) |
| `/api/orders/*/send-payment-link` | POST | Public (SKIP /api) |

Admin/staff routes are unchanged and still require authentication + role check.

## Debug Mode

Set `DEBUG_PAYMENT_LINKS=true` in environment to get `payment_url` in API responses.
This is guarded: never returned when `NODE_ENV === 'production'`.

Token URLs are never logged in production (body is `[REDACTED]`).
