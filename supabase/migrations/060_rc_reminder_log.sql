-- RC Reminder Log: dedup table so we don't spam RideCheckers
CREATE TABLE IF NOT EXISTS rc_reminder_log (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      timestamptz DEFAULT now(),
  ridechecker_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_key    text        NOT NULL,
  sent_by         uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  channels        text[]      NOT NULL DEFAULT '{email}',
  email_sent      boolean     NOT NULL DEFAULT false,
  sms_sent        boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rc_reminder_log_rc_template
  ON rc_reminder_log(ridechecker_id, template_key, created_at DESC);

ALTER TABLE rc_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ops can manage reminder log" ON rc_reminder_log;
CREATE POLICY "ops can manage reminder log"
  ON rc_reminder_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('operations','operations_lead','ops_lead','admin','owner','ops')
        AND profiles.is_active = true
    )
  );
