import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { db, songs } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  // Allow any authenticated user to download; tighten if needed
  if (!assertRole(session?.user?.role, ['admin', 'editor', 'viewer'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [song] = await db.select().from(songs).where(eq(songs.id, params.id)).limit(1);
  if (!song || !song.audioUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !service) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const supabase = createClient(supabaseUrl, service);

  const { data, error } = await supabase.storage.from('audio-originals').createSignedUrl(song.audioUrl, 600);
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Failed to sign' }, { status: 500 });
  return NextResponse.redirect(data.signedUrl, { status: 302 });
}


