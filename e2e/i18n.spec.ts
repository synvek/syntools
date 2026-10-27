import { expect, test } from '@playwright/test';

/** Default: without localStorage, follow the browser language (en-US here → English) */
test('follows browser language when no preference is stored (en)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('syntools:settings.v1');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Online Toolkit' })).toBeVisible();
  await expect(page.locator('#header-lang')).toHaveValue('en');
});

/** Defaults to Simplified Chinese when the browser is zh-CN */
test('defaults to Simplified Chinese when the browser is zh-CN', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.removeItem('syntools:settings.v1');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '在线工具集' })).toBeVisible();
  await expect(page.locator('#header-lang')).toHaveValue('zh');
  await context.close();
});

/** Language switching: dropdown selection + localStorage persistence */
test('language switching persists across reloads', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('syntools:settings.v1');
  });
  await page.goto('/');
  const langSelect = page.locator('#header-lang');

  await langSelect.selectOption('zh');
  await expect(page.getByRole('heading', { name: '在线工具集' })).toBeVisible();

  await langSelect.selectOption('en');
  await expect(page.getByRole('heading', { name: 'Online Toolkit' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Online Toolkit' })).toBeVisible();
  await expect(langSelect).toHaveValue('en');
});

/** Legacy settings with lang but no langExplicit are not pinned; language is re-detected from the system locale */
test('legacy settings without langExplicit re-detect the language', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('syntools:settings.v1', JSON.stringify({ theme: 'system', lang: 'en' }));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '在线工具集' })).toBeVisible();
  await expect(page.locator('#header-lang')).toHaveValue('zh');
  await context.close();
});

test('switches to French and shows the localized heading', async ({ page }) => {
  await page.goto('/');
  const langSelect = page.locator('#header-lang');
  await langSelect.selectOption('fr');
  await expect(page.getByRole('heading', { name: 'Boîte à outils en ligne' })).toBeVisible({
    timeout: 15000,
  });
  await expect(langSelect).toHaveValue('fr');
});
