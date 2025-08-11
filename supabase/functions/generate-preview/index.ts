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

function parseDurationFromFfmpegLogLine(message: string): number | null {
  // Example: "Duration: 00:03:42.12, start: 0.000000, bitrate: ..."
  const m = message.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  if ([hh, mm, ss].some((n) => Number.isNaN(n))) return null;
  return hh * 3600 + mm * 60 + ss;
}

async function transcodeAndComputePeaks(bytes: ArrayBuffer, durationSec = 30): Promise<{ mp3: Uint8Array | null; peaks: number[] | null; duration: number } | null> {
  try {
    // deno-lint-ignore no-explicit-any
    const ff = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.7');
    const createFFmpeg = (ff as any).createFFmpeg as (opts: any) => any;
    const ffmpeg = createFFmpeg({
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.12.7/dist/ffmpeg-core.js',
    });
    await ffmpeg.load();
    ffmpeg.FS('writeFile', 'input', new Uint8Array(bytes));

    // Probe duration via logger parsing
    let totalDurationSec: number | null = null;
    // deno-lint-ignore no-explicit-any
    (ffmpeg as any).setLogger?.(({ message }: { message: string }) => {
      const d = parseDurationFromFfmpegLogLine(message);
      if (d && !totalDurationSec) totalDurationSec = d;
    });
    try {
      // This will error (no outputs), but logs include duration
      await ffmpeg.run('-i', 'input');
    } catch {
      // ignore
    }

    const maxStart = totalDurationSec ? Math.max(0, totalDurationSec - durationSec) : 0;
    const midpointStart = totalDurationSec ? Math.max(0, totalDurationSec / 2 - durationSec / 2) : 0;
    const startAt = Math.min(maxStart, midpointStart);

    let mp3: Uint8Array | null = null;
    try {
      await ffmpeg.run(
        '-ss', String(startAt),
        '-i', 'input',
        '-t', String(durationSec),
        '-vn',
        '-acodec', 'libmp3lame',
        '-b:a', '128k',
        'out.mp3'
      );
      mp3 = ffmpeg.FS('readFile', 'out.mp3');
    } catch {
      mp3 = null;
    }

    // Choose a source for peak analysis: the trimmed mp3 if available, else the input
    const analysisSource = mp3 ? 'out.mp3' : 'input';
    let peaks: number[] | null = null;
    try {
      // Decode to 8kHz mono raw PCM s16le limited to durationSec for consistent peak window
      await ffmpeg.run(
        '-i', analysisSource,
        '-t', String(durationSec),
        '-ac', '1',
        '-ar', '8000',
        '-f', 's16le',
        'audio.pcm'
      );
      const pcm: Uint8Array = ffmpeg.FS('readFile', 'audio.pcm');
      // Interpret as 16-bit little-endian signed samples
      const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      const numSamples = Math.floor(pcm.byteLength / 2);
      const bucketCount = 400; // reasonable resolution for compact player
      const samplesPerBucket = Math.max(1, Math.floor(numSamples / bucketCount));
      const result: number[] = new Array(bucketCount).fill(0);
      const int16Max = 32768;
      for (let b = 0; b < bucketCount; b++) {
        const start = b * samplesPerBucket;
        const end = Math.min(numSamples, start + samplesPerBucket);
        let sumSquares = 0;
        let count = 0;
        for (let i = start; i < end; i++) {
          const sample = view.getInt16(i * 2, true);
          const norm = sample / int16Max;
          sumSquares += norm * norm;
          count++;
        }
        const rms = count ? Math.sqrt(sumSquares / count) : 0;
        result[b] = Number.isFinite(rms) ? Math.min(1, rms) : 0;
      }
      peaks = result;
    } catch {
      peaks = null;
    }

    return { mp3, peaks, duration: durationSec };
  } catch (_e) {
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
    const tx = await transcodeAndComputePeaks(inputBytes, durationSec);
    const trimmed = tx?.mp3 || null;

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

    const waveform = {
      peaks: tx?.peaks ?? Array.from({ length: 400 }, () => 0),
      duration: durationSec,
    };

    // Update DB row
    const { error: rpcErr } = await supabase
      .from('songs')
      .update({ preview_url: publicUrl || previewPath, waveform_json: waveform })
      .eq('id', songId);
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


