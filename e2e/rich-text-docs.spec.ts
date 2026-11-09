import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * 富文本编辑器的本地持久化链路（IndexedDB 文档库 + 版本快照）。
 * 单测里 IndexedDB 由 fake-indexeddb 顶替，这里验真实浏览器中的完整闭环：
 * 保存 → 出现在文档库 → 新建清空 → 从库里重新打开；手动快照 → 改动后恢复。
 */

test.use({ locale: 'zh-CN' });

async function openEditor(page: Page): Promise<void> {
  await page.goto('/tools/rich-text-editor');
  await expect(page.locator('.tiptap')).toBeVisible();
}

/** Ctrl/⌘+S 立即落盘（自动保存是防抖的，等它不可靠） */
async function saveNow(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.getByTestId('rich-text-save-notice')).toBeVisible();
}

async function openLibrary(page: Page): Promise<Locator> {
  await page.getByTestId('menubar-more').click();
  await page.getByRole('menuitem', { name: '文档库', exact: true }).click();
  const panel = page.getByTestId('rich-text-library');
  await expect(panel).toBeVisible();
  return panel;
}

/** 字符计数来自防抖后的快照，新建前的“丢弃内容”确认依赖它 */
async function waitForChars(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('[data-editor-statusbar]').innerText())
    .toMatch(/字符: [1-9]/);
}

test('saved document appears in the library and reopens after creating a new one', async ({
  page,
}) => {
  await openEditor(page);
  await page.locator('.tiptap').click();
  await page.keyboard.type('文档库往返内容');
  await waitForChars(page);
  await saveNow(page);

  const panel = await openLibrary(page);
  await expect(panel.getByText('暂无本地文档')).toHaveCount(0);
  await expect(panel.getByText('未命名文档')).toBeVisible();

  // 新建文档：有内容时会先确认，接受后编辑器清空
  page.once('dialog', (dialog) => void dialog.accept());
  await panel.getByRole('button', { name: '新建', exact: true }).click();
  await expect(page.locator('.tiptap')).not.toContainText('文档库往返内容');

  // 列表仍然持有刚保存的文档，点回去内容必须回来
  await expect(panel.getByText('未命名文档')).toBeVisible();
  await panel.getByText('未命名文档').click();
  await expect(page.locator('.tiptap')).toContainText('文档库往返内容');
  // 打开文档后面板自动收起
  await expect(page.getByTestId('rich-text-library')).toHaveCount(0);
});

test('duplicating from the library adds a localized copy', async ({ page }) => {
  await openEditor(page);
  await page.locator('.tiptap').click();
  await page.keyboard.type('原件内容');
  await waitForChars(page);
  await saveNow(page);

  const panel = await openLibrary(page);
  await panel.getByLabel('创建副本').click();
  // 副本标题由界面语言决定（store 层不再硬编码中文）
  await expect(panel.getByText('未命名文档 副本')).toBeVisible();
  await expect(panel.getByText('未命名文档', { exact: true })).toBeVisible();
});

test('flags a save made in another tab and can load that version', async ({ context, page }) => {
  await openEditor(page);
  const otherTab = await context.newPage();
  await otherTab.goto('/tools/rich-text-editor');
  await expect(otherTab.locator('.tiptap')).toBeVisible();

  await page.locator('.tiptap').click();
  await page.keyboard.type('第一个标签页的内容');
  await saveNow(page);

  const banner = otherTab.getByTestId('rich-text-remote-change');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('另一个标签页更新了此文档');

  await otherTab.getByRole('button', { name: '载入最新版本' }).click();
  await expect(otherTab.locator('.tiptap')).toContainText('第一个标签页的内容');
  await expect(otherTab.getByTestId('rich-text-remote-change')).toHaveCount(0);
});

test('manual snapshot lands in the version panel and restores the archived content', async ({
  page,
}) => {
  await openEditor(page);
  await page.locator('.tiptap').click();
  await page.keyboard.type('快照前内容');
  await saveNow(page);

  await page.getByRole('tab', { name: '审阅', exact: true }).click();
  await page.getByRole('button', { name: '历史版本', exact: true }).click();
  const panel = page.getByTestId('rich-text-versions');
  await expect(panel).toBeVisible();
  // 保存文档时已经自动留下了一个快照
  await expect(panel.getByText('暂无历史版本')).toHaveCount(0);

  await panel.getByPlaceholder('快照备注（可选）').fill('定稿');
  await panel.getByRole('button', { name: '保存快照' }).click();
  await expect(panel.getByText('定稿')).toBeVisible();

  // 改动正文，再从最新快照恢复
  await page.locator('.tiptap').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('改坏的内容');
  await expect(page.locator('.tiptap')).toContainText('改坏的内容');

  page.once('dialog', (dialog) => void dialog.accept());
  await panel.getByRole('button', { name: '恢复', exact: true }).first().click();
  await expect(page.locator('.tiptap')).toContainText('快照前内容');
  await expect(page.getByTestId('rich-text-versions')).toHaveCount(0);
});
