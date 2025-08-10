import { test, expect } from '@playwright/test';

test('home loads and shows header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Album Progress' })).toBeVisible();
});


