import Fastify from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const app = Fastify({ logger: true });

function authGuard(req, reply) {
  const secret = process.env.WORKER_SECRET || '';
  const auth = req.headers['authorization'] || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}\n${stderr}`));
    });
  });
}

app.post('/', async (req, reply) => {
  if (!authGuard(req, reply)) return;
  const { songId, bucket, path: objectPath } = req.body || {};
  if (!songId || !bucket || !objectPath) return reply.code(400).send({ error: 'Missing params' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return reply.code(500).send({ error: 'Server misconfigured' });
  const supabase = createClient(supabaseUrl, serviceKey);

  // download original to temp
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'media-'));
  const inputFile = path.join(tmpDir, 'input');
  const quantizedFile = path.join(tmpDir, 'orig-16bit.wav');
  const playbackFile = path.join(tmpDir, 'playback.mp3');

  try {
    const { data: dl, error: dlErr } = await supabase.storage.from('audio-originals').download(objectPath);
    if (dlErr || !dl) throw new Error(`download failed: ${dlErr?.message}`);
    const arr = Buffer.from(await dl.arrayBuffer());
    await fs.writeFile(inputFile, arr);

    // probe
    let probeJson = '';
    try {
      const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate,bit_depth,sample_fmt', '-of', 'json', inputFile]);
      probeJson = stdout;
    } catch (e) {}
    let needsQuantize = false;
    let originalBitDepth = null;
    let originalSampleRate = null;
    try {
      const parsed = JSON.parse(probeJson || '{}');
      const st = (parsed.streams || [])[0] || {};
      originalSampleRate = st.sample_rate ? Number(st.sample_rate) : null;
      originalBitDepth = st.bit_depth ? Number(st.bit_depth) : null;
      const fmt = st.sample_fmt || '';
      const highFmt = ['flt', 'fltp', 'dbl', 'dblp', 's32', 's32p'].includes(fmt);
      needsQuantize = highFmt || (originalBitDepth != null && originalBitDepth > 24);
    } catch {}

    // If needed, quantize to 16-bit PCM WAV (no resample)
    let sourceForPlayback = inputFile;
    let newObjectPath = objectPath;
    if (needsQuantize) {
      await run('ffmpeg', ['-y', '-i', inputFile, '-map', 'a:0', '-c:a', 'pcm_s16le', '-dither_method', 'triangular', quantizedFile]);
      // upload quantized original and replace
      const qName = objectPath.replace(/(\.[^./\\]+)?$/, (_m, ext) => ext ? ext : '')
        .replace(/([^/]+)$/, (m) => `orig-16bit-${Date.now()}-${m}`);
      const fileBuf = await fs.readFile(quantizedFile);
      const up = await supabase.storage.from('audio-originals').upload(qName, new Blob([fileBuf]), { contentType: 'audio/wav', upsert: true });
      if (up.error) throw new Error(`upload quantized failed: ${up.error.message}`);
      // Delete old object
      await supabase.storage.from('audio-originals').remove([objectPath]);
      newObjectPath = qName;
      sourceForPlayback = quantizedFile;
    }

    // transcode playback mp3 at 128k, 44.1kHz
    await run('ffmpeg', ['-y', '-i', sourceForPlayback, '-map', 'a:0', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', playbackFile]);
    const pbName = `${songId}/playback-${Date.now()}.mp3`;
    const pbBuf = await fs.readFile(playbackFile);
    const up2 = await supabase.storage.from('audio-previews').upload(pbName, new Blob([pbBuf]), { contentType: 'audio/mpeg', upsert: true });
    if (up2.error) throw new Error(`upload playback failed: ${up2.error.message}`);
    const { data: pub } = supabase.storage.from('audio-previews').getPublicUrl(pbName);
    const playbackUrl = pub?.publicUrl || null;

    // sizes
    const originalSizeBytes = (await fs.stat(needsQuantize ? quantizedFile : inputFile)).size;
    const playbackSizeBytes = pbBuf.length;

    // update DB
    const res = await fetch(`${supabaseUrl}/rest/v1/songs?id=eq.${songId}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        audio_url: newObjectPath,
        playback_url: playbackUrl,
        original_size_bytes: originalSizeBytes,
        playback_size_bytes: playbackSizeBytes,
        playback_bitrate_kbps: 128,
        original_bit_depth: originalBitDepth,
        original_sample_rate: originalSampleRate,
        processing_status: 'succeeded',
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) throw new Error(`db update failed: ${await res.text()}`);

    reply.send({ ok: true, playbackUrl });
  } catch (e) {
    app.log.error(e);
    // best-effort DB update of failure state
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/rest/v1/songs?id=eq.${req.body?.songId}`, {
          method: 'PATCH',
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ processing_status: 'failed', last_processing_error: String(e?.message || e) })
        });
      }
    } catch {}
    reply.code(500).send({ error: 'processing_failed' });
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

const port = process.env.PORT || 8080;
app.listen({ port, host: '0.0.0.0' }).catch((e) => {
  console.error(e);
  process.exit(1);
});


