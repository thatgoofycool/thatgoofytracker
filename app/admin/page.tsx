import { getServerSession } from 'next-auth';
import { authOptions, assertRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, songs, tags, songTags } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { songCreateSchema } from '@/lib/validators';
import Link from 'next/link';
import AuthButtons from '@/components/AuthButtons';
import ThemeToggle from '@/components/ThemeToggle';
import SubmitButton from '@/components/SubmitButton';
import SlugInput from '@/components/SlugInput';
import ToastDisplay from '@/components/ToastDisplay';
import UploadForm from '@/components/UploadForm';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!assertRole(session?.user?.role, ['admin', 'editor'])) redirect('/');

  const list = await db
    .select({
      id: songs.id,
      title: songs.title,
      slug: songs.slug,
      description: songs.description,
      bpm: songs.bpm,
      key: songs.key,
      status: songs.status,
      previewUrl: songs.previewUrl,
      audioUrl: songs.audioUrl,
      audioOriginalName: (songs as any).audioOriginalName,
      coverUrl: songs.coverUrl,
      coverOriginalName: (songs as any).coverOriginalName,
      waveformJson: songs.waveformJson,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
    })
    .from(songs)
    .orderBy(desc(songs.updatedAt));
  const tagsList = await db.select().from(tags);
  // Only pull tag relations for the current song IDs to avoid stale/misaligned mapping
  const ids = list.map((s) => s.id);
  const allSongTags = ids.length ? await db.select().from(songTags) : [];
  const songTagRows = allSongTags.filter((r) => ids.includes(r.songId));
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
    // Now upload bytes using signed URL without streaming through Server Action
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/trigger-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: data.bucket, path: data.path, size: file.size })
    });
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
      {/* Toasts via URL query (?toast=message&type=success|error) */}
      <ToastDisplay />
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="flex items-center gap-3">
          <Link className="px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100" href="/">Back</Link>
          <ThemeToggle />
          <AuthButtons signedIn={true} />
        </div>
      </header>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Create Song</h2>
        <form
          action={async (fd: FormData) => {
            'use server';
            try {
              await createSong(fd);
            } catch {
              redirect('/admin?toast=Failed&type=error');
            }
            redirect('/admin?toast=Created&type=success');
          }}
          className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <input name="title" placeholder="Title" required className="rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700" />
          <SlugInput className="rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700" />
          <select name="status" className="rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700">
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="mixing">Mixing</option>
            <option value="mastering">Mastering</option>
            <option value="done">Done</option>
          </select>
          <textarea name="description" placeholder="Description" className="rounded-md border border-slate-300 px-3 py-2 sm:col-span-2 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700" />
          <SubmitButton className="rounded-md bg-slate-900 text-white px-4 py-2 sm:col-span-2 hover:bg-slate-800 active:scale-95 transition">Create</SubmitButton>
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
    <div className="rounded-lg border border-slate-200 p-3 flex flex-col gap-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{song.title}</div>
          <div className="text-xs text-slate-600">{song.status}</div>
        </div>
        <Link className="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100" href={`/api/songs/${song.id}`}>Edit API</Link>
      </div>
      <form
        action={async (fd: FormData) => {
          'use server';
          try {
            await updateSong(fd);
          } catch {
            redirect('/admin?toast=Failed&type=error');
          }
          redirect('/admin?toast=Saved&type=success');
        }}
        className="flex flex-wrap items-center gap-2" aria-label="Update song"
      >
          <input type="hidden" name="id" value={song.id} />
          <input name="title" defaultValue={song.title} className="rounded-md border border-slate-300 px-2 py-1 text-sm bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700" />
          <select name="status" defaultValue={song.status} className="rounded-md border border-slate-300 px-2 py-1 text-sm bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700">
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="mixing">Mixing</option>
            <option value="mastering">Mastering</option>
            <option value="done">Done</option>
          </select>
        <SubmitButton className="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 active:scale-95 transition dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100" pendingText="Saving..." ariaLabel="Save changes">Save</SubmitButton>
      </form>
      <div className="flex flex-wrap items-center gap-2" aria-label="Upload audio and cover">
        <form
          action={async (fd: FormData) => {
            'use server';
            try {
              await assignTags(fd);
            } catch {
              redirect('/admin?toast=Tag%20save%20failed&type=error');
            }
            redirect('/admin?toast=Tags%20saved&type=success');
          }}
          className="flex items-center gap-2 flex-wrap"
          aria-label="Assign tags"
        >
          <input type="hidden" name="songId" value={song.id} />
          <div className="flex items-center gap-1 flex-wrap">
            {tags.map(t => (
              <label key={t.id} className={`text-xs inline-flex items-center gap-1 border rounded-full px-2 py-1 tag-${t.color}`}>
                <input type="checkbox" name="tagIds" value={t.id} defaultChecked={selectedTagIds.includes(t.id)} />
                {t.name}
              </label>
            ))}
          </div>
          <SubmitButton className="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 active:scale-95 transition dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100" pendingText="Saving..." ariaLabel="Save tags">Save tags</SubmitButton>
        </form>
        <UploadForm
          songId={song.id}
          currentAudioPath={(song as any).audioUrl || null}
          currentCoverUrl={(song as any).coverUrl || null}
          // @ts-expect-error drizzle shape
          currentAudioName={(song as any).audioOriginalName || null}
          // @ts-expect-error drizzle shape
          currentCoverName={(song as any).coverOriginalName || null}
        />
      </div>
      <form
        action={async (fd: FormData) => {
          'use server';
          try {
            await deleteSong(fd);
          } catch {
            redirect('/admin?toast=Delete failed&type=error');
          }
          redirect('/admin?toast=Deleted&type=success');
        }}
        aria-label="Delete song"
      >
          <input type="hidden" name="id" value={song.id} />
          <SubmitButton className="px-3 py-1.5 rounded-md border border-red-300 text-red-700 hover:bg-red-50 active:scale-95 transition" pendingText="Deleting..." ariaLabel="Delete song">Delete</SubmitButton>
      </form>
    </div>
  );
}


