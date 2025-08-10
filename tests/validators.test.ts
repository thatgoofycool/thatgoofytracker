import { describe, it, expect } from 'vitest';
import { songCreateSchema, uploadRequestSchema } from '@/lib/validators';

describe('validators', () => {
  it('validates song create', () => {
    const data = { title: 'Test', slug: 'test-song', status: 'draft' };
    const parsed = songCreateSchema.parse(data);
    expect(parsed.title).toBe('Test');
  });

  it('rejects bad upload types', () => {
    const res = uploadRequestSchema.safeParse({ songId: crypto.randomUUID(), fileName: 'evil.exe', contentType: 'application/x-msdownload', fileSize: 100 });
    expect(res.success).toBe(false);
  });
});


