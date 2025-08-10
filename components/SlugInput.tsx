"use client";
import { useState } from 'react';

type Props = {
  defaultValue?: string;
  className?: string;
};

function sanitize(value: string): string {
  const lower = value.toLowerCase();
  const replaced = lower
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return replaced;
}

export default function SlugInput({ defaultValue = '', className }: Props) {
  const [val, setVal] = useState<string>(sanitize(defaultValue));
  return (
    <input
      name="slug"
      value={val}
      onChange={(e) => setVal(sanitize(e.target.value))}
      placeholder="Unique ID"
      aria-label="Unique ID"
      autoComplete="off"
      spellCheck={false}
      required
      className={className}
    />
  );
}


