"use client";
import { useEffect } from 'react';
import { useToast } from './toast';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function ToastDisplay() {
  const { Toast, showSuccess, showError } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const message = params.get('toast') ?? undefined;
  const type = (params.get('type') as 'success' | 'error' | null) ?? 'success';

  useEffect(() => {
    if (!message) return;
    if (type === 'error') showError(message);
    else showSuccess(message);
    const sp = new URLSearchParams(params.toString());
    sp.delete('toast');
    sp.delete('type');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [message, type]);

  return <Toast />;
}


