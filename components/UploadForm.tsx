"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SubmitButton from './SubmitButton';
import { useToast } from './toast';

export default function UploadForm({ songId }: { songId: string }) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const { Toast, showSuccess, showError } = useToast();

  async function handleUpload() {
    try {
      setIsUploading(true);
      let didSomething = false;
      if (audioFile) {
        const audioMeta = {
          songId,
          fileName: audioFile.name,
          contentType: audioFile.type,
          fileSize: audioFile.size,
          kind: 'audio' as const,
        };
        const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(audioMeta) });
        if (!res.ok) throw new Error('sign failed');
        const data = await res.json();
        // Upload directly to signed URL (no client env needed)
        const put = await fetch(data.url, { method: 'PUT', headers: { 'Content-Type': data.contentType, 'x-upsert': 'true' }, body: audioFile });
        if (!put.ok) throw new Error('upload failed');
        didSomething = true;
        // Trigger preview generation server-side
        const trig = await fetch('/api/trigger-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bucket: data.bucket, path: data.path, size: audioFile.size }) });
        if (!trig.ok) throw new Error('preview trigger failed');
      }
      if (coverFile) {
        const coverMeta = {
          songId,
          fileName: coverFile.name,
          contentType: coverFile.type,
          fileSize: coverFile.size,
          kind: 'cover' as const,
        };
        const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(coverMeta) });
        if (!res.ok) throw new Error('cover sign failed');
        const data = await res.json();
        const put = await fetch(data.url, { method: 'PUT', headers: { 'Content-Type': data.contentType, 'x-upsert': 'true' }, body: coverFile });
        if (!put.ok) throw new Error('cover upload failed');
        didSomething = true;
      }
      if (didSomething) showSuccess('Uploaded');
      router.refresh();
    } catch (e) {
      showError('Upload failed');
    }
    finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input className="text-sm" type="file" accept="audio/wav,audio/x-wav,audio/aiff,audio/x-aiff,audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
      <input className="text-sm" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
      <button
        onClick={handleUpload}
        disabled={isUploading || (!audioFile && !coverFile)}
        className={`px-3 py-1.5 rounded-md text-white transition ${isUploading ? 'bg-slate-700' : 'bg-slate-900 hover:bg-slate-800 active:scale-95'} ${(!audioFile && !coverFile) ? 'opacity-60 cursor-not-allowed' : ''}`}
        aria-label="Upload files"
        aria-busy={isUploading}
      >
        {isUploading ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-50 animate-spin" />
            Uploading...
          </span>
        ) : 'Upload'}
      </button>
      <Toast />
    </div>
  );
}


