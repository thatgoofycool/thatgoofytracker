-- Rename existing tags if present (updates both name and slug)
UPDATE public.tags SET name = 'melodic_prod_needed', slug = 'melodic-prod-needed' WHERE slug = 'melodic-update' OR name = 'melodic_update';
UPDATE public.tags SET name = 'bass_needed', slug = 'bass-needed' WHERE slug = 'bass-update' OR name = 'bass_update';
UPDATE public.tags SET name = 'misc_prod_needed', slug = 'misc-prod-needed' WHERE slug = 'misc-changes' OR name = 'misc_changes';
UPDATE public.tags SET name = 'drums_needed', slug = 'drums-needed' WHERE slug = 'drums-update' OR name = 'drums_update';

-- Seed (idempotent): new names and slugs
INSERT INTO public.tags (name, slug, color, description) VALUES
  ('reference_needed', 'reference-needed', 'amber', 'Need reference track'),
  ('melodic_prod_needed', 'melodic-prod-needed', 'violet', 'Melody changes'),
  ('bass_needed', 'bass-needed', 'cyan', 'Bassline changes'),
  ('misc_prod_needed', 'misc-prod-needed', 'slate', 'Misc edits'),
  ('mixing', 'mixing', 'sky', 'Mixing pass'),
  ('mastering', 'mastering', 'emerald', 'Mastering pass'),
  ('drums_needed', 'drums-needed', 'rose', 'Drums changes')
ON CONFLICT (slug) DO NOTHING;


