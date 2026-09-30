---
name: RideCheck external database target verification
description: Verify the Supabase target before any RideCheck live-data audit or schema operation.
---

Do not assume a connected Supabase project's name proves the development preview or published app actually targets it. Project listings can change between sessions: a previous audit listed only an unrelated rehearsal project, while a later listing included RideCheck-v2. The app's configured URL must be matched to the target through an approved, non-disclosing verification before attributing database state to the app.

**Why:** A mismatch between the connected project and the app's actual external database could make an audit misleading or direct a migration at the wrong target. A project listing alone does not establish the app's live configuration.

**How to apply:** Before live RideCheck SQL or migration work, confirm the project identity against the app's actual database configuration through the approved integration/secrets workflow without revealing credentials. If identity cannot be established, report that live data and schema were not verified.