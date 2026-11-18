import { expect, test, type Page } from '@playwright/test';

/**
 * 移动端「可看 + 轻改」（方案 P2-8）。
 *
 * 只有真浏览器能验这两件事：
 * 1. 窄屏下多出一条 6 个动作的底部工具条，且按钮的禁用规则沿用命令表；
 * 2. 对象浮层整层不渲染——`ChartOverlay` 是 `absolute z-50`，留在 DOM 里就会盖住网格、抢走手指。
 *
 * 判定用「同一份含图表的模板、两种视口」对照，而不是只断言移动端没有浮层：
 * 只断言"没有"的话，图表配置本身坏掉也会让用例变绿。
 *
 * 模板的图表挂在汇总表上（`templates.ts` 的 `chart.sheetId = summary.id`），
 * 所以两个用例都要先切到 Summary 再断言——首屏的 Data 表本来就没有浮层。
 */

async function openTemplate(page: Page): Promise<void> {
  // `?template=sales` 是 P2-6 的直达入口：明细 → SUMIF 汇总 → 图表 + 透视
  await page.goto('/tools/spreadsheet-editor?template=sales');
  await expect(page.locator('canvas').first()).toBeVisible();
  // Univer 在异步插件引导之后才上屏
  await page.waitForTimeout(1500);
}

/** 工作表名固定 ASCII（P2-6 偏差②），不随界面语言变化 */
async function openSummarySheet(page: Page): Promise<void> {
  await page.getByTestId('sheet-tabs').getByRole('tab', { name: 'Summary' }).click();
  await page.waitForTimeout(500);
}

test.describe('移动端视口', () => {
  test.use({ locale: 'zh-CN', viewport: { width: 390, height: 844 } });

  test('底部工具条出现：6 个命令 + 1 个「编辑」', async ({ page }) => {
    await openTemplate(page);

    const bar = page.getByTestId('sheet-mobile-bar');
    await expect(bar).toBeVisible();
    await expect(bar.locator('button')).toHaveCount(7);
    await expect(page.getByTestId('sheet-mobile-edit-cell')).toBeVisible();
    // 撤销不依赖实例之外的状态，是"按钮真的能点"的最小证据
    await expect(page.getByTestId('sheet-mobile-undo')).toBeEnabled();
  });

  test('改值：点「编辑」→ 输入 → 写入，网格里读得到新值', async ({ page }) => {
    await openTemplate(page);

    await page.getByTestId('sheet-mobile-edit-cell').click();
    const input = page.getByTestId('sheet-cell-edit-input');
    await expect(input).toBeVisible();
    // 打开时带着当前格的原值（默认选区在 A1）
    await expect(input).not.toHaveValue('');

    await input.fill('移动端写入');
    await page.getByTestId('sheet-cell-edit-apply').click();

    // 浮层关闭 + 值真的落地：读屏投影（AriaGrid）会在 mutation 后 300ms 内刷新
    await expect(page.getByTestId('sheet-cell-edit-sheet')).toHaveCount(0);
    await expect(page.getByTestId('sheet-a11y-grid')).toContainText('移动端写入');
  });

  test('数字格式：格式单元格对话框在窄屏能打开', async ({ page }) => {
    await openTemplate(page);

    await page.getByTestId('sheet-mobile-formatCells').click();
    await expect(page.getByTestId('sheet-format-cells-dialog')).toBeVisible();
    // 数字 / 字体 / 对齐 / 边框四页签都在，说明手机上不是"只能看不能改"
    await expect(page.getByTestId('sheet-format-tab-number')).toBeVisible();
  });

  test('切到含图表的工作表也不会渲染对象浮层', async ({ page }) => {
    await openTemplate(page);
    await openSummarySheet(page);

    await expect(page.getByTestId('sheet-chart-overlay')).toHaveCount(0);
    await expect(page.getByTestId('sheet-shape-layer')).toHaveCount(0);
    await expect(page.getByTestId('sheet-image-layer')).toHaveCount(0);
  });
});

test.describe('桌面视口（对照组）', () => {
  test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

  test('同一张表在桌面端有图表浮层，且没有底部工具条', async ({ page }) => {
    await openTemplate(page);
    await openSummarySheet(page);

    await expect(page.getByTestId('sheet-chart-overlay')).toHaveCount(1);
    await expect(page.getByTestId('sheet-mobile-bar')).toHaveCount(0);
  });
});
