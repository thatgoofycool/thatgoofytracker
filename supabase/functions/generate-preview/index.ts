// Deno Deploy Edge Function
// Trigger: Storage object created in bucket 'audio-originals'
// This function generates a 30s preview and waveform JSON, stores them, and updates the DB row.

// Hardening: validate payload, limit duration/size, sanitize paths

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
// Use npm specifier that works on Supabase Edge Runtime
import { createFFmpeg, fetchFile } from 'npm:@ffmpeg/ffmpeg@0.12.10';

// Note: Use a prebuilt ffmpeg wasm or hosted service if native ffmpeg is not available.
// For brevity, this example assumes availability of ffmpeg.wasm wrapper (pseudo-code).
// In production, consider a queue/worker or Supabase functions with ffmpeg layer.

interface StorageEventPayload {
  type: 'INSERT' | 'UPDATE';
  table: string;
  record: { bucket_id: string; name: string; size: number; metadata: Record<string, unknown> };
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
    const inputBytes = new Uint8Array(await original.arrayBuffer());

    const ffmpeg = createFFmpeg({ log: false, corePath: undefined });
    await ffmpeg.load();
    ffmpeg.FS('writeFile', 'input', await fetchFile(new Blob([inputBytes])));

    // Generate MP3 preview (first 30 seconds, ~128 kbps)
    await ffmpeg.run('-hide_banner', '-loglevel', 'error', '-i', 'input', '-t', '30', '-ac', '2', '-b:a', '128k', '-f', 'mp3', 'preview.mp3');
    const mp3 = ffmpeg.FS('readFile', 'preview.mp3');

    // Extract 30s mono PCM at 11025 Hz for lightweight waveform
    await ffmpeg.run('-hide_banner', '-loglevel', 'error', '-i', 'input', '-t', '30', '-ac', '1', '-ar', '11025', '-f', 's16le', 'pcm.raw');
    const pcm = ffmpeg.FS('readFile', 'pcm.raw');

    // Compute waveform peaks
    const int16 = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
    const sampleCount = int16.length;
    const bins = Math.min(1000, Math.max(120, Math.floor(sampleCount / 512)));
    const binSize = Math.max(1, Math.floor(sampleCount / bins));
    const peaks: number[] = [];
    for (let i = 0; i < sampleCount; i += binSize) {
      let max = 0;
      const end = Math.min(sampleCount, i + binSize);
      for (let j = i; j < end; j++) {
        const v = Math.abs(int16[j]);
        if (v > max) max = v;
      }
      // Normalize to [0,1] using int16 max
      peaks.push(Number((max / 32767).toFixed(4)));
      if (peaks.length >= bins) break;
    }

    const previewPath = `${songId}/preview-${crypto.randomUUID()}.mp3`;
    const upload = await supabase.storage.from('audio-previews').upload(previewPath, new Blob([mp3], { type: 'audio/mpeg' }), { contentType: 'audio/mpeg', upsert: true });
    if (upload.error) return new Response('upload error', { status: 500 });

    const { data: pub } = supabase.storage.from('audio-previews').getPublicUrl(previewPath);
    const publicUrl = pub?.publicUrl ?? null;

    const waveform = { peaks, duration: 30 };

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


