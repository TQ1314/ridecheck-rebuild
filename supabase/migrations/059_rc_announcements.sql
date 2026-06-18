-- RC Announcements: group messages from ops to RideCheckers
CREATE TABLE IF NOT EXISTS rc_announcements (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      timestamptz DEFAULT now(),
  sent_by         uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  subject         text        NOT NULL,
  body            text        NOT NULL,
  channels        text[]      NOT NULL DEFAULT '{email}',
  recipient_group text        NOT NULL DEFAULT 'all',
  area_filter     text,
  recipient_count int         NOT NULL DEFAULT 0,
  email_sent      int         NOT NULL DEFAULT 0,
  sms_sent        int         NOT NULL DEFAULT 0,
  email_failed    int         NOT NULL DEFAULT 0,
  sms_failed      int         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rc_announcements_created_at ON rc_announcements(created_at DESC);

ALTER TABLE rc_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops can manage announcements"
  ON rc_announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operations','operations_lead','ops_lead','admin','owner','ops')
        AND profiles.is_active = true
    )
  );
