# Pilot ZIP Restriction Testing Guide

## Overview
RideCheck is restricted to Lake County, IL during pilot mode. ZIP codes are validated both in the UI and enforced server-side via the order creation API.

## Service Area Phases
| Phase | Counties Allowed | Unlocks After |
|-------|-----------------|---------------|
| 1 (current) | Lake | 0 orders |
| 2 | Lake + McHenry | 50 orders |
| 3 | Lake + McHenry + Cook | 100 orders |
| Capacity | None (pilot full) | 200 total orders |

## Test Cases

### Allowed ZIP (Lake County)
- **ZIP**: `60045` (Lake Forest, IL)
- **UI**: Green checkmark — "Available in Lake County"
- **API**: Order created successfully (200)

```bash
curl -X POST http://localhost:5000/api/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_year": 2020,
    "vehicle_make": "Toyota",
    "vehicle_model": "Camry",
    "vehicle_location": "Lake Forest, IL",
    "buyer_phone": "5551234567",
    "booking_type": "concierge",
    "package": "standard",
    "service_zip": "60045"
  }'
```
**Expected**: 200 OK with order object

### Blocked ZIP (Cook County — Chicago)
- **ZIP**: `60601` (Chicago Loop)
- **UI**: Red X — "Not available yet — we're launching in phases (Lake → McHenry → Cook)"
- **API**: 409 with county_locked error

```bash
curl -X POST http://localhost:5000/api/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_year": 2020,
    "vehicle_make": "Honda",
    "vehicle_model": "Civic",
    "vehicle_location": "Chicago, IL",
    "buyer_phone": "5551234567",
    "booking_type": "concierge",
    "package": "standard",
    "service_zip": "60601"
  }'
```
**Expected**: 409 with `{"error":"county_locked","message":"RideCheck is not yet available in cook county..."}`

### Blocked ZIP (Out of state / Unknown)
- **ZIP**: `90210` (Beverly Hills, CA)
- **UI**: Red X — "Not available yet"
- **API**: 409 with service_unavailable error

```bash
curl -X POST http://localhost:5000/api/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_year": 2020,
    "vehicle_make": "BMW",
    "vehicle_model": "M3",
    "vehicle_location": "Beverly Hills, CA",
    "buyer_phone": "5551234567",
    "booking_type": "concierge",
    "package": "standard",
    "service_zip": "90210"
  }'
```
**Expected**: 409 with `{"error":"service_unavailable","message":"RideCheck is currently available only in Lake County, IL..."}`

### Missing ZIP (API bypass attempt)
```bash
curl -X POST http://localhost:5000/api/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_year": 2020,
    "vehicle_make": "Ford",
    "vehicle_model": "F150",
    "vehicle_location": "Somewhere",
    "buyer_phone": "5551234567",
    "booking_type": "concierge",
    "package": "standard"
  }'
```
**Expected**: 400 validation error (service_zip is required)

## Other Allowed Lake County ZIPs for testing
- `60002` (Antioch)
- `60030` (Grayslake)
- `60035` (Highland Park)
- `60040` (Highwood)
- `60048` (Libertyville)
- `60060` (Mundelein)
- `60085` (Waukegan)
- `60087` (Waukegan)
- `60099` (Zion)

## Migration Required
Run `supabase/migrations/007_service_area.sql` in the Supabase SQL Editor before testing to add service_zip, service_county, service_state columns to orders.

## UI Behavior
1. **Global banner** on all public pages: "Now serving: Lake County, IL only"
2. **Booking page banner**: "Pilot Mode: Lake County, IL only — Confirm availability with your ZIP before booking"
3. **ZIP field** on Step 2 (Vehicle Info): Required, validates against Lake County allowlist
4. **Next button** is disabled until a valid Lake County ZIP is entered
5. Even if UI is bypassed (curl/Postman), the API enforces the same restriction
