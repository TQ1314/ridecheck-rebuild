-- Migration 027: Add platform_source and vehicle_seen_location to orders
-- platform_source: specific site/place where buyer found the vehicle
--   (e.g. facebook_marketplace, craigslist, offerup, cargurus, autotrader,
--         cars_com, dealership_website, walked_in, roadside_sign, other)
-- vehicle_seen_location: for roadside orders — where the car is physically parked
--   (may differ from seller address / vehicle_location)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS platform_source TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_seen_location TEXT;

COMMENT ON COLUMN orders.platform_source IS 'Specific platform or place where the buyer found the vehicle';
COMMENT ON COLUMN orders.vehicle_seen_location IS 'Physical location of the parked car (roadside orders only)';
