-- 042_seller_type.sql
-- Adds seller_type to orders for workflow branching across the platform.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_type TEXT DEFAULT 'private_party';

-- Back-fill all existing orders
UPDATE orders SET seller_type = 'private_party' WHERE seller_type IS NULL;

ALTER TABLE orders
  ALTER COLUMN seller_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_seller_type ON orders(seller_type);
