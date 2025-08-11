import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { limitRequest } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin', 'editor'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await limitRequest(`playback:trigger:${session?.user?.id}:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { songId, bucket, path, size } = await req.json();
  if (!songId || !bucket || !path) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const endpoint = process.env.PLAYBACK_WORKER_URL || '';
  const workerSecret = process.env.PLAYBACK_WORKER_SECRET || '';
  if (!endpoint || !workerSecret) {
    return NextResponse.json({ error: 'Server misconfigured: PLAYBACK_WORKER_URL/SECRET missing' }, { status: 500 });
  }

  const payload = { songId, bucket, path, size: Number(size || 0) };
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 15000);
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerSecret}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
      keepalive: true,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Request failed', message: String(e?.message || e) }, { status: 500 });
  }
}


