import { expect, test } from '@playwright/test';

/** 语言切换：中文 ⇄ 英文 + localStorage 持久化（Tasks T29） */
test('语言切换与刷新持久化', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '开发者在线工具集' })).toBeVisible();

  // 中文状态下按钮显示 EN，点击切换到英文
  await page.getByRole('button', { name: '切换语言' }).click();
  await expect(page.getByRole('heading', { name: 'Developer Online Toolbox' })).toBeVisible();

  // 刷新后语言设置持久化（存储于 syntools:settings.v1）
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Developer Online Toolbox' })).toBeVisible();

  // 再点一次切回中文（英文态下按钮 aria-label 为 Switch language）
  await page.getByRole('button', { name: 'Switch language' }).click();
  await expect(page.getByRole('heading', { name: '开发者在线工具集' })).toBeVisible();
});
