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
  const fadeTimerRef = useRef<number | null>(null);
  const fadeRafRef = useRef<number | null>(null);
  const isFadingRef = useRef(false);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    // Hint for cross-origin; not required when using element.volume fades, but harmless
    try { (audio as any).crossOrigin = 'anonymous'; } catch {}
    audio.preload = 'metadata';
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
        fadeVolumeTo(0, FADE_SEC * 1000);
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
      if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
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
        // Fade in using element volume
        a.volume = 0;
        await a.play();
        isFadingRef.current = false;
        fadeVolumeTo(1, 400);
      } catch {}
    } else {
      // Fade out then pause
      fadeVolumeTo(0, 400);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = window.setTimeout(() => {
        try { a.pause(); } catch {}
      }, 400);
    }
  };

  function fadeVolumeTo(target: number, durationMs: number) {
    const a = audioRef.current;
    if (!a) return;
    if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
    const start = performance.now();
    const from = a.volume;
    const to = Math.max(0, Math.min(1, target));
    const dur = Math.max(0, durationMs);
    const step = (now: number) => {
      const elapsed = now - start;
      const t = dur === 0 ? 1 : Math.min(1, elapsed / dur);
      const value = from + (to - from) * t;
      // Clamp to [0,1] to avoid IndexSizeError
      a.volume = Math.max(0, Math.min(1, value));
      if (t < 1) {
        fadeRafRef.current = requestAnimationFrame(step);
      } else {
        // Ensure final exact target
        a.volume = to;
        fadeRafRef.current = null;
      }
    };
    fadeRafRef.current = requestAnimationFrame(step);
  }

  // Circular progress ring geometry
  const size = 100; // SVG viewport size slightly larger for thicker ring
  const stroke = 8; // thicker ring for easier interaction
  const r = (size - stroke) / 2; // radius
  const c = 2 * Math.PI * r; // circumference
  const dashoffset = c * (1 - progress);

  function handleRingPointer(e: React.PointerEvent<HTMLDivElement>) {
    const wrapper = ringRef.current;
    const a = audioRef.current;
    if (!wrapper || !a) return;
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = size / 2;
    const cy = size / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Only respond when clicking near the ring (band around r)
    const band = Math.max(10, stroke * 1.25);
    if (dist < r - band || dist > r + band) return;
    // Convert to angle fraction, accounting for -90deg rotation (top = 0)
    let theta = Math.atan2(dy, dx); // [-pi, pi], 0 at +X
    if (theta < 0) theta += Math.PI * 2; // [0, 2pi)
    const fraction = ((theta + Math.PI / 2) % (Math.PI * 2)) / (Math.PI * 2); // 0 at top, clockwise
    const limit = Math.min(30, isFinite(a.duration) && a.duration > 0 ? a.duration : 30);
    try {
      a.currentTime = Math.max(0, Math.min(limit, fraction * limit));
      setProgress(Math.max(0, Math.min(1, fraction)));
    } catch {}
  }

  return (
    <div className="w-full">
      <div
        ref={ringRef}
        className="relative inline-block"
        style={{ width: size, height: size }}
        onPointerDown={handleRingPointer}
      >
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
          className={`relative w-18 h-18 rounded-full flex items-center justify-center border ${isPlaying ? 'border-black' : 'border-slate-300'} bg-white hover:bg-slate-50`}
          style={{ left: (size - 72) / 2, top: (size - 72) / 2, width: 72, height: 72, position: 'absolute' }}
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


