"use client";
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

type Props = {
  previewUrl?: string;
  waveform?: { peaks?: number[]; duration?: number } | null;
  title: string;
};

export default function AudioPlayer({ previewUrl, waveform, title }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !previewUrl) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#94a3b8',
      progressColor: '#0ea5e9',
      height: 64,
      normalize: true,
      interact: true,
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1,
    });

    if (waveform?.peaks && waveform.peaks.length) {
      // Load audio with provided mono peaks; wrap to match multi-channel signature
      ws.load(previewUrl, [waveform.peaks] as any, waveform.duration || undefined);
    } else {
      ws.load(previewUrl);
    }

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    wavesurferRef.current = ws;
    return () => {
      try { ws.destroy(); } catch {}
      wavesurferRef.current = null;
    };
  }, [previewUrl]);

  useEffect(() => {
    // Ensure auto-stop at 30s even if preview is longer
    const ws = wavesurferRef.current;
    if (!ws) return;
    const onReady = () => {
      const limit = Math.min(30, ws.getDuration());
      const sub = ws.on('audioprocess', () => {
        if (ws.getCurrentTime() >= limit) ws.pause();
      });
      return () => { ws.un('audioprocess', sub); };
    };
    ws.on('ready', onReady);
    return () => { ws.un('ready', onReady); };
  }, [previewUrl]);

  if (!previewUrl) {
    return <div className="text-sm text-slate-500">No preview available</div>;
  }

  return (
    <div className="w-full">
      <div ref={containerRef} aria-label={`Waveform for ${title}`} className="rounded-md overflow-hidden" />
      <div className="mt-2 flex items-center gap-2">
        <button
          className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50"
          type="button"
          onClick={() => wavesurferRef.current?.playPause()}
          aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50"
          type="button"
          onClick={() => { if (wavesurferRef.current) wavesurferRef.current.seekTo(0); }}
          aria-label="Restart preview"
        >
          Restart
        </button>
      </div>
    </div>
  );
}


