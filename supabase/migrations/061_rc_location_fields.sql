-- RC structured location fields
-- service_area (free text) already exists; these add structured fields.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rc_city              TEXT,
  ADD COLUMN IF NOT EXISTS rc_state             TEXT,
  ADD COLUMN IF NOT EXISTS rc_zip               TEXT,
  ADD COLUMN IF NOT EXISTS service_radius_miles INT DEFAULT 30;

CREATE INDEX IF NOT EXISTS idx_profiles_rc_state ON public.profiles(rc_state);
CREATE INDEX IF NOT EXISTS idx_profiles_rc_zip   ON public.profiles(rc_zip);
