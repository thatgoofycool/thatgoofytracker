import { NextRequest, NextResponse } from 'next/server';
import { db, songTags } from '@/lib/db';
import { assignTagsSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { eq, inArray } from 'drizzle-orm';
import { handleCors } from '@/lib/cors';
import { limitRequest } from '@/lib/rateLimit';

export async function OPTIONS(req: NextRequest) { return handleCors(req); }

export async function POST(req: NextRequest) {
  const cors = handleCors(req);
  if (cors instanceof NextResponse) return cors;
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin', 'editor'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await limitRequest(`song-tags:assign:${session?.user?.id}:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  const body = await req.json();
  const parsed = assignTagsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  const { songId, tagIds } = parsed.data;
  // Remove existing
  await db.delete(songTags).where(eq(songTags.songId, songId));
  // Add new
  if (tagIds.length) {
    await db.insert(songTags).values(tagIds.map(tid => ({ songId, tagId: tid })));
  }
  return NextResponse.json({ ok: true }, { headers: cors });
}


