import { expect, test, type Page } from '@playwright/test';

/**
 * Regression cases for the flowchart editor's "next-stage enhancements" (P0):
 * multi-select batch editing, keyboard shortcuts (select all / nudge / create node),
 * grid snapping toggle, Mermaid import, export range and margin options.
 */

const NODE = '.react-flow__node';
const EDGE = '.react-flow__edge';

async function dropProcess(page: Page, x: number, y: number) {
  const canvas = page.locator('.react-flow');
  // Exact match: the shape library also has "预定义过程", which contains "过程" as a substring
  await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
    targetPosition: { x, y },
  });
}

/** Drag from the right handle of node `from` to node `to` to create an edge */
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

/** Select the edge by clicking the midpoint of its path */
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

test.describe('flowchart editor enhancements (zh-CN)', () => {
  test.use({ locale: 'zh-CN' });
  // Larger viewport: the shape library and properties panel flank the canvas, so nodes/handles need room to be clicked
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('multi-select batch edit: properties panel aggregates and writes all selected nodes at once', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 90);
    await dropProcess(page, 380, 90);
    await expect(page.locator(NODE)).toHaveCount(2);

    // Ctrl/⌘+A selects all
    await page.keyboard.press('Control+a');
    await expect(page.getByText(/已选中 2 个元素/)).toBeVisible();

    // The panel title becomes "已选中 2 个节点"
    await expect(page.getByText('已选中 2 个节点')).toBeVisible();

    // Changing the fill color → both nodes update
    // Note: controlled inputs need the native setter so React's value tracker sees the change
    const fill = page.getByLabel('填充色');
    await fill.evaluate((el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, '#ffcc00');
    // The first <g> inside each node's svg is the shape itself (later <g>s are decorations/arrowheads)
    const shapeGroup = (index: number) => page.locator(NODE).nth(index).locator('svg g').first();
    await expect(shapeGroup(0)).toHaveAttribute('fill', '#ffcc00');
    await expect(shapeGroup(1)).toHaveAttribute('fill', '#ffcc00');
  });

  test('shortcuts: Ctrl+A select all, arrow keys nudge, Tab creates a connected node', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 140, 120);
    await expect(page.locator(NODE)).toHaveCount(1);

    const node = page.locator(NODE).first();
    await node.click();
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();
    const before = (await node.boundingBox())!;

    // Nudge with arrow keys (1px by default, 10px with ⇧ held)
    await page.keyboard.press('Shift+ArrowRight');
    await expect
      .poll(async () => (await node.boundingBox())?.x ?? before.x)
      .toBeGreaterThan(before.x + 5);

    // Ctrl+A selects all: the status bar shows "已选中 1 个元素"
    await page.keyboard.press('Control+a');
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();

    // Tab: create a connected node to the right
    await page.keyboard.press('Tab');
    await expect(page.locator(NODE)).toHaveCount(2);
    await expect(page.locator(EDGE)).toHaveCount(1);
  });

  test('grid snapping can be toggled and the grid size is selectable', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const toggle = page.getByTestId('flowchart-grid-toggle');
    await expect(toggle).toBeVisible();
    // On by default (primary style = blue background)
    await expect(toggle).toHaveClass(/bg-blue-600/);
    await toggle.click();
    await expect(toggle).not.toHaveClass(/bg-blue-600/);

    const gridSize = page.getByTestId('flowchart-grid-size');
    await gridSize.selectOption('20');
    await expect(gridSize).toHaveValue('20');
  });

  test('importing Mermaid text creates shapes and edges', async ({ page }) => {
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

  test('export panel offers range / scale / margin options', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 140, 120);

    await page.getByRole('button', { name: '导出' }).click();
    const range = page.getByTestId('flowchart-export-range');
    await expect(range).toBeVisible();
    await expect(range).toHaveValue('current');
    // With a single page, "全部页" cannot be selected
    const allDisabled = await range
      .locator('option[value="all"]')
      .evaluate((el) => (el as HTMLOptionElement).disabled);
    expect(allDisabled).toBe(true);
    await expect(page.getByText('边距', { exact: true })).toBeVisible();
    await expect(page.getByTestId('flowchart-export-png')).toBeVisible();
  });

  test('with multiple pages "全部页" is selectable and exports a ZIP', async ({ page }) => {
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

  test('edge waypoints: orthogonal auto-routing creates bends, double-click deletes one', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 80);
    await dropProcess(page, 400, 240);
    await expect(page.locator(NODE)).toHaveCount(2);

    await connectNodes(page, 0, 1);
    await expect(page.locator(EDGE)).toHaveCount(1);
    await selectFirstEdge(page);
    await expect(page.getByTestId('edge-endpoint')).toHaveCount(2);

    // Auto-routing: generates orthogonal waypoints and draggable handles
    await page.getByTestId('flowchart-auto-route').click();
    const waypoints = page.getByTestId('edge-waypoint');
    await expect(waypoints.first()).toBeVisible();
    const count = await waypoints.count();
    expect(count).toBeGreaterThan(0);

    // Double-click deletes one waypoint
    await waypoints.first().dblclick();
    await expect.poll(() => page.getByTestId('edge-waypoint').count()).toBeLessThan(count);

    // After re-routing "清除折点" is enabled and clears all waypoints at once
    // (routing follows the fewest bends along endpoint normals: diagonally adjacent nodes may only need one bend)
    await page.getByTestId('flowchart-auto-route').click();
    await expect(page.getByTestId('edge-waypoint').first()).toBeVisible();
    await page.getByTestId('flowchart-clear-waypoints').click();
    await expect(page.getByTestId('edge-waypoint')).toHaveCount(0);
  });

  test('edge labels: double-click to edit in place', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 80);
    await dropProcess(page, 400, 240);
    await connectNodes(page, 0, 1);
    await selectFirstEdge(page);
    await expect(page.getByTestId('edge-endpoint')).toHaveCount(2);

    // When selected, a "＋" placeholder label appears; double-click to edit
    await page.getByTestId('edge-label').first().dblclick();
    await page.keyboard.type('同意');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('edge-label').first()).toHaveText('同意');
  });

  test('layers panel: container tree, search filtering and drag-to-reparent entry', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    // Exact match: the shape library also has a "模板类" shape button
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    await page.getByRole('button', { name: '图层' }).click();
    // 1 swimlane + 4 inner nodes
    await expect(page.getByTestId('layer-row')).toHaveCount(5);
    // Child nodes provide a "移出容器" button
    await expect(page.getByTestId('layer-move-out').first()).toBeVisible();

    // Search filtering
    await page.getByTestId('layer-search').fill('步骤 1');
    await expect(page.getByTestId('layer-row')).toHaveCount(1);
    await page.getByTestId('layer-search').fill('');

    // Clicking a row selects the node, syncing with the canvas selection
    await page.getByTestId('layer-row').first().click();
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();
  });

  test('insert icon and formula nodes, and edit the formula in the properties panel', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByTestId('insert-icon').click();
    await page.getByTestId('icon-star').click();
    await expect(page.locator(NODE)).toHaveCount(1);

    await page.getByTestId('insert-formula').click();
    await expect(page.locator(NODE)).toHaveCount(2);
    // The newly inserted formula node is selected; once KaTeX renders, the source editor appears in the panel
    await expect(page.getByTestId('formula-content')).toBeVisible();
    const input = page.getByTestId('flowchart-formula-input');
    await expect(input).toBeVisible();
    await input.fill('a^2 + b^2 = c^2');
    await expect(input).toHaveValue('a^2 + b^2 = c^2');
  });

  test('auto layout: direction is selectable and swimlane hierarchy is preserved', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    // Exact match: the shape library also has a "模板类" shape button
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    await page.getByTestId('flowchart-layout-direction').selectOption('LR');
    await page.getByTestId('flowchart-layout-density').selectOption('loose');
    await page.getByRole('button', { name: '自动布局' }).click();

    // The swimlane is still a container (the old implementation detached swimlanes before layout and re-laid them out as plain nodes)
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();
    await expect(page.locator(NODE).filter({ hasText: '横向泳道' })).toHaveCount(1);
    await page.getByRole('button', { name: '图层' }).click();
    await expect(page.getByTestId('layer-move-out').first()).toBeVisible();
  });

  test('geometry editing: X and width/height inputs write to the node', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 220, 150);
    await page.locator(NODE).first().click();

    const posX = page.getByTestId('flowchart-geo-x');
    await expect(posX).toBeVisible();
    await posX.fill('320');
    await posX.blur();
    await expect(posX).toHaveValue('320');

    const width = page.getByTestId('flowchart-geo-width');
    await width.fill('260');
    await width.blur();
    await expect(width).toHaveValue('260');
    await expect
      .poll(async () => Math.round((await page.locator(NODE).first().boundingBox())!.width))
      .toBe(260);
  });

  test("uniform size: selected nodes adopt the first node's size", async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 130, 110);
    await page.locator(NODE).first().click();
    const width = page.getByTestId('flowchart-geo-width');
    await width.fill('300');
    await width.blur();
    await expect(width).toHaveValue('300');

    await dropProcess(page, 470, 110);
    await page.keyboard.press('Control+a');
    await expect(page.getByText(/已选中 2 个元素/)).toBeVisible();

    await page.getByTestId('flowchart-uniform-size').click();
    await expect
      .poll(async () => Math.round((await page.locator(NODE).nth(1).boundingBox())!.width))
      .toBe(300);
  });

  test('align to grid: selected node positions snap to grid multiples', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 173, 137);
    await page.locator(NODE).first().click();

    await page.getByTestId('flowchart-snap-selection-grid').click();
    const x = Number(await page.getByTestId('flowchart-geo-x').inputValue());
    const y = Number(await page.getByTestId('flowchart-geo-y').inputValue());
    expect(x % 10).toBe(0);
    expect(y % 10).toBe(0);
  });

  test('Esc deselects; Ctrl+X cuts and Ctrl+V pastes back', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 160, 130);
    await page.locator(NODE).first().click();
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText('未选中元素')).toBeVisible();

    await page.locator(NODE).first().click();
    await page.keyboard.press('Control+x');
    await expect(page.locator(NODE)).toHaveCount(0);

    await page.keyboard.press('Control+v');
    await expect(page.locator(NODE)).toHaveCount(1);
  });

  test('Esc closes the page overview (the global Esc does not steal keys from overlays)', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 150, 120);
    await page.getByRole('button', { name: '新建页面' }).click();
    await dropProcess(page, 200, 160);

    await page.getByTestId('page-overview-open').click();
    const overview = page.getByTestId('page-overview');
    await expect(overview).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(overview).toHaveCount(0);
  });

  test('template dialog: focus trap and Esc to close', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    // Exact match: the shape library also has a "模板类" shape button
    await page.getByRole('button', { name: '模板', exact: true }).click();
    const dialog = page.getByTestId('flowchart-template-dialog');
    await expect(dialog).toBeVisible();
    // Focus moves into the dialog on open
    await expect(dialog.locator(':focus')).toHaveCount(1);

    // Focus stays inside the dialog after repeated Tab presses (focus trap)
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('multi-page Mermaid export produces multiple flowchart sections', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 140, 120);
    await page.getByRole('button', { name: '新建页面' }).click();
    await dropProcess(page, 210, 170);
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();

    await page.getByRole('button', { name: '导出' }).click();
    await page.getByTestId('flowchart-export-range').selectOption('all');

    const download = page.waitForEvent('download');
    await page.getByTestId('flowchart-export-mermaid').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.mmd$/);

    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString('utf-8');
    expect(text.match(/flowchart TD/g)?.length).toBe(2);
  });

  test('right-click node: switch shape (expands the category it belongs to by default)', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 190, 140);
    const node = page.locator(NODE).first();
    await expect(node.locator('[data-kind]')).toHaveAttribute('data-kind', 'rect');

    await node.click({ button: 'right' });
    await expect(page.getByTestId('flow-context-menu')).toBeVisible();
    await expect(page.getByTestId('context-shape-grid')).toBeVisible();

    // Switch to "圆角矩形": the menu closes and the node shape changes
    await page.getByTestId('context-shape-roundRect').click();
    await expect(page.getByTestId('flow-context-menu')).toHaveCount(0);
    await expect(page.locator(NODE).first().locator('[data-kind]')).toHaveAttribute(
      'data-kind',
      'roundRect',
    );
  });

  test('right-click node: switch category then pick a shape, duplicate and delete work', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 170, 130);
    await expect(page.locator(NODE)).toHaveCount(1);

    // Switch to the "流程图" category and pick "判断" (the shape library has a button with the same name, so scope to the menu)
    await page.locator(NODE).first().click({ button: 'right' });
    const menu = page.getByTestId('flow-context-menu');
    await menu.getByRole('button', { name: '流程图', exact: true }).click();
    await page.getByTestId('context-shape-decision').click();
    await expect(page.locator(NODE).first().locator('[data-kind]')).toHaveAttribute(
      'data-kind',
      'decision',
    );

    await page.locator(NODE).first().click({ button: 'right' });
    await page.getByTestId('context-duplicate').click();
    await expect(page.locator(NODE)).toHaveCount(2);

    // The copy is offset by only 24px and covers the original, so right-click it via page coordinates (higher z-order) to delete
    const copy = (await page.locator(NODE).nth(1).boundingBox())!;
    await page.mouse.click(copy.x + copy.width / 2, copy.y + copy.height / 2, { button: 'right' });
    await page.getByTestId('context-delete').click();
    await expect(page.locator(NODE)).toHaveCount(1);
  });

  test('right-click empty canvas: paste clipboard contents', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 140, 110);
    await page.locator(NODE).first().click();
    await page.keyboard.press('Control+c');

    // Right-click an empty spot (away from nodes and the bottom-right minimap, dispatch via page coordinates)
    const pane = (await page.locator('.react-flow__pane').boundingBox())!;
    await page.mouse.click(pane.x + 120, pane.y + pane.height - 60, { button: 'right' });
    await expect(page.getByTestId('flow-context-menu')).toBeVisible();
    await page.getByTestId('context-paste').click();
    await expect(page.locator(NODE)).toHaveCount(2);
  });

  test('context menu: Esc closes it without clearing the canvas selection', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 170, 130);
    await page.locator(NODE).first().click();
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();

    await page.locator(NODE).first().click({ button: 'right' });
    await expect(page.getByTestId('flow-context-menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('flow-context-menu')).toHaveCount(0);
    // The menu intercepts Esc during the capture phase, so it must not reach the editor's "deselect"
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();
  });

  test('right-click edge: orthogonal auto-routing creates waypoints', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 80);
    await dropProcess(page, 400, 240);
    await connectNodes(page, 0, 1);
    await expect(page.locator(EDGE)).toHaveCount(1);

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
    await page.mouse.click(mid!.x, mid!.y, { button: 'right' });
    await expect(page.getByTestId('flow-context-menu')).toBeVisible();

    await page.getByTestId('context-auto-route').click();
    await expect(page.getByTestId('flow-context-menu')).toHaveCount(0);
    await expect(page.getByTestId('edge-waypoint').first()).toBeVisible();
  });

  test('shape adjust handles: the sticky-note fold can be dragged and syncs with the panel', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await page
      .getByRole('button', { name: '便签', exact: true })
      .dragTo(page.locator('.react-flow'), { targetPosition: { x: 300, y: 200 } });
    await expect(page.locator(NODE)).toHaveCount(1);

    const node = page.locator(NODE).first();
    await node.click();
    const handle = page.getByTestId('flowchart-adjust-foldSize');
    await expect(handle).toBeVisible();

    const slider = page.getByTestId('flowchart-param-foldSize');
    await expect(slider).toBeVisible();
    const before = Number(await slider.inputValue());
    const pathBefore = await node.locator('svg path').first().getAttribute('d');

    // Drag the fold vertex left: the fold grows (value = w - x)
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(before);
    // The shape itself (fold path) changes accordingly
    await expect
      .poll(async () => node.locator('svg path').first().getAttribute('d'))
      .not.toBe(pathBefore);

    // Double-click the vertex to restore the default value
    await handle.dblclick();
    await expect.poll(async () => Number(await slider.inputValue())).toBe(before);
  });

  test('shape adjust handles: predefined-process side bars are draggable', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page
      .getByRole('button', { name: '预定义过程', exact: true })
      .dragTo(page.locator('.react-flow'), { targetPosition: { x: 300, y: 220 } });
    await expect(page.locator(NODE)).toHaveCount(1);
    await page.locator(NODE).first().click();

    const handle = page.getByTestId('flowchart-adjust-barWidth');
    await expect(handle).toBeVisible();
    const slider = page.getByTestId('flowchart-param-barWidth');
    const before = Number(await slider.inputValue());

    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(before);
  });

  test('adjust handles are hidden for multi-selection (to avoid stacking)', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page
      .getByRole('button', { name: '便签', exact: true })
      .dragTo(page.locator('.react-flow'), { targetPosition: { x: 220, y: 160 } });
    await page
      .getByRole('button', { name: '便签', exact: true })
      .dragTo(page.locator('.react-flow'), { targetPosition: { x: 480, y: 160 } });
    await expect(page.locator(NODE)).toHaveCount(2);
    await page.keyboard.press('Control+a');
    await expect(page.getByText(/已选中 2 个元素/)).toBeVisible();
    await expect(page.getByTestId('flowchart-adjust-foldSize')).toHaveCount(0);
  });

  test('import a compressed (base64 + deflate) .drawio file', async ({ page }) => {
    const { deflateRaw } = await import('pako');
    const inner =
      '<mxGraphModel dx="0" dy="0" grid="1" page="1"><root>' +
      '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="n1" value="开始" style="rounded=0;html=1;" vertex="1" parent="1">' +
      '<mxGeometry x="40" y="60" width="120" height="60" as="geometry"/></mxCell>' +
      '</root></mxGraphModel>';
    const compressed = Buffer.from(deflateRaw(encodeURIComponent(inner))).toString('base64');
    const xml = `<mxfile host="x"><diagram name="页 1" id="p1">${compressed}</diagram></mxfile>`;

    await page.goto('/tools/flowchart-editor');
    await page.setInputFiles('input[type=file]', {
      name: 'compressed.drawio',
      mimeType: 'application/xml',
      buffer: Buffer.from(xml, 'utf-8'),
    });

    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
    await expect(page.locator(NODE).filter({ hasText: '开始' })).toHaveCount(1);
  });

  test('rotation handle: drag to rotate, synced with the panel, double-click resets', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 300, 220);
    await page.locator(NODE).first().click();

    const handle = page.getByTestId('flowchart-rotate-handle');
    await expect(handle).toBeVisible();
    const slider = page.getByTestId('flowchart-param-rotation');
    await expect(slider).toHaveValue('0');

    // Drag from the top handle to the right side: the angle should change noticeably and show a live readout while dragging
    const box = (await handle.boundingBox())!;
    const node = (await page.locator(NODE).first().boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(node.x + node.width + 10, node.y + node.height / 2, { steps: 12 });
    await page.mouse.up();

    const rotated = Number(await slider.inputValue());
    expect(rotated).toBeGreaterThan(0);
    await expect(page.getByTestId('flowchart-node-transform').first()).toHaveAttribute(
      'data-rotation',
      String(rotated),
    );

    // Double-click the handle to reset
    await handle.dblclick();
    await expect(slider).toHaveValue('0');
  });

  test('container collapse: hides children and shows a badge, can be expanded again', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.locator(NODE)).toHaveCount(5);

    const toggle = page.getByTestId('flowchart-collapse-toggle');
    await expect(toggle).toHaveCount(1);
    await toggle.click();
    // After collapsing only the swimlane itself remains visible (children are hidden)
    await expect(page.locator(NODE)).toHaveCount(1);
    await expect(page.getByTestId('flowchart-collapsed-count')).toHaveText('4');

    await page.getByTestId('flowchart-collapse-toggle').click();
    await expect(page.locator(NODE)).toHaveCount(5);
  });

  test('edge dual labels and label position: panel input applies immediately', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 80);
    await dropProcess(page, 400, 240);
    await connectNodes(page, 0, 1);
    await selectFirstEdge(page);

    const source = page.getByTestId('edge-source-label-input');
    await expect(source).toBeVisible();
    await source.fill('请求');
    await source.blur();
    await expect(page.getByTestId('edge-label-source')).toHaveText('请求');

    const target = page.getByTestId('edge-target-label-input');
    await target.fill('响应');
    await target.blur();
    await expect(page.getByTestId('edge-label-target')).toHaveText('响应');

    await page.getByTestId('edge-label-position').selectOption('nearTarget');
    await expect(page.getByTestId('edge-label-position')).toHaveValue('nearTarget');
  });

  test('UML relation presets: switch an edge to an aggregation relation in one click', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 80);
    await dropProcess(page, 400, 240);
    await connectNodes(page, 0, 1);
    await selectFirstEdge(page);

    await page.getByTestId('edge-relation-aggregation').click();
    // Aggregation: hollow diamond at the source + arrow at the target
    await expect(page.getByTestId('edge-jump')).toBeVisible();
    const startArrow = page.getByLabel('起点箭头');
    await expect(startArrow).toHaveValue('diamondHollow');
  });

  test('multi-select resize: the bounding box handle is visible and changes the size', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 180, 140);
    await dropProcess(page, 520, 140);
    await page.keyboard.press('Control+a');
    await expect(page.getByText(/已选中 2 个元素/)).toBeVisible();

    const resizer = page.getByTestId('flowchart-selection-resizer');
    await expect(resizer).toBeVisible();
    // Read the real store value from the panel width input (.react-flow__node's box comes from React Flow's measurement cache)
    const widthInput = page.getByTestId('flowchart-geo-width');
    const before = Number(await widthInput.inputValue());

    const handle = (await page.getByTestId('flowchart-selection-handle-e').boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 120, handle.y + handle.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    await expect
      .poll(async () => Number(await widthInput.inputValue()))
      .toBeGreaterThan(before + 10);
  });

  test('pages and canvas: duplicate page, paper boundary and grid style', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 140, 120);

    await page.getByTestId('flowchart-duplicate-page').click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
    await expect(page.locator(NODE)).toHaveCount(1);

    await page.getByTestId('flowchart-paper-size').selectOption('a4l');
    await expect(page.getByTestId('flowchart-page-boundary')).toBeVisible();

    await page.getByTestId('flowchart-grid-style').selectOption('lines');
    await expect(page.getByTestId('flowchart-grid-style')).toHaveValue('lines');
    await page.getByTestId('flowchart-wheel-mode').selectOption('zoom');
    await expect(page.getByTestId('flowchart-wheel-mode')).toHaveValue('zoom');
  });

  test('rulers and guides: drag a guide out of the ruler and double-click to delete', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 200, 160);
    await page.getByTestId('flowchart-rulers-toggle').click();
    await expect(page.getByTestId('flowchart-ruler-top')).toBeVisible();

    const ruler = (await page.getByTestId('flowchart-ruler-top').boundingBox())!;
    await page.mouse.move(ruler.x + 200, ruler.y + ruler.height / 2);
    await page.mouse.down();
    await page.mouse.move(ruler.x + 200, ruler.y + 160, { steps: 6 });
    await page.mouse.up();

    const guide = page.getByTestId('flowchart-guide-y').first();
    await expect(guide).toBeVisible();
    await guide.dblclick();
    await expect(page.getByTestId('flowchart-guide-y')).toHaveCount(0);
  });

  test('shortcut help overlay: F1 opens, Esc closes', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByTestId('flowchart-canvas').click();
    await page.keyboard.press('F1');
    const dialog = page.getByTestId('flowchart-shortcut-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('撤销');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // The toolbar button opens it too
    await page.getByTestId('flowchart-shortcut-help').click();
    await expect(dialog).toBeVisible();
    await page.getByTestId('flowchart-shortcut-close').click();
    await expect(dialog).toHaveCount(0);
  });

  test('canvas-wide search: locate and select a node by text', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.locator(NODE)).toHaveCount(5);

    await page.getByRole('button', { name: '搜索', exact: true }).click();
    await page.getByTestId('flowchart-node-search').fill('步骤 2');
    await expect(page.getByTestId('flowchart-node-search-item')).toHaveCount(1);
    await page.getByTestId('flowchart-node-search-item').first().click();
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();
  });

  test('paste mxGraph from draw.io: parsed, inserted and selected', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const xml =
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="n1" value="粘贴节点" style="rounded=0;html=1;" vertex="1" parent="1">' +
      '<mxGeometry x="10" y="20" width="120" height="60" as="geometry"/></mxCell>' +
      '</root></mxGraphModel>';

    await page.getByTestId('flowchart-canvas').click();
    await page.evaluate((payload) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', payload);
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
    }, xml);

    await expect(page.locator(NODE)).toHaveCount(1);
    await expect(page.locator(NODE).filter({ hasText: '粘贴节点' })).toHaveCount(1);
    await expect(page.getByText(/已选中 1 个元素/)).toBeVisible();
  });

  test('insert a table and edit a cell in place', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByTestId('insert-table').click();

    await expect(page.getByTestId('flowchart-table')).toHaveCount(1);
    // 3×3 by default: the last cell exists
    await expect(page.getByTestId('table-cell-2-2')).toHaveCount(1);

    // Double-click the first cell → type text → ⌘/Ctrl+Enter commits (Enter inserts a newline)
    await page.getByTestId('table-cell-0-0').dblclick();
    const editor = page.locator('[data-testid="table-cell-0-0"] textarea');
    await expect(editor).toBeVisible();
    await editor.fill('表头');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('table-cell-0-0')).toHaveText('表头');
  });

  test('node text: Enter inserts a newline for multiple lines and does not create a connected node', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 140, 120);
    await expect(page.locator(NODE)).toHaveCount(1);

    await page.locator(NODE).first().dblclick();
    const editor = page.locator('.react-flow__node textarea');
    await expect(editor).toBeVisible();

    await editor.fill('第一行');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('第二行');
    await page.keyboard.press('Control+Enter');

    // Key regression point: Enter only inserts a newline and must not trigger "create node below"
    await expect(page.locator(NODE)).toHaveCount(1);
    await expect(page.locator(NODE).first()).toContainText('第一行');
    await expect(page.locator(NODE).first()).toContainText('第二行');
  });

  test('page-wide routing: right-click empty canvas triggers autoRouteEdges(all)', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await dropProcess(page, 110, 90);
    await dropProcess(page, 420, 90);
    await connectNodes(page, 0, 1);
    await expect(page.locator(EDGE)).toHaveCount(1);

    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 10, y: 10 } });
    await page.getByTestId('context-route-all').click();
    await expect(page.locator(EDGE)).toHaveCount(1);
  });

  test('onboarding: opens automatically on first visit and never again after skipping', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await page.evaluate(() =>
      window.localStorage.removeItem('syntools:flowchart-editor.onboarding.v1'),
    );
    await page.reload();

    const guide = page.getByTestId('flowchart-onboarding');
    await expect(guide).toBeVisible();
    await expect(page.getByTestId('onboarding-step')).toBeVisible();

    await page.getByTestId('onboarding-skip').click();
    await expect(guide).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('flowchart-onboarding')).toHaveCount(0);
  });
});
