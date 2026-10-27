import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Group buttons in the toolbox: the first click selects, a second click expands the flyout, so loop until it appears
 * (the first click only switches tools; double-clicking quickly can register the second click as a collapse while animating).
 */
async function pickFromGroup(page: Page, row: Locator, name: string) {
  const flyout = page.getByTestId('photo-tool-flyout');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await row.click();
    await page.waitForTimeout(120);
    if ((await flyout.count()) > 0) break;
  }
  await flyout.getByRole('menuitem', { name, exact: true }).click();
  await expect(flyout).toHaveCount(0);
}

// UI copy follows the browser language (Playwright defaults to en-US), so these cases assert Simplified Chinese
test.use({ locale: 'zh-CN' });

/** One smoke case per tool: open → input → assert output (Tasks T24) */

test('Base64: encoding output is correct', async ({ page }) => {
  await page.goto('/tools/base64');
  await page.getByRole('textbox', { name: '原始文本' }).fill('SynTools');
  await expect(page.getByRole('textbox', { name: 'Base64 结果' })).toHaveValue('U3luVG9vbHM=');
});

test('URL codec: component mode encodes correctly', async ({ page }) => {
  await page.goto('/tools/url-codec');
  await page.getByRole('textbox', { name: '原始文本' }).fill('a b&c');
  await expect(page.getByRole('textbox', { name: '结果' })).toHaveValue('a%20b%26c');
});

test('regex tester: match count and highlighting', async ({ page }) => {
  await page.goto('/tools/regex-tester');
  await page.getByLabel('表达式').fill('\\d+');
  await page.getByRole('textbox', { name: '测试文本' }).fill('abc 123 def 45');
  await expect(page.getByText('共 2 个匹配')).toBeVisible();
  await expect(page.locator('mark', { hasText: '123' })).toBeVisible();
});

test('text diff: difference stats are correct', async ({ page }) => {
  await page.goto('/tools/text-diff');
  await page.getByRole('textbox', { name: '原文本' }).fill('a\nb');
  await page.getByRole('textbox', { name: '新文本' }).fill('a\nc');
  await expect(page.getByText('+1 新增 / −1 删除 / 1 未变')).toBeVisible();
});

test('JSON format: 4-space indent', async ({ page }) => {
  await page.goto('/tools/json-format');
  await page.getByLabel('缩进').selectOption('4');
  await page.getByRole('textbox', { name: 'JSON 输入' }).fill('{"a":1}');
  await expect(page.getByRole('textbox', { name: '输出' })).toHaveValue('{\n    "a": 1\n}');
});

test('timestamp: parses second-based timestamps', async ({ page }) => {
  await page.goto('/tools/timestamp');
  await page.getByLabel('时间戳输入').fill('1725000000');
  await expect(page.getByText('2024-08-30T06:40:00')).toBeVisible();
});

test('UUID: generates valid v4 values', async ({ page }) => {
  await page.goto('/tools/uuid');
  // exact: avoid substring-matching the sidebar "生成器" category, and wait for the lazy-loaded tool to mount
  await page.getByRole('button', { name: '生成', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '生成结果（每行一个）' })).toHaveValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test('hash: SHA-256 matches the standard vector', async ({ page }) => {
  await page.goto('/tools/hash');
  await page.getByRole('textbox', { name: '文本输入' }).fill('abc');
  await expect(page.getByRole('textbox', { name: 'SHA-256 结果' })).toHaveValue(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

// Document editors follow the browser language for UI copy; pin to Simplified Chinese so assertions are stable
test.describe('slide editor (zh-CN)', () => {
  test.use({ locale: 'zh-CN' });

  test('canvas mounts → insert text box → export pptx → present', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();
    // Konva injects 3 canvases (background / content / overlay)
    expect(await page.locator('canvas').count()).toBeGreaterThanOrEqual(3);

    await page.getByRole('button', { name: '文本框' }).click();
    await expect(page.getByText('已选中 1 个元素')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    // Export moved into the "文件" menu: open the menu first, then pick the format
    await page.getByTestId('menubar-file').click();
    await page.getByRole('menuitem', { name: '导出 PPTX', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pptx$/);

    await page.getByRole('button', { name: '放映', exact: true }).click();
    await expect(page.getByText('1 / 1')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '放映', exact: true })).toBeVisible();
  });

  /** Shapes moved into the toolbar "形状" dropdown, so expand the menu before inserting */
  async function insertShape(page: Page, name: string) {
    await page.getByRole('button', { name: '形状', exact: true }).click();
    await page.getByRole('menuitem', { name, exact: true }).click();
  }

  test('align left: both elements converge on the leftmost X', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    await page.getByRole('button', { name: '文本框' }).click();
    await insertShape(page, '矩形');
    await page.keyboard.press('ControlOrMeta+a');
    await expect(page.getByText('已选中 2 个元素')).toBeVisible();

    // The panel shows the last selected rectangle (240 wide, centered → x=520); the text box is further left at x=400
    const xInput = page.getByLabel('X 坐标').first();
    await expect(xInput).toHaveValue('520');

    // Alignment acts on the selection and now lives in the toolbar "排列" row's dropdown
    await page.getByRole('button', { name: '对齐', exact: true }).click();
    await page.getByRole('menuitem', { name: '左对齐', exact: true }).click();
    await expect(xInput).toHaveValue('400');
  });

  test('group → ungroup: selection count 2 → 1 → 2', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    await page.getByRole('button', { name: '文本框' }).click();
    await insertShape(page, '矩形');
    await page.keyboard.press('ControlOrMeta+a');
    await expect(page.getByText('已选中 2 个元素')).toBeVisible();

    await page.getByRole('button', { name: '组合', exact: true }).click();
    await expect(page.getByText('已选中 1 个元素')).toBeVisible();

    await page.getByRole('button', { name: '取消组合', exact: true }).click();
    await expect(page.getByText('已选中 2 个元素')).toBeVisible();
  });

  test('clipboard: copy/paste adds an element', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    await page.getByRole('button', { name: '文本框' }).click();
    await expect(page.getByText('已选中 1 个元素')).toBeVisible();

    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    await expect(page.getByText('已选中 1 个元素')).toBeVisible();

    // Select all should hit both the original and the copy
    await page.keyboard.press('ControlOrMeta+a');
    await expect(page.getByText('已选中 2 个元素')).toBeVisible();
  });

  test('speaker notes: edits are kept in the panel', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    const notes = page.getByLabel('演讲者备注');
    await expect(notes).toBeVisible();
    await notes.fill('开场先讲背景');
    await expect(notes).toHaveValue('开场先讲背景');
  });

  test('templates: applying one shows its layout list', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    // Switch to the right-hand "主题与母版" tab
    await page.getByRole('button', { name: '主题与母版' }).click();
    await page.getByRole('button', { name: '商务蓝' }).click();

    // The template ships 6 layouts; once applied, clickable buttons appear in the layout area
    await expect(page.getByRole('button', { name: 'Title Slide' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Section Header' })).toBeVisible();
  });

  test('table: row count can be adjusted right after inserting', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    await page.getByRole('button', { name: '表格', exact: true }).click();
    await expect(page.getByText('已选中 1 个元素')).toBeVisible();

    const rows = page.getByLabel('行数');
    await expect(rows).toHaveValue('3');
    await rows.fill('4');
    await expect(rows).toHaveValue('4');
    // Column count stays unchanged
    await expect(page.getByLabel('列数')).toHaveValue('3');
  });

  test('layers panel: lists elements on this page and toggles visibility', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    await page.getByRole('button', { name: '文本框' }).click();
    await page.getByRole('button', { name: '图层', exact: true }).click();

    const row = page.getByRole('button', { name: '图层: 文本框' });
    await expect(row).toBeVisible();

    // Hidden rows get a strikethrough title (aria-pressed reflects the hidden state)
    const hide = page.getByRole('button', { name: /文本框 隐藏/ });
    await hide.click();
    await expect(page.getByRole('button', { name: /文本框 显示/ })).toBeVisible();
  });

  test('outline generation: Markdown produces multiple slides', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();
    // 1 page initially
    await expect(page.locator('.slide-thumb')).toHaveCount(1);

    await page.getByTestId('menubar-file').click();
    await page.getByRole('menuitem', { name: '从大纲生成', exact: true }).click();
    const editor = page.getByRole('textbox', { name: '从大纲生成' });
    await editor.fill('# 第一页\n- 要点\n# 第二页');
    await page.getByRole('button', { name: '生成幻灯片' }).click();

    await expect(page.locator('.slide-thumb')).toHaveCount(2);
  });

  test('export PDF / image / project file: file extensions are correct', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    // Export moved into the "导出" dropdown: open the menu each round, then pick the format
    for (const [item, pattern] of [
      ['导出 PDF', /\.pdf$/],
      ['导出图片', /\.png$/],
      ['另存为工程', /\.sld$/],
    ] as const) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('menubar-file').click();
      await page.getByRole('menuitem', { name: item, exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(pattern);
    }
  });

  test('grid snapping and ruler toggles switch', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    const grid = page.getByRole('button', { name: '网格吸附' });
    await expect(grid).toHaveAttribute('aria-pressed', 'false');
    await grid.click();
    await expect(grid).toHaveAttribute('aria-pressed', 'true');

    const rulers = page.getByRole('button', { name: '显示标尺' });
    await expect(rulers).toHaveAttribute('aria-pressed', 'true');
    await rulers.click();
    await expect(rulers).toHaveAttribute('aria-pressed', 'false');
  });

  test('inline editing: transparent overlay does not cover stacked elements', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    await page.getByRole('button', { name: '文本框' }).click();
    await insertShape(page, '矩形');

    // Read both elements' screen positions (text box first, rectangle second; the rectangle covers the middle of the text box)
    const [textBox, rect] = await page.evaluate(() => {
      const Konva = (window as unknown as { Konva: { stages: unknown[] } }).Konva;
      const stage = (Konva.stages as unknown as { container: () => HTMLElement | null }[]).find(
        (s) => s.container()?.getAttribute('aria-label') === 'slide canvas',
      )! as unknown as {
        container: () => HTMLElement;
        children: { children: { id: () => string; getClientRect: () => DOMRect }[] }[];
      };
      const box = stage.container().getBoundingClientRect();
      return stage.children[1].children
        .filter((node) => node.id())
        .map((node) => {
          const r = node.getClientRect();
          return {
            id: node.id(),
            left: box.left + r.x,
            top: box.top + r.y,
            width: r.width,
            height: r.height,
          };
        });
    });

    /** Whether the element node's static text is visible (hidden while editing, restored after) */
    const staticTextVisible = () =>
      page.evaluate((id) => {
        const Konva = (window as unknown as { Konva: { stages: unknown[] } }).Konva;
        const stage = (Konva.stages as unknown as { container: () => HTMLElement | null }[]).find(
          (s) => s.container()?.getAttribute('aria-label') === 'slide canvas',
        )! as unknown as {
          children: {
            children: {
              id: () => string;
              findOne: (s: string) => { visible: () => boolean } | null;
            }[];
          }[];
        };
        const node = stage.children[1].children.find((child) => child.id() === id);
        return node?.findOne('.text')?.visible();
      }, textBox.id);

    // Sample point: the overlap area, avoiding the text box text and the element borders
    const clip = {
      x: Math.round(Math.max(textBox.left, rect.left) + 20),
      y: Math.round(Math.max(textBox.top, rect.top) + 8),
      width: 40,
      height: 12,
    };
    // The overlay really does overlap the rectangle (otherwise this case proves nothing)
    expect(clip.x).toBeGreaterThan(rect.left);
    expect(clip.x + clip.width).toBeLessThan(rect.left + rect.width);
    await page.waitForTimeout(200);
    const before = await page.screenshot({ clip });

    // Double-click the text box (left part, not covered by the rectangle) to enter inline editing
    const enterEdit = async () => {
      await page.mouse.dblclick(textBox.left + 10, textBox.top + textBox.height / 2);
      await expect(area).toBeAttached();
    };
    const area = page.locator('textarea[aria-label="edit text"]');
    await enterEdit();

    // The overlay must be transparent: a background would hide the rectangle stacked above it
    await expect(area).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(area).toHaveCSS('z-index', '20');
    // Static text yields to the textarea to avoid ghosting on a transparent background
    expect(await staticTextVisible()).toBe(false);

    // Overlap pixels must not change while editing (regression: a white background covered the rectangle)
    await page.waitForTimeout(200);
    const during = await page.screenshot({ clip });
    expect(during.equals(before)).toBe(true);

    // Esc exits: overlay removed, static text restored
    await page.keyboard.press('Escape');
    await expect(area).toHaveCount(0);
    expect(await staticTextVisible()).toBe(true);

    // Blurring without changes (clicking another element) must also restore the static text.
    // The click must land outside the text box (bottom edge of the rectangle), else the overlay itself keeps focus.
    await enterEdit();
    await page.mouse.click(rect.left + rect.width / 2, rect.top + rect.height - 8);
    await expect(area).toHaveCount(0);
    expect(await staticTextVisible()).toBe(true);
  });

  test('right-click canvas: menu opens, select all and Esc to close', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    await page.getByRole('button', { name: '文本框' }).click();
    await insertShape(page, '矩形');

    // Left-click empty space to clear the selection first; the right-click menu should offer canvas-level actions.
    // Coordinates must avoid the ruler overlay (20px rulers on the top/left plus a 20×20 square in the corner).
    const blank = { x: 60, y: 60 };
    const canvas = page.getByLabel('slide canvas');
    await canvas.click({ position: blank });
    await canvas.click({ button: 'right', position: blank });

    const menu = page.getByRole('menu', { name: '编辑操作' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: '全选' }).click();
    await expect(page.getByText('已选中 2 个元素')).toBeVisible();

    // Right-click again: Esc only closes the menu, without triggering the editor's "deselect"
    await canvas.click({ button: 'right', position: blank });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.getByText('已选中 2 个元素')).toBeVisible();
  });

  test('right-click page thumbnail: menu can duplicate the page', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();
    await expect(page.locator('.slide-thumb')).toHaveCount(1);

    await page.locator('.slide-thumb').first().click({ button: 'right' });
    const menu = page.getByRole('menu', { name: '编辑操作' });
    await expect(menu).toBeVisible();

    await menu.getByRole('menuitem', { name: '复制此页' }).click();
    await expect(page.locator('.slide-thumb')).toHaveCount(2);
  });

  test('present: vector stage + page jump + Esc to exit', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    await page.getByRole('button', { name: '放映', exact: true }).click();
    // The vector stage replaces the previous bitmap <img>
    await expect(page.getByLabel('present stage')).toBeVisible();
    await expect(page.getByLabel('跳转到页')).toHaveValue('1');
    await expect(page.getByLabel('计时')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '放映', exact: true })).toBeVisible();
  });
});

