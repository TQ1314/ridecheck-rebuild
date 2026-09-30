---
name: RideCheck pricing policy
description: Business decisions for classifying vehicles into the three current inspection tiers.
---

Classify regular gasoline vehicles as Standard; European, hybrid, electric, diesel, and heavy-duty vehicles as Plus; and exotic, performance, or collector vehicles as Premium/Exotic. Ordinary Mercedes-Benz/BMW and non-performance S-Class/Maybach are Plus; base Porsche 911 is performance. Do not elevate on price alone, luxury/flagship branding alone, or three-row seating alone. Do not downgrade eligible Plus vehicles for age, mileage, or low price. The old separate $189 Premium rule is obsolete; legacy Premium records may still exist.

**Why:** The user explicitly settled six conflicting legacy classifier behaviors rather than permitting guesses about which old rules should survive.

**How to apply:** Keep booking quote, server order price, public pricing copy, and regressions aligned. Do not retroactively change historical orders. Stripe TEST mode does not isolate the shared Supabase database; do not create test orders without a confirmed isolated database.