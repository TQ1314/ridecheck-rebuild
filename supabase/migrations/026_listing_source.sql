-- Migration 026: Add listing_source to orders
-- Tracks how/where the buyer found the vehicle being assessed.
-- Values: online_marketplace (default), dealership, roadside

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS listing_source TEXT NOT NULL DEFAULT 'online_marketplace';

COMMENT ON COLUMN orders.listing_source IS 'Where the buyer found the vehicle: online_marketplace, dealership, or roadside';