// Flowchart editor (zh-CN)
test.describe('flowchart editor (zh-CN)', () => {
  test.use({ locale: 'zh-CN' });

  test('canvas mounts → drop lands at the cursor (not centered) → template loads', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    // React Flow mounts the canvas (including the .react-flow container)
    await expect(page.locator('.react-flow')).toBeVisible();
    // Export is now one dropdown (PNG/JPEG/SVG/PDF/JSON/DrawIO/Mermaid)
    await expect(page.getByRole('button', { name: '导出' })).toBeVisible();
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible();

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // Drop onto the top-left area of the canvas: the node should land at the cursor
    // Exact match: the shape library's "预定义过程" also contains "过程" as a substring
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 90, y: 90 },
    });

    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible();
    // New shapes default to no text: the node carries no "过程" placeholder but renders as a rectangle
    await expect(node).not.toContainText(/\S/);
    await expect(node.locator('svg rect').first()).toBeVisible();
    // Guard against "node collapsed to 0 size and became invisible": it needs a real width and height
    const nodeBox = await node.boundingBox();
    expect(nodeBox?.width).toBeGreaterThan(0);
    expect(nodeBox?.height).toBeGreaterThan(0);
    // Guard against "first element centered by fitView": the node center must stay in the top-left quadrant
    const cx = nodeBox!.x + nodeBox!.width / 2 - canvasBox!.x;
    const cy = nodeBox!.y + nodeBox!.height / 2 - canvasBox!.y;
    // Use 1/3 rather than 1/2: when centered the coordinate is near the canvas center, so keep separation
    expect(cx).toBeLessThan(canvasBox!.width / 3);
    expect(cy).toBeLessThan(canvasBox!.height / 3);
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();

    // Loading a template should replace the canvas contents and increase the node count
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '基础流程' }).click();
    await expect(page.getByText(/节点:\s*4/)).toBeVisible();
  });

  test('swimlanes are containers: dropped elements go inside the lane', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    // Swimlane template: 1 lane + 4 inner nodes
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // Drop at the canvas center (after the template fitView the lane covers the center area)
    // Exact match: the shape library's "预定义过程" also contains "过程" as a substring
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: canvasBox!.width / 2, y: canvasBox!.height / 2 },
    });
    await expect(page.getByText(/节点:\s*6/)).toBeVisible();

    // The new node should be enclosed by the lane (proving it went inside rather than on top)
    // New shapes have no text, so locate the node without copy (every template node has a title)
    const newNode = page.locator('.react-flow__node').filter({ hasNotText: /\S/ });
    await expect(newNode).toHaveCount(1);
    const lane = page.locator('.react-flow__node').filter({ hasText: '泳道' }).first();
    const nb = await newNode.first().boundingBox();
    const lb = await lane.boundingBox();
    expect(nb).toBeTruthy();
    expect(lb).toBeTruthy();
    expect(nb!.x).toBeGreaterThanOrEqual(lb!.x - 1);
    expect(nb!.y).toBeGreaterThanOrEqual(lb!.y - 1);
    expect(nb!.x + nb!.width).toBeLessThanOrEqual(lb!.x + lb!.width + 1);
    expect(nb!.y + nb!.height).toBeLessThanOrEqual(lb!.y + lb!.height + 1);
  });

  test('page tabs: new pages are isolated and switching back restores content', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();

    // New page: the canvas should become empty
    await page.getByRole('button', { name: '新建页面' }).click();
    await expect(page.getByText(/节点:\s*0/)).toBeVisible();

    // Switch back to the first page: content should be restored
    await page.getByRole('button', { name: '页面 1' }).click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
  });

  test('vertical swimlanes are containers too: drops go inside the lane', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '纵向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // Exact match: the shape library's "预定义过程" also contains "过程" as a substring
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: canvasBox!.width / 2, y: canvasBox!.height / 2 },
    });
    await expect(page.getByText(/节点:\s*6/)).toBeVisible();

    const newNode = page.locator('.react-flow__node').filter({ hasNotText: /\S/ });
    await expect(newNode).toHaveCount(1);
    const lane = page.locator('.react-flow__node').filter({ hasText: '纵向泳道' }).first();
    const nb = await newNode.first().boundingBox();
    const lb = await lane.boundingBox();
    expect(nb).toBeTruthy();
    expect(lb).toBeTruthy();
    expect(nb!.x).toBeGreaterThanOrEqual(lb!.x - 1);
    expect(nb!.y).toBeGreaterThanOrEqual(lb!.y - 1);
    expect(nb!.x + nb!.width).toBeLessThanOrEqual(lb!.x + lb!.width + 1);
    expect(nb!.y + nb!.height).toBeLessThanOrEqual(lb!.y + lb!.height + 1);
  });

  test('free connection anchors: drag between shape anchors to connect', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const canvas = page.locator('.react-flow');
    // Place one shape at each of two different canvas positions
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 120, y: 120 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 420, y: 200 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    const node = page.locator('.react-flow__node').first();
    // Each shape renders 8 free connection anchors (3 top/bottom each, 1 left/right each)
    await expect(node.locator('.react-flow__handle')).toHaveCount(8);
    // Anchors appear on hover and a connection can be dragged out (ConnectionMode.Loose)
    await node.hover();
    await expect(node.locator('.react-flow__handle').first()).toBeVisible();
  });

  test('lane resize handles: selecting a swimlane shows 8 resize handles', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    // The horizontal lane is 760px wide while the editor shows 100% by default: on a narrow canvas its title bar is clipped,
    // so a direct click hits the left shape panel. Click "适应画布" first to fit the diagram into the viewport (the usual path).
    await page.getByRole('button', { name: '适应画布' }).click();

    const lane = page.locator('.react-flow__node').filter({ hasText: '泳道' }).first();
    // Click the lane title bar to select the lane (avoiding inner nodes), then 8 resize handles appear
    await lane.getByText('泳道').click();
    await expect(lane.locator('.react-flow__resize-control')).toHaveCount(8);
  });

  test('plain shapes also support resize handles: 8 round handles on select', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    const node = page.locator('.react-flow__node').first();
    await node.click();
    await expect(node.locator('.react-flow__resize-control')).toHaveCount(8);
  });

  test('shape categories: general shapes on top, each category collapses', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    // General shapes are the first sidebar category
    const palette = page.locator('aside').filter({ has: page.getByPlaceholder('搜索图形') });
    // The sidebar top gained insert image/icon/formula entries; the first category button should still be "通用图形"
    // Wait for the sidebar to render before counting (allInnerTexts does not auto-wait)
    await expect(palette.getByPlaceholder('搜索图形')).toBeVisible();
    const categories = [
      '通用图形',
      '流程图',
      'UML 通用',
      'UML 用例图',
      'UML 类图',
      'UML 对象/包图',
      'UML 时序图',
      'UML 活动图',
      'UML 状态图',
      'UML 组件图',
      'UML 部署图',
      'BPMN',
      '网络与云',
      '组织结构',
      '思维导图',
      'ER 图',
    ];
    const texts = await palette.getByRole('button').allInnerTexts();
    expect(texts.find((text) => categories.includes(text.trim()))).toBe('通用图形');
    // Expanded by default: "圆角矩形" under general shapes is visible
    await expect(page.getByRole('button', { name: '圆角矩形', exact: true })).toBeVisible();
    // Collapse the category: its shapes hide (other categories are unaffected)
    await page.getByRole('button', { name: '通用图形', exact: true }).click();
    await expect(page.getByRole('button', { name: '圆角矩形', exact: true })).toHaveCount(0);
    // Expanding again restores them
    await page.getByRole('button', { name: '通用图形', exact: true }).click();
    await expect(page.getByRole('button', { name: '圆角矩形', exact: true })).toBeVisible();
  });

  test('sidebar shows 5 items per row by default and the splitter resizes it', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const palette = page.locator('aside').filter({ has: page.getByPlaceholder('搜索图形') });
    // About 5 items per row at the default width (count first-row buttons to avoid depending on exact column width)
    await expect
      .poll(
        async () => {
          const tops = await palette
            .locator('.grid')
            .first()
            .locator('button')
            .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
          const firstRowTop = Math.min(...tops);
          return tops.filter((t) => t === firstRowTop).length;
        },
        { timeout: 5000 },
      )
      .toBe(5);
    // Dragging the right splitter widens the sidebar
    const sep = palette.locator('[role="separator"]');
    const box = (await sep.boundingBox())!;
    const before = (await palette.boundingBox())?.width ?? 0;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    const after = (await palette.boundingBox())?.width ?? 0;
    expect(after).toBeGreaterThan(before + 40);
  });

  test('free connection: dropping onto the target shape itself connects', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const canvas = page.locator('.react-flow');
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 120, y: 100 },
    });
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 440, y: 280 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    const src = page.locator('.react-flow__node').first();
    await src.hover();
    const handle = src.locator('.react-flow__handle-right');
    await expect(handle).toBeVisible();
    const hb = (await handle.boundingBox())!;
    const tb = (await page.locator('.react-flow__node').nth(1).boundingBox())!;
    // Drag out of an anchor and release on the target shape's body (not the exact handle): the edge should still be created
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  });

  test('quick connect: click an arrow, pick a shape in the dialog to insert a node', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    const node = page.locator('.react-flow__node').first();
    await node.hover();
    const arrow = node.getByLabel('快速连线-right');
    await arrow.click();
    // Releasing creates the connected node and edge at once and opens the shape picker
    const picker = page.getByTestId('quick-picker');
    await expect(picker).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    // Picking a shape in the dialog replaces the new node's kind (no text by default, so assert the rendered shape)
    await picker.getByRole('button', { name: '圆角矩形', exact: true }).click();
    await expect(page.locator('.react-flow__node svg rect[rx="10"]')).toHaveCount(1);
  });

  test('free connection: dropping on blank canvas creates no shape or edge', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    const canvasBox = (await page.locator('.react-flow').boundingBox())!;
    const node = page.locator('.react-flow__node').first();
    await node.hover();
    const handle = node.locator('.react-flow__handle-left');
    await expect(handle).toBeVisible();
    const hb = (await handle.boundingBox())!;
    // Drag from the left anchor to empty canvas: releasing should create no shape or edge
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 40, hb.y + hb.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  });

  test('quick connect: drag an arrow and release to open the picker', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    const node = page.locator('.react-flow__node').first();
    await node.hover();
    const arrow = node.getByLabel('快速连线-up');
    const ab = (await arrow.boundingBox())!;
    await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
    await page.mouse.down();
    await page.mouse.move(ab.x + ab.width / 2 - 80, ab.y - 80, { steps: 10 });
    await page.mouse.up();
    const picker = page.getByTestId('quick-picker');
    await expect(picker).toBeVisible();
    // Releasing has already created the connected node and edge
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    await picker.getByRole('button', { name: '椭圆', exact: true }).click();
    await expect(page.locator('.react-flow__node svg ellipse')).toHaveCount(1);
  });

  test('toolbar edge style: dropdown changes apply to the selected edge', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const canvas = page.locator('.react-flow');
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 120, y: 100 },
    });
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 440, y: 260 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Drag from one anchor onto another shape to create an edge
    const src = page.locator('.react-flow__node').first();
    await src.hover();
    const handle = src.locator('.react-flow__handle-right');
    const hb = (await handle.boundingBox())!;
    const tb = (await page.locator('.react-flow__node').nth(1).boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // Click the path midpoint to select the edge (the midpoint always lies on the stroke)
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
    expect(mid).toBeTruthy();
    await page.mouse.click(mid!.x, mid!.y);

    // Adjust the style from the toolbar dropdown: it should apply immediately (and the panel reflects it)
    await page.getByLabel('开始箭头').selectOption('arrowclosed');
    await page.getByLabel('连线样式').selectOption('dashed');
    await expect(page.getByLabel('起点箭头')).toHaveValue('arrowclosed');
    await expect(page.getByLabel('线条')).toHaveValue('dashed');
  });

  test('canvas scrolling: wheel pans the view and scrollbars appear', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '基础流程' }).click();
    await expect(page.getByText(/节点:\s*4/)).toBeVisible();

    const canvas = page.locator('.react-flow');
    const box = (await canvas.boundingBox())!;
    const node = page.locator('.react-flow__node').first();
    const before = (await node.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Scroll vertically → pan vertically (content moves up)
    await page.mouse.wheel(0, 220);
    await expect
      .poll(async () => (await node.boundingBox())?.y ?? before.y)
      .toBeLessThan(before.y - 10);

    // Scroll horizontally → pan horizontally (content moves left)
    const beforeX = (await node.boundingBox())!.x;
    await page.mouse.wheel(220, 0);
    await expect
      .poll(async () => (await node.boundingBox())?.x ?? beforeX)
      .toBeLessThan(beforeX - 10);

    // Scrollbars appear once content exceeds the viewport
    await expect(page.getByTestId('canvas-scrollbar-y')).toBeVisible();
  });

  test('edge selection: highlights and allows changing source/target', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const canvas = page.locator('.react-flow');
    const proc = page.getByRole('button', { name: '过程', exact: true });
    await proc.dragTo(canvas, { targetPosition: { x: 110, y: 80 } });
    await proc.dragTo(canvas, { targetPosition: { x: 380, y: 80 } });
    await proc.dragTo(canvas, { targetPosition: { x: 250, y: 210 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(3);

    // Connect 1 → 2
    const n1 = page.locator('.react-flow__node').nth(0);
    await n1.hover();
    const hb = (await n1.locator('.react-flow__handle-right').boundingBox())!;
    const n2b = (await page.locator('.react-flow__node').nth(1).boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(n2b.x + n2b.width / 2, n2b.y + n2b.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // Not selected: no custom reconnect endpoint squares should render
    await expect(page.locator('[data-testid="edge-endpoint"]')).toHaveCount(0);

    // Click the path midpoint to select the edge
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

    // Selected: the stroke highlights blue and "small squares" appear at both ends
    const endpoints = page.locator('[data-testid="edge-endpoint"]');
    await expect(endpoints).toHaveCount(2);
    const stroke = await page
      .locator('.react-flow__edge-path')
      .first()
      .evaluate((el) => getComputedStyle(el).stroke);
    expect(stroke).toBe('rgb(37, 99, 235)');
    const box = (await endpoints.first().boundingBox())!;
    // Square, and smaller
    expect(Math.abs(box.width - box.height)).toBeLessThan(1);
    expect(box.width).toBeLessThanOrEqual(12);

    // Change "终点节点" to the 3rd shape in the properties panel; the edge geometry should change
    const dBefore = await page.locator('.react-flow__edge-path').first().getAttribute('d');
    await page.getByLabel('终点节点').selectOption({ index: 2 });
    await expect
      .poll(() => page.locator('.react-flow__edge-path').first().getAttribute('d'))
      .not.toBe(dBefore);
  });

  test('edge reconnect: drag an endpoint onto another shape', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const canvas = page.locator('.react-flow');
    const proc = page.getByRole('button', { name: '过程', exact: true });
    await proc.dragTo(canvas, { targetPosition: { x: 110, y: 80 } });
    await proc.dragTo(canvas, { targetPosition: { x: 390, y: 80 } });
    await proc.dragTo(canvas, { targetPosition: { x: 250, y: 240 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(3);

    // Connect 1 → 2
    const n1 = page.locator('.react-flow__node').nth(0);
    await n1.hover();
    const hb = (await n1.locator('.react-flow__handle-right').boundingBox())!;
    const n2b = (await page.locator('.react-flow__node').nth(1).boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(n2b.x + n2b.width / 2, n2b.y + n2b.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // Click the path midpoint to select the edge
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

    // The squares at both ends should appear and accept a pointer down (hitting themselves)
    await expect(page.locator('[data-testid="edge-endpoint"]')).toHaveCount(2);
    const ub = (await page.locator('[data-testid="edge-endpoint"]').nth(1).boundingBox())!;
    const scx = ub.x + ub.width / 2;
    const scy = ub.y + ub.height / 2;
    const hitClass = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.getAttribute('class') ?? '',
      [scx, scy] as [number, number],
    );
    expect(hitClass).toContain('edge-endpoint');

    // The square center is the edge endpoint: it lies exactly on the shape border (no longer outside)
    expect(
      Math.min(
        Math.abs(scy - n2b.y),
        Math.abs(scy - (n2b.y + n2b.height)),
        Math.abs(scx - n2b.x),
        Math.abs(scx - (n2b.x + n2b.width)),
      ),
    ).toBeLessThanOrEqual(1);

    // The edge endpoint coincides with the square center too (the endpoint sits on the border, not ~6px outside)
    const pathEnd = await page
      .locator('.react-flow__edge-path')
      .first()
      .evaluate((el) => {
        const p = el as SVGPathElement;
        const pt = p.getPointAtLength(p.getTotalLength());
        const m = p.getScreenCTM()!;
        const sp = new DOMPoint(pt.x, pt.y).matrixTransform(m);
        return { x: sp.x, y: sp.y };
      });
    expect(Math.abs(pathEnd.x - scx)).toBeLessThanOrEqual(1);
    expect(Math.abs(pathEnd.y - scy)).toBeLessThanOrEqual(1);

    // The square covers only the arrow root: the exposed length along that edge is under half the 16px arrow, so the arrow stays visible
    const outward =
      scy < n2b.y + n2b.height / 2
        ? n2b.y - ub.y
        : scy > n2b.y + n2b.height / 2
          ? ub.y + ub.height - (n2b.y + n2b.height)
          : scx < n2b.x + n2b.width / 2
            ? n2b.x - ub.x
            : ub.x + ub.width - (n2b.x + n2b.width);
    expect(outward).toBeLessThan(8);

    // Drag the target endpoint onto the 3rd shape
    const id3 = await page.locator('.react-flow__node').nth(2).getAttribute('data-id');
    const n3b = (await page.locator('.react-flow__node').nth(2).boundingBox())!;
    await page.mouse.move(ub.x + ub.width / 2, ub.y + ub.height / 2);
    await page.mouse.down();
    await page.mouse.move(n3b.x + n3b.width / 2, n3b.y + n3b.height / 2, { steps: 12 });
    await page.mouse.up();

    // No edge was added and the target is now the 3rd shape
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    await expect(page.getByLabel('终点节点')).toHaveValue(id3!);

    // Selecting an edge does not suppress node-side connection UI: anchor dots show on hover and accept pointers
    await n1.hover();
    // The endpoint square sits on this edge's own anchor (right side), so pull the new edge from the bottom-middle anchor
    const handleAgain = n1.locator('.react-flow__handle-bottom[data-handleid="b"]');
    const pointerEvents = await handleAgain.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).not.toBe('none');
    await expect
      .poll(() => handleAgain.locator('span').evaluate((el) => getComputedStyle(el).opacity))
      .toBe('1');

    // While the edge is still selected (both endpoint squares present), pull a new edge from that anchor
    await expect(page.locator('[data-testid="edge-endpoint"]')).toHaveCount(2);
    const hb2 = (await handleAgain.boundingBox())!;
    await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(n2b.x + n2b.width / 2, n2b.y + n2b.height / 2, { steps: 10 });
    await page.mouse.up();
    // A new edge was created and the original lost its selection (endpoint squares gone)
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);
    await expect(page.locator('[data-testid="edge-endpoint"]')).toHaveCount(0);
  });
});

// Photo editor (zh-CN)
test.describe('photo editor (zh-CN)', () => {
  // The workspace has a 460px min height: any shorter window scrolls the page and the canvas drop point drifts with scroll.
  // Run at a common laptop size so the cases click real positions inside the canvas.
  test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

  test('canvas mounts → brush stroke creates a layer → export PNG', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();
    // Konva injects 3 canvases (background / content / overlay)
    expect(await page.locator('canvas').count()).toBeGreaterThanOrEqual(3);
    // A new document starts with a background layer (matching PS / Photopea's "背景" layer)
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // Brush tool: strokes go into the current (background) layer
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const canvasBox = (await page.getByTestId('photo-canvas').boundingBox())!;
    await page.mouse.move(canvasBox.x + 120, canvasBox.y + 120);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 220, canvasBox.y + 200, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // Export dialog → download PNG
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('menubar-file').click();
    await page.getByRole('menuitem', { name: '导出图片' }).click();
    await page.getByRole('button', { name: '下载', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test('fit to window: real container ratio (not min zoom), 100% restores', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    const readZoom = async () =>
      Number((await page.getByTestId('photo-zoom').textContent())?.replace(/\D/g, '') ?? '0');

    const initial = await readZoom();
    expect(initial).toBeGreaterThan(10);
    expect(initial).toBeLessThanOrEqual(100);

    // A 1280×720 canvas in a ~650×518 container should fit reproducibly (instead of being clamped to 2%)
    await page.getByRole('button', { name: '适应窗口' }).click();
    await expect(page.getByTestId('photo-zoom')).toContainText(`${initial}%`);

    await page.getByRole('button', { name: '100%', exact: true }).click();
    await expect(page.getByTestId('photo-zoom')).toContainText('100%');
  });

  test('brush / eraser: apply live while dragging (no need to release)', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    /** Count colored pixels on the content canvas (re-read its position each time so page scroll cannot invalidate coordinates) */
    const paintedPixels = () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          '[data-testid="photo-content-canvas"]',
        ) as HTMLCanvasElement;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count += 1;
        return count;
      });

    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    const y = box.y + Math.min(box.height - 40, Math.max(40, box.height / 2));

    await page.mouse.move(box.x + 80, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 320, y, { steps: 12 });
    await page.waitForTimeout(150);
    // Strokes must be visible before release: the baked cache must not freeze the frame at the start of the stroke
    expect(await paintedPixels()).toBeGreaterThan(0);
    await page.mouse.up();
    await page.waitForTimeout(150);
    const painted = await paintedPixels();
    expect(painted).toBeGreaterThan(0);

    // Erase back along the same line: pixels should shrink before release
    // The eraser now has its own toolbox entry instead of living under the brush
    await page.getByTestId('photo-tool-palette').locator('[data-tool="eraser"]').click();

    // Switching to the eraser changes the option bar's height and the workspace reflows, shifting the canvas,
    // so earlier screen coordinates are stale; find the stroke's row in canvas pixels and convert it instead.
    const line = await page.evaluate(() => {
      const canvas = document.querySelector(
        '[data-testid="photo-content-canvas"]',
      ) as HTMLCanvasElement;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let bestY = 0;
      let bestCount = 0;
      for (let y = 0; y < canvas.height; y++) {
        let count = 0;
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] > 0) count += 1;
        }
        if (count > bestCount) {
          bestCount = count;
          bestY = y;
        }
      }
      const rect = canvas.getBoundingClientRect();
      return {
        count: bestCount,
        y: rect.y + ((bestY + 0.5) * rect.height) / canvas.height,
        left: rect.x + rect.width * 0.2,
        right: rect.x + rect.width * 0.8,
      };
    });
    expect(line.count).toBeGreaterThan(0);

    await page.mouse.move(line.left, line.y);
    await page.mouse.down();
    await page.mouse.move(line.right, line.y, { steps: 12 });
    // Still not released: pixels only need to shrink during the drag (not after), leaving a few frames for repaint
    await expect.poll(paintedPixels, { timeout: 1000 }).toBeLessThan(painted);
    await page.mouse.up();
  });

  test('hand tool: pans the viewport live while dragging', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    const transform = () =>
      page.evaluate(
        () => (document.querySelector('.photo-stage') as HTMLElement).dataset.transform,
      );
    const panX = async () => Number((await transform())?.split(',')[1] ?? '0');

    await page.getByRole('button', { name: '抓手', exact: true }).click();
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const before = await panX();

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy, { steps: 10 });
    await page.waitForTimeout(150);
    // The viewport has already panned before release and stays panned afterwards
    expect(await panX()).toBeGreaterThanOrEqual(before + 60);
    await page.mouse.up();
    await page.waitForTimeout(150);
    expect(await panX()).toBeGreaterThanOrEqual(before + 60);
  });

  test('draft restore after reload still allows painting', async ({ page }) => {
    const paintedPixels = () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          '[data-testid="photo-content-canvas"]',
        ) as HTMLCanvasElement;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count += 1;
        return count;
      });

    const stroke = async () => {
      await page.getByRole('button', { name: '画笔', exact: true }).click();
      const box = (await page.getByTestId('photo-canvas').boundingBox())!;
      const y = box.y + Math.min(box.height - 40, Math.max(40, box.height / 2));
      await page.mouse.move(box.x + 80, y);
      await page.mouse.down();
      await page.mouse.move(box.x + 320, y, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(200);
    };

    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();
    await stroke();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // Wait for the draft to be persisted (the icon shows "已保存到本地草稿"), then reload: the layer must still accept strokes
    await expect(page.getByLabel('已保存到本地草稿')).toBeVisible({ timeout: 5000 });
    await page.reload();
    await expect(page.getByTestId('photo-canvas')).toBeVisible();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');
    const restored = await paintedPixels();
    expect(restored).toBeGreaterThan(0);

    await page.getByTestId('photo-tool-palette').locator('[data-tool="eraser"]').click();

    // The restored pan/zoom need not match the pre-reload state, so convert the stroke row from canvas pixels to screen
    // coordinates; fixed screen coordinates could land on blank space (pixels intact but nothing erased).
    const row = await page.evaluate(() => {
      const canvas = document.querySelector(
        '[data-testid="photo-content-canvas"]',
      ) as HTMLCanvasElement;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let bestY = 0;
      let bestCount = 0;
      for (let y = 0; y < canvas.height; y++) {
        let count = 0;
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] > 0) count += 1;
        }
        if (count > bestCount) {
          bestCount = count;
          bestY = y;
        }
      }
      const rect = canvas.getBoundingClientRect();
      return {
        count: bestCount,
        y: rect.y + ((bestY + 0.5) * rect.height) / canvas.height,
        left: rect.x + rect.width * 0.2,
        right: rect.x + rect.width * 0.8,
      };
    });
    expect(row.count).toBeGreaterThan(0);

    await page.mouse.move(row.left, row.y);
    await page.mouse.down();
    await page.mouse.move(row.right, row.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    expect(await paintedPixels()).toBeLessThan(restored);
  });

  test('layers panel: blend mode / opacity on the top row, the ⋯ menu holds rename and new layer', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    // The ⋯ menu also creates the first layer from the empty state
    await page.getByTestId('layer-menu-trigger').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('menuitem', { name: '空白图层' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // The top row only affects the currently selected layer
    await page.getByLabel('混合模式').selectOption('multiply');
    await expect(page.getByLabel('混合模式')).toHaveValue('multiply');
    await page.getByRole('slider', { name: '不透明度' }).fill('60');
    await expect(page.getByRole('slider', { name: '不透明度' })).toHaveValue('60');

    // The rename text field inside the ⋯ menu
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menu').getByLabel('重命名').fill('我的图层');
    await page.keyboard.press('Escape');
    await expect(page.getByText('我的图层').first()).toBeVisible();

    // When layers overflow and scroll, the "混合模式 / 不透明度" row must stay fixed
    for (let i = 0; i < 8; i += 1) {
      await page.getByTestId('layer-menu-trigger').first().click();
      await page.getByRole('menuitem', { name: '文字图层' }).click();
    }
    const blend = page.getByLabel('混合模式');
    const opacity = page.getByRole('slider', { name: '不透明度' });
    const before = {
      blend: Math.round((await blend.boundingBox())!.y),
      opacity: Math.round((await opacity.boundingBox())!.y),
    };
    const scrolled = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="layer-panel"]')!.parentElement!;
      list.scrollTop = list.scrollHeight;
      return list.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(0);
    expect(Math.round((await blend.boundingBox())!.y)).toBe(before.blend);
    expect(Math.round((await opacity.boundingBox())!.y)).toBe(before.opacity);
  });

  test('canvas context menu: selection actions (fill / invert / new layer via copy)', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    const paintedPixels = () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          '[data-testid="photo-content-canvas"]',
        ) as HTMLCanvasElement;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count += 1;
        return count;
      });

    const menu = page.getByTestId('canvas-context-menu');
    const openMenu = async () => {
      const canvas = page.getByTestId('photo-canvas');
      await canvas.scrollIntoViewIfNeeded();
      const box = (await canvas.boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
      await expect(menu).toBeVisible();
    };

    // No selection: the menu only has canvas-level actions
    await openMenu();
    await expect(menu.getByRole('menuitem', { name: '全选' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '填充选区（前景色）' })).toHaveCount(0);

    // Select all → selection actions appear and fill the whole canvas
    await menu.getByRole('menuitem', { name: '全选' }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByText('选区 1280 × 720')).toBeVisible();
    await openMenu();
    await expect(menu.getByRole('menuitem', { name: '清除选区内容' })).toBeVisible();
    await menu.getByRole('menuitem', { name: '填充选区（前景色）' }).click();
    await page.waitForTimeout(200);
    const filled = await paintedPixels();
    expect(filled).toBeGreaterThan(0);

    // Rectangle select → invert → clear: only the original selection keeps its pixels
    await page.keyboard.press('Control+a');
    await page.getByRole('button', { name: '矩形选区', exact: true }).click();
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 320, box.y + 260, { steps: 8 });
    await page.mouse.up();

    await openMenu();
    await menu.getByRole('menuitem', { name: '反选' }).click();
    await openMenu();
    await menu.getByRole('menuitem', { name: '清除选区内容' }).click();
    await page.waitForTimeout(200);
    const afterClear = await paintedPixels();
    expect(afterClear).toBeGreaterThan(0);
    expect(afterClear).toBeLessThan(filled);

    // New layer via copy
    await page.keyboard.press('Control+a');
    await openMenu();
    await menu.getByRole('menuitem', { name: '通过拷贝新建图层' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 2');
  });

  test('eyedropper: picks with feedback, transparent pixels keep the foreground, Alt+click samples temporarily', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    /** Document coordinates → screen coordinates: data-transform = "scale,tx,ty" */
    const stage = async () => {
      const box = (await page.getByTestId('photo-canvas').boundingBox())!;
      const raw = await page.evaluate(
        () => (document.querySelector('.photo-stage') as HTMLElement).dataset.transform!,
      );
      const [scale, tx, ty] = raw.split(',').map(Number);
      return {
        at: (dx: number, dy: number) => ({
          x: box.x + tx + dx * scale,
          y: box.y + ty + dy * scale,
        }),
      };
    };

    // Paint a red stroke (document coordinates (200,200) → (600,400))
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    await page.getByTestId('photo-swatch-#DC2626').click();
    let s = await stage();
    const from = s.at(200, 200);
    const to = s.at(600, 400);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    // Eyedropper: the option bar shows the foreground color and a "已吸取" notice
    await page.getByRole('button', { name: '吸管', exact: true }).click();
    await expect(page.getByTestId('eyedropper-bar')).toBeVisible();
    s = await stage();
    const onStroke = s.at(400, 300);
    await page.mouse.click(onStroke.x, onStroke.y);
    await expect(page.getByTestId('photo-notice')).toContainText('已吸取 #DC2626');
    await expect(page.getByTestId('eyedropper-bar')).toContainText('#DC2626');

    // Blank spot on a white canvas → picks white
    const onWhite = s.at(1100, 400);
    await page.mouse.click(onWhite.x, onWhite.y);
    await expect(page.getByTestId('photo-notice')).toContainText('已吸取 #FFFFFF');

    // Transparent canvas: blank spots report transparency and keep the foreground color
    await page.getByRole('button', { name: '新建画布' }).click();
    await page.getByLabel('画布背景').selectOption('transparent');
    await page.getByRole('dialog').getByRole('button', { name: '创建' }).click();
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: '吸管', exact: true }).click();
    s = await stage();
    const onEmpty = s.at(1100, 400);
    await page.mouse.click(onEmpty.x, onEmpty.y);
    await expect(page.getByTestId('photo-notice')).toContainText('透明像素');
    await expect(page.getByTestId('eyedropper-bar')).toContainText('#FFFFFF');

    // Alt + left click: samples temporarily while the brush stays active
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    await page.keyboard.down('Alt');
    await page.mouse.click(onEmpty.x, onEmpty.y);
    await page.keyboard.up('Alt');
    await expect(page.getByRole('button', { name: '画笔', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('scrollbars and wheel: vertical/horizontal scroll, Ctrl+wheel zoom, hide after fit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    const transform = async () => {
      const raw = await page.evaluate(
        () => (document.querySelector('.photo-stage') as HTMLElement).dataset.transform!,
      );
      const [scale, x, y] = raw.split(',').map(Number);
      return { scale, x, y, raw };
    };
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    // 1) At 100% the content exceeds the viewport, so both scrollbars appear
    await page.getByRole('button', { name: '100%', exact: true }).click();
    await expect(page.getByTestId('canvas-scrollbar-x')).toBeVisible();
    await expect(page.getByTestId('canvas-scrollbar-y')).toBeVisible();

    // 2) A plain wheel = panning (content moves up/left)
    const before = await transform();
    await page.mouse.move(center.x, center.y);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(100);
    const afterY = await transform();
    expect(afterY.y).toBeLessThan(before.y - 10);

    await page.mouse.wheel(200, 0);
    await page.waitForTimeout(100);
    const afterX = await transform();
    expect(afterX.x).toBeLessThan(before.x - 10);

    // 3) Ctrl + wheel = zoom anchored at the cursor: the document point under it stays put
    await page.getByRole('button', { name: '适应窗口' }).click();
    await page.waitForTimeout(150);
    const anchor = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.35 };
    const docPoint = async () => {
      const { scale, x, y } = await transform();
      return { x: (anchor.x - box.x - x) / scale, y: (anchor.y - box.y - y) / scale, scale };
    };
    const docBefore = await docPoint();
    await page.mouse.move(anchor.x, anchor.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -240);
    await page.keyboard.up('Control');
    await page.waitForTimeout(150);
    const docAfter = await docPoint();
    expect(docAfter.scale).toBeGreaterThan(docBefore.scale);
    expect(Math.abs(docAfter.x - docBefore.x)).toBeLessThan(6);
    expect(Math.abs(docAfter.y - docBefore.y)).toBeLessThan(6);

    // 4) Drag the vertical scrollbar thumb → the viewport pans
    const vBefore = (await transform()).y;
    const thumb = page.getByTestId('canvas-scrollbar-y').locator('div').first();
    const tb = (await thumb.boundingBox())!;
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2 + 120, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    const vAfter = (await transform()).y;
    expect(vAfter).toBeLessThan(vBefore - 20);

    // 5) After fit-to-window the content is smaller than the viewport → scrollbars hide
    await page.getByRole('button', { name: '适应窗口' }).click();
    await page.waitForTimeout(200);
    await expect(page.getByTestId('canvas-scrollbar-y')).toHaveCount(0);
  });

  test('zoom controls: four distinct icon buttons, labels live in tooltips', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-zoom')).toBeVisible();

    const markup = async (name: string) =>
      (await page.getByRole('button', { name }).innerHTML()).replace(/\s+/g, '');

    // Zoom in / out must use different icons (the two buttons once shared a magnifier icon)
    expect(await markup('放大')).not.toBe(await markup('缩小'));

    // Fit to window / 100%: icon buttons + tooltips, no visible text anymore
    for (const [testId, label] of [
      ['photo-fit', '适应窗口'],
      ['photo-actual', '100%'],
    ] as const) {
      const button = page.getByTestId(testId);
      await expect(button).toHaveAttribute('title', label);
      await expect(button).toHaveText('');
    }
    expect(await markup('适应窗口')).not.toBe(await markup('100%'));
  });

  test('new canvas dialog: creating at a custom size updates stats and resets the name', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    const title = page.getByLabel('画布名称');
    await title.fill('旧画布');

    await page.getByRole('button', { name: '新建画布' }).click();
    await page.getByRole('dialog').getByLabel('宽度').fill('800');
    await page.getByRole('dialog').getByLabel('高度').fill('600');
    await page.getByRole('dialog').getByRole('button', { name: '创建' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('800 × 600');

    // A new canvas starts blank: the name does not carry over and reverts to the "未命名画布" placeholder
    await expect(title).toHaveValue('');
    await expect(title).toHaveAttribute('placeholder', '未命名画布');
  });

  test('open image sizes the canvas; import image only appends a layer', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    // A 16×16 PNG: identical to the minimum canvas size, so it is easy to check the canvas follows the image
    const png = {
      name: 'dot.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKUlEQVR42u3NMQEAAAgDoC251a3gLwSgcyfTVFVVVVVVVVVVVVVVVVVV1S8DLQABAVXMpwAAAABJRU5ErkJggg==',
        'base64',
      ),
    };

    // Import image: the canvas size is unchanged, just one more layer
    let chooser = page.waitForEvent('filechooser');
    await page.getByTestId('menubar-file').click();
    await page.getByRole('menuitem', { name: '导入图片到画布' }).click();
    await (await chooser).setFiles(png);
    await expect(page.getByTestId('photo-stats')).toContainText('1280 × 720');
    await expect(page.getByTestId('photo-stats')).toContainText('图层 2');

    // Open image: a new canvas at the image size, leaving only the image layer in the document
    chooser = page.waitForEvent('filechooser');
    await page.getByTestId('menubar-file').click();
    await page.getByRole('menuitem', { name: '打开图片' }).click();
    await (await chooser).setFiles(png);
    await expect(page.getByTestId('photo-stats')).toContainText('16 × 16');
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');
    // The canvas background is white: erasing pixels reveals white instead of the stage's dark checkerboard.
    // The background is painted on the bg layer (the first canvas on the stage) and fills the whole page rect.
    const bgCanvas = await page.evaluate(() => {
      const canvas = document.querySelector('.photo-stage canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let white = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 248 && data[i + 1] > 248 && data[i + 2] > 248 && data[i + 3] > 248) {
          white += 1;
        }
      }
      return white;
    });
    expect(bgCanvas).toBeGreaterThan(0);
  });

  test('export PSD: downloads a .psd editable in Photoshop / Photopea', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    // Two levels of content: a bitmap plus one layer inside a group, to verify the layer-tree mapping
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menuitem', { name: '空白图层' }).click();
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menuitem', { name: '从图层新建编组' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 2');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('menubar-file').click();
    await page.getByRole('menuitem', { name: '导出图片' }).click();
    await page.getByTestId('export-psd').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.psd$/);

    // Validate the downloaded file by its header: PSD files start with 8BPS
    const path = await download.path();
    const header = (await import('node:fs')).readFileSync(path!).subarray(0, 4).toString('latin1');
    expect(header).toBe('8BPS');
  });

  test('smart object: conversion keeps source pixel size and can be rasterized', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    // One bitmap layer (created automatically by the first stroke)
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + 200, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // Convert to a smart object
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '转换为智能对象' }).click();

    await page.getByRole('tab', { name: '属性', exact: true }).click();
    await expect(page.getByTestId('smart-section')).toBeVisible();
    // Source pixel size comes from the original asset (the layer width on a 1280×720 canvas)
    await expect(page.getByTestId('smart-section')).toContainText('1280 × 720');

    // Shrinking the displayed size leaves the source size untouched (non-destructive)
    const width = page.getByLabel('宽度');
    await width.fill('640');
    await width.dispatchEvent('change');
    await expect(page.getByTestId('smart-section')).toContainText('1280 × 720');

    // Rasterize: back to a plain bitmap and the smart object section disappears
    await page.getByTestId('smart-rasterize').click();
    await expect(page.getByTestId('smart-section')).toHaveCount(0);
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');
  });

  test('adjustment layer: applies to everything below, brightness is live and undoable', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    // Base: a fully filled bitmap (bucket-fill the canvas to rule out background noise)
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '空白图层' }).click();
    await page.getByRole('button', { name: '油漆桶', exact: true }).click();
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    /** Brightness of the center pixel on the content canvas */
    const centerLuma = () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          '[data-testid="photo-content-canvas"]',
        ) as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const { data } = ctx.getImageData(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height / 2),
          1,
          1,
        );
        return Math.round(data[0] * 0.299 + data[1] * 0.587 + data[2] * 0.114);
      });

    // New adjustment layer → select it → adjust brightness
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '新建调整图层' }).click();
    await page.getByRole('tab', { name: '调整', exact: true }).click();
    const before = await centerLuma();

    const brightness = page.getByLabel('亮度');
    await brightness.fill('80');
    await brightness.dispatchEvent('change');
    await expect.poll(centerLuma).toBeGreaterThan(before);

    // Undo (slider drags are not recorded in history, so use the toolbar button): brightness returns to the original
    await page.getByRole('button', { name: '撤销' }).click();
    await expect.poll(centerLuma).toBe(before);
  });

  test('layer mask: hide all → paint white to reveal → invert → delete', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    // Create a bitmap layer with content
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 320, box.y + 260, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    /** Number of visible pixels on the content canvas (the mask changes it directly) */
    const countInk = () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          '[data-testid="photo-content-canvas"]',
        ) as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 8) n += 1;
        return n;
      });
    const before = await countInk();
    expect(before).toBeGreaterThan(0);

    // Properties tab → add mask (hide all)
    await page.getByRole('tab', { name: '属性', exact: true }).click();
    await page.getByRole('button', { name: '隐藏全部' }).click();
    await expect(page.getByTestId('mask-remove')).toBeVisible();
    await expect.poll(countInk).toBe(0);

    // Edit the mask: painting white shows that area
    await page.getByTestId('mask-edit-toggle').click();
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 240, { steps: 10 });
    await page.mouse.up();
    // Mask compositing is async (dirty-region repaint), so reading the canvas right away may be stale
    await expect.poll(countInk).toBeGreaterThan(0);
    const revealed = await countInk();

    // Invert: black and white swap → the visible area becomes the complement of the painted area
    await page.getByTestId('mask-edit-toggle').click();
    await page.getByTestId('mask-invert').click();
    await expect.poll(countInk).not.toBe(revealed);
    const inverted = await countInk();
    expect(inverted).toBeGreaterThan(0);
    // Complementary: the sum of both parts does not exceed the original pixel count (overlap counted once)
    expect(inverted + revealed).toBeLessThanOrEqual(before + revealed);

    // Delete the mask: fully visible again
    await page.getByTestId('mask-remove').click();
    await expect.poll(countInk).toBe(before);
  });

  test('layer groups: new group → move layer in → collapse hides children → ungroup', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    // Start with one bitmap layer
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '空白图层' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // New group from layer
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '从图层新建编组' }).click();
    // Two rows: the group plus its inner layer
    await expect(page.getByTestId('layer-panel').locator('li')).toHaveCount(2);

    // The panel is reversed (topmost first): the inner layer is row 1 indented 12px, the group is row 2 unindented
    const rows = page.getByTestId('layer-panel').locator('li');
    await expect(rows.nth(0)).toHaveCSS('margin-left', '12px');
    await expect(rows.nth(1)).toHaveCSS('margin-left', '0px');

    // Collapse: the whole subtree hides
    await page.locator('[data-testid^="group-toggle-"]').first().click();
    await expect(rows).toHaveCount(1);
    await page.locator('[data-testid^="group-toggle-"]').first().click();
    await expect(rows).toHaveCount(2);

    // Ungroup: the menu sits on the group's row (row 2)
    await rows.nth(1).getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '解散编组' }).click();
    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');
  });

  test('history panel: lists steps by action name, click to jump and clear', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    // Brush stroke → a layer is created automatically (one history step)
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 180, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    await page.getByRole('tab', { name: '历史', exact: true }).click();
    const list = page.getByTestId('history-list');
    await expect(list).toBeVisible();
    // Open document → new layer → brush stroke (current)
    await expect(list.locator('li')).toHaveCount(3);
    await expect(page.getByTestId('history-row-1')).toContainText('新建图层');
    await expect(page.getByTestId('history-row-2')).toContainText('画笔');
    await expect(page.getByTestId('history-row-2')).toHaveAttribute('data-current', 'true');

    // Click row 0: jump back to the initial state (the layer is undone)
    await page.getByTestId('history-row-0').click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 0');
    await expect(page.getByTestId('history-row-0')).toHaveAttribute('data-current', 'true');

    // Jump to the last row: redo both steps
    await page.getByTestId('history-row-2').click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // Clear history: only the current state row remains
    await page.getByTestId('history-clear').click();
    await expect(list.locator('li')).toHaveCount(1);
  });

  test('right panel: three equal panes, drag dividers, panes scroll independently', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-panels')).toBeVisible();

    const heights = () =>
      page.evaluate(() =>
        ['color', 'layers', 'info'].map((id) =>
          Math.round(
            document.querySelector(`[data-testid="panel-group-${id}"]`)!.getBoundingClientRect()
              .height,
          ),
        ),
      );

    // Three equal panes by default
    const [first, second, third] = await heights();
    expect(Math.abs(first - second)).toBeLessThanOrEqual(2);
    expect(Math.abs(second - third)).toBeLessThanOrEqual(2);

    // The sidebar as a whole never scrolls (overflow is confined to each pane)
    await expect
      .poll(() =>
        page.getByTestId('photo-panels').evaluate((el) => el.scrollHeight - el.clientHeight),
      )
      .toBeLessThanOrEqual(1);

    // Drag the divider between panes 1 and 2: pane 1 grows, pane 2 shrinks
    const box = (await page.getByTestId('panel-divider-1').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 5 });
    await page.mouse.up();

    const [grownFirst, shrunkSecond] = await heights();
    expect(grownFirst).toBeGreaterThan(first);
    expect(shrunkSecond).toBeLessThan(second);

    // The color pane is taller than its viewport: it scrolls inside its own content area
    const inner = await page.getByTestId('panel-group-color').evaluate((el) => {
      const area = el.lastElementChild as HTMLElement;
      return { scroll: area.scrollHeight, client: area.clientHeight };
    });
    expect(inner.scroll).toBeGreaterThan(inner.client);
  });

  test('toolbox: click selects, click again opens the group, the badge is only an icon', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    const palette = page.getByTestId('photo-tool-palette');
    const bucket = palette.locator('[data-tool="fill"]');
    await expect(bucket).toBeVisible();

    // One button per row: the small corner triangle is an icon, there is no second "expand" button
    await expect(page.getByTestId('tool-group-fill').locator('button')).toHaveCount(1);

    // First click = select, no flyout
    await bucket.click();
    await expect(bucket).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // Clicking the already-selected button again = open the group's tools
    await bucket.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveText([/油漆桶/, /渐变/]);

    // Closing is automatic after picking, and the button switches to the new tool
    await menu.getByRole('menuitem', { name: '渐变' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(palette.locator('[data-tool="gradient"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('shape tools: kinds live in the toolbox group, the option bar holds shape props', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    const palette = page.getByTestId('photo-tool-palette');
    const row = palette.locator('[data-tool="shape"]');
    await expect(row).toHaveAttribute('aria-label', '矩形');

    // First click selects the shape tool, a second click expands its six shapes (the group button is in the sidebar, not the bar)
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await row.click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText([
      /矩形/,
      /圆角矩形/,
      /椭圆/,
      /直线/,
      /箭头/,
      /星形/,
    ]);

    // Each shape icon must be distinct (they all used the generic shapes icon before)
    const icons = await menu
      .getByRole('menuitem')
      .evaluateAll((items) => items.map((item) => item.querySelector('svg')?.innerHTML ?? ''));
    expect(new Set(icons).size).toBe(icons.length);

    await menu.getByRole('menuitem', { name: '椭圆' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(row).toHaveAttribute('aria-label', '椭圆');

    // Option bar: no more "pick a shape" buttons, only properties used while drawing
    const bar = page.getByTestId('shape-bar');
    await expect(bar.getByRole('button')).toHaveCount(0);
    await expect(bar.getByLabel('填充色', { exact: true })).toBeVisible();
    await expect(bar.getByLabel('描边色', { exact: true })).toBeVisible();
    const width = bar.getByRole('slider', { name: '描边宽度' });
    await width.fill('8');
    await expect(width).toHaveValue('8');
    // Rounded corners only make sense for rounded rectangles
    await expect(bar.getByRole('slider', { name: '圆角', exact: true })).toHaveCount(0);
    await row.click();
    await menu.getByRole('menuitem', { name: '圆角矩形' }).click();
    await expect(bar.getByRole('slider', { name: '圆角', exact: true })).toBeVisible();

    // The properties are really used for new shapes: the stroke width is readable in the "属性" panel after drawing
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    await page.mouse.move(box.x + 160, box.y + 160);
    await page.mouse.down();
    await page.mouse.move(box.x + 380, box.y + 340, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 2');
    await expect(page.getByRole('slider', { name: '描边宽度' })).toHaveCount(2);
    await expect(page.getByRole('slider', { name: '描边宽度' }).last()).toHaveValue('8');
  });

  test('shape placement follows the cursor: ellipse and line fill the dragged box', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    const row = page.getByTestId('photo-tool-palette').locator('[data-tool="shape"]');
    const flyout = page.getByTestId('photo-tool-flyout');
    const pick = async (name: string) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await row.click();
        if ((await flyout.count()) > 0) break;
      }
      await flyout.getByRole('menuitem', { name }).click();
      await expect(flyout).toHaveCount(0);
    };
    // On-screen bounding box of the marks (the background is rendered and yields no pixels, only shapes have alpha)
    const inkBox = () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          '[data-testid="photo-content-canvas"]',
        ) as HTMLCanvasElement;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            if (data[(y * canvas.width + x) * 4 + 3] > 8) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        const rect = canvas.getBoundingClientRect();
        const sx = rect.width / canvas.width;
        const sy = rect.height / canvas.height;
        return {
          x: rect.x + minX * sx,
          y: rect.y + minY * sy,
          w: (maxX - minX) * sx,
          h: (maxY - minY) * sy,
        };
      });

    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    const from = { x: box.x + 240, y: box.y + 180 };
    const to = { x: box.x + 460, y: box.y + 360 };

    for (const kind of ['椭圆', '直线']) {
      await pick(kind);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      const ink = await inkBox();
      // The ellipse used to be drawn with "center = layer top-left", offset up-left by about half a body (≈110 × 90 px)
      expect(Math.abs(ink.x - from.x)).toBeLessThanOrEqual(6);
      expect(Math.abs(ink.y - from.y)).toBeLessThanOrEqual(6);
      expect(Math.abs(ink.w - (to.x - from.x))).toBeLessThanOrEqual(6);
      expect(Math.abs(ink.h - (to.y - from.y))).toBeLessThanOrEqual(6);

      await page.keyboard.press('Delete');
      await expect(page.getByTestId('photo-stats')).toContainText('图层 1');
    }
  });

  test('toolbox: magic wand and quick select form a group, lasso adds polygon and magnetic', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    const palette = page.getByTestId('photo-tool-palette');
    const flyout = page.getByTestId('photo-tool-flyout');

    // Wand group: magic wand by default, expands to wand / quick select
    const wandRow = palette.locator('[data-tool="wand"]');
    await expect(wandRow).toHaveAttribute('aria-label', '魔棒');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await wandRow.click();
      await page.waitForTimeout(120);
      if ((await flyout.count()) > 0) break;
    }
    await expect(flyout.getByRole('menuitem')).toHaveText([/魔棒/, /快速选择/]);
    await flyout.getByRole('menuitem', { name: '快速选择' }).click();
    // The tool row shows the "current tool", so data-tool becomes quickSelect
    await expect(palette.locator('[data-tool="quickSelect"]')).toHaveAttribute(
      'aria-label',
      '快速选择',
    );

    // Lasso group: freehand / polygon / magnetic (the wand is no longer mixed in)
    const lassoRow = palette.locator('[data-tool="lasso"]');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await lassoRow.click();
      await page.waitForTimeout(120);
      if ((await flyout.count()) > 0) break;
    }
    await expect(flyout.getByRole('menuitem')).toHaveText([/套索/, /多边形套索/, /磁性套索/]);
    // All three icons are distinct (wand / quick select used to reuse the lasso icon)
    const icons = await flyout
      .getByRole('menuitem')
      .evaluateAll((items) => items.map((item) => item.querySelector('svg')?.innerHTML ?? ''));
    expect(new Set(icons).size).toBe(icons.length);
  });

  test('polygon lasso: click point by point, double-click to close, Esc to cancel', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    const row = page.getByTestId('photo-tool-palette').locator('[data-tool="lasso"]');
    await pickFromGroup(page, row, '多边形套索');
    await expect(page.getByTestId('poly-lasso-hint')).toBeVisible();

    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    const point = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy });
    const a = point(260, 200);
    const b = point(520, 220);
    const c = point(500, 400);

    for (const p of [a, b, c]) {
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(80);
    }
    // Not closed yet: there should be no selection
    await expect(page.getByText(/^选区 \d+ × \d+$/)).toHaveCount(0);

    // Click near the start point → closes, creating a triangular selection
    await page.mouse.dblclick(a.x + 3, a.y + 3);
    const selection = page.getByText(/^选区 \d+ × \d+$/);
    await expect(selection).toBeVisible();
    const [width, height] = (await selection.textContent())!.match(/\d+/g)!.map(Number);
    expect(width).toBeGreaterThan(200);
    expect(height).toBeGreaterThan(150);

    // Esc cancels the open polyline: no new selection should appear
    await page.keyboard.press('Meta+d');
    await expect(selection).toHaveCount(0);
    await page.mouse.click(box.x + 300, box.y + 250);
    await page.mouse.click(box.x + 480, box.y + 300);
    await page.keyboard.press('Escape');
    await expect(selection).toHaveCount(0);
  });

  test('magnetic lasso: snaps to layer edges while dragging', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    const palette = page.getByTestId('photo-tool-palette');
    const box = (await page.getByTestId('photo-canvas').boundingBox())!;

    // Draw a rectangle first to act as the "edge"
    await palette.locator('[data-tool="shape"]').click();
    await page.mouse.move(box.x + 300, box.y + 220);
    await page.mouse.down();
    await page.mouse.move(box.x + 560, box.y + 420, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 2');

    // The shape's size in the document (to compare the snap result)
    await page.getByRole('tab', { name: '属性', exact: true }).click();
    const shapeWidth = Number(await page.getByLabel('宽度', { exact: true }).first().inputValue());
    const shapeHeight = Number(await page.getByLabel('高度', { exact: true }).first().inputValue());

    await pickFromGroup(page, palette.locator('[data-tool="lasso"]'), '磁性套索');
    await expect(page.getByTestId('selection-bar')).toContainText('对比度');

    // Trace a loop about 6px outside the rectangle: with snapping the selection pulls back to the shape edge
    const ring = [
      [566, 214],
      [566, 426],
      [294, 426],
      [294, 214],
      [566, 214],
    ];
    await page.mouse.move(box.x + ring[0][0], box.y + ring[0][1]);
    await page.mouse.down();
    for (const [x, y] of ring.slice(1)) {
      await page.mouse.move(box.x + x, box.y + y, { steps: 20 });
    }
    await page.mouse.up();

    const selection = page.getByText(/^选区 \d+ × \d+$/);
    await expect(selection).toBeVisible();
    const [width, height] = (await selection.textContent())!.match(/\d+/g)!.map(Number);
    // Without snapping it would be one ring larger (6px outside ≈ 10 document pixels, 20 on both sides)
    expect(Math.abs(width - shapeWidth)).toBeLessThanOrEqual(8);
    expect(Math.abs(height - shapeHeight)).toBeLessThanOrEqual(8);
  });
});

