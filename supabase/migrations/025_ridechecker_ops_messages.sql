CREATE TABLE IF NOT EXISTS ridechecker_ops_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID,
  order_id UUID,
  ridechecker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ridechecker_ops_messages_assignment
  ON ridechecker_ops_messages(assignment_id);

CREATE INDEX IF NOT EXISTS idx_ridechecker_ops_messages_ridechecker
  ON ridechecker_ops_messages(ridechecker_id);

ALTER TABLE ridechecker_ops_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ridechecker_ops_messages_insert"
  ON ridechecker_ops_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (ridechecker_id = auth.uid());

CREATE POLICY "ridechecker_ops_messages_select_own"
  ON ridechecker_ops_messages
  FOR SELECT
  TO authenticated
  USING (ridechecker_id = auth.uid());
