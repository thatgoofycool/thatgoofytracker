import { test, expect } from '@playwright/test';

test('unauthenticated users cannot create songs', async ({ request }) => {
  const res = await request.post('/api/songs', {
    data: { title: 'X', slug: 'x', status: 'draft' },
  });
  expect(res.status()).toBe(403);
});


