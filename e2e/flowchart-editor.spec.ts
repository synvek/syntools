import { expect, test, type Page } from '@playwright/test';

/**
 * 流程图编辑器「下一阶段增强」的回归用例（P0）：
 * 多选批量编辑、快捷键（全选 / 微移 / 建节点）、网格吸附开关、
 * Mermaid 导入、导出范围与边距参数。
 */

const NODE = '.react-flow__node';
const EDGE = '.react-flow__edge';

async function dropProcess(page: Page, x: number, y: number) {
  const canvas = page.locator('.react-flow');
  // 精确匹配：图形库中「预定义过程」也包含「过程」子串
  await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
    targetPosition: { x, y },
  });
}

/** 从第 from 个图形的右侧锚点拖到第 to 个图形，生成一条连线 */
async function connectNodes(page: Page, from: number, to: number) {
  const source = page.locator(NODE).nth(from);
  await source.hover();
  const handle = (await source.locator('.react-flow__handle-right').boundingBox())!;
  const target = (await page.locator(NODE).nth(to).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
}

/** 点击连线路径中点选中该连线 */
async function selectFirstEdge(page: Page) {
  const mid = await page
    .locator('.react-flow__edge-interaction')
    .first()
    .evaluate((el) => {
      const path = el as SVGPathElement;
      const p = path.getPointAtLength(path.getTotalLength() / 2);
      const m = path.getScreenCTM();
      if (!m) return null;
      const sp = new DOMPoint(p.x, p.y).matrixTransform(m);
      return { x: sp.x, y: sp.y };
    });
  await page.mouse.click(mid!.x, mid!.y);
}

test.describe('流程图编辑器增强（zh-CN）', () => {
  test.use({ locale: 'zh-CN' });

  test('多选批量编辑：属性面板聚合展示并一次写入全部选中节点', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 90);
    await dropProcess(page, 380, 90);
    await expect(page.locator(NODE)).toHaveCount(2);

    // Ctrl/⌘+A 全选
    await page.keyboard.press('Control+a');
    await expect(page.getByText(/已选中 2 个元素/)).toBeVisible();

    // 属性面板标题变为「已选中 2 个节点」
    await expect(page.getByText('已选中 2 个节点')).toBeVisible();

    // 修改填充色 → 两个节点同时生效
    // 注意：受控 input 需用原生 setter 写值，React 的 value tracker 才会识别到变化
    const fill = page.getByLabel('填充色');
    await fill.evaluate((el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, '#ffcc00');
    // 每个节点的 svg 内第一个 <g> 是图形本体（后面的 <g> 是装饰/箭头）
    const shapeGroup = (index: number) => page.locator(NODE).nth(index).locator('svg g').first();
    await expect(shapeGroup(0)).toHaveAttribute('fill', '#ffcc00');
    await expect(shapeGroup(1)).toHaveAttribute('fill', '#ffcc00');
  });

  test('快捷键：Ctrl+A 全选、方向键微移、Tab 生成相连节点', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 140, 120);
    await expect(page.locator(NODE)).toHaveCount(1);

    const node = page.locator(NODE).first();
    await node.click();
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();
    const before = (await node.boundingBox())!;

    // 方向键微移（默认 1px，按住 ⇧ 加速 10px）
    await page.keyboard.press('Shift+ArrowRight');
    await expect
      .poll(async () => (await node.boundingBox())?.x ?? before.x)
      .toBeGreaterThan(before.x + 5);

    // Ctrl+A 全选：状态栏出现「已选中 1 个元素」
    await page.keyboard.press('Control+a');
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();

    // Tab：在右侧生成相连的新节点
    await page.keyboard.press('Tab');
    await expect(page.locator(NODE)).toHaveCount(2);
    await expect(page.locator(EDGE)).toHaveCount(1);
  });

  test('网格吸附可开关且网格尺寸可选', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const toggle = page.getByTestId('flowchart-grid-toggle');
    await expect(toggle).toBeVisible();
    // 默认开启（primary 样式 = 蓝底）
    await expect(toggle).toHaveClass(/bg-blue-600/);
    await toggle.click();
    await expect(toggle).not.toHaveClass(/bg-blue-600/);

    const gridSize = page.getByTestId('flowchart-grid-size');
    await gridSize.selectOption('20');
    await expect(gridSize).toHaveValue('20');
  });

  test('导入 Mermaid 文本生成图形与连线', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const source = ['flowchart TD', '  A[开始] --> B{判断}', '  B -->|是| C([结束])'].join('\n');
    await page.setInputFiles('input[type=file]', {
      name: 'sample.mmd',
      mimeType: 'text/plain',
      buffer: Buffer.from(source, 'utf-8'),
    });

    await expect(page.getByText(/节点:\s*3/)).toBeVisible();
    await expect(page.getByText(/连线:\s*2/)).toBeVisible();
    await expect(page.locator(NODE).filter({ hasText: '开始' })).toHaveCount(1);
    await expect(page.locator(NODE).filter({ hasText: '判断' })).toHaveCount(1);
  });

  test('导出面板提供范围 / 倍率 / 边距参数', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 140, 120);

    await page.getByRole('button', { name: '导出' }).click();
    const range = page.getByTestId('flowchart-export-range');
    await expect(range).toBeVisible();
    await expect(range).toHaveValue('current');
    // 只有一页时「全部页」不可选
    const allDisabled = await range
      .locator('option[value="all"]')
      .evaluate((el) => (el as HTMLOptionElement).disabled);
    expect(allDisabled).toBe(true);
    await expect(page.getByText('边距', { exact: true })).toBeVisible();
    await expect(page.getByTestId('flowchart-export-png')).toBeVisible();
  });

  test('多页时可选「全部页」并导出 ZIP', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 140, 120);
    await page.getByRole('button', { name: '新建页面' }).click();
    await dropProcess(page, 200, 160);
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();

    await page.getByRole('button', { name: '导出' }).click();
    const range = page.getByTestId('flowchart-export-range');
    await range.selectOption('all');

    const download = page.waitForEvent('download');
    await page.getByTestId('flowchart-export-png').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.zip$/);
  });

  test('连线折点：正交自动布线生成折点，双击可删除', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 80);
    await dropProcess(page, 400, 240);
    await expect(page.locator(NODE)).toHaveCount(2);

    await connectNodes(page, 0, 1);
    await expect(page.locator(EDGE)).toHaveCount(1);
    await selectFirstEdge(page);
    await expect(page.getByTestId('edge-endpoint')).toHaveCount(2);

    // 自动布线：生成正交折点并出现可拖拽手柄
    await page.getByTestId('flowchart-auto-route').click();
    const waypoints = page.getByTestId('edge-waypoint');
    await expect(waypoints.first()).toBeVisible();
    const count = await waypoints.count();
    expect(count).toBeGreaterThan(0);

    // 双击删除一个折点
    await waypoints.first().dblclick();
    await expect.poll(() => page.getByTestId('edge-waypoint').count()).toBeLessThan(count);

    // 清除折点
    await page.getByTestId('flowchart-clear-waypoints').click();
    await expect(page.getByTestId('edge-waypoint')).toHaveCount(0);
  });

  test('连线标签：双击就地编辑', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 80);
    await dropProcess(page, 400, 240);
    await connectNodes(page, 0, 1);
    await selectFirstEdge(page);
    await expect(page.getByTestId('edge-endpoint')).toHaveCount(2);

    // 选中态下显示「＋」占位标签，双击进入编辑
    await page.getByTestId('edge-label').first().dblclick();
    await page.keyboard.type('同意');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('edge-label').first()).toHaveText('同意');
  });

  test('图层面板：容器树形、搜索过滤与拖拽改父级入口', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    await page.getByRole('button', { name: '图层' }).click();
    // 1 条泳道 + 4 个内部节点
    await expect(page.getByTestId('layer-row')).toHaveCount(5);
    // 子节点提供「移出容器」按钮
    await expect(page.getByTestId('layer-move-out').first()).toBeVisible();

    // 搜索过滤
    await page.getByTestId('layer-search').fill('步骤 1');
    await expect(page.getByTestId('layer-row')).toHaveCount(1);
    await page.getByTestId('layer-search').fill('');

    // 点击行选中节点，与画布选中态联动
    await page.getByTestId('layer-row').first().click();
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();
  });

  test('插入图标与公式节点，并可在属性面板编辑公式', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByTestId('insert-icon').click();
    await page.getByTestId('icon-star').click();
    await expect(page.locator(NODE)).toHaveCount(1);

    await page.getByTestId('insert-formula').click();
    await expect(page.locator(NODE)).toHaveCount(2);
    // 新插入的公式节点处于选中态，KaTeX 渲染完成后属性面板出现源码编辑框
    await expect(page.getByTestId('formula-content')).toBeVisible();
    const input = page.getByTestId('flowchart-formula-input');
    await expect(input).toBeVisible();
    await input.fill('a^2 + b^2 = c^2');
    await expect(input).toHaveValue('a^2 + b^2 = c^2');
  });

  test('自动布局：方向可选且保留泳道层级', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    await page.getByTestId('flowchart-layout-direction').selectOption('LR');
    await page.getByTestId('flowchart-layout-density').selectOption('loose');
    await page.getByRole('button', { name: '自动布局' }).click();

    // 泳道仍是容器（旧实现会在布局前解除泳道归属并把它当普通节点重排）
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();
    await expect(page.locator(NODE).filter({ hasText: '横向泳道' })).toHaveCount(1);
    await page.getByRole('button', { name: '图层' }).click();
    await expect(page.getByTestId('layer-move-out').first()).toBeVisible();
  });
});
