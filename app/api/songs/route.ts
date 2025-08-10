import { NextRequest, NextResponse } from 'next/server';
import { db, songs, tags, songTags, logAudit } from '@/lib/db';
import { and, desc, eq, ilike, inArray } from 'drizzle-orm';
import { paginationQuerySchema, songCreateSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { handleCors } from '@/lib/cors';
import { limitRequest } from '@/lib/rateLimit';

export async function OPTIONS(req: NextRequest) { return handleCors(req); }

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qp = Object.fromEntries(url.searchParams.entries());
  const parsed = paginationQuerySchema.safeParse(qp);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad params' }, { status: 400 });
  }
  const { page, perPage, q, status, tag } = parsed.data;

  const where = [] as any[];
  if (q) where.push(ilike(songs.title, `%${q}%`));
  if (status) where.push(eq(songs.status, status));

  // Basic query
  const base = db.select().from(songs).where(and(...(where.length ? where : [undefined as any]))).orderBy(desc(songs.updatedAt)).limit(perPage).offset((page - 1) * perPage);
  const items = await base;

  // Fetch tags for these songs
  const songIds = items.map(s => s.id);
  let tagMap: Record<string, { id: string; name: string; slug: string; color: string }[]> = {};
  if (songIds.length) {
    const rows = await db.select({ songId: songTags.songId, tagId: tags.id, name: tags.name, slug: tags.slug, color: tags.color }).from(songTags).leftJoin(tags, eq(songTags.tagId, tags.id)).where(inArray(songTags.songId, songIds));
    for (const r of rows) {
      const arr = (tagMap[r.songId] ||= []);
      arr.push({ id: r.tagId, name: r.name, slug: r.slug, color: r.color });
    }
  }

  const data = items.map(s => ({ ...s, tags: tagMap[s.id] || [] }));
  return NextResponse.json({ items: data, page, perPage });
}

export async function POST(req: NextRequest) {
  const cors = handleCors(req);
  if (cors instanceof NextResponse) return cors;

  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!assertRole(role, ['admin', 'editor'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await limitRequest(`songs:create:${session?.user?.id}:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const body = await req.json();
  const parsed = songCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const now = new Date();
  const [inserted] = await db.insert(songs).values({
    ...parsed.data,
    createdBy: session?.user?.id as string | undefined,
    updatedBy: session?.user?.id as string | undefined,
    createdAt: now,
    updatedAt: now,
  }).returning();
  await logAudit({ userId: session?.user?.id, entityType: 'song', entityId: inserted.id, action: 'create' });
  return NextResponse.json(inserted, { status: 201, headers: cors });
}


