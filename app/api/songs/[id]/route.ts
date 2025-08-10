import { NextRequest, NextResponse } from 'next/server';
import { db, songs, songTags, tags, logAudit } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { songUpdateSchema, assignTagsSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { corsHeaders, preflight } from '@/lib/cors';
import { limitRequest } from '@/lib/rateLimit';

export async function OPTIONS(req: NextRequest) { return preflight(req); }

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [row] = await db.select().from(songs).where(eq(songs.id, params.id)).limit(1);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const origin = req.headers.get('origin') || undefined;
  const cors = corsHeaders(origin);

  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin', 'editor'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await limitRequest(`songs:update:${session?.user?.id}:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const body = await req.json();
  const parsed = songUpdateSchema.safeParse({ ...body, id: params.id });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const { id, ...updates } = parsed.data as any;
  const [updated] = await db.update(songs).set({ ...updates, updatedBy: session?.user?.id, updatedAt: new Date() }).where(eq(songs.id, params.id)).returning();
  await logAudit({ userId: session?.user?.id, entityType: 'song', entityId: params.id, action: 'update' });
  return NextResponse.json(updated, { headers: cors });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const origin = req.headers.get('origin') || undefined;
  const cors = corsHeaders(origin);
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin', 'editor'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await limitRequest(`songs:delete:${session?.user?.id}:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  await db.delete(songs).where(eq(songs.id, params.id));
  await logAudit({ userId: session?.user?.id, entityType: 'song', entityId: params.id, action: 'delete' });
  return NextResponse.json({ ok: true }, { headers: cors });
}


