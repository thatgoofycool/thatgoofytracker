"use client";
import { useEffect, useState } from 'react';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<'success'|'error'>('success');
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);
  const Toast = () => message ? (
    <div className={`fixed bottom-4 right-4 px-3 py-2 rounded-md shadow text-white ${type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{message}</div>
  ) : null;
  return {
    Toast,
    showSuccess: (msg: string) => { setType('success'); setMessage(msg); },
    showError: (msg: string) => { setType('error'); setMessage(msg); },
  };
}


