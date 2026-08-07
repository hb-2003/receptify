import { expect, test } from '@playwright/test';

test('landing page links to the login flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /sign in|log in/i }).first()).toBeVisible();
});

test('login form validates an unsuccessful API response', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Invalid email or password' }),
    });
  });

  await page.goto('/login');
  await page.getByLabel(/email/i).fill('user@example.com');
  await page.getByLabel(/password/i).fill('incorrect-password');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByText('Invalid email or password')).toBeVisible();
});
