INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-originals', 'audio-originals', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-previews', 'audio-previews', true)
ON CONFLICT (id) DO NOTHING;