// Photo editor i18n (en-US): no Chinese may remain after switching the UI language
test.describe('photo editor i18n (en-US)', () => {
  test.use({ locale: 'en-US' });

  test('English UI leaves no Chinese (all tabs / dialogs / context menus)', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-canvas')).toBeVisible();

    await expect(page.getByLabel('Canvas name')).toHaveAttribute('placeholder', 'Untitled canvas');

    // Blank layer → the auto-generated name should be English
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: 'Blank layer' }).click();
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menuitem', { name: 'Text layer' }).click();
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menuitem', { name: 'Shape layer' }).click();
    await expect(page.getByText('Layer 1').first()).toBeVisible();
    await expect(page.getByText('Text 1').first()).toBeVisible();
    await expect(page.getByText('Shape 1').first()).toBeVisible();

    // The blend mode dropdown is English
    const mix = page.getByLabel('Blend mode');
    await expect(mix.locator('option')).toContainText(['Normal', 'Multiply']);

    // Shapes: kinds live in the toolbox group (English), the option bar shows shape properties
    const shapeRow = page.getByTestId('photo-tool-palette').locator('[data-tool="shape"]');
    await shapeRow.click();
    await expect(shapeRow).toHaveAttribute('aria-label', 'Rectangle');
    await shapeRow.click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'Rounded rectangle' }).click();
    await expect(shapeRow).toHaveAttribute('aria-label', 'Rounded rectangle');
    await expect(page.getByTestId('shape-bar').getByLabel('Fill')).toBeVisible();

    // New canvas dialog: presets are neutral text, buttons are English
    await page.getByRole('button', { name: 'New canvas' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Preset').locator('option').first()).toHaveText(
      '1280 × 720 · 16:9',
    );
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Scan each tab / menu / dialog: no CJK should appear
    const scan = () =>
      page.evaluate(() => {
        const main = document.querySelector('main') ?? document.body;
        const text = (main as HTMLElement).innerText;
        return text.split('\n').filter((line) => /[\u3400-\u9FFF\uF900-\uFAFF]/.test(line));
      });
    const found: string[] = [];
    for (const tab of ['Properties', 'Adjust', 'Filters', 'Layers']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.waitForTimeout(120);
      found.push(...(await scan()).map((line) => `${tab}: ${line}`));
    }
    // The export entry lives in the "文件" menu (items are role=menuitem), so expand it first
    await page.getByTestId('menubar-file').click();
    await page.getByRole('menuitem', { name: 'Export image' }).click();
    found.push(...(await scan()).map((line) => `export: ${line}`));
    await page.getByRole('button', { name: 'Cancel' }).click();

    const box = (await page.getByTestId('photo-canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await expect(page.getByTestId('canvas-context-menu')).toBeVisible();
    found.push(...(await scan()).map((line) => `ctx: ${line}`));
    await page.keyboard.press('Escape');

    // Scan all visible text in the tool area: no CJK should appear
    const cjk = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const text = (main as HTMLElement).innerText;
      return text.split('\n').filter((line) => /[\u3400-\u9FFF\uF900-\uFAFF]/.test(line));
    });
    expect(found).toEqual([]);
    expect(cjk).toEqual([]);
  });
});

