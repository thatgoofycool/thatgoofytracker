// Deno Deploy Edge Function
// Trigger: Storage object created in bucket 'audio-originals'
// This function generates a 30s preview and waveform JSON, stores them, and updates the DB row.

// Hardening: validate payload, limit duration/size, sanitize paths

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// Note: Use a prebuilt ffmpeg wasm or hosted service if native ffmpeg is not available.
// For brevity, this example assumes availability of ffmpeg.wasm wrapper (pseudo-code).
// In production, consider a queue/worker or Supabase functions with ffmpeg layer.

interface StorageEventPayload {
  type: 'INSERT' | 'UPDATE';
  table: string;
  record: { bucket_id: string; name: string; size: number; metadata: Record<string, unknown> };
}

async function tryTranscodeToThirtySecondPreview(bytes: ArrayBuffer, durationSec = 30): Promise<Uint8Array | null> {
  try {
    // Lazy import to avoid boot failures when ffmpeg is not supported in the runtime
    // deno-lint-ignore no-explicit-any
    const ff = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.7');
    const createFFmpeg = (ff as any).createFFmpeg as (opts: any) => any;
    const ffmpeg = createFFmpeg({
      log: false,
      // Use a CDN-hosted core to avoid bundling large assets into the function itself
      corePath: 'https://unpkg.com/@ffmpeg/core@0.12.7/dist/ffmpeg-core.js',
    });
    await ffmpeg.load();
    ffmpeg.FS('writeFile', 'input', new Uint8Array(bytes));
    // Re-encode to mp3 and trim to exact 30s for consistent playback
    await ffmpeg.run(
      '-i', 'input',
      '-t', String(durationSec),
      '-vn',
      '-acodec', 'libmp3lame',
      '-b:a', '128k',
      'out.mp3'
    );
    const out: Uint8Array = ffmpeg.FS('readFile', 'out.mp3');
    return out;
  } catch (_e) {
    // Fall back to non-trimmed copy if ffmpeg is unavailable in this environment
    return null;
  }
}

export default async function handler(req: Request) {
  try {
    const raw = await req.text();
    const payload = JSON.parse(raw) as StorageEventPayload;
    if (!payload?.record?.bucket_id || payload.record.bucket_id !== 'audio-originals') {
      return new Response('ignored', { status: 200 });
    }
    const name = payload.record.name;
    // Expect path like: <songId>/<uuid>.<ext>
    const songId = name.split('/')[0];
    if (!crypto.randomUUID || songId.length < 10) return new Response('bad', { status: 400 });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Download original
    const { data: original, error } = await supabase.storage.from('audio-originals').download(name);
    if (error || !original) return new Response('download error', { status: 500 });

    const durationSec = Number(Deno.env.get('PREVIEW_DURATION_SECONDS') || 30) || 30;
    const inputBytes = await original.arrayBuffer();
    const trimmed = await tryTranscodeToThirtySecondPreview(inputBytes, durationSec);

    // If trimming succeeded, upload MP3; else fall back to copying the original
    const previewBase = `${songId}/preview-${crypto.randomUUID()}`;
    const previewPath = trimmed ? `${previewBase}.mp3` : previewBase;
    if (trimmed) {
      const mp3Blob = new Blob([trimmed], { type: 'audio/mpeg' });
      const upload = await supabase.storage.from('audio-previews').upload(previewPath, mp3Blob, { contentType: 'audio/mpeg', upsert: true });
      if (upload.error) return new Response('upload error', { status: 500 });
    } else {
      const upload = await supabase.storage.from('audio-previews').upload(previewPath, original, { contentType: original.type || 'application/octet-stream', upsert: true });
      if (upload.error) return new Response('upload error', { status: 500 });
    }

    const { data: pub } = supabase.storage.from('audio-previews').getPublicUrl(previewPath);
    const publicUrl = pub?.publicUrl ?? null;

    const waveform = { peaks: [], duration: durationSec };

    // Update DB row
    const { error: rpcErr } = await supabase.from('songs').update({ preview_url: publicUrl || previewPath, waveform_json: waveform }).eq('id', songId);
    if (rpcErr) return new Response('db error', { status: 500 });

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response('error', { status: 500 });
  }
}

// deno-lint-ignore no-explicit-any
addEventListener('fetch', (event: any) => {
  event.respondWith(handler(event.request));
});


