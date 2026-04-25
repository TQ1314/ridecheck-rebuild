-- Migration 023: RideChecker Verification Layer
-- Adds identity verification fields to profiles.
-- Creates a private Supabase Storage bucket for verification documents.
-- ADDITIVE ONLY: no drops, no renames.

-- =============================================================
-- A) Verification fields on public.profiles
-- =============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='verification_status') THEN
    ALTER TABLE public.profiles ADD COLUMN verification_status TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='legal_name') THEN
    ALTER TABLE public.profiles ADD COLUMN legal_name TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='date_of_birth') THEN
    ALTER TABLE public.profiles ADD COLUMN date_of_birth DATE NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='address_line1') THEN
    ALTER TABLE public.profiles ADD COLUMN address_line1 TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='address_city') THEN
    ALTER TABLE public.profiles ADD COLUMN address_city TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='address_state') THEN
    ALTER TABLE public.profiles ADD COLUMN address_state TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='address_zip') THEN
    ALTER TABLE public.profiles ADD COLUMN address_zip TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id_document_path') THEN
    ALTER TABLE public.profiles ADD COLUMN id_document_path TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='selfie_path') THEN
    ALTER TABLE public.profiles ADD COLUMN selfie_path TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='has_reliable_transportation') THEN
    ALTER TABLE public.profiles ADD COLUMN has_reliable_transportation BOOLEAN NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='agreement_accepted_at') THEN
    ALTER TABLE public.profiles ADD COLUMN agreement_accepted_at TIMESTAMPTZ NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='verification_submitted_at') THEN
    ALTER TABLE public.profiles ADD COLUMN verification_submitted_at TIMESTAMPTZ NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='verification_reviewed_at') THEN
    ALTER TABLE public.profiles ADD COLUMN verification_reviewed_at TIMESTAMPTZ NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='verification_review_notes') THEN
    ALTER TABLE public.profiles ADD COLUMN verification_review_notes TEXT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='verification_reviewed_by') THEN
    ALTER TABLE public.profiles ADD COLUMN verification_reviewed_by UUID NULL;
  END IF;
END $$;

-- =============================================================
-- B) Private storage bucket for verification documents
-- =============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ridechecker-verifications',
  'ridechecker-verifications',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- C) Storage RLS: ridecheckers upload/read their own folder
-- =============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'rc_verif_upload'
  ) THEN
    CREATE POLICY "rc_verif_upload"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'ridechecker-verifications' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'rc_verif_select_own'
  ) THEN
    CREATE POLICY "rc_verif_select_own"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'ridechecker-verifications' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'rc_verif_update_own'
  ) THEN
    CREATE POLICY "rc_verif_update_own"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'ridechecker-verifications' AND
        (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'ridechecker-verifications' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
