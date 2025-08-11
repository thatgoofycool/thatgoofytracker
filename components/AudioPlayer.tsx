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

  useEffect(() => {
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    audio.preload = 'none';
    audioRef.current = audio;

    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onTime = () => {
      const limit = Math.min(30, isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30);
      if (audio.currentTime >= limit) {
        audio.pause();
        setProgress(1);
        return;
      }
      setProgress(Math.max(0, Math.min(1, audio.currentTime / limit)));
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
        await a.play();
      } catch {}
    } else {
      a.pause();
    }
  };

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


