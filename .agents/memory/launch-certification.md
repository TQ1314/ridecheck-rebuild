---
name: Launch certification boundaries
description: Read/test-only certification scope, finding classifications, and safe interpretation of isolated tests.
---

RideCheck launch certification is read/test only. Do not implement, refactor, fix, migrate, publish, or deploy as part of certification. Do not invent product requirements or reopen the closed Facebook routing ticket.

**Why:** The user explicitly requested: "When we discover something, we classify it as Launch Blocker / Manual Pilot Control / Post-Launch. We do not automatically fix it."

**How to apply:** Classify each finding only as (A) unsafe or core-journey-blocking, (B) safely manageable by Owner/Ops during the pilot, or (C) nonblocking post-launch work. Distinguish VERIFIED, PARTIALLY VERIFIED, and NOT VERIFIED and identify evidence. Use isolated fixtures rather than real customer data, charges, dispatches, or destructive production actions. Never infer real provider delivery or authenticated browser verification from mocked handlers.

Test isolation must preserve local, in-memory resource loading and the application's server-side module semantics while blocking external network access.

**Why:** An overstrict test network guard blocked embedded PDF-renderer resources, and a standalone fixture lacked server-only module semantics. Those harness failures initially resembled report-generation failures; neither established a product defect.

**How to apply:** Establish that the harness faithfully supports the existing server/runtime before classifying an exception as a launch blocker. Keep fixture adjustments outside application code and do not weaken the prohibition on external provider or database access.