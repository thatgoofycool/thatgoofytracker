import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { db, songs } from '@/lib/db';
import { isNull, or } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Find songs missing preview or waveform and with an uploaded original audio
  const pending = await db.select().from(songs)
    .where(or(isNull(songs.previewUrl), isNull(songs.waveformJson))) as any[];

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const fnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-preview`;

  let triggered = 0;
  for (const s of pending) {
    if (!s.audioUrl) continue;
    const payload = {
      type: 'INSERT',
      table: 'storage.objects',
      record: { bucket_id: 'audio-originals', name: s.audioUrl, size: 0, metadata: {} },
    };
    await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRole}` },
      body: JSON.stringify(payload),
    });
    triggered++;
  }
  return NextResponse.json({ ok: true, triggered });
}


