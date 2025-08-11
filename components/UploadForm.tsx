"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SubmitButton from './SubmitButton';
import { useToast } from './toast';

export default function UploadForm({ songId, currentAudioPath, currentCoverUrl, currentAudioName, currentCoverName }: { songId: string; currentAudioPath?: string | null; currentCoverUrl?: string | null; currentAudioName?: string | null; currentCoverName?: string | null }) {
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
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-800 dark:text-slate-200">Audio file</label>
        <input className="text-sm" type="file" accept="audio/wav,audio/x-wav,audio/aiff,audio/x-aiff,audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {audioFile?.name
            ? `Selected: ${audioFile.name}`
            : currentAudioName
            ? `Current: ${currentAudioName}`
            : currentAudioPath
            ? `Current: ${currentAudioPath.split('/').pop()}`
            : 'None'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-800 dark:text-slate-200">Cover art</label>
        <input className="text-sm" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {coverFile?.name
            ? `Selected: ${coverFile.name}`
            : currentCoverName
            ? `Current: ${currentCoverName}`
            : currentCoverUrl
            ? `Current: ${(() => { try { const u = new URL(currentCoverUrl); const parts = u.pathname.split('/'); return parts[parts.length - 1]; } catch { return currentCoverUrl.split('/').pop(); } })()}`
            : 'None'}
        </span>
      </div>
      <button
        onClick={handleUpload}
        disabled={isUploading || (!audioFile && !coverFile)}
        className={`px-3 py-1.5 rounded-md border text-white transition
          ${isUploading
            ? 'bg-slate-800 dark:bg-slate-700'
            : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-95'}
          border-slate-300 dark:border-slate-600
          ${(!audioFile && !coverFile) ? 'opacity-60 cursor-not-allowed' : ''}`}
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


