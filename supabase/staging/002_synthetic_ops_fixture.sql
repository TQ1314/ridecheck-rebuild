-- Only for the empty RideCheck-Staging project. No Auth user or real contact.
-- This profile is a notification recipient, not a login-capable Ops account.
INSERT INTO public.profiles (id, email, full_name, phone, role, is_active)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'ops-test@example.invalid',
  'RideCheck Test Ops',
  '+12025550125',
  'operations',
  true
)
ON CONFLICT (id) DO NOTHING;