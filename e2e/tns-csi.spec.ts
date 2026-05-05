import { test, expect } from '@playwright/test';

test.describe('TNS CSI plugin smoke tests', () => {
  test('sidebar contains TNS CSI entry', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.getByRole('navigation', { name: 'Navigation' });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    await expect(sidebar.getByRole('button', { name: /tns.csi/i })).toBeVisible();
  });

  test('TNS CSI sidebar entry navigates to TNS CSI view', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.getByRole('navigation', { name: 'Navigation' });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    const entry = sidebar.getByRole('button', { name: /tns.csi/i });
    await expect(entry).toBeVisible();
    await entry.click();

    await expect(page).toHaveURL(/tns-csi/);
    await expect(page.getByRole('heading', { name: /TNS.CSI/i })).toBeVisible();
  });

  test('TNS CSI page renders content', async ({ page }) => {
    await page.goto('/c/main/tns-csi');

    await expect(page.getByRole('heading', { name: /TNS.CSI/i })).toBeVisible({
      timeout: 15_000,
    });

    const hasTable = await page.locator('table').first().isVisible().catch(() => false);
    const hasContent = await page.locator('[class*="Mui"]').first().isVisible().catch(() => false);
    expect(hasTable || hasContent).toBe(true);
  });

  test('plugin settings page shows TNS CSI plugin entry', async ({ page }) => {
    await page.goto('/settings/plugins');

    const pluginEntry = page.locator('text=/tns.csi/i').first();
    await expect(pluginEntry).toBeVisible({ timeout: 30_000 });
  });
});
