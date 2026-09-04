import { expect, test } from '@playwright/test';

/** 默认：无 localStorage 时跟随浏览器语言（本配置为 en-US → English） */
test('无偏好时跟随浏览器语言（en）', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('syntools:settings.v1');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Developer Online Toolbox' })).toBeVisible();
  await expect(page.locator('#header-lang')).toHaveValue('en');
});

/** 浏览器为简体中文时默认简中 */
test('浏览器 zh-CN 时默认简体中文', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.removeItem('syntools:settings.v1');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '开发者在线工具集' })).toBeVisible();
  await expect(page.locator('#header-lang')).toHaveValue('zh');
  await context.close();
});

/** 语言切换：下拉选择 + localStorage 持久化 */
test('语言切换与刷新持久化', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('syntools:settings.v1');
  });
  await page.goto('/');
  const langSelect = page.locator('#header-lang');

  await langSelect.selectOption('zh');
  await expect(page.getByRole('heading', { name: '开发者在线工具集' })).toBeVisible();

  await langSelect.selectOption('en');
  await expect(page.getByRole('heading', { name: 'Developer Online Toolbox' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Developer Online Toolbox' })).toBeVisible();
  await expect(langSelect).toHaveValue('en');
});

test('可切换到法语并显示本地化标题', async ({ page }) => {
  await page.goto('/');
  const langSelect = page.locator('#header-lang');
  await langSelect.selectOption('fr');
  await expect(
    page.getByRole('heading', { name: 'Boîte à outils en ligne pour développeurs' }),
  ).toBeVisible({ timeout: 15000 });
  await expect(langSelect).toHaveValue('fr');
});
