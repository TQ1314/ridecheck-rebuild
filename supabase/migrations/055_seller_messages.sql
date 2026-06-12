-- Migration 055: Seller Reply Capture System
-- Run in Supabase SQL Editor

-- ── seller_messages table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid        REFERENCES orders(id) ON DELETE CASCADE,
  channel          text        NOT NULL CHECK (channel IN ('sms', 'email')),
  direction        text        NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  from_address     text,
  to_address       text,
  subject          text,
  body             text,
  raw_payload      jsonb,
  match_method     text,        -- 'phone_lookup' | 'email_lookup' | 'subject_order_ref' | 'reply_to_tag'
  extracted_dates  text[]  DEFAULT '{}',
  extracted_times  text[]  DEFAULT '{}',
  extracted_addresses text[] DEFAULT '{}',
  extracted_phones text[]  DEFAULT '{}',
  is_read          boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_messages_order_id ON seller_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_seller_messages_direction ON seller_messages(direction);
CREATE INDEX IF NOT EXISTS idx_seller_messages_created_at ON seller_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_messages_from_address ON seller_messages(from_address);

-- ── New columns on orders ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_replied_at') THEN
    ALTER TABLE orders ADD COLUMN seller_replied_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_inspection_address') THEN
    ALTER TABLE orders ADD COLUMN seller_inspection_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_available_date') THEN
    ALTER TABLE orders ADD COLUMN seller_available_date text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='seller_available_time') THEN
    ALTER TABLE orders ADD COLUMN seller_available_time text;
  END IF;
END $$;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE seller_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "ops_seller_messages_all"
  ON seller_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','owner','operations','operations_lead','ops_lead','ops')
    )
  );
