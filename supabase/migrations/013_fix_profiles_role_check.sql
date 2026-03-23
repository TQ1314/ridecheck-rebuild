-- Fix profiles_role_check constraint to include all valid system roles.
-- The previous constraint (created in Supabase dashboard) did not include
-- 'ridechecker' or 'ridechecker_active', causing 500 errors on:
--   1. RideChecker signup  (INSERT with role = 'ridechecker')
--   2. RideChecker approval (UPDATE role = 'ridechecker_active')

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'customer',
    'operations',
    'operations_lead',
    'ridechecker',
    'ridechecker_active',
    'inspector',
    'qa',
    'developer',
    'platform',
    'owner'
  ));
