import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { db, songs } from '@/lib/db';
import { and, isNotNull, isNull, or } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Find songs missing preview or waveform and with an uploaded original audio
  const pending = await db
    .select()
    .from(songs)
    .where(and(or(isNull(songs.previewUrl), isNull(songs.waveformJson)), isNotNull(songs.audioUrl))) as any[];

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const fnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-preview`;

  const withTimeout = async (ms: number, task: () => Promise<Response>) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      return await task().catch((e) => {
        throw e;
      });
    } finally {
      clearTimeout(id);
    }
  };

  const results = await Promise.allSettled(
    pending.map(async (s) => {
      const payload = {
        type: 'INSERT',
        table: 'storage.objects',
        record: { bucket_id: 'audio-originals', name: s.audioUrl, size: 0, metadata: {} },
      };
      const res = await withTimeout(15000, () =>
        fetch(fnUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRole}` },
          body: JSON.stringify(payload),
        })
      );
      const ok = res.ok;
      const body = await res.text().catch(() => '');
      return { id: s.id, ok, status: res.status, body };
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  const failed = results.filter((r) => r.status === 'fulfilled' && !r.value.ok).length;
  const errors = results.filter((r) => r.status === 'rejected').length;
  const triggered = pending.length;

  return NextResponse.json({ ok: true, triggered, succeeded, failed, errors });
}


