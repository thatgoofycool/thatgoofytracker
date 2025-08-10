import { NextRequest, NextResponse } from 'next/server';
import { db, tags } from '@/lib/db';
import { desc } from 'drizzle-orm';
import { tagCreateSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { handleCors } from '@/lib/cors';
import { limitRequest } from '@/lib/rateLimit';

export async function OPTIONS(req: NextRequest) { return handleCors(req); }

export async function GET() {
  const list = await db.select().from(tags).orderBy(desc(tags.name));
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const cors = handleCors(req);
  if (cors instanceof NextResponse) return cors;
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin', 'editor'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await limitRequest(`tags:create:${session?.user?.id}:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  const body = await req.json();
  const parsed = tagCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  const [inserted] = await db.insert(tags).values(parsed.data).returning();
  return NextResponse.json(inserted, { status: 201, headers: cors });
}


