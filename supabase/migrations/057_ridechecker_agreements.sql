-- Migration 057: RideChecker Agreement Acceptance System
-- Run in Supabase SQL Editor
-- Additive only — does not modify any existing table constraints

-- ── ridechecker_agreements ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ridechecker_agreements (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ridechecker_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agreement_version        text        NOT NULL,
  agreement_title          text        NOT NULL,
  signed_name              text        NOT NULL,
  signed_at                timestamptz NOT NULL DEFAULT now(),
  ip_address               text        NULL,
  user_agent               text        NULL,
  agreement_text_snapshot  text        NOT NULL,
  pdf_url                  text        NULL,
  status                   text        NOT NULL DEFAULT 'signed'
                             CHECK (status IN ('signed', 'superseded', 'voided')),
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_agreements_ridechecker_id ON ridechecker_agreements(ridechecker_id);
CREATE INDEX IF NOT EXISTS idx_rc_agreements_version       ON ridechecker_agreements(agreement_version);
CREATE INDEX IF NOT EXISTS idx_rc_agreements_status        ON ridechecker_agreements(status);
CREATE INDEX IF NOT EXISTS idx_rc_agreements_signed_at     ON ridechecker_agreements(signed_at DESC);

-- ── profiles: agreement tracking columns ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='agreement_status') THEN
    ALTER TABLE profiles ADD COLUMN agreement_status text NOT NULL DEFAULT 'not_signed'
      CHECK (agreement_status IN ('not_signed', 'signed', 'outdated'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='current_agreement_version') THEN
    ALTER TABLE profiles ADD COLUMN current_agreement_version text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='agreement_signed_at') THEN
    ALTER TABLE profiles ADD COLUMN agreement_signed_at timestamptz NULL;
  END IF;
END $$;

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE ridechecker_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rc_can_read_own_agreements" ON ridechecker_agreements;
CREATE POLICY "rc_can_read_own_agreements"
  ON ridechecker_agreements
  FOR SELECT
  USING (ridechecker_id = auth.uid());

DROP POLICY IF EXISTS "rc_can_insert_own_agreements" ON ridechecker_agreements;
CREATE POLICY "rc_can_insert_own_agreements"
  ON ridechecker_agreements
  FOR INSERT
  WITH CHECK (ridechecker_id = auth.uid());

DROP POLICY IF EXISTS "ops_rc_agreements_all" ON ridechecker_agreements;
CREATE POLICY "ops_rc_agreements_all"
  ON ridechecker_agreements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','owner','operations','operations_lead','ops_lead','ops')
    )
  );
