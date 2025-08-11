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

  const withTimeout = async (ms: number, input: RequestInfo | URL, init: RequestInit): Promise<{ ok: boolean; status: number; body: string }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      const body = await res.text().catch(() => '');
      return { ok: res.ok, status: res.status, body };
    } catch (_e) {
      return { ok: false, status: 0, body: 'timeout' };
    } finally {
      clearTimeout(timer);
    }
  };

  // Limit concurrency to avoid long hangs; process in small batches
  const batchSize = 8;
  const results: Array<{ ok: boolean; status: number; body: string }> = [];
  for (let i = 0; i < pending.length; i += batchSize) {
    const slice = pending.slice(i, i + batchSize);
    const settled = await Promise.all(
      slice.map(async (s) => {
        const payload = {
          type: 'INSERT',
          table: 'storage.objects',
          record: { bucket_id: 'audio-originals', name: s.audioUrl, size: 0, metadata: {} },
        };
        return withTimeout(12000, fnUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRole}` },
          body: JSON.stringify(payload),
        });
      })
    );
    results.push(...settled);
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok && r.status !== 0).length;
  const errors = results.filter((r) => r.status === 0).length;
  const triggered = pending.length;

  return NextResponse.json({ ok: true, triggered, succeeded, failed, errors });
}


