-- Migration 005: Payment link columns for SMS-first payment flow
-- Run this manually in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_token') THEN
    ALTER TABLE orders ADD COLUMN payment_link_token text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_sent_to') THEN
    ALTER TABLE orders ADD COLUMN payment_link_sent_to text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_sent_channel') THEN
    ALTER TABLE orders ADD COLUMN payment_link_sent_channel text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_sent_at') THEN
    ALTER TABLE orders ADD COLUMN payment_link_sent_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_click_ip') THEN
    ALTER TABLE orders ADD COLUMN payment_link_click_ip text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_link_click_ua') THEN
    ALTER TABLE orders ADD COLUMN payment_link_click_ua text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='stripe_session_id') THEN
    ALTER TABLE orders ADD COLUMN stripe_session_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='base_price') THEN
    ALTER TABLE orders ADD COLUMN base_price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='final_price') THEN
    ALTER TABLE orders ADD COLUMN final_price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='discount_amount') THEN
    ALTER TABLE orders ADD COLUMN discount_amount numeric;
  END IF;
END $$;
