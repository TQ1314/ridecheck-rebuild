# RideCheck Internal Authorization — Review Package
**Status: STAGED FOR REVIEW — nothing applied to Supabase yet**

---

## Role Mapping

| RideCheck role | Policy alias | Meaning |
|---|---|---|
| `owner` | `is_admin()` | Full control |
| `operations_lead` | `is_ops_lead()` | Approval authority + broad oversight |
| `operations` | `is_ops()` | Scheduling / coordination |
| `ridechecker_active` | `is_active_ridechecker()` | Can submit inspection work |
| `ridechecker` | `is_ridechecker()` | Pending applicant (can read own data only) |
| `qa`, `developer`, `platform` | `is_staff()` | Internal read access |
| `customer` | row-owner check | Buyers, see only their own data |

**Cascade rule:** `is_admin ⊂ is_ops_lead ⊂ is_ops ⊂ is_staff`
i.e. every `is_ops_lead()` check also passes for `owner`.

---

## Tables Audited + Policies Added

### Core tables (created in migrations)

| Table | RLS | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `profiles` | ✅ Enabled | Own row OR `is_staff()` | Service role only | Service role only | None |
| `orders` | ✅ Enabled | Own order OR `is_staff()` | Own + staff | Service role only | None |
| `ridechecker_job_assignments` | ✅ Enabled | Own OR `is_staff()` | Service role only | Service role only | None |
| `ridechecker_raw_submissions` | ✅ Enabled | Own OR `is_staff()` | Active ridechecker only | Active ridechecker only | None |
| `ridechecker_availability` | ✅ Enabled | Own OR `is_staff()` | Active ridechecker | Active ridechecker | Active ridechecker |
| `ridechecker_earnings` | ✅ Enabled | Own OR `is_ops_lead()` | Service role only | Service role only | None |
| `referral_codes` | ✅ Enabled | Own OR `is_ops_lead()` | Service role only | None | None |
| `referrals` | ✅ Enabled | Own (referrer or referee) OR `is_ops_lead()` | Service role only | None | None |
| `audit_log` | ✅ Enabled | `is_ops_lead()` only | Service role only | None | None |
| `order_events` | ✅ Enabled | `is_staff()` OR buyer's non-internal events | Service role only | None | None |
| `intelligence_reports` | ✅ Enabled | `is_staff()` | Service role only | None | None |
| `title_ownership_review` | ✅ Enabled | `is_staff()` | Service role only | None | None |
| `bill_of_sale_documents` | ✅ Enabled | `is_staff()` OR buyer (via order) | Service role only | None | None |
| `inspectors` | ✅ Enabled | `is_staff()` | `is_ops_lead()` | `is_ops_lead()` | None |
| `user_invites` | ✅ Enabled | `is_ops_lead()` | `is_ops_lead()` | None | None |
| `seller_contact_attempts` | ✅ Enabled | `is_ops()` | Service role only | None | None |
| `terms_acceptances` | ✅ Enabled | `is_ops_lead()` | Service role only | None | None |
| `role_definitions` | ✅ Enabled | `is_staff()` | None | None | None |
| `health_pings` | ✅ Enabled | Public (already was) | Public (already was) | — | — |

### Sensitive / intelligence tables (Supabase dashboard tables)

| Table | SELECT | Rationale |
|---|---|---|
| `mechanical_findings` | `is_ops()` | Operational staff reviewing inspection data |
| `obd_findings` | `is_ops()` | Same |
| `title_intelligence` | `is_ops_lead()` | More sensitive — approval-level access |
| `system_flags` | `is_admin()` | Owner only — system config |
| `fraud_flags` | `is_admin()` | **Highest sensitivity** — owner only |
| `region_capacity` | `is_ops()` | Ops needs for scheduling |
| `reports` | `is_staff()` | Internal review |

### Configuration / lookup tables

| Table | SELECT |
|---|---|
| `tier_pricing` | `is_staff()` |
| `regions` | `is_staff()` |
| `region_zips` | `is_staff()` |
| `vehicle_rules` | `is_staff()` |
| `roles` | `is_ops_lead()` |
| `user_roles` | `is_ops_lead()` |
| `waitlist` | `is_ops_lead()` for reads; anon INSERT for signups |

---

## Critical Approval Hard Rule (DB + API)

**RideChecker applicant approval (`profiles.role → ridechecker_active`):**
- API route `/api/admin/ridecheckers` PATCH: `requireRole(["owner", "operations_lead"])` ✅
- DB layer: No client UPDATE policy on `profiles` — all updates go through service role, so this is enforced at the API layer

**QA submission approval (approving submitted inspection work):**
- API route `/api/ops/orders/[orderId]/approve-submission`: `requireRole(["operations", "operations_lead", "owner"])` — operations CAN approve submitted work (this is a QA function, not a personnel function)

