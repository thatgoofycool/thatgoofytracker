import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, songs, tags, songTags } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { songCreateSchema } from '@/lib/validators';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin', 'editor'])) redirect('/');

  const list = await db.select().from(songs).orderBy(desc(songs.updatedAt));
  const tagsList = await db.select().from(tags);
  const songTagRows = list.length ? await db.select().from(songTags).where(eq(songTags.songId, list[0].id)).then(async () => {
    // fetch all mapping for list ids
    const ids = list.map((s) => s.id);
    // drizzle lacks where in multiple eq easily; make a simple raw in loop (not raw SQL). We'll fetch all and filter.
    // For simplicity in this minimal admin view, do a naive fetch of all tag relations.
    return await db.select().from(songTags);
  }) : [];
  const tagMap = new Map<string, Set<string>>();
  for (const r of songTagRows) {
    const set = tagMap.get(r.songId) || new Set<string>();
    set.add(r.tagId);
    tagMap.set(r.songId, set);
  }

  async function createSong(formData: FormData) {
    'use server';
    const session = await getServerSession(authOptions);
    if (!assertRole(session?.user?.role, ['admin', 'editor'])) return;
    const data = {
      title: String(formData.get('title') || ''),
      slug: String(formData.get('slug') || ''),
      description: String(formData.get('description') || ''),
      status: String(formData.get('status') || 'draft') as any,
    };
    const parsed = songCreateSchema.safeParse(data);
    if (!parsed.success) return;
    await db.insert(songs).values({ ...parsed.data, createdBy: session?.user?.id, updatedBy: session?.user?.id });
    revalidatePath('/');
    revalidatePath('/admin');
  }

  async function requestUpload(formData: FormData) {
    'use server';
    const session = await getServerSession(authOptions);
    if (!assertRole(session?.user?.role, ['admin', 'editor'])) return;
    const songId = String(formData.get('songId') || '');
    const file = formData.get('file') as File | null;
    if (!songId || !file) return;
    const contentType = file.type as any;
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, fileName: file.name, contentType, fileSize: file.size }),
    });
    if (!res.ok) return;
    const data = await res.json();
    // Now upload bytes using signed URL
    await fetch(data.url, { method: 'PUT', headers: { 'Content-Type': data.contentType }, body: file.stream() as any });

    // Fallback: directly invoke edge function since Storage Triggers UI may not be available
    try {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      if (supabaseUrl && serviceRole) {
        const fnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-preview`;
        const payload = {
          type: 'INSERT',
          table: 'storage.objects',
          record: { bucket_id: data.bucket, name: data.path, size: Number(file.size), metadata: {} },
        };
        await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRole}`,
          },
          body: JSON.stringify(payload),
        });
      }
    } catch {}
    revalidatePath('/');
    revalidatePath('/admin');
  }

  async function updateSong(formData: FormData) {
    'use server';
    const session = await getServerSession(authOptions);
    if (!assertRole(session?.user?.role, ['admin', 'editor'])) return;
    const id = String(formData.get('id') || '');
    const title = String(formData.get('title') || '');
    const status = String(formData.get('status') || 'draft');
    if (!id || !title) return;
    await db.update(songs).set({ title, status: status as any, updatedBy: session?.user?.id, updatedAt: new Date() }).where(eq(songs.id, id));
    revalidatePath('/');
    revalidatePath('/admin');
  }

  async function deleteSong(formData: FormData) {
    'use server';
    const session = await getServerSession(authOptions);
    if (!assertRole(session?.user?.role, ['admin', 'editor'])) return;
    const id = String(formData.get('id') || '');
    if (!id) return;
    await db.delete(songs).where(eq(songs.id, id));
    revalidatePath('/');
    revalidatePath('/admin');
  }

  async function assignTags(formData: FormData) {
    'use server';
    const session = await getServerSession(authOptions);
    if (!assertRole(session?.user?.role, ['admin', 'editor'])) return;
    const songId = String(formData.get('songId') || '');
    const tagIds = formData.getAll('tagIds') as string[];
    if (!songId) return;
    await db.delete(songTags).where(eq(songTags.songId, songId));
    if (tagIds.length) {
      await db.insert(songTags).values(tagIds.map((tid) => ({ songId, tagId: String(tid) })));
    }
    revalidatePath('/');
    revalidatePath('/admin');
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Link className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200" href="/">Back</Link>
      </header>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Create Song</h2>
        <form action={createSong} className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input name="title" placeholder="Title" required className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="slug" placeholder="Slug (a-z0-9-)" pattern="[a-z0-9-]+" required className="rounded-md border border-slate-300 px-3 py-2" />
          <select name="status" className="rounded-md border border-slate-300 px-3 py-2">
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="mixing">Mixing</option>
            <option value="mastering">Mastering</option>
            <option value="done">Done</option>
          </select>
          <textarea name="description" placeholder="Description" className="rounded-md border border-slate-300 px-3 py-2 sm:col-span-2" />
          <button type="submit" className="rounded-md bg-slate-900 text-white px-4 py-2 sm:col-span-2">Create</button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Songs</h2>
        <div className="mt-3 space-y-3">
          {list.map((s) => (
            <AdminSongRow key={s.id} song={s} tags={tagsList} selectedTagIds={Array.from(tagMap.get(s.id) || [])} requestUpload={requestUpload} updateSong={updateSong} deleteSong={deleteSong} assignTags={assignTags} />
          ))}
        </div>
      </section>
    </main>
  );
}

