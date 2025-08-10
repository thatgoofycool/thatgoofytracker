import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { uploadRequestSchema } from '@/lib/validators';
import { createClient } from '@supabase/supabase-js';
import { db, songs } from '@/lib/db';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { limitRequest } from '@/lib/rateLimit';
import { corsHeaders, preflight } from '@/lib/cors';

export async function OPTIONS(req: NextRequest) { return preflight(req); }

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') || undefined;
  const cors = corsHeaders(origin);

  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!assertRole(role, ['admin', 'editor'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await limitRequest(`upload:${session?.user?.id}:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const body = await req.json();
  const parsed = uploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { fileName, contentType, fileSize, songId } = parsed.data;

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Normalize and hash filename to UUID-like path
  const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
  const allowedExt = ['wav', 'aiff', 'aif', 'mp3', 'm4a'];
  if (!allowedExt.includes(ext)) return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });

  const objectName = `${songId}/${crypto.randomUUID()}.${ext}`;
  const bucket = 'audio-originals';

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectName);
  if (error || !data) {
    return NextResponse.json({ error: 'Failed to sign upload' }, { status: 500 });
  }

  // Optimistically set audio_url so the app can show link; Edge Function will set preview later.
  await db.update(songs).set({ audioUrl: objectName, updatedBy: session?.user?.id, updatedAt: new Date() }).where(eq(songs.id, songId));

  return NextResponse.json({
    url: data.signedUrl,
    token: data.token,
    path: objectName,
    bucket,
    contentType,
  }, { headers: cors });
}


