"use client";
import { signIn, signOut } from 'next-auth/react';

type Props = {
  signedIn: boolean;
};

export default function AuthButtons({ signedIn }: Props) {
  const btn = "px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100";
  if (signedIn) {
    return (
      <button
        className={btn}
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        aria-label="Sign out"
      >
        Sign out
      </button>
    );
  }
  return (
    <button
      className={btn}
      type="button"
      onClick={() => signIn()}
      aria-label="Sign in"
    >
      Sign in
    </button>
  );
}


