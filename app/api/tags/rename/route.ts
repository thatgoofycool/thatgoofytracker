import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { db, tags } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { limitRequest } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await limitRequest(`tags:rename:${session?.user?.id}:${ip}`);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  // Mapping of old tag names -> new tag names (underscored internal names)
  const mapping: Record<string, string> = {
    melodic_update: 'melodic_prod_needed',
    drums_update: 'drums_needed',
    bass_update: 'bass_needed',
    misc_changes: 'misc_prod_needed',
  };

  const results: Array<{ from: string; to: string; updated: number }> = [];
  for (const [from, to] of Object.entries(mapping)) {
    const res = await db.update(tags).set({ name: to }).where(eq(tags.name, from));
    // drizzle update doesn't return affected count directly; do a follow-up count
    const [row] = await db.select({ count: tags.id }).from(tags).where(eq(tags.name, to));
    results.push({ from, to, updated: Number((row as any)?.count || 0) });
  }

  return NextResponse.json({ ok: true, results });
}


