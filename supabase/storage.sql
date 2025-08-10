-- Buckets
select storage.create_bucket('audio-originals', jsonb_build_object('public', false));
select storage.create_bucket('audio-previews', jsonb_build_object('public', true));

-- Restrict originals to signed URLs only
-- (Supabase storage policies can be set via dashboard; documented in README)


