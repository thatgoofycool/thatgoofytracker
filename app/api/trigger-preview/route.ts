import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { limitRequest } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin', 'editor'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await limitRequest(`preview:trigger:${session?.user?.id}:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { bucket, path, size } = await req.json();
  if (!bucket || !path) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const fnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-preview`;

  const payload = { type: 'INSERT', table: 'storage.objects', record: { bucket_id: bucket, name: path, size: Number(size || 0), metadata: {} } };
  const res = await fetch(fnUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRole}` }, body: JSON.stringify(payload) });
  if (!res.ok) return NextResponse.json({ error: 'Function error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}


