CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Safe column add for cover_url
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'songs' AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN cover_url text;
  END IF;
END $$;


