## Album Progress Tracker

A sleek, modern Next.js 14 app to track song progress. Secure previews, RBAC, Supabase Storage/DB, Drizzle, and NextAuth.

### Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Auth: NextAuth (Google/GitHub)
- DB: Supabase Postgres + Drizzle ORM
- Storage: Supabase Storage (originals private, previews public/signed)
- Background: Supabase Edge Function (FFmpeg) for 30s preview + waveform JSON

### Security Highlights
- Strict security headers (CSP, HSTS, X-Frame-Options DENY, etc.)
- RBAC server-enforced (admin/editor mutate; viewer/public read-only)
- RLS policies for tables; storage originals private and signed
- Rate limiting via Upstash (optional) with in-memory fallback for dev
- Zod validation on all inputs; strict file allowlist and size guard

### Windows 11 Setup (PowerShell)
Do not run these until you confirm. Replace placeholders in `.env.example`, then copy to `.env.local`.

1. Install deps
```
npm install
```

2. Generate and run migrations (requires `POSTGRES_URL` environment set to your Supabase connection string)
```
npx drizzle-kit generate --config=drizzle.config.ts
npx drizzle-kit migrate --config=drizzle.config.ts
```

3. Seed default tags
```
npx tsx scripts/seed.ts
```

4. Supabase provisioning (run in the Supabase SQL editor):
- Execute `drizzle/0000_init.sql`
- Execute `supabase/policies.sql`
- Execute `supabase/storage.sql`
- Execute `supabase/seed.sql` (optional; same as script seed)

5. Deploy Edge Function (FFmpeg)
```
supabase functions deploy generate-preview --project-ref <your-ref>
```
Configure Storage trigger: bucket `audio-originals`, event `Object Created`, target `generate-preview` function. Ensure env vars `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set for the function.

6. Run app locally
```
npm run dev
```

### Environment Vars
Copy `.env.example` to `.env.local` and fill:
- `NEXTAUTH_SECRET` strong value
- `POSTGRES_URL` from Supabase (connection string)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only)
- OAuth provider keys

### Auth & Roles
- On first sign-in, user is created with `viewer` role. Promote a user by updating `users.role` to `editor` or `admin` via SQL (separate admin-only console).

### RLS Policies
- `songs`, `tags`, `song_tags`: public read; write limited to admin/editor via `users.role` mapping.

### Uploads
- Client requests signed upload URL via `POST /api/upload` (auth required: admin/editor)
- Uploads go to `audio-originals` (private)
- Server calls Cloud Run worker via `POST /api/trigger-playback` to normalize originals (quantize >24-bit or float to 16-bit PCM) and create a full-length 128 kbps MP3 playback into `audio-previews`, then updates `songs.playback_url`

### CORS
- Restricted to `NEXT_PUBLIC_APP_URL`

### Tests
```
npm run test
npm run test:e2e
```

### Deployment
- Vercel for Next.js app; set all env vars in Vercel project
- Supabase for DB/Auth/Storage/Functions

### Notes
- Service role key must never be exposed client-side; only used in server routes/functions
- Signed URLs for originals; previews can be public or short-lived signed


