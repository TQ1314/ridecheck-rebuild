-- RideCheck Phase 5-9: User Management, Inspector Portal, QA, Delivery
-- ADDITIVE ONLY: No drops, no renames. All new columns are nullable or have defaults.
-- Run this migration manually in Supabase SQL Editor AFTER 002_ops_engine.sql.

-- ==============================================
-- A) Role Definitions table
-- ==============================================
CREATE TABLE IF NOT EXISTS role_definitions (
  role TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT
);

INSERT INTO role_definitions (role, display_name, description) VALUES
  ('customer', 'Customer', 'Buyers who book assessments'),
  ('operations', 'Operations', 'Handle day-to-day order processing'),
  ('operations_lead', 'Operations Lead', 'Manage ops team and assign work'),
  ('inspector', 'RideChecker', 'Field inspectors who perform assessments'),
  ('qa', 'Quality Assurance', 'Review and approve inspection reports'),
  ('developer', 'Developer', 'Platform development and maintenance'),
  ('platform', 'Platform', 'Platform-level analytics and oversight'),
  ('owner', 'Owner', 'Full administrative access')
ON CONFLICT (role) DO NOTHING;

-- ==============================================
-- B) User Invites table
-- ==============================================
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);

ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- C) New columns on orders for report workflow
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_status') THEN
    ALTER TABLE orders ADD COLUMN report_status TEXT NOT NULL DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_storage_path') THEN
    ALTER TABLE orders ADD COLUMN report_storage_path TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='report_uploaded_at') THEN
    ALTER TABLE orders ADD COLUMN report_uploaded_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='qa_status') THEN
    ALTER TABLE orders ADD COLUMN qa_status TEXT NOT NULL DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='qa_notes') THEN
    ALTER TABLE orders ADD COLUMN qa_notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='qa_reviewed_by') THEN
    ALTER TABLE orders ADD COLUMN qa_reviewed_by UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='qa_reviewed_at') THEN
    ALTER TABLE orders ADD COLUMN qa_reviewed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspector_status') THEN
    ALTER TABLE orders ADD COLUMN inspector_status TEXT NOT NULL DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='inspector_notes') THEN
    ALTER TABLE orders ADD COLUMN inspector_notes TEXT;
  END IF;
END $$;

-- ==============================================
-- D) Link inspectors to auth users (optional profile_id)
-- ==============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspectors' AND column_name='user_id') THEN
    ALTER TABLE inspectors ADD COLUMN user_id UUID;
  END IF;
END $$;

-- ==============================================
-- E) Indexes for new workflows
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_orders_report_status ON orders(report_status);
CREATE INDEX IF NOT EXISTS idx_orders_qa_status ON orders(qa_status);
CREATE INDEX IF NOT EXISTS idx_orders_inspector_status ON orders(inspector_status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_inspector ON orders(assigned_inspector_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_inspectors_user_id ON inspectors(user_id);
