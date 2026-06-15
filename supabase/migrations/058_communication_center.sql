-- Migration 058: Communication Center — extend seller_messages for all parties
-- Run in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seller_messages' AND column_name='sender_type') THEN
    ALTER TABLE seller_messages ADD COLUMN sender_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seller_messages' AND column_name='recipient_type') THEN
    ALTER TABLE seller_messages ADD COLUMN recipient_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seller_messages' AND column_name='status') THEN
    ALTER TABLE seller_messages ADD COLUMN status text DEFAULT 'received';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seller_messages' AND column_name='created_by') THEN
    ALTER TABLE seller_messages ADD COLUMN created_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Backfill existing inbound rows: they are from seller → ops
UPDATE seller_messages
SET
  sender_type    = 'seller',
  recipient_type = 'ops',
  status         = 'received'
WHERE direction = 'inbound'
  AND sender_type IS NULL;

-- Index for filtering by sender/recipient
CREATE INDEX IF NOT EXISTS idx_seller_messages_sender_type    ON seller_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_seller_messages_recipient_type ON seller_messages(recipient_type);
