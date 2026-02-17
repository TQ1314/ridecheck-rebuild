-- RideCheck Phase 2: Ops Engine B
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable or have defaults.
-- Run this migration manually in Supabase SQL Editor AFTER 001_add_upgrade_columns.sql.

-- ==============================================
-- A) New columns on orders table
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_status') THEN
    ALTER TABLE orders ADD COLUMN ops_status TEXT DEFAULT 'new';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='assigned_inspector_id') THEN
    ALTER TABLE orders ADD COLUMN assigned_inspector_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='assigned_at') THEN
    ALTER TABLE orders ADD COLUMN assigned_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_contact_attempts') THEN
    ALTER TABLE orders ADD COLUMN seller_contact_attempts INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_contacted_at') THEN
    ALTER TABLE orders ADD COLUMN seller_contacted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_confirmed_at') THEN
    ALTER TABLE orders ADD COLUMN seller_confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_requested_at') THEN
    ALTER TABLE orders ADD COLUMN payment_requested_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspection_scheduled_for') THEN
    ALTER TABLE orders ADD COLUMN inspection_scheduled_for TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspection_completed_at') THEN
    ALTER TABLE orders ADD COLUMN inspection_completed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_delivered_at') THEN
    ALTER TABLE orders ADD COLUMN report_delivered_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_priority') THEN
    ALTER TABLE orders ADD COLUMN ops_priority INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ops_notes') THEN
    ALTER TABLE orders ADD COLUMN ops_notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='hold_status') THEN
    ALTER TABLE orders ADD COLUMN hold_status TEXT DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_url') THEN
    ALTER TABLE orders ADD COLUMN payment_link_url TEXT;
  END IF;
END $$;

-- ==============================================
-- B) Inspectors table
-- ==============================================
CREATE TABLE IF NOT EXISTS inspectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  region TEXT,
  specialties TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_daily_capacity INT NOT NULL DEFAULT 3,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inspectors ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- C) Order Events table (timeline of what happened)
-- ==============================================
CREATE TABLE IF NOT EXISTS order_events (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT,
  details JSONB,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If order_events already existed with missing columns, add them
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_events' AND column_name='actor_id') THEN
    ALTER TABLE order_events ADD COLUMN actor_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_events' AND column_name='actor_email') THEN
    ALTER TABLE order_events ADD COLUMN actor_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_events' AND column_name='details') THEN
    ALTER TABLE order_events ADD COLUMN details JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_events' AND column_name='is_internal') THEN
    ALTER TABLE order_events ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON order_events(created_at);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- D) Audit Log table (every admin/ops action)
-- ==============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If audit_log already existed with missing columns, add them
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='actor_id') THEN
    ALTER TABLE audit_log ADD COLUMN actor_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='actor_email') THEN
    ALTER TABLE audit_log ADD COLUMN actor_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='actor_role') THEN
    ALTER TABLE audit_log ADD COLUMN actor_role TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='resource_type') THEN
    ALTER TABLE audit_log ADD COLUMN resource_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='resource_id') THEN
    ALTER TABLE audit_log ADD COLUMN resource_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='old_value') THEN
    ALTER TABLE audit_log ADD COLUMN old_value JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='new_value') THEN
    ALTER TABLE audit_log ADD COLUMN new_value JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='metadata') THEN
    ALTER TABLE audit_log ADD COLUMN metadata JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='ip_address') THEN
    ALTER TABLE audit_log ADD COLUMN ip_address TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- E) Index for FIFO queue ordering on orders
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_orders_fifo_queue ON orders(ops_priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_orders_ops_status ON orders(ops_status);