// Code editor (zh-CN)
test.describe('code editor (zh-CN)', () => {
  test.use({ locale: 'zh-CN' });

  test('mounts editor → language switch changes extension → format → export source / HTML', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/code-editor');

    const editor = page.getByRole('textbox', { name: '编辑器' });
    await expect(editor).toBeVisible();
    // The default Java sample is highlighted (Prism tokens inside the editable area) plus the gutter
    await expect(page.locator('.ce-surface .token.keyword').first()).toBeVisible();
    await expect(page.locator('.ce-gutter')).toContainText('1');

    // The export filename follows the language
    await expect(page.getByText('将导出为 snippet.java')).toBeVisible();
    await page.getByLabel('语言', { exact: true }).selectOption('rust');
    await expect(page.getByText('将导出为 snippet.rs')).toBeVisible();

    // Format: minify to one line, then re-indent
    await page.getByLabel('语言', { exact: true }).selectOption('java');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(
      'class A{public static void main(String[] args){System.out.println(1);}}',
    );
    await page.getByRole('button', { name: '格式化', exact: true }).click();
    await expect(page.locator('.ce-surface')).toContainText('class A {');
    await expect(page.locator('.ce-surface')).toContainText('  public static void main');

    // Export source: the extension follows the language
    const sourceDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 .java' }).click();
    expect((await sourceDownload).suggestedFilename()).toBe('snippet.java');

    // Export HTML: a standalone highlighted document
    const htmlDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 HTML' }).click();
    expect((await htmlDownload).suggestedFilename()).toBe('snippet.html');

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('current line highlight aligns with line numbers, overlay off when wrapped', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/code-editor');

    const editor = page.getByRole('textbox', { name: '编辑器' });
    const surface = page.locator('.ce-surface');
    const band = page.locator('.ce-line-active');
    await expect(surface).toBeVisible();

    // Use the tool's own "清空" for cross-platform determinism, then type 3 lines (caret on the last line)
    await page.getByRole('button', { name: '清空' }).click();
    await editor.click();
    await page.keyboard.type('a\nb\nc');
    await expect(page.locator('.ce-gutter')).toBeVisible();
    await expect
      .poll(() =>
        page.locator('.ce-gutter').evaluate((el) => (el.textContent ?? '').split('\n').length),
      )
      .toBe(3);

    // The overlay aligns exactly with text lines: line 1 y = padding-top (12), line 3 y = 12 + 2 × 21
    const bandOffset = async () => {
      const bandBox = await band.boundingBox();
      const surfaceBox = await surface.boundingBox();
      if (!bandBox || !surfaceBox) return Number.NaN;
      return bandBox.y - surfaceBox.y;
    };
    await expect.poll(bandOffset).toBeGreaterThan(53);
    await expect.poll(bandOffset).toBeLessThan(55);

    // Caret up one line → the highlight follows to line 2 (12 + 21 = 33)
    await page.keyboard.press('ArrowUp');
    await expect.poll(bandOffset).toBeGreaterThan(32);
    await expect.poll(bandOffset).toBeLessThan(34);

    // Typing stability: 200 consecutive characters lose nothing and keep the line count
    const filler = 'x'.repeat(200);
    await page.keyboard.type(filler);
    await expect
      .poll(() => surface.evaluate((el, text) => (el.textContent ?? '').includes(text), filler))
      .toBe(true);
    await expect
      .poll(() =>
        page.locator('.ce-gutter').evaluate((el) => (el.textContent ?? '').split('\n').length),
      )
      .toBe(3);

    // Content is not reset after switching language or theme (controlled sync does not jitter)
    const before = await surface.evaluate((el) => el.textContent);
    await page.getByLabel('语言', { exact: true }).selectOption('javascript');
    await page.getByLabel('风格主题').selectOption('dracula');
    await expect.poll(() => surface.evaluate((el) => el.textContent)).toBe(before);

    // With soft wrap on, line numbers and the line overlay hide together (lines no longer map to visual lines)
    await page.getByLabel('自动换行').check();
    await expect(page.locator('.ce-line-active')).toHaveCount(0);
    await expect(page.locator('.ce-gutter')).toHaveCount(0);
    await page.getByLabel('自动换行').uncheck();
    await expect(page.locator('.ce-line-active')).toHaveCount(1);

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('line actions: comment toggle shortcut → toolbar move / copy → go to line → undo', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.goto('/tools/code-editor');

    const editor = page.getByRole('textbox', { name: '编辑器' });
    const surface = page.locator('.ce-surface');
    const text = async () => surface.evaluate((el) => el.textContent);

    await page.getByRole('button', { name: '清空' }).click();
    await editor.click();
    await page.keyboard.type('a\nb\nc');
    // Typing in an empty editor must not insert padding characters (an earlier version added a leading space into the export)
    await expect.poll(text).toBe('a\nb\nc');
    // Wait for CodeJar's history to settle (300ms debounce after keyup) so undo returns to the typed state
    await page.waitForTimeout(400);

    // Toggle a line comment by shortcut: caret on the last line → only that line is commented, press again to undo
    await page.keyboard.press(`${mod}+/`);
    await expect.poll(text).toBe('a\nb\n// c');
    await page.keyboard.press(`${mod}+/`);
    await expect.poll(text).toBe('a\nb\nc');

    // The toolbar "跳转行" puts the caret on the first line, then move down / copy
    await page.getByRole('button', { name: '跳转行' }).click();
    const gotoInput = page.getByLabel('跳转行');
    await expect(gotoInput).toBeVisible();
    await gotoInput.fill('1');
    await gotoInput.press('Enter');
    await expect(gotoInput).toHaveCount(0);

    await page.getByRole('button', { name: '下移行' }).click();
    await expect.poll(text).toBe('b\na\nc');
    await page.getByRole('button', { name: '复制行' }).click();
    await expect.poll(text).toBe('b\na\na\nc');

    // After toolbar actions the editor is still the focus target (otherwise undo fails), and undo returns to before the copy
    await page.keyboard.press(`${mod}+z`);
    await expect.poll(text).toBe('b\na\nc');
    // Undo also syncs controlled state (stats refresh instead of keeping the post-copy length)
    await expect(page.getByText(/5 字符/)).toBeVisible();

    // Comment button: jump to the first line, then comment, proving jump and toolbar actions compose
    await expect(page.getByRole('button', { name: '注释' })).toBeEnabled();
    await page.getByRole('button', { name: '跳转行' }).click();
    await page.getByLabel('跳转行').fill('1');
    await page.getByLabel('跳转行').press('Enter');
    await page.getByRole('button', { name: '注释' }).click();
    await expect.poll(text).toBe('// b\na\nc');

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('find & replace: ⌘F opens the bar → count and wrap-around → regex → replace all', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.goto('/tools/code-editor');

    const editor = page.getByRole('textbox', { name: '编辑器' });
    const surface = page.locator('.ce-surface');
    const text = async () => surface.evaluate((el) => el.textContent);
    const counter = page.locator('.ce-find-counter');

    await page.getByRole('button', { name: '清空' }).click();
    await editor.click();
    await page.keyboard.type('foo\nbar\nfoo');
    await expect.poll(text).toBe('foo\nbar\nfoo');

    // ⌘F opens the find bar and focuses the query field
    await page.keyboard.press(`${mod}+f`);
    const query = page.getByLabel('查找', { exact: true });
    await expect(query).toBeFocused();
    await query.fill('foo');
    await expect(counter).toHaveText('–/2');

    // Enter moves through matches and the counter advances (wrapping at the end)
    await page.keyboard.press('Enter');
    await expect(counter).toHaveText('1/2');
    const matchTop = async () => {
      const box = await page.locator('.ce-match-current').boundingBox();
      const surfaceBox = await surface.boundingBox();
      if (!box || !surfaceBox) return Number.NaN;
      return box.y - surfaceBox.y;
    };
    await expect.poll(matchTop).toBeGreaterThan(11);
    await expect.poll(matchTop).toBeLessThan(13);

    await page.keyboard.press('Enter');
    await expect(counter).toHaveText('2/2');
    // The current hit jumps to line 3: 12 + 2 × 21 = 54
    await expect.poll(matchTop).toBeGreaterThan(53);
    await expect.poll(matchTop).toBeLessThan(55);

    await page.keyboard.press('Enter');
    await expect(counter).toHaveText('1/2');
    // Focus stays in the find field across jumps and content is not rewritten (regression: jumps used to steal focus)
    await expect(query).toBeFocused();
    await expect.poll(text).toBe('foo\nbar\nfoo');

    // An invalid regex shows a readable message
    await page.getByLabel('正则表达式', { exact: true }).click();
    await query.fill('[');
    await expect(counter).toHaveText('正则无效');
    await page.getByLabel('正则表达式', { exact: true }).click();

    // Replace all: content, preview and stats stay in sync
    await query.fill('foo');
    await page.getByLabel('替换为', { exact: true }).fill('x');
    await page.getByRole('button', { name: '全部替换' }).click();
    await expect.poll(text).toBe('x\nbar\nx');
    await expect(page.getByText('已全部替换')).toBeVisible();
    await expect(page.locator('.ce-card')).not.toContainText('foo');

    // Esc closes the find bar
    await query.press('Escape');
    await expect(query).toHaveCount(0);

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('visual aids: indent guides / bracket matching and jump / fold markers', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.goto('/tools/code-editor');

    const editor = page.getByRole('textbox', { name: '编辑器' });
    const surface = page.locator('.ce-surface');
    // prettier-plugin-java adds blank lines after nested blocks, so assert the formatted shape (trailing newline included)
    const code = ['class A {', '', '  void f() {', '    g();', '  }', '}', ''].join('\n');
    const caretTop = async () => {
      const box = await page.locator('.ce-line-active').boundingBox();
      const surfaceBox = await surface.boundingBox();
      if (!box || !surfaceBox) return Number.NaN;
      return box.y - surfaceBox.y;
    };

    await page.getByRole('button', { name: '清空' }).click();
    await editor.click();
    // Feed a single line and let Prettier format it instead of relying on CodeJar's auto-indent
    await page.keyboard.type('class A{void f(){g();}}');
    await page.getByRole('button', { name: '格式化', exact: true }).click();
    await expect.poll(() => surface.evaluate((el) => el.textContent)).toBe(code);

    // Indent guides: one each on lines 2/4, two on line 3 (columns 0 and 2), none on line 5
    await expect(page.locator('.ce-guide')).toHaveCount(4);

    // Fold markers: one foldable range each on lines 1 and 2
    const markers = page.locator('.ce-fold-marker');
    await expect(markers).toHaveCount(2);

    // Clicking the first marker highlights the whole range plus a line-count badge (hidden folding is out of scope for this core)
    await markers.first().click();
    await expect(page.locator('.ce-fold-band')).toHaveCount(1);
    await expect(page.getByText('6 行')).toBeVisible();
    const bandBox = await page.locator('.ce-fold-band').boundingBox();
    expect(Math.round(bandBox?.height ?? 0)).toBe(6 * 21);

    // Bracket matching + jump: with the caret on the trailing '}', ⌘⇧\ jumps to its '{' (line 1)
    await editor.click();
    await page.keyboard.press(`${mod}+End`);
    await page.keyboard.press(`${mod}+Shift+\\`);
    await expect(page.locator('.ce-bracket')).toHaveCount(2);
    await expect.poll(caretTop).toBeGreaterThan(11);
    await expect.poll(caretTop).toBeLessThan(13);

    // Pressing again jumps back to the closing bracket (line 6: 12 + 5 × 21 = 117)
    await page.keyboard.press(`${mod}+Shift+\\`);
    await expect.poll(caretTop).toBeGreaterThan(116);
    await expect.poll(caretTop).toBeLessThan(118);

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('batch edit: select same word → replace every occurrence', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/code-editor');

    const editor = page.getByRole('textbox', { name: '编辑器' });
    const surface = page.locator('.ce-surface');
    const text = async () => surface.evaluate((el) => el.textContent);

    await page.getByRole('button', { name: '清空' }).click();
    await editor.click();
    await page.keyboard.type('total = 1;');
    await page.keyboard.press('Enter');
    await page.keyboard.type('sum = total;');
    // Move the caret to the end of the last line, onto 'total'
    await page.keyboard.press('ArrowLeft');
    await expect.poll(text).toBe('total = 1;\nsum = total;');

    // Select same word: both hits are marked
    await page.getByRole('button', { name: '选择同词' }).click();
    await expect(page.getByText('2 处')).toBeVisible();
    await expect(page.locator('.ce-multi')).toHaveCount(2);

    // Replace all: both occurrences are rewritten at once
    const input = page.getByLabel('统一替换');
    await input.fill('count');
    await page.getByRole('button', { name: '应用' }).click();
    await expect.poll(text).toBe('count = 1;\nsum = count;');
    await expect(page.locator('.ce-multi')).toHaveCount(0);

    // When the caret is not on a word, explain instead of failing silently (append a space; neither side is a word char)
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' + ');
    await page.getByRole('button', { name: '选择同词' }).click();
    await expect(page.getByText('光标不在可批量替换的词上')).toBeVisible();

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('styled export card: window style / line numbers / highlighted lines / watermark → preview matches export', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/code-editor');

    const surface = page.locator('.ce-surface');
    const text = async () => surface.evaluate((el) => el.textContent);
    await page.getByRole('button', { name: '清空' }).click();
    await page.getByRole('textbox', { name: '编辑器' }).click();
    await page.keyboard.type('const a = 1;\nconst b = 2;\nconst c = 3;');
    await expect.poll(text).toBe('const a = 1;\nconst b = 2;\nconst c = 3;');

    // Open the card style panel and adjust the options
    await page.getByRole('button', { name: '卡片样式' }).click();
    const panel = page.getByTestId('card-panel');
    await panel.getByRole('checkbox').check();
    await panel.getByLabel('高亮行').fill('2-3');
    await panel.getByLabel('水印', { exact: true }).fill('syntools');
    await panel.getByLabel('窗口').selectOption('title');

    // The preview card reflects the options immediately
    await expect(page.locator('.ce-card .code-title')).toHaveCount(1);
    await expect(page.locator('.ce-card .code-dot')).toHaveCount(0);
    await expect(page.locator('.ce-card .code-line-no')).toHaveCount(3);
    await expect(page.locator('.ce-card .code-line-hit')).toHaveCount(2);
    await expect(page.locator('.ce-card .code-watermark')).toHaveText('syntools');

    // The HTML export and the preview share the same body structure
    const htmlPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 HTML' }).click();
    const htmlDownload = await htmlPromise;
    expect(htmlDownload.suggestedFilename()).toBe('snippet.html');
    const html = fs.readFileSync(await htmlDownload.path(), 'utf8');
    expect(html).toContain('syntools');
    expect(html).toContain('code-line-no');
    expect(html).toContain('code-line-hit');
    expect(html).toContain('code-watermark');
    // The title style renders no traffic lights (the .code-dot-* rules stay in the stylesheet)
    expect(html).not.toContain('class="code-dot code-dot-red"');

    // Image export uses the current scale
    const pngPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 PNG' }).click();
    expect((await pngPromise).suggestedFilename()).toBe('snippet.png');

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('share expansion: compressed links restore long code and card styles', async ({
    page,
    context,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const longCode = Array.from(
      { length: 120 },
      (_, index) => `const value${index} = ${index};`,
    ).join('\n');
    const text = () => page.locator('.ce-surface').evaluate((el) => el.textContent);

    // Seed long code through the draft (an uncompressed share would exceed the 2048 limit)
    await page.goto('/tools/code-editor');
    await page.evaluate((code) => {
      localStorage.setItem(
        'syntools:code-editor.draft.v1',
        JSON.stringify({
          code,
          language: 'javascript',
          theme: 'dracula',
          indent: '2',
          filename: 'snippet',
          lineNumbers: true,
          wordWrap: false,
        }),
      );
    }, longCode);
    await page.reload();
    await expect.poll(text).toBe(longCode);

    // Tweak an observable card style option (shared along with the link)
    await page.getByRole('button', { name: '卡片样式' }).click();
    await page.getByTestId('card-panel').getByLabel('留白').fill('64');

    await page.getByRole('button', { name: /分享/ }).click();
    const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
    // Compression parameters are marked with a z prefix
    expect(sharedUrl).toContain('?s=z');

    // Open the link: long code and card styles are fully restored
    await page.goto(sharedUrl);
    await expect.poll(text).toBe(longCode);
    expect(await page.locator('.ce-card').evaluate((el) => getComputedStyle(el).paddingLeft)).toBe(
      '64px',
    );

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

// Mind map editor (zh-CN)
test.describe('mind map editor (zh-CN)', () => {
  test.use({ locale: 'zh-CN' });

  test('canvas mounts → Tab adds a child topic → template loads → collapse a branch', async ({
    page,
  }) => {
    await page.goto('/tools/mindmap-editor');
    // The React Flow canvas plus export/import entries
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect(page.getByRole('button', { name: '导出' })).toBeVisible();
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible();
    // Initially only the central topic, fitted to the canvas center (not stuck at the top-left)
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
    const canvasBox = (await page.locator('.react-flow').boundingBox())!;
    const rootBox = (await page.locator('.react-flow__node').first().boundingBox())!;
    expect(
      Math.abs(rootBox.x + rootBox.width / 2 - (canvasBox.x + canvasBox.width / 2)),
    ).toBeLessThan(canvasBox.width * 0.12);
    expect(
      Math.abs(rootBox.y + rootBox.height / 2 - (canvasBox.y + canvasBox.height / 2)),
    ).toBeLessThan(canvasBox.height * 0.12);
    // The default label must not be ellipsized (the width has to fit "Central Topic")
    await expect(page.locator('.react-flow__node').first()).toContainText('Central Topic');
    const clipped = await page
      .locator('.react-flow__node')
      .first()
      .locator('span')
      .first()
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped).toBe(false);

    // The empty-state hint must not cover the central topic (it sits below it)
    const hint = page.getByText(/按 Tab 添加子主题/);
    await expect(hint).toBeVisible();
    const hintBox = (await hint.boundingBox())!;
    expect(hintBox.y).toBeGreaterThan(rootBox.y + rootBox.height);

    // Tab creates a child topic: one more node and a branch edge
    await page.locator('.react-flow__pane').click({ position: { x: 40, y: 40 } });
    await page.keyboard.press('Tab');
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // New nodes carry the default English label
    await expect(page.getByText('Subtopic', { exact: true })).toBeVisible();

    // Enter creates a sibling topic (Enter in edit mode also creates a sibling)
    await page.keyboard.press('Enter');
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
    await expect(page.getByText('Topic', { exact: true })).toBeVisible();

    // Loading a template replaces the whole map (Project Plan: center + 4 branches + 13 children)
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '项目规划' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(18);

    // Second-level nodes and below use the underline shape by default: bottom edge visible (2px), others 0
    const borders = await page.locator('.react-flow__node').evaluateAll((els) =>
      els.map((el) => {
        const box = el.firstElementChild?.firstElementChild as HTMLElement | undefined;
        if (!box) return null;
        const s = getComputedStyle(box);
        return {
          top: s.borderTopWidth,
          bottom: s.borderBottomWidth,
          left: s.borderLeftWidth,
          style: s.borderBottomStyle,
        };
      }),
    );
    expect(
      borders.some(
        (b) =>
          b && b.bottom === '2px' && b.top === '0px' && b.left === '0px' && b.style === 'solid',
      ),
    ).toBe(true);

    // Everything collapsed leaves only the central topic and first-level branches
    await page.getByRole('button', { name: '全部折叠' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(5);
    await page.getByRole('button', { name: '全部展开' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(18);
  });

  test('switching layout direction keeps the branch count and orientation', async ({ page }) => {
    await page.goto('/tools/mindmap-editor');
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: '读书笔记' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(13);
    await expect(page.locator('.react-flow__edge')).toHaveCount(12);

    await page.getByRole('button', { name: '向下' }).click();
    await expect(page.locator('.react-flow__edge')).toHaveCount(12);
    // Layout switching animates for 150ms, so wait for it to settle before comparing coordinates
    await page.waitForTimeout(400);
    // Downward layout: first-level branches sit below the central topic
    const nodes = await page.locator('.react-flow__node').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent ?? '', x: r.x, y: r.y };
      }),
    );
    const root = nodes.find((n) => n.text.includes('Reading Notes'));
    expect(root).toBeTruthy();
    const below = nodes.filter((n) => n.text.includes('Key ideas'))[0];
    expect(below).toBeTruthy();
    expect(below!.y).toBeGreaterThan(root!.y);
  });

  test('double-click a node to edit text: continuous input, Esc cancels', async ({ page }) => {
    await page.goto('/tools/mindmap-editor');
    const root = page.locator('.react-flow__node').first();
    await expect(root).toContainText('Central Topic');

    // Double-click to enter edit mode, type the full text, then commit
    // Scope the assertion to the canvas: the outline panel shows the same text
    const onCanvas = (text: string) => page.locator('.react-flow').getByText(text, { exact: true });
    await root.dblclick();
    await page.keyboard.type('Hello Map');
    await page.keyboard.press('Enter');
    await expect(onCanvas('Hello Map')).toBeVisible();

    // Edit again with F2: Esc should roll back without persisting
    await onCanvas('Hello Map').click();
    await page.keyboard.press('F2');
    await page.keyboard.type('Changed');
    await page.keyboard.press('Escape');
    await expect(onCanvas('Hello Map')).toBeVisible();
    await expect(onCanvas('Changed')).toHaveCount(0);

    // Clicking an already-selected node also enters edit mode (covers "two clicks too far apart to be a dblclick")
    const second = page.locator('.react-flow__node').nth(1);
    await second.click();
    await page.keyboard.press('Escape');
    await second.click();
    await expect(second.locator('input')).toHaveCount(1);
  });
});

// Document editors' "present" mode: same entry as the slide tool (DocumentHeader afterNew)
test.describe('document editor present mode (zh-CN)', () => {
  test.use({ locale: 'zh-CN' });

  const overlay = (page: Page) => page.getByTestId('present-overlay');

  test('photo editor: present composites the bitmap, Esc exits', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/photo-editor');
    await page.getByTestId('photo-present').click();
    await expect(overlay(page)).toBeVisible();
    await expect(page.getByTestId('present-image')).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('word processor: present a read-only document', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/rich-text-editor');
    await page.locator('.tiptap').click();
    await page.keyboard.type('放映冒烟内容');
    const button = page.getByTestId('rich-text-present');
    await expect(button).toBeEnabled();
    await button.click();
    await expect(overlay(page)).toBeVisible();
    await expect(page.getByTestId('present-document')).toContainText('放映冒烟内容');
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('word processor: content really grows on zoom without drifting', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/rich-text-editor');
    await page.locator('.tiptap').click();
    await page.keyboard.type('放映放大视觉检查');
    await page.getByTestId('rich-text-present').click();
    await expect(overlay(page)).toBeVisible();

    // The document element's "visible width" and "distance from the top of the viewport"
    const metrics = () =>
      page.evaluate(() => {
        const doc = document.querySelector('[data-testid="present-document"]') as HTMLElement;
        const host = document.querySelector('[data-testid="present-scroll"]') as HTMLElement;
        const d = doc.getBoundingClientRect();
        const h = host.getBoundingClientRect();
        return { width: d.width, topGap: d.top - h.top };
      });

    const before = await metrics();
    await page.getByTestId('present-zoom-in').click();
    await page.getByTestId('present-zoom-in').click();
    await expect(page.getByTestId('present-zoom-level')).toHaveText('156%');

    const after = await metrics();
    // Fixed-size content such as text / tables must really grow (not just leave a blank block)
    expect(after.width).toBeGreaterThan(before.width);
    // Top-aligned document: still flush with the viewport top after zoom, never pushed off-screen
    expect(Math.abs(after.topGap - before.topGap)).toBeLessThan(4);

    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('word processor: links can be viewed / edited / removed from the context menu', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/rich-text-editor');
    await page.locator('.tiptap').click();
    await page.keyboard.type('示例链接文字');

    // Create a link with the toolbar button first (that entry uses a native prompt)
    page.once('dialog', (dialog) => void dialog.accept('https://example.com/a'));
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByRole('button', { name: '链接', exact: true }).click();
    await expect(page.locator('.tiptap a[href="https://example.com/a"]')).toHaveCount(1);

    // Right-click the link: the menu offers view / edit / remove
    await page.locator('.tiptap a[href="https://example.com/a"]').click({ button: 'right' });
    await expect(page.getByTestId('rich-text-context-menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '复制链接地址' })).toBeVisible();

    // Edit the link address
    await page.getByRole('menuitem', { name: '编辑链接' }).click();
    const input = page.getByRole('textbox', { name: '链接地址' });
    await expect(input).toHaveValue('https://example.com/a');
    await input.fill('https://example.org/b');
    await page.getByRole('button', { name: '确定' }).click();
    await expect(page.locator('.tiptap a[href="https://example.org/b"]')).toHaveCount(1);

    // Remove the link
    await page.locator('.tiptap a[href="https://example.org/b"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: '移除链接' }).click();
    await expect(page.locator('.tiptap a[href]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('word processor: inline images stay in the text flow instead of owning a line', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/rich-text-editor');
    await page.locator('.tiptap').click();
    await page.keyboard.type('前文');

    // Same entry as the toolbar "插入图片": drop an image straight into the hidden file input
    await page.setInputFiles('input[type="file"][accept="image/*"]', {
      name: 'dot.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKUlEQVR42u3NMQEAAAgDoC251a3gLwSgcyfTVFVVVVVVVVVVVVVVVVVV1S8DLQABAVXMpwAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
    // The image node is inserted asynchronously via FileReader, so wait for the <img> before typing on
    await page.locator('.tiptap img').first().waitFor();
    await page.keyboard.type('后文');

    // The image shares one paragraph with the text around it
    await expect(page.locator('.tiptap p')).toHaveCount(1);
    const html = await page.locator('.tiptap p').innerHTML();
    expect(html.startsWith('前文<img')).toBe(true);
    expect(html.endsWith('后文')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('word processor: the ruler shows millimeter ticks and toggles visibility', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/rich-text-editor');
    await page.waitForSelector('.tiptap');

    const ruler = page.getByTestId('rich-text-ruler');
    await expect(ruler).toBeVisible();
    // Major ticks every 1cm (96/25.4 × 10 ≈ 37.8px), minor ticks every 1mm
    const [major, minor] = await ruler.evaluate((el) => {
      const size = (selector: string) =>
        Number.parseFloat(getComputedStyle(el.querySelector(selector)!).backgroundSize);
      return [size('.rte-ruler-ticks--major'), size('.rte-ruler-ticks--minor')];
    });
    expect(major).toBeGreaterThan(37);
    expect(major).toBeLessThan(38.5);
    expect(minor).toBeGreaterThan(3.5);
    expect(minor).toBeLessThan(4);

    // The vertical ruler uses the same 1cm / 1mm scale and aligns with the top of the body
    const verticalRuler = page.getByTestId('rich-text-ruler-v');
    await expect(verticalRuler).toBeVisible();
    const [vMajor, vOffset] = await verticalRuler.evaluate((el) => {
      const size = Number.parseFloat(
        getComputedStyle(el.querySelector('.rte-ruler-ticks--major')!).backgroundSize.split(' ')[1],
      );
      const track = el.querySelector('.rte-ruler-track--v')!.getBoundingClientRect().top;
      const content = document.querySelector('.tiptap')!.getBoundingClientRect().top;
      return [size, Math.round(track - content)];
    });
    expect(vMajor).toBeGreaterThan(37);
    expect(vMajor).toBeLessThan(38.5);
    expect(Math.abs(vOffset)).toBeLessThan(3);

    const toggle = page.getByRole('button', { name: '标尺', exact: true });
    await toggle.click();
    await expect(ruler).toHaveCount(0);
    await expect(verticalRuler).toHaveCount(0);
    await toggle.click();
    await expect(ruler).toHaveCount(1);
    await expect(verticalRuler).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('spreadsheet: present a read-only table', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/spreadsheet-editor');
    await page.getByTestId('sheet-present').click();
    await expect(overlay(page)).toBeVisible();
    // Even an empty workbook shows the header plus an empty table
    await expect(page.getByRole('table')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('spreadsheet: zoom in / out / fit to window while presenting', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/spreadsheet-editor');
    await page.getByTestId('sheet-present').click();
    await expect(overlay(page)).toBeVisible();

    const stage = page.getByTestId('present-stage');
    const table = page.getByRole('table');
    const level = page.getByTestId('present-zoom-level');
    await expect(level).toHaveText('100%');
    const baseStage = await stage.evaluate((el) => el.getBoundingClientRect().width);
    const baseTable = await table.evaluate((el) => el.getBoundingClientRect().width);

    // Zoom in: the stage and the content (table) must really grow, not just leave a blank block
    await page.getByTestId('present-zoom-in').click();
    await expect(level).toHaveText('125%');
    expect(await stage.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(
      baseStage,
    );
    expect(await table.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(
      baseTable,
    );

    // Fit to window: back to 100%
    await page.getByTestId('present-zoom-fit').click();
    await expect(level).toHaveText('100%');

    // Shortcuts: `=` zooms in, `-` zooms out
    await page.keyboard.press('=');
    await expect(level).toHaveText('125%');
    await page.keyboard.press('-');
    await expect(level).toHaveText('100%');

    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('spreadsheet: zoom stays anchored to the viewport center', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/spreadsheet-editor');
    await page.getByTestId('sheet-present').click();
    await expect(overlay(page)).toBeVisible();

    // The viewport center's relative position inside the zoom stage should stay put before and after zooming
    const centerFraction = () =>
      page.evaluate(() => {
        const host = document.querySelector('[data-testid="present-scroll"]') as HTMLElement;
        const stage = document.querySelector('[data-testid="present-stage"]') as HTMLElement;
        const h = host.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        return {
          fx: (h.left + h.width / 2 - s.left) / s.width,
          fy: (h.top + h.height / 2 - s.top) / s.height,
        };
      });

    const before = await centerFraction();
    await page.getByTestId('present-zoom-in').click();
    await page.getByTestId('present-zoom-in').click();
    await expect(page.getByTestId('present-zoom-level')).toHaveText('156%');

    // Scroll compensation really happens after zooming (otherwise "no drift" is just an illusion of not scrolling)
    const scrolled = await page.getByTestId('present-scroll').evaluate((el) => ({
      left: el.scrollLeft,
      top: el.scrollTop,
    }));
    expect(scrolled.left).toBeGreaterThan(0);
    expect(scrolled.top).toBeGreaterThan(0);

    const after = await centerFraction();
    expect(Math.abs(after.fx - before.fx)).toBeLessThan(0.02);
    expect(Math.abs(after.fy - before.fy)).toBeLessThan(0.02);

    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('flowchart: present a canvas screenshot', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
    await page.getByTestId('flowchart-present').click();
    await expect(overlay(page)).toBeVisible();
    await expect(page.getByTestId('present-image')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('mind map: present a canvas screenshot', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/mindmap-editor');
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await page.getByTestId('mindmap-present').click();
    await expect(overlay(page)).toBeVisible();
    await expect(page.getByTestId('present-image')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

// Multi-page browsing: tab strip paging + thumbnail overview (flowchart / mind map)
test.describe('multi-page browsing (zh-CN)', () => {
  test.use({ locale: 'zh-CN' });

  test('flowchart: overview / paging / page number', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/flowchart-editor');

    // Add a node, then add a page
    await page.getByRole('button', { name: '过程', exact: true }).click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
    await page.getByTestId('page-counter').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('page-counter')).toContainText('1');
    await page.getByRole('button', { name: '新建页面' }).click();
    await expect(page.getByTestId('page-counter')).toContainText('2');

    // Previous / next page
    await page.getByTestId('page-prev').click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
    await page.getByTestId('page-next').click();
    await expect(page.getByText(/节点:\s*0/)).toBeVisible();

    // Overview: both page thumbnails are there and page 1 has content
    await page.getByTestId('page-overview-open').click();
    const overview = page.getByTestId('page-overview');
    await expect(overview).toBeVisible();
    await expect(overview.getByTestId('page-thumb')).toHaveCount(1);
    // Page 2 is still empty → the card shows a "空白页" hint
    await expect(overview.getByText('空白页')).toBeVisible();

    // Click the first page card to jump there and close the overview
    await page.getByTestId('page-card-select-0').click();
    await expect(overview).toHaveCount(0);
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();

    // Ctrl+PageDown pages forward
    await page.keyboard.press('Control+PageDown');
    await expect(page.getByText(/节点:\s*0/)).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('mind map: overview / paging / page number', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/mindmap-editor');
    await expect(page.locator('.react-flow__node')).toHaveCount(1);

    await page.getByRole('button', { name: '新建画布' }).click();
    await expect(page.getByTestId('page-counter')).toContainText('2');

    await page.getByTestId('page-overview-open').click();
    await expect(page.getByTestId('page-overview')).toBeVisible();
    await expect(page.getByTestId('page-thumb')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('page-overview')).toHaveCount(0);

    await page.getByTestId('page-prev').click();
    await expect(page.getByTestId('page-counter')).toContainText('1');
    expect(errors).toEqual([]);
  });
});

/**
 * Shared workspace-height rule for the six office editors:
 * The workspace fills the rest of the first screen, the status bar stays visible and "相关工具" is pushed below the fold (needs scrolling).
 * This keeps the default visible workspace consistent across tools and avoids hard-coded calc constants squeezing related tools in.
 */
test.describe('office tool workspace (zh-CN)', () => {
  // The minimum workspace heights (320 / 460) target common laptop screens; shorter windows are designed to scroll
  test.use({ viewport: { width: 1440, height: 900 } });

  const editors = [
    'rich-text-editor',
    'spreadsheet-editor',
    'slide-editor',
    'mindmap-editor',
    'flowchart-editor',
    'photo-editor',
  ];

  for (const id of editors) {
    test(`${id}: workspace fills the first screen, related tools stay below the fold`, async ({
      page,
    }) => {
      await page.goto(`/tools/${id}`);
      await expect(page.locator('[data-tool-root]')).toBeVisible();

      // Return 'ok' or a diagnostic string: on failure the geometry shows which direction overflowed
      const measure = () =>
        page.evaluate(() => {
          const vh = window.innerHeight;
          const related = document.querySelector('section[aria-label="相关工具"]');
          const relatedTop = related ? Math.round(related.getBoundingClientRect().top) : -1;
          const bar = document.querySelector('[data-editor-statusbar]');
          const barBottom = bar ? Math.round(bar.getBoundingClientRect().bottom) : null;
          // The status bar must stay fully within the first screen (±1px rounding tolerance)
          const barOk = barBottom === null || barBottom <= vh + 1;
          const relatedOk = relatedTop >= vh;
          return barOk && relatedOk
            ? 'ok'
            : `relatedTop=${relatedTop} barBottom=${barBottom} vh=${vh}`;
        });

      await expect.poll(measure, { timeout: 15_000 }).toBe('ok');
    });
  }
});
