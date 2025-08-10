"use client";
import { signIn, signOut } from 'next-auth/react';

type Props = {
  signedIn: boolean;
};

export default function AuthButtons({ signedIn }: Props) {
  if (signedIn) {
    return (
      <button
        className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200"
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
      className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200"
      type="button"
      onClick={() => signIn()}
      aria-label="Sign in"
    >
      Sign in
    </button>
  );
}


