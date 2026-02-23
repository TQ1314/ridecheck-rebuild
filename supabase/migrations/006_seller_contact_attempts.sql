-- Migration 006: Seller contact attempts table and order columns
-- Run this manually in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS seller_contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attempt_number int NOT NULL,
  channel text NOT NULL,
  destination text,
  message_template_key text,
  message_body text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_platform') THEN
    ALTER TABLE orders ADD COLUMN seller_platform text DEFAULT 'other';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_contact_status') THEN
    ALTER TABLE orders ADD COLUMN seller_contact_status text DEFAULT 'not_started';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_outcome_notes') THEN
    ALTER TABLE orders ADD COLUMN seller_outcome_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_email') THEN
    ALTER TABLE orders ADD COLUMN seller_email text;
  END IF;
END $$;
