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
    // 导出已整合为下拉菜单（PNG/JPEG/SVG/PDF/JSON/DrawIO/Mermaid）
    await expect(page.getByRole('button', { name: '导出' })).toBeVisible();
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible();

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // 拖放到画布左上区域：节点应落在鼠标处
    // 精确匹配：图形库中「预定义过程」也包含「过程」子串
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 90, y: 90 },
    });

    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible();
    // 新建图形默认无文案：节点不应带「过程」等占位文字，但形状已渲染为矩形
    await expect(node).not.toContainText(/\S/);
    await expect(node.locator('svg rect').first()).toBeVisible();
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
    // 精确匹配：图形库中「预定义过程」也包含「过程」子串
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: canvasBox!.width / 2, y: canvasBox!.height / 2 },
    });
    await expect(page.getByText(/节点:\s*6/)).toBeVisible();

    // 新节点应被泳道包围（证明它确实被放进了泳道，而不是叠在外面）
    // 新建图形默认无文本，故用「无文案的节点」定位它（模板里的节点都带标题）
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

  test('多页标签：新建页面后内容隔离，切回可恢复', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();

    // 新建页面：画布应变为空白
    await page.getByRole('button', { name: '新建页面' }).click();
    await expect(page.getByText(/节点:\s*0/)).toBeVisible();

    // 切回第一页：内容应恢复
    await page.getByRole('button', { name: '页面 1' }).click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
  });

  test('纵向泳道同样是容器：拖入的元素会放进泳道内', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '纵向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // 精确匹配：图形库中「预定义过程」也包含「过程」子串
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

  test('自由连线锚点：从一个图形的锚点拖到另一个图形生成连线', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const canvas = page.locator('.react-flow');
    // 在画布两个不同位置各放一个图形
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 120, y: 120 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 420, y: 200 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    const node = page.locator('.react-flow__node').first();
    // 每个图形渲染 8 个自由连线锚点（上/下各 3、左/右各 1）
    await expect(node.locator('.react-flow__handle')).toHaveCount(8);
    // 悬停时锚点可见，可从此处拉出连线（ConnectionMode.Loose）
    await node.hover();
    await expect(node.locator('.react-flow__handle').first()).toBeVisible();
  });

  test('泳道缩放把手：选中泳道后出现 8 个缩放把手', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '横向泳道流程' }).click();
    await expect(page.getByText(/节点:\s*5/)).toBeVisible();

    const lane = page.locator('.react-flow__node').filter({ hasText: '泳道' }).first();
    // 点击泳道标题栏选中泳道（避开内部子节点），随后出现 8 个缩放把手
    await lane.getByText('泳道').click();
    await expect(lane.locator('.react-flow__resize-control')).toHaveCount(8);
  });

  test('普通图形也支持缩放把手：选中后出现 8 个圆形把手', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    const node = page.locator('.react-flow__node').first();
    await node.click();
    await expect(node.locator('.react-flow__resize-control')).toHaveCount(8);
  });

  test('图形分类：通用图形置顶且每个分类可独立折叠', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    // 通用图形为侧边栏第一个分类
    const palette = page.locator('aside').filter({ has: page.getByPlaceholder('搜索图形') });
    await expect(palette.getByRole('button').first()).toContainText('通用图形');
    // 默认展开：可见通用图形下的「圆角矩形」
    await expect(page.getByRole('button', { name: '圆角矩形', exact: true })).toBeVisible();
    // 点击收起该分类，其下图形隐藏（其它分类不受影响）
    await page.getByRole('button', { name: '通用图形', exact: true }).click();
    await expect(page.getByRole('button', { name: '圆角矩形', exact: true })).toHaveCount(0);
    // 再次展开后恢复
    await page.getByRole('button', { name: '通用图形', exact: true }).click();
    await expect(page.getByRole('button', { name: '圆角矩形', exact: true })).toBeVisible();
  });

  test('侧边栏默认每排 5 个元素且可拖拽分隔条调整宽度', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const palette = page.locator('aside').filter({ has: page.getByPlaceholder('搜索图形') });
    // 默认宽度下每排约 5 个元素（按首行按钮数计，避免依赖精确列宽）
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
    // 拖拽右侧分隔条可加宽侧边栏
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

  test('自由连线：拖到目标图形“身上”即生成连线（不再丢线）', async ({ page }) => {
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
    // 从锚点拖出，松手在目标图形身体上（非精确 handle），应补建连线
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  });

  test('快速连线：点击箭头后在弹窗中选择图形生成相连图形', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    const node = page.locator('.react-flow__node').first();
    await node.hover();
    const arrow = node.getByLabel('快速连线-right');
    await arrow.click();
    // 松手立即生成相连节点与连线，并弹出图形选择弹窗
    const picker = page.getByTestId('quick-picker');
    await expect(picker).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    // 在弹窗中选择图形后，新节点类型被替换为该图形（默认无文案，按渲染形状断言）
    await picker.getByRole('button', { name: '圆角矩形', exact: true }).click();
    await expect(page.locator('.react-flow__node svg rect[rx="10"]')).toHaveCount(1);
  });

  test('自由连线：拖到空白画布只连已有图形，不新增图形', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '过程', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    const canvasBox = (await page.locator('.react-flow').boundingBox())!;
    const node = page.locator('.react-flow__node').first();
    await node.hover();
    const handle = node.locator('.react-flow__handle-left');
    await expect(handle).toBeVisible();
    const hb = (await handle.boundingBox())!;
    // 从左侧锚点拖到画布空白处，松手不应生成任何图形/连线
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 40, hb.y + hb.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  });

  test('快速连线：按住箭头拖出后松手弹出选择弹窗', async ({ page }) => {
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
    // 松手即已生成相连节点与连线
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    await picker.getByRole('button', { name: '椭圆', exact: true }).click();
    await expect(page.locator('.react-flow__node svg ellipse')).toHaveCount(1);
  });

  test('工具栏连线样式：选中连线后调整下拉立即生效', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const canvas = page.locator('.react-flow');
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 120, y: 100 },
    });
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
      targetPosition: { x: 440, y: 260 },
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // 从一个锚点拖到另一个图形身上生成连线
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

    // 在连线路径中点处点击以选中该连线（路径中点必落在描边上）
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

    // 选中后通过工具栏下拉调整样式，应立即应用到该连线（属性面板同步反映）
    await page.getByLabel('开始箭头').selectOption('arrowclosed');
    await page.getByLabel('连线样式').selectOption('dashed');
    await expect(page.getByLabel('起点箭头')).toHaveValue('arrowclosed');
    await expect(page.getByLabel('线条')).toHaveValue('dashed');
  });

  test('画布滚动：滚轮平移视图并显示滚动条', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '基础流程' }).click();
    await expect(page.getByText(/节点:\s*4/)).toBeVisible();

    const canvas = page.locator('.react-flow');
    const box = (await canvas.boundingBox())!;
    const node = page.locator('.react-flow__node').first();
    const before = (await node.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // 上下滚动 → 竖直平移（内容向上移动）
    await page.mouse.wheel(0, 220);
    await expect
      .poll(async () => (await node.boundingBox())?.y ?? before.y)
      .toBeLessThan(before.y - 10);

    // 左右滚动 → 水平平移（内容向左移动）
    const beforeX = (await node.boundingBox())!.x;
    await page.mouse.wheel(220, 0);
    await expect
      .poll(async () => (await node.boundingBox())?.x ?? beforeX)
      .toBeLessThan(beforeX - 10);

    // 内容超出视口时出现滚动条
    await expect(page.getByTestId('canvas-scrollbar-y')).toBeVisible();
  });

  test('连线选中：高亮显示并可调整 source/target', async ({ page }) => {
    await page.goto('/tools/flowchart-editor');
    const canvas = page.locator('.react-flow');
    const proc = page.getByRole('button', { name: '过程', exact: true });
    await proc.dragTo(canvas, { targetPosition: { x: 110, y: 80 } });
    await proc.dragTo(canvas, { targetPosition: { x: 380, y: 80 } });
    await proc.dragTo(canvas, { targetPosition: { x: 250, y: 210 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(3);

    // 连 1 → 2
    const n1 = page.locator('.react-flow__node').nth(0);
    await n1.hover();
    const hb = (await n1.locator('.react-flow__handle-right').boundingBox())!;
    const n2b = (await page.locator('.react-flow__node').nth(1).boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(n2b.x + n2b.width / 2, n2b.y + n2b.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // 未选中时：不应出现自绘的重连端点方块
    await expect(page.locator('[data-testid="edge-endpoint"]')).toHaveCount(0);

    // 点击连线路径中点选中该连线
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

    // 选中后：描边高亮为蓝色 + 两端出现「小方块」重连端点
    const endpoints = page.locator('[data-testid="edge-endpoint"]');
    await expect(endpoints).toHaveCount(2);
    const stroke = await page
      .locator('.react-flow__edge-path')
      .first()
      .evaluate((el) => getComputedStyle(el).stroke);
    expect(stroke).toBe('rgb(37, 99, 235)');
    const box = (await endpoints.first().boundingBox())!;
    // 正方形且尺寸更小
    expect(Math.abs(box.width - box.height)).toBeLessThan(1);
    expect(box.width).toBeLessThanOrEqual(12);

    // 通过属性面板把「终点节点」改为第 3 个图形，连线几何应改变
    const dBefore = await page.locator('.react-flow__edge-path').first().getAttribute('d');
    await page.getByLabel('终点节点').selectOption({ index: 2 });
    await expect
      .poll(() => page.locator('.react-flow__edge-path').first().getAttribute('d'))
      .not.toBe(dBefore);
  });

  test('连线重连：选中后直接拖拽端点改接另一图形（节点锚点与快连箭头不抢指针）', async ({
    page,
  }) => {
    await page.goto('/tools/flowchart-editor');
    const canvas = page.locator('.react-flow');
    const proc = page.getByRole('button', { name: '过程', exact: true });
    await proc.dragTo(canvas, { targetPosition: { x: 110, y: 80 } });
    await proc.dragTo(canvas, { targetPosition: { x: 390, y: 80 } });
    await proc.dragTo(canvas, { targetPosition: { x: 250, y: 240 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(3);

    // 连 1 → 2
    const n1 = page.locator('.react-flow__node').nth(0);
    await n1.hover();
    const hb = (await n1.locator('.react-flow__handle-right').boundingBox())!;
    const n2b = (await page.locator('.react-flow__node').nth(1).boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(n2b.x + n2b.width / 2, n2b.y + n2b.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // 点击连线路径中点选中该连线
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

    // 两端的方块端点应出现，且方块自身可按下（命中自己）
    await expect(page.locator('[data-testid="edge-endpoint"]')).toHaveCount(2);
    const ub = (await page.locator('[data-testid="edge-endpoint"]').nth(1).boundingBox())!;
    const scx = ub.x + ub.width / 2;
    const scy = ub.y + ub.height / 2;
    const hitClass = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.getAttribute('class') ?? '',
      [scx, scy] as [number, number],
    );
    expect(hitClass).toContain('edge-endpoint');

    // 方块中心即连线终点：正好落在图形边缘上（不再偏外）
    expect(
      Math.min(
        Math.abs(scy - n2b.y),
        Math.abs(scy - (n2b.y + n2b.height)),
        Math.abs(scx - n2b.x),
        Math.abs(scx - (n2b.x + n2b.width)),
      ),
    ).toBeLessThanOrEqual(1);

    // 连线终点也与该方块中心重合（即终点落在图形边缘，不再偏外约 6px）
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

    // 方块只盖住箭头根部：沿该边向外露出的长度不足箭头全长(16)的一半，箭头仍可见
    const outward =
      scy < n2b.y + n2b.height / 2
        ? n2b.y - ub.y
        : scy > n2b.y + n2b.height / 2
          ? ub.y + ub.height - (n2b.y + n2b.height)
          : scx < n2b.x + n2b.width / 2
            ? n2b.x - ub.x
            : ub.x + ub.width - (n2b.x + n2b.width);
    expect(outward).toBeLessThan(8);

    // 拖拽终点端点改接到第 3 个图形
    const id3 = await page.locator('.react-flow__node').nth(2).getAttribute('data-id');
    const n3b = (await page.locator('.react-flow__node').nth(2).boundingBox())!;
    await page.mouse.move(ub.x + ub.width / 2, ub.y + ub.height / 2);
    await page.mouse.down();
    await page.mouse.move(n3b.x + n3b.width / 2, n3b.y + n3b.height / 2, { steps: 12 });
    await page.mouse.up();

    // 未新增连线，且终点已改为第 3 个图形
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    await expect(page.getByLabel('终点节点')).toHaveValue(id3!);

    // 选中连线不抑制节点侧连线 UI：锚点圆点悬停即显、锚点可接收指针
    await n1.hover();
    // 端点方块落在该连线自己的锚点上（右侧），故换用底边中点锚点拉新连线
    const handleAgain = n1.locator('.react-flow__handle-bottom[data-handleid="b"]');
    const pointerEvents = await handleAgain.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).not.toBe('none');
    await expect
      .poll(() => handleAgain.locator('span').evaluate((el) => getComputedStyle(el).opacity))
      .toBe('1');

    // 连线仍选中（两端端点方块在）时，从该锚点拉出新连线
    await expect(page.locator('[data-testid="edge-endpoint"]')).toHaveCount(2);
    const hb2 = (await handleAgain.boundingBox())!;
    await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(n2b.x + n2b.width / 2, n2b.y + n2b.height / 2, { steps: 10 });
    await page.mouse.up();
    // 新建了连线，且原连线选中态被取消（端点方块消失）
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);
    await expect(page.locator('[data-testid="edge-endpoint"]')).toHaveCount(0);
  });
});

// 照片编辑器（zh-CN）
test.describe('照片编辑器（zh-CN）', () => {
  test.use({ locale: 'zh-CN' });

  test('画布挂载 → 画笔落笔自动建图层 → 导出 PNG', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();
    // Konva 会注入 3 个 canvas（背景 / 内容 / 覆盖层）
    expect(await page.locator('canvas').count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId('photo-stats')).toContainText('图层 0');

    // 画笔工具：在没有图层时落笔会自动新建位图图层
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const canvasBox = (await page.getByLabel('photo canvas').boundingBox())!;
    await page.mouse.move(canvasBox.x + 120, canvasBox.y + 120);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 220, canvasBox.y + 200, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // 导出对话框 → 下载 PNG
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出图片' }).click();
    await page.getByRole('button', { name: '下载', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test('新建画布对话框：指定尺寸后画布统计更新', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await page.getByRole('button', { name: '新建画布' }).click();
    await page.getByLabel('宽度').fill('800');
    await page.getByLabel('高度').fill('600');
    await page.getByRole('button', { name: '创建' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('800 × 600');
  });
});

// 脑图编辑器（zh-CN）
test.describe('脑图编辑器（zh-CN）', () => {
  test.use({ locale: 'zh-CN' });

  test('画布挂载 → Tab 建子主题 → 模板载入 → 折叠分支', async ({ page }) => {
    await page.goto('/tools/mindmap-editor');
    // React Flow 画布与导出/导入入口
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect(page.getByRole('button', { name: '导出' })).toBeVisible();
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible();
    // 初始只有中心主题，且应被适配到画布中央（而非默认贴在左上角）
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
    // 默认文案不应被截成省略号（宽度需容纳 "Central Topic"）
    await expect(page.locator('.react-flow__node').first()).toContainText('Central Topic');
    const clipped = await page
      .locator('.react-flow__node')
      .first()
      .locator('span')
      .first()
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped).toBe(false);

    // 空态提示条不得盖住中心主题（应位于其下方）
    const hint = page.getByText(/按 Tab 添加子主题/);
    await expect(hint).toBeVisible();
    const hintBox = (await hint.boundingBox())!;
    expect(hintBox.y).toBeGreaterThan(rootBox.y + rootBox.height);

    // Tab 新建子主题：节点 +1，且生成一条分支连线
    await page.locator('.react-flow__pane').click({ position: { x: 40, y: 40 } });
    await page.keyboard.press('Tab');
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // 新节点带默认英文文案
    await expect(page.getByText('Subtopic', { exact: true })).toBeVisible();

    // Enter 新建同级主题（编辑态下 Enter 同样建同级）
    await page.keyboard.press('Enter');
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
    await expect(page.getByText('Topic', { exact: true })).toBeVisible();

    // 载入模板应替换整张脑图（项目规划：中心 + 4 分支 + 13 子节点）
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '项目规划' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(18);

    // 二级及以下节点默认下划线形状：底边可见（2px），其余边为 0
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

    // 全部折叠后只剩中心主题与一级分支
    await page.getByRole('button', { name: '全部折叠' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(5);
    await page.getByRole('button', { name: '全部展开' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(18);
  });

  test('切换布局方向后分支数不变且朝向正确', async ({ page }) => {
    await page.goto('/tools/mindmap-editor');
    await page.getByRole('button', { name: '模板' }).click();
    await page.getByRole('button', { name: '读书笔记' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(13);
    await expect(page.locator('.react-flow__edge')).toHaveCount(12);

    await page.getByRole('button', { name: '向下' }).click();
    await expect(page.locator('.react-flow__edge')).toHaveCount(12);
    // 布局切换有 150ms 过渡动画，等落位后再比较坐标
    await page.waitForTimeout(400);
    // 向下布局：一级分支应位于中心主题下方
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

  test('双击节点编辑文本：可连续输入，Esc 取消回滚', async ({ page }) => {
    await page.goto('/tools/mindmap-editor');
    const root = page.locator('.react-flow__node').first();
    await expect(root).toContainText('Central Topic');

    // 双击进入编辑态，连续输入完整文本后提交
    // 断言限定在画布内：大纲面板里同样会出现该文本
    const onCanvas = (text: string) => page.locator('.react-flow').getByText(text, { exact: true });
    await root.dblclick();
    await page.keyboard.type('Hello Map');
    await page.keyboard.press('Enter');
    await expect(onCanvas('Hello Map')).toBeVisible();

    // F2 再次编辑：Esc 应回滚，不落库
    await onCanvas('Hello Map').click();
    await page.keyboard.press('F2');
    await page.keyboard.type('Changed');
    await page.keyboard.press('Escape');
    await expect(onCanvas('Hello Map')).toBeVisible();
    await expect(onCanvas('Changed')).toHaveCount(0);

    // 单击已选中的节点也能进入编辑（覆盖「两次单击间隔过长、不算双击」的场景）
    const second = page.locator('.react-flow__node').nth(1);
    await second.click();
    await page.keyboard.press('Escape');
    await second.click();
    await expect(second.locator('input')).toHaveCount(1);
  });
});
