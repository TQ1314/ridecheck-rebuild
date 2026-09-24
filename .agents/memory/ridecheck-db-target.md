---
name: RideCheck external database target verification
description: Verify the Supabase target before any RideCheck live-data audit or schema operation.
---

Do not assume the workspace's connected Supabase MCP project is RideCheck's production database. Its listed project name during the September 2026 stabilization session was for a different rehearsal project, so no RideCheck rows or schema could be safely inferred from that connection.

**Why:** A mismatch between the connected project and the app's actual external database could make an audit misleading or direct a migration at the wrong target.

**How to apply:** Before live RideCheck SQL or migration work, confirm the project identity against the app's actual database configuration through the approved integration/secrets workflow without revealing credentials. If identity cannot be established, report that live data and schema were not verified.