"use client";
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
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
  const [progress, setProgress] = useState(0); // 0..1 relative to 30s cap

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
      ws.load(previewUrl, [waveform.peaks] as any, waveform.duration || undefined);
    } else {
      ws.load(previewUrl);
    }

    // Swallow internal fetch abort errors on teardown
    const onError = (_: unknown) => {};
    ws.on('error', onError as any);

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onFinish = () => {
      setIsPlaying(false);
      setProgress(0);
    };
    ws.on('play', onPlay);
    ws.on('pause', onPause);
    ws.on('finish', onFinish);

    wavesurferRef.current = ws;
    return () => {
      try {
        ws.un('error', onError as any);
        ws.un('play', onPlay);
        ws.un('pause', onPause);
        ws.un('finish', onFinish);
        ws.destroy();
      } catch {}
      wavesurferRef.current = null;
    };
  }, [previewUrl]);

  useEffect(() => {
    // Enforce 30s cap and drive progress bar
    const ws = wavesurferRef.current;
    if (!ws) return;
    const onReady = () => {
      const limit = Math.min(30, ws.getDuration());
      const onProcess = () => {
        const t = ws.getCurrentTime();
        if (t >= limit) {
          ws.pause();
        }
        setProgress(limit > 0 ? Math.min(1, t / limit) : 0);
      };
      ws.on('audioprocess', onProcess);
      return () => {
        ws.un('audioprocess', onProcess);
      };
    };
    ws.on('ready', onReady);
    return () => {
      ws.un('ready', onReady);
    };
  }, [previewUrl]);

  if (!previewUrl) {
    return <div className="text-sm text-slate-500">No preview available</div>;
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
      e.preventDefault();
      ws.playPause();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const t = ws.getCurrentTime();
      ws.setTime(t + 5);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const t = ws.getCurrentTime();
      ws.setTime(Math.max(0, t - 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      ws.seekTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      ws.seekTo(1);
    }
  };

  return (
    <div className="w-full" tabIndex={0} onKeyDown={onKeyDown} aria-label={`Audio controls for ${title}`}>
      <div ref={containerRef} aria-label={`Waveform for ${title}`} className="rounded-md overflow-hidden" />
      <div className="mt-2 h-1.5 w-full bg-slate-200 rounded">
        <div className="h-1.5 bg-sky-500 rounded" style={{ width: `${Math.round(progress * 100)}%` }} aria-label="Playback progress" />
      </div>
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


