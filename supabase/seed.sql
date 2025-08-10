INSERT INTO public.tags (name, slug, color, description) VALUES
  ('reference_needed', 'reference-needed', 'amber', 'Need reference track'),
  ('melodic_update', 'melodic-update', 'violet', 'Melody changes'),
  ('bass_update', 'bass-update', 'cyan', 'Bassline changes'),
  ('misc_changes', 'misc-changes', 'slate', 'Misc edits'),
  ('mixing', 'mixing', 'sky', 'Mixing pass'),
  ('mastering', 'mastering', 'emerald', 'Mastering pass')
ON CONFLICT (slug) DO NOTHING;


