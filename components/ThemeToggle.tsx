"use client";
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = theme === 'system' ? systemTheme : theme;
  const isDark = current === 'dark';

  if (!mounted) return null;
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex items-center justify-center h-9 w-9 rounded-md text-slate-900 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50
                 dark:text-slate-100 dark:hover:text-slate-300 dark:focus-visible:ring-slate-600"
    >
      {isDark ? (
        // Sun icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" fill="currentColor" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        // Moon icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}


