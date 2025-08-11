DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='playback_url'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN playback_url text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='duration_sec'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN duration_sec integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='original_size_bytes'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN original_size_bytes integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='playback_size_bytes'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN playback_size_bytes integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='playback_bitrate_kbps'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN playback_bitrate_kbps integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='original_bit_depth'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN original_bit_depth integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='original_sample_rate'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN original_sample_rate integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='processing_status'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN processing_status text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='last_processing_error'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN last_processing_error text;
  END IF;
END $$;


