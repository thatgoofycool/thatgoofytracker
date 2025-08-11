# Cloud Run Playback Worker

HTTP worker that:
- Downloads originals from Supabase Storage (`audio-originals`)
- If bit-depth > 24 or floating-point, converts to 16-bit PCM WAV (no resample)
- Creates full-length MP3 playback at 128 kbps, 44.1 kHz
- Uploads playback to `audio-previews`
- Updates the `songs` row fields

Environment variables:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- WORKER_SECRET (shared secret for Authorization header)


