"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SubmitButton from './SubmitButton';
import { useToast } from './toast';

export default function UploadForm({ songId }: { songId: string }) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const router = useRouter();
  const { Toast, showSuccess, showError } = useToast();

  async function handleUpload(formData: FormData) {
    try {
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
        await fetch(data.url, { method: 'PUT', headers: { 'Content-Type': data.contentType }, body: audioFile });
        await fetch('/api/trigger-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bucket: data.bucket, path: data.path, size: audioFile.size }) });
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
        await fetch(data.url, { method: 'PUT', headers: { 'Content-Type': data.contentType }, body: coverFile });
      }
      showSuccess('Uploaded');
      router.refresh();
    } catch (e) {
      showError('Upload failed');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input className="text-sm" type="file" accept="audio/wav,audio/x-wav,audio/aiff,audio/x-aiff,audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
      <input className="text-sm" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
      <form action={handleUpload}>
        <SubmitButton className="px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition" pendingText="Uploading...">Upload</SubmitButton>
      </form>
      <Toast />
    </div>
  );
}


