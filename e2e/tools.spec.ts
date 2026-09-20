import { expect, test } from '@playwright/test';

/** 每个工具 1 条冒烟用例：打开 → 输入 → 断言输出（Tasks T24） */

test('Base64：编码输出正确', async ({ page }) => {
  await page.goto('/tools/base64');
  await page.getByRole('textbox', { name: '原始文本' }).fill('SynTools');
  await expect(page.getByRole('textbox', { name: 'Base64 结果' })).toHaveValue('U3luVG9vbHM=');
});

test('URL 编解码：component 模式编码正确', async ({ page }) => {
  await page.goto('/tools/url-codec');
  await page.getByRole('textbox', { name: '原始文本' }).fill('a b&c');
  await expect(page.getByRole('textbox', { name: '结果' })).toHaveValue('a%20b%26c');
});

test('正则验证：匹配计数与高亮', async ({ page }) => {
  await page.goto('/tools/regex-tester');
  await page.getByLabel('表达式').fill('\\d+');
  await page.getByRole('textbox', { name: '测试文本' }).fill('abc 123 def 45');
  await expect(page.getByText('共 2 个匹配')).toBeVisible();
  await expect(page.locator('mark', { hasText: '123' })).toBeVisible();
});

test('文本对比：差异统计正确', async ({ page }) => {
  await page.goto('/tools/text-diff');
  await page.getByRole('textbox', { name: '原文本' }).fill('a\nb');
  await page.getByRole('textbox', { name: '新文本' }).fill('a\nc');
  await expect(page.getByText('+1 新增 / −1 删除 / 1 未变')).toBeVisible();
});

test('JSON 格式化：4 空格缩进', async ({ page }) => {
  await page.goto('/tools/json-format');
  await page.getByLabel('缩进').selectOption('4');
  await page.getByRole('textbox', { name: 'JSON 输入' }).fill('{"a":1}');
  await expect(page.getByRole('textbox', { name: '输出' })).toHaveValue('{\n    "a": 1\n}');
});

test('时间戳：秒级时间戳解析', async ({ page }) => {
  await page.goto('/tools/timestamp');
  await page.getByLabel('时间戳输入').fill('1725000000');
  await expect(page.getByText('2024-08-30T06:40:00')).toBeVisible();
});

test('UUID：生成 v4 格式正确', async ({ page }) => {
  await page.goto('/tools/uuid');
  await page.getByRole('button', { name: '生成' }).click();
  await expect(page.getByRole('textbox', { name: '生成结果（每行一个）' })).toHaveValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test('哈希计算：SHA-256 与标准向量一致', async ({ page }) => {
  await page.goto('/tools/hash');
  await page.getByRole('textbox', { name: '文本输入' }).fill('abc');
  await expect(page.getByRole('textbox', { name: 'SHA-256 结果' })).toHaveValue(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

// 办公工具类的界面文案按浏览器语言切换，固定为简体中文以便断言
test.describe('幻灯片编辑器（zh-CN）', () => {
  test.use({ locale: 'zh-CN' });

  test('画布挂载 → 插入文本框 → 导出 pptx → 放映', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();
    // Konva 会注入 3 个 canvas（背景 / 内容 / 覆盖层）
    expect(await page.locator('canvas').count()).toBeGreaterThanOrEqual(3);

    await page.getByRole('button', { name: '文本框' }).click();
    await expect(page.getByText('已选中 1 个元素')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 PPTX' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pptx$/);

    await page.getByRole('button', { name: '放映', exact: true }).click();
    await expect(page.getByText('1 / 1')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '放映', exact: true })).toBeVisible();
  });
});

// 流程图编辑器（zh-CN）
test.describe('流程图编辑器（zh-CN）', () => {
  test.use({ locale: 'zh-CN' });

  test('画布挂载 → 拖放元素落在鼠标处（不被居中）→ 模板载入', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    // React Flow 会挂载画布（含 .react-flow 容器）
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect(page.getByRole('button', { name: '导出 PNG' })).toBeVisible();
    await expect(page.getByRole('button', { name: '导出 SVG' })).toBeVisible();

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // 拖放到画布左上区域：节点应落在鼠标处
    await page.getByRole('button', { name: '过程' }).dragTo(canvas, {
      targetPosition: { x: 90, y: 90 },
    });

    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible();
    await expect(node).toContainText('过程');
    // 防止「节点被撑成 0 尺寸而不可见」回归：必须有实际的宽高
    const nodeBox = await node.boundingBox();
    expect(nodeBox?.width).toBeGreaterThan(0);
    expect(nodeBox?.height).toBeGreaterThan(0);
    // 防止「首个元素被 fitView 居中」回归：节点中心必须落在画布左上象限
    const cx = nodeBox!.x + nodeBox!.width / 2 - canvasBox!.x;
    const cy = nodeBox!.y + nodeBox!.height / 2 - canvasBox!.y;
    // 用 1/3 而非 1/2：被居中时坐标约等于画布正中，必须留足区分度
    expect(cx).toBeLessThan(canvasBox!.width / 3);
    expect(cy).toBeLessThan(canvasBox!.height / 3);
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();

    // 载入模板应替换画布内容且节点数增加
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '基础流程' }).click();
    await expect(page.getByText(/节点:\s*4/)).toBeVisible();
  });

  test('泳道是容器：拖入的元素会放进泳道内', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    // 泳道模板：1 条泳道 + 4 个内部节点
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // 拖到画布中心（模板 fitView 后泳道覆盖画布中心区域）
    await page.getByRole('button', { name: '过程' }).dragTo(canvas, {
      targetPosition: { x: canvasBox!.width / 2, y: canvasBox!.height / 2 },
    });
    await expect(page.getByText(/节点:\s*6/)).toBeVisible();

    // 新节点应被泳道包围（证明它确实被放进了泳道，而不是叠在外面）
    const newNode = page.locator('.react-flow__node').filter({ hasText: '过程' });
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

  test('纵向泳道同样是容器：拖入的元素会放进泳道内', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '纵向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    await page.getByRole('button', { name: '过程' }).dragTo(canvas, {
      targetPosition: { x: canvasBox!.width / 2, y: canvasBox!.height / 2 },
    });
    await expect(page.getByText(/节点:\s*6/)).toBeVisible();

    const newNode = page.locator('.react-flow__node').filter({ hasText: '过程' });
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
});
