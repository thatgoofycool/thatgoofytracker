"use client";
import { useEffect, useRef, useState } from 'react';

type Props = {
  previewUrl?: string;
  waveform?: { peaks?: number[]; duration?: number } | null;
  title: string;
};

export default function AudioPlayer({ previewUrl, title }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 relative to 30s cap
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const isFadingRef = useRef(false);

  useEffect(() => {
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    audio.preload = 'none';
    audioRef.current = audio;

    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const FADE_SEC = 0.4;
    const onTime = () => {
      const limit = Math.min(30, isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30);
      const t = audio.currentTime;
      const p = Math.max(0, Math.min(1, t / limit));
      setProgress(p);
      // Trigger fade out slightly before the hard stop
      if (!isFadingRef.current && t >= Math.max(0, limit - FADE_SEC)) {
        isFadingRef.current = true;
        fadeGainTo(0, FADE_SEC);
        // Pause right after fade completes
        if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = window.setTimeout(() => {
          try { audio.pause(); } catch {}
        }, FADE_SEC * 1000);
      }
      if (t >= limit) {
        setProgress(1);
        return;
      }
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('timeupdate', onTime);

    return () => {
      try {
        audio.pause();
      } catch {}
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('timeupdate', onTime);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
      isFadingRef.current = false;
      // Tear down WebAudio graph
      try { sourceRef.current?.disconnect(); } catch {}
      try { gainRef.current?.disconnect(); } catch {}
      try { audioCtxRef.current?.close(); } catch {}
      sourceRef.current = null;
      gainRef.current = null;
      audioCtxRef.current = null;
      audioRef.current = null;
    };
  }, [previewUrl]);

  if (!previewUrl) {
    return <div className="text-sm text-slate-500">No preview available</div>;
  }

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try {
        await ensureAudioGraph(a);
        // Fade in
        setGainImmediately(0);
        await a.play();
        isFadingRef.current = false;
        fadeGainTo(1, 0.4);
      } catch {}
    } else {
      // Fade out then pause
      fadeGainTo(0, 0.4);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = window.setTimeout(() => {
        try { a.pause(); } catch {}
      }, 400);
    }
  };

  function ensureAudioGraph(element: HTMLMediaElement) {
    if (audioCtxRef.current && gainRef.current && sourceRef.current) return Promise.resolve();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaElementSource(element as HTMLAudioElement);
    const gain = ctx.createGain();
    source.connect(gain).connect(ctx.destination);
    sourceRef.current = source;
    gainRef.current = gain;
    if (ctx.state === 'suspended') return ctx.resume();
    return Promise.resolve();
  }

  function setGainImmediately(value: number) {
    const ctx = audioCtxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;
    const t = ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(value, t);
    } catch {}
  }

  function fadeGainTo(target: number, seconds: number) {
    const ctx = audioCtxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;
    const now = ctx.currentTime;
    try {
      const current = gain.gain.value;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(current, now);
      gain.gain.linearRampToValueAtTime(target, now + Math.max(0.01, seconds));
    } catch {}
  }

  // Circular progress ring geometry
  const size = 92; // SVG viewport size
  const stroke = 4;
  const r = (size - stroke) / 2; // radius
  const c = 2 * Math.PI * r; // circumference
  const dashoffset = c * (1 - progress);

  return (
    <div className="w-full">
      <div className="relative inline-block" style={{ width: size, height: size }}>
        <svg
          className="absolute inset-0 -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e5e7eb" /* slate-200 */
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#000000"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center border ${isPlaying ? 'border-black' : 'border-slate-300'} bg-white hover:bg-slate-50`}
          style={{ left: (size - 80) / 2, top: (size - 80) / 2, position: 'absolute' }}
        >
          {isPlaying ? (
            <div className="flex items-end gap-[3px] h-6" aria-hidden>
              <span className="w-[4px] bg-black animate-eq1 rounded-sm" />
              <span className="w-[4px] bg-black animate-eq2 rounded-sm" />
              <span className="w-[4px] bg-black animate-eq3 rounded-sm" />
              <span className="w-[4px] bg-black animate-eq2 rounded-sm" />
              <span className="w-[4px] bg-black animate-eq1 rounded-sm" />
            </div>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M8 5v14l11-7-11-7z" fill="#000000" />
            </svg>
          )}
        </button>
      </div>
      <style jsx>{`
        @keyframes eq {
          0%, 100% { height: 6px; }
          50% { height: 24px; }
        }
        .animate-eq1 { animation: eq 1s ease-in-out infinite; }
        .animate-eq2 { animation: eq 0.9s ease-in-out infinite; animation-delay: 0.1s; }
        .animate-eq3 { animation: eq 0.8s ease-in-out infinite; animation-delay: 0.2s; }
      `}</style>
      <div className="sr-only" aria-live="polite">{isPlaying ? `${title} playing` : `${title} paused`}</div>
    </div>
  );
}


