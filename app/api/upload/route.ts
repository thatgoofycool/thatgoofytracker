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
  const { fileName, contentType, fileSize, songId, kind } = parsed.data;

  const url = process.env.SUPABASE_URL || '';
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !service) {
    return NextResponse.json({ error: 'Server misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 });
  }
  const supabase = createClient(url, service);

  // Normalize and hash filename to UUID-like path
  const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
  const allowedExt = kind === 'cover' ? ['png', 'jpg', 'jpeg', 'webp'] : ['wav', 'aiff', 'aif', 'mp3', 'm4a'];
  if (!allowedExt.includes(ext)) return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });

  const objectName = kind === 'cover' ? `${songId}/cover.${ext}` : `${songId}/${crypto.randomUUID()}.${ext}`;
  const bucket = kind === 'cover' ? 'audio-previews' : 'audio-originals';

  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectName);
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to sign upload', details: error?.message }, { status: 500 });
    }

    // Optimistically set fields so the app can reflect immediately
    if (kind === 'audio') {
      await db.update(songs).set({ audioUrl: objectName, audioOriginalName: fileName, updatedBy: session?.user?.id, updatedAt: new Date() }).where(eq(songs.id, songId));
    } else {
      // Build public URL for cover in public bucket
      const base = url.replace(/\/$/, '');
      const publicUrl = `${base}/storage/v1/object/public/${bucket}/${objectName}`;
      await db.update(songs).set({ coverUrl: publicUrl, coverOriginalName: fileName, updatedBy: session?.user?.id, updatedAt: new Date() }).where(eq(songs.id, songId));
    }

    return NextResponse.json({
      url: data.signedUrl,
      token: data.token,
      path: objectName,
      bucket,
      contentType,
    }, { headers: cors });
  } catch (e: any) {
    return NextResponse.json({ error: 'Unexpected error', message: String(e?.message || e) }, { status: 500 });
  }
}


