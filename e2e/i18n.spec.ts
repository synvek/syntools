import { expect, test } from '@playwright/test';

/** 语言切换：下拉选择 + localStorage 持久化 */
test('语言切换与刷新持久化', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '开发者在线工具集' })).toBeVisible();

  const langSelect = page.locator('#header-lang');
  await langSelect.selectOption('en');
  await expect(page.getByRole('heading', { name: 'Developer Online Toolbox' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Developer Online Toolbox' })).toBeVisible();
  await expect(langSelect).toHaveValue('en');

  await langSelect.selectOption('zh');
  await expect(page.getByRole('heading', { name: '开发者在线工具集' })).toBeVisible();
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
