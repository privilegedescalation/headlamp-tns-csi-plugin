import { test, expect } from '@playwright/test';

async function waitForSidebar(page: import('@playwright/test').Page) {
  const sidebar = page.getByRole('navigation', { name: 'Navigation' });
  await expect(sidebar).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  return sidebar;
}

test.describe('TNS CSI plugin smoke tests', () => {
  test('sidebar contains TNS CSI entry', async ({ page }) => {
    await page.goto('/');
    const sidebar = await waitForSidebar(page);
    await expect(sidebar.getByRole('button', { name: /tns.csi/i })).toBeVisible();
  });

  test('TNS CSI sidebar entry navigates to TNS CSI view', async ({ page }) => {
    await page.goto('/');
    const sidebar = await waitForSidebar(page);

    const entry = sidebar.getByRole('button', { name: /tns.csi/i });
    await expect(entry).toBeVisible();
    await entry.click();

    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/tns-csi/);
    await expect(page.getByRole('heading', { name: /TNS.CSI/i })).toBeVisible();
  });

  test('TNS CSI page renders content', async ({ page }) => {
    await page.goto('/c/main/tns-csi');
    await waitForSidebar(page);

    await expect(page.getByRole('heading', { name: /TNS.CSI/i })).toBeVisible({
      timeout: 15_000,
    });

    const hasTable = await page.locator('table').first().isVisible().catch(() => false);
    const hasContent = await page.locator('[class*="Mui"]').first().isVisible().catch(() => false);
    expect(hasTable || hasContent).toBe(true);
  });

  test('plugin settings page shows TNS CSI plugin entry', async ({ page }) => {
    await page.goto('/settings/plugins');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[class*="PluginList"], [class*="plugins"], table, list', { timeout: 10_000 }).catch(() => {});

    const pluginEntry = page.locator('text=/tns.csi/i').first();
    await expect(pluginEntry).toBeVisible({ timeout: 30_000 });
  });
});
