-- Enable RLS
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helper: map auth.uid() to users.role
CREATE OR REPLACE VIEW public.current_user_role AS
  SELECT u.id, u.role FROM public.users u
  WHERE u.id = auth.uid();

-- Public select policies (read-only fields)
DROP POLICY IF EXISTS "public read songs" ON public.songs;
CREATE POLICY "public read songs" ON public.songs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read tags" ON public.tags;
CREATE POLICY "public read tags" ON public.tags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read song_tags" ON public.song_tags;
CREATE POLICY "public read song_tags" ON public.song_tags
  FOR SELECT USING (true);

-- Mutation policies: admin/editor only
DROP POLICY IF EXISTS "write songs admin/editor" ON public.songs;
CREATE POLICY "write songs admin/editor" ON public.songs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','editor')));

DROP POLICY IF EXISTS "write tags admin/editor" ON public.tags;
CREATE POLICY "write tags admin/editor" ON public.tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','editor')));

DROP POLICY IF EXISTS "write song_tags admin/editor" ON public.song_tags;
CREATE POLICY "write song_tags admin/editor" ON public.song_tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','editor')));


