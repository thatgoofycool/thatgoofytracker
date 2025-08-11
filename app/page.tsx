import { db, songs, songTags, tags } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';
import { and, desc, eq, ilike, inArray } from 'drizzle-orm';
import Link from 'next/link';
import AuthButtons from '@/components/AuthButtons';
import { paginationQuerySchema } from '@/lib/validators';
import { Suspense } from 'react';
import AudioPlayer from '@/components/AudioPlayer';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getData(searchParams: Record<string, string | string[] | undefined>) {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === 'string') params[k] = v;
  const parsed = paginationQuerySchema.safeParse(params);
  const { page, perPage, q, status, tag } = parsed.success ? parsed.data as any : { page: 1, perPage: 10 } as any;
  const where = [] as any[];
  if (q) where.push(ilike(songs.title, `%${q}%`));
  if (status) where.push(eq(songs.status, status));
  let baseQuery = db.select().from(songs);
  if (where.length) {
    // @ts-expect-error drizzle type narrowing
    baseQuery = baseQuery.where(and(...where));
  }
  // Filter by tag slug if present
  if (tag) {
    const [t] = await db.select().from(tags).where(eq(tags.slug, tag)).limit(1);
    if (t) {
      const rows = await db.select().from(songTags).where(eq(songTags.tagId, t.id));
      const allowedIds = new Set(rows.map(r => r.songId));
      // Fetch all then filter by IDs while keeping pagination simple (for brevity)
      // In production, use a join with pagination
      const allItems = await baseQuery.orderBy(desc(songs.updatedAt)).limit(200);
      const filtered = allItems.filter(s => allowedIds.has(s.id)).slice((page - 1) * perPage, (page - 1) * perPage + perPage);
      const ids = filtered.map(s => s.id);
      let tagMap: Record<string, { id: string; name: string; slug: string; color: string }[]> = {};
      if (ids.length) {
        const rows2 = await db
          .select({ songId: songTags.songId, tagId: tags.id, name: tags.name, slug: tags.slug, color: tags.color })
          .from(songTags)
          .innerJoin(tags, eq(songTags.tagId, tags.id))
          .where(inArray(songTags.songId, ids));
        for (const r of rows2) {
          (tagMap[r.songId] ||= []).push({ id: r.tagId, name: r.name, slug: r.slug, color: r.color });
        }
      }
      return filtered.map(s => ({ ...s, tags: tagMap[s.id] || [] }));
    }
  }
  const items = await baseQuery.orderBy(desc(songs.updatedAt)).limit(perPage).offset((page - 1) * perPage);
  const ids = items.map(s => s.id);
  let tagMap: Record<string, { id: string; name: string; slug: string; color: string }[]> = {};
  if (ids.length) {
    const rows = await db
      .select({ songId: songTags.songId, tagId: tags.id, name: tags.name, slug: tags.slug, color: tags.color })
      .from(songTags)
      .innerJoin(tags, eq(songTags.tagId, tags.id))
      .where(inArray(songTags.songId, ids));
    for (const r of rows) {
      (tagMap[r.songId] ||= []).push({ id: r.tagId, name: r.name, slug: r.slug, color: r.color });
    }
  }
  // Attach transient signed preview URLs if missing
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let signedMap: Record<string, string | undefined> = {};
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    for (const s of items) {
      if (!s.previewUrl && s.audioUrl) {
        try {
          // Give originals a slightly longer TTL to reduce intermittent playback failures
          const { data } = await supabase.storage.from('audio-originals').createSignedUrl(s.audioUrl, 300);
          signedMap[s.id] = data?.signedUrl;
        } catch {}
      }
    }
  }
  return items.map(s => ({ ...s, previewUrl: s.previewUrl || signedMap[s.id], tags: tagMap[s.id] || [] }));
}

export default async function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const data = await getData(searchParams);
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const tagsList = await db.select().from(tags);
  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Album Progress</h1>
          <p className="text-sm sm:text-base text-slate-600">Secure music management application.</p>
        </div>
        <div className="flex items-center gap-3">
          {role ? (
            <Link className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200" href="/admin">Admin</Link>
          ) : null}
          <AuthButtons signedIn={Boolean(role)} />
        </div>
      </header>

      <form className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3" method="get">
        <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="text" name="q" placeholder="Search title" defaultValue={(searchParams.q as string) || ''} aria-label="Search title" />
        <select className="w-full rounded-md border border-slate-300 px-3 py-2" name="status" defaultValue={(searchParams.status as string) || ''} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="mixing">Mixing</option>
          <option value="mastering">Mastering</option>
          <option value="done">Done</option>
        </select>
        <button className="rounded-md bg-slate-900 text-white px-4 py-2" type="submit">Filter</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter by tag">
        <Link className={`px-2 py-1 rounded-full border ${!searchParams.tag ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'}`} href={{ pathname: '/', query: { ...searchParams, tag: '' } }}>All tags</Link>
        {tagsList.map(t => (
          <Link key={t.id} className={`px-2 py-1 rounded-full border tag-${t.color} ${searchParams.tag === t.slug ? 'ring-2 ring-slate-400' : ''}`} href={{ pathname: '/', query: { ...searchParams, tag: t.slug } }}>{t.name}</Link>
        ))}
      </div>

      <ul className="mt-8 space-y-6">
        {data.map((song) => (
          <li key={song.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium">{song.title}</h2>
                <p className="text-sm text-slate-600">Status: <span className="font-medium">{song.status}</span></p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {song.tags.map((t) => (
                    <span key={t.id} className={`text-xs px-2 py-1 rounded-full tag-${t.color}`} aria-label={`tag ${t.name}`}>{t.name}</span>
                  ))}
                </div>
                {song.updatedAt ? (
                  <p className="mt-1 text-xs text-slate-500">Updated: {new Date(song.updatedAt as unknown as string).toLocaleString()}</p>
                ) : null}
              </div>
              <div className="w-full max-w-[420px]">
                <div className="flex items-start gap-3">
                  { (song as any).coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={(song as any).coverUrl as string} alt="Cover art" className="w-16 h-16 object-cover rounded" />
                  ) : null }
                  <div className="flex-1 min-w-0">
                    {song.previewUrl ? (
                      <Suspense fallback={<div className="h-[64px] w-full bg-slate-100 animate-pulse rounded-md" />}>
                        <AudioPlayer previewUrl={song.previewUrl || undefined} waveform={song.waveformJson as any} title={song.title} />
                      </Suspense>
                    ) : (
                      <div className="text-sm text-slate-500">No preview available</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}