function AdminSongRow({ song, tags, selectedTagIds, requestUpload, updateSong, deleteSong, assignTags }: { song: any; tags: any[]; selectedTagIds: string[]; requestUpload: (fd: FormData) => Promise<void>; updateSong: (fd: FormData) => Promise<void>; deleteSong: (fd: FormData) => Promise<void>; assignTags: (fd: FormData) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{song.title}</div>
          <div className="text-xs text-slate-600">{song.status}</div>
        </div>
        <Link className="px-3 py-1.5 rounded-md border border-slate-300" href={`/api/songs/${song.id}`}>Edit API</Link>
      </div>
      <form action={updateSong} className="flex flex-wrap items-center gap-2" aria-label="Update song">
          <input type="hidden" name="id" value={song.id} />
          <input name="title" defaultValue={song.title} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
          <select name="status" defaultValue={song.status} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="mixing">Mixing</option>
            <option value="mastering">Mastering</option>
            <option value="done">Done</option>
          </select>
          <button type="submit" className="px-3 py-1.5 rounded-md border border-slate-300">Save</button>
      </form>
      <form action={requestUpload} className="flex flex-wrap items-center gap-2" aria-label="Upload audio and cover">
        <input type="hidden" name="songId" value={song.id} />
        <div className="flex items-center gap-1 flex-wrap">
          {tags.map(t => (
            <label key={t.id} className={`text-xs inline-flex items-center gap-1 border rounded-full px-2 py-1 tag-${t.color}`}>
              <input type="checkbox" name="tagIds" value={t.id} defaultChecked={selectedTagIds.includes(t.id)} />
              {t.name}
            </label>
          ))}
        </div>
        <input className="text-sm" type="file" name="file" accept="audio/wav,audio/x-wav,audio/aiff,audio/x-aiff,audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a" required />
        <input className="text-sm" type="file" name="cover" accept="image/png,image/jpeg,image/webp" />
        <button type="submit" className="px-3 py-1.5 rounded-md bg-slate-900 text-white">Upload</button>
      </form>
      <form action={deleteSong} aria-label="Delete song">
          <input type="hidden" name="id" value={song.id} />
          <button type="submit" className="px-3 py-1.5 rounded-md border border-red-300 text-red-700">Delete</button>
      </form>
    </div>
  );
}


