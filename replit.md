# RideCheck - Vehicle Inspection Booking Platform

## Overview
RideCheck is a production-grade vehicle inspection booking platform built with Next.js 14 App Router. Customers can book pre-purchase vehicle inspections with different packages and service tiers.

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
  (public)/           - Public pages (landing, pricing, how-it-works, booking)
  (buyer)/            - Authenticated customer pages (dashboard, orders, profile)
  (ops)/              - Operations staff pages (order management)
  (admin)/            - Admin/owner pages (dashboard, users, orders, settings)
  auth/               - Login, register, callback
  api/                - API route handlers
    orders/create/    - Order creation
    orders/[orderId]/ - Status, assign, send-payment
    webhooks/stripe/  - Stripe webhook handler
    admin/users/      - User role/status management
components/
  layout/             - Navbar, Footer, AppShell
  orders/             - OrderTable, OrderDetailPanel, StatusUpdateDialog, AssignOpsDialog
  ui/                 - shadcn/ui components
lib/
  supabase/           - Client, server, admin, middleware Supabase clients
  stripe/             - Server and client Stripe instances
  email/              - Resend + email templates
  sms/                - Twilio SMS
  utils/              - Pricing, roles, formatting, orderId generation
types/                - TypeScript type definitions
middleware.ts         - Auth and role-based route protection
```

## Booking Types
- **Self-Arranged**: Customer arranges appointment with seller, pays immediately
- **Concierge**: RideCheck contacts seller, customer pays after confirmation

## Packages
- Standard ($113 self / $119 concierge)
- Premium ($170 self / $179 concierge)  
- Comprehensive ($284 self / $299 concierge)

## Roles
- customer, operations, operations_lead, qa, developer, platform, owner

## Database (Supabase)
Tables needed: profiles, orders, activity_log

## Key Decisions
- Using Supabase for auth, NOT local auth
- Route groups for layout organization
- Idempotency keys for order creation
- Stripe Checkout (not Elements) for payment
- Middleware handles auth + RBAC
