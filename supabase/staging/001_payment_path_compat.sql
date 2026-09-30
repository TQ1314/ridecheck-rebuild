-- RideCheck staging-only compatibility layer for the focused payment path.
-- Apply only after the ordered migrations in supabase/staging/README.md.
-- This is additive and intended for a NEW, EMPTY staging Supabase project.

-- Current booking accepts these fields when available (see
-- app/api/orders/create/contract.ts). Keep buyer-arranged checkout usable
-- without importing the unrelated health-ping/report schema in migration 001.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS booking_method TEXT DEFAULT 'concierge',
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS inspection_address TEXT,
  ADD COLUMN IF NOT EXISTS inspection_time_window TEXT,
  ADD COLUMN IF NOT EXISTS notes_to_inspector TEXT,
  ADD COLUMN IF NOT EXISTS listing_platform TEXT,
  ADD COLUMN IF NOT EXISTS ops_status TEXT DEFAULT 'new';

-- The base schema allows a buyer to update their entire own profile row,
-- including role/is_active. No client profile writes are needed for this flow;
-- privileged server routes use the Supabase service role.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Terms are recorded/read by server routes using the service role only.
-- No authenticated or anonymous client policy is granted.
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Keep the base-schema buyer read policy, and ensure no client writes to orders.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;