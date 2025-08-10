"use client";
import { useEffect } from 'react';
import { useToast } from './toast';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function ToastDisplay({ message, type }: { message?: string; type?: 'success' | 'error' }) {
  const { Toast, showSuccess, showError } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (!message) return;
    if (type === 'error') showError(message);
    else showSuccess(message);
    const sp = new URLSearchParams(params.toString());
    sp.delete('toast');
    sp.delete('type');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [message]);

  return <Toast />;
}


