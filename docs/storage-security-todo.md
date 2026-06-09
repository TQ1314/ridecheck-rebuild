# Storage Security — Pending Migration TODO

## Summary

Two Supabase Storage buckets are currently **public** — meaning any object URL is
accessible without authentication. This is a security risk for sensitive documents.

---

## Affected Buckets

### 1. `payment-evidence`
- **Current state**: PUBLIC bucket
- **Contains**: Manual payment proof uploads (screenshots, receipts, bank transfers)
- **Risk**: Any URL leak exposes financial/payment documents to unauthenticated users
- **Priority**: HIGH

### 2. `ridechecker-photos`
- **Current state**: PUBLIC bucket
- **Contains**: Inspection photos taken by RideCheckers in the field
- **Risk**: Inspection photos accessible to anyone with the URL
- **Priority**: MEDIUM

---

## Migration Plan

### Step 1 — Audit all URL consumers before changing bucket privacy
Search for all places that render `<img src={...}>` or `<a href={...}>` using direct
Supabase storage URLs from these buckets. These will break if the bucket is made private.

```
grep -rn "payment-evidence\|ridechecker-photos" app/ components/ --include="*.tsx" --include="*.ts"
```

### Step 2 — Create signed URL utility

```typescript
// lib/supabase/signedUrl.ts
import { supabaseAdmin } from './admin';

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600 // 1 hour
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}
```

### Step 3 — Update all consumers to use signed URLs
- `components/orders/PayPanel.tsx` — payment evidence display
- `components/orders/ManualPaymentVerification.tsx` — evidence viewer
- Any `<img>` or `<a>` that reads from `ridechecker-photos` bucket
- API routes that return photo URLs in inspection submissions

### Step 4 — Change bucket privacy in Supabase dashboard
1. Go to Storage → `payment-evidence` → Edit bucket → Uncheck "Public bucket"
2. Go to Storage → `ridechecker-photos` → Edit bucket → Uncheck "Public bucket"
3. Add RLS policies:
   - `payment-evidence`: allow read by `owner`, `operations_lead`, `admin` roles
   - `ridechecker-photos`: allow read by assigned RideChecker + ops + admin

### Step 5 — Update RLS policies
```sql
-- payment-evidence: staff-only read
CREATE POLICY "payment_evidence_staff_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'payment-evidence'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'operations_lead', 'admin', 'operations')
    )
  );

-- ridechecker-photos: RC reads own, ops/admin reads all
CREATE POLICY "rc_photos_rc_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'ridechecker-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'operations_lead', 'admin', 'operations', 'qa')
      )
    )
  );
```

---

## Already Secure Buckets

| Bucket | Privacy | Notes |
|---|---|---|
| `ridechecker-verifications` | PRIVATE | RLS enforced; signed URLs with 1h TTL |
| `reports` | PRIVATE | RLS enforced; ops/admin access only |

---

## Do Not Change Yet

The bucket privacy change should only happen after Step 1-3 are complete.
Changing bucket privacy without updating URL consumers will break:
- Payment evidence display in ops order detail
- Inspection photo display in RC portal and QA review
- Any email/notification that embeds direct photo URLs
