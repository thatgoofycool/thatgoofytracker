"use client";
import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  ariaLabel?: string;
};

export default function SubmitButton({ children, pendingText = "Working...", className, ariaLabel }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      aria-busy={pending}
      aria-label={ariaLabel}
      disabled={pending}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}