---

## Backend Route Fixes Required

Three routes reference phantom roles (`"admin"` and `"ops"`) that do not exist in the system. They currently match nothing and cause no security issue, but they are misleading and should be removed.

### File 1: `app/api/ops/orders/[orderId]/approve-submission/route.ts`
```diff
- requireRole(["operations", "operations_lead", "admin", "owner", "ops"])
+ requireRole(["operations", "operations_lead", "owner"])
```

### File 2: `app/api/ops/orders/[orderId]/reject-submission/route.ts`
```diff
- requireRole(["operations", "operations_lead", "admin", "owner", "ops"])
+ requireRole(["operations", "operations_lead", "owner"])
```

### File 3: `app/api/ops/payouts/[assignmentId]/mark-paid/route.ts`
```diff
- requireRole(["operations", "operations_lead", "admin", "owner", "ops"])
+ requireRole(["operations_lead", "owner"])
```
> Rationale: releasing money to a RideChecker is a financial action that should require ops_lead authority, not just ops.

---

## SQL Migration File

**`supabase/migrations/016_internal_authorization.sql`** — staged, not yet run.

Sections:
1. **RBAC helper functions** — `current_user_role()`, `is_admin()`, `is_ops_lead()`, `is_ops()`, `is_staff()`, `is_ridechecker()`, `is_active_ridechecker()`
2. **Drop old policies** from migrations 014/015 that are replaced by more precise versions
3. **Per-table policies** — one section per table, explicit FOR SELECT / INSERT / UPDATE / DELETE

---

## Tables Still Needing Product Decisions

| Table | Issue | TODO |
|---|---|---|
| `mechanical_findings` | Schema not in migrations — FK column name unknown | Confirm if there's a `ridechecker_id` or `order_id` FK; add row-level ridechecker policy if needed |
| `obd_findings` | Same as above | Same |
| `title_intelligence` | Schema unknown | Confirm columns; policy is ops_lead read-only for now |
| `order_events` | `order_id` is `TEXT` (not UUID); sub-select join works but is slow at scale | Consider adding `customer_id` column or keeping orders lookup only on server |
| `waitlist` | Does the waitlist form need anon (unauthenticated) signup? | Currently set to allow anon INSERT; confirm this is intentional |

---

## Test Plan

### 1. `operations` cannot approve RideChecker applicants
```
Actor: user with role = "operations"
Action: PATCH /api/admin/ridecheckers { userId: "...", action: "approve" }
Expected: 403 Forbidden
Verify: profiles.role stays "ridechecker", no approved_at written
```

### 2. `operations_lead` can approve RideChecker applicants
```
Actor: user with role = "operations_lead"
Action: PATCH /api/admin/ridecheckers { userId: "...", action: "approve" }
Expected: 200 OK
Verify: profiles.role = "ridechecker_active", approved_at set, audit_log entry written
```

### 3. `owner` can approve RideChecker applicants
```
Same as #2 but with role = "owner"
```

### 4. Approved applicant becomes ridechecker_active
```
After approval, log in as the approved user
Action: GET /ridechecker/dashboard
Expected: 200 (access granted)
Verify: Middleware redirects correctly based on role
```

### 5. RideChecker cannot read another RideChecker's assignments
```
Actor: user with role = "ridechecker_active", id = A
Direct Supabase REST: GET /rest/v1/ridechecker_job_assignments?ridechecker_id=neq.A
Expected: 0 rows (RLS filters to own rows only)
```

### 6. RideChecker cannot read another RideChecker's submissions
```
Same pattern as #5 using ridechecker_raw_submissions
Expected: 0 rows
```

### 7. `fraud_flags` is inaccessible to non-owners
```
Actor: user with role = "operations" or "operations_lead"
Direct REST: GET /rest/v1/fraud_flags
Expected: 0 rows (RLS blocks access)
Actor: user with role = "owner"
Expected: rows returned
```

### 8. `system_flags` is owner-only
```
Same pattern as #7
```

### 9. `operations` can read `seller_contact_attempts`
```
Actor: role = "operations"
Direct REST: GET /rest/v1/seller_contact_attempts
Expected: rows returned (ops needs this for concierge workflow)
```

### 10. Customer cannot read other customers' orders
```
Actor: customer with id = A, order belonging to customer B
Direct REST: GET /rest/v1/orders?id=eq.<B's order id>
Expected: 0 rows
```

---

## How to Apply (after approval)

1. Run `supabase/migrations/016_internal_authorization.sql` in the Supabase SQL Editor
2. Apply the 3 backend route changes in the code (ready in files listed above)
3. Re-run Supabase Security Advisor linter to confirm 0 errors
4. Execute the test plan above manually or via automated tests
