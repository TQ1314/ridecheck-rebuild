---
name: Supabase & Lucide Type Pitfalls
description: Two recurring TypeScript build failures in this codebase and their fixes.
---

## Pattern 1 — Supabase GenericStringError on select results

**Rule:** After any `supabaseAdmin.from(...).select(...)`, the TypeScript inferred type may be `GenericStringError` if Supabase cannot resolve the table type from the generated schema. Accessing `.id` or any field on the raw result will fail at build time.

**Fix:** Cast immediately after destructuring:
```ts
const { data, error } = await supabaseAdmin.from("profiles").select(...);
const rows = (data ?? []) as any[];
```
Do not use `data` directly after this point — use `rows`.

**Why:** Supabase's generated types sometimes can't resolve dynamic or untyped select strings, returning `GenericStringError` as the element type. The cast is safe because the runtime shape is always correct.

**How to apply:** Any new API route that calls `supabaseAdmin.from(...).select(...)` and then iterates or accesses properties on the result.

---

## Pattern 2 — LucideIcon as a prop/array type

**Rule:** Lucide icons are `ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>`. Writing a custom function signature like `(props: { className?: string }) => JSX.Element | null` is not assignable and will fail at build time.

**Fix:** Import and use the `LucideIcon` type from lucide-react:
```ts
import { type LucideIcon, MapPin, Shield } from "lucide-react";

const ITEMS: Array<{ Icon: LucideIcon }> = [
  { Icon: MapPin },
  { Icon: Shield },
];
```

**Why:** Lucide's exported type is `LucideIcon` and it wraps the ForwardRef component correctly. Custom function signatures are structurally incompatible because `ReactNode` (the actual return type) is wider than `JSX.Element | null`.

**How to apply:** Any time you store Lucide icons in arrays or pass them as typed props.
