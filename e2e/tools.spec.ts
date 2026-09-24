import { expect, test, type Page } from '@playwright/test';

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

  test('适应窗口：算出容器真实比例（不退化到最小缩放）→ 100% 复原', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    const readZoom = async () =>
      Number((await page.getByTestId('photo-zoom').textContent())?.replace(/\D/g, '') ?? '0');

    const initial = await readZoom();
    expect(initial).toBeGreaterThan(10);
    expect(initial).toBeLessThanOrEqual(100);

    // 1280×720 画布放进 ~650×518 的容器，适配结果应稳定复现（而非被下限钳成 2%）
    await page.getByRole('button', { name: '适应窗口' }).click();
    await expect(page.getByTestId('photo-zoom')).toContainText(`${initial}%`);

    await page.getByRole('button', { name: '100%', exact: true }).click();
    await expect(page.getByTestId('photo-zoom')).toContainText('100%');
  });

  test('画笔 / 橡皮：拖动过程中即时生效（不等松手）', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    /** 统计内容层画布上「有颜色」的像素数（每次现取画布位置，避免页面滚动导致坐标失效） */
    const paintedPixels = () =>
      page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count += 1;
        return count;
      });

    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const box = (await page.getByLabel('photo canvas').boundingBox())!;
    const y = box.y + Math.min(box.height - 40, Math.max(40, box.height / 2));

    await page.mouse.move(box.x + 80, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 320, y, { steps: 12 });
    await page.waitForTimeout(150);
    // 松手前就该看到笔迹：烘焙缓存不能把画面冻在笔画开始那一刻
    expect(await paintedPixels()).toBeGreaterThan(0);
    await page.mouse.up();
    await page.waitForTimeout(150);
    const painted = await paintedPixels();
    expect(painted).toBeGreaterThan(0);

    // 橡皮沿同一条线擦回：松手前像素就应该减少
    await page.getByRole('button', { name: '橡皮', exact: true }).click();
    const box2 = (await page.getByLabel('photo canvas').boundingBox())!;
    const y2 = box2.y + Math.min(box2.height - 40, Math.max(40, box2.height / 2));
    await page.mouse.move(box2.x + 80, y2);
    await page.mouse.down();
    await page.mouse.move(box2.x + 320, y2, { steps: 12 });
    await page.waitForTimeout(150);
    expect(await paintedPixels()).toBeLessThan(painted);
    await page.mouse.up();
  });

  test('抓手：拖动过程中即时平移视口', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    const transform = () =>
      page.evaluate(
        () => (document.querySelector('.photo-stage') as HTMLElement).dataset.transform,
      );
    const panX = async () => Number((await transform())?.split(',')[1] ?? '0');

    await page.getByRole('button', { name: '抓手', exact: true }).click();
    const box = (await page.getByLabel('photo canvas').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const before = await panX();

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy, { steps: 10 });
    await page.waitForTimeout(150);
    // 松手前视口就已经平移，且松手后保持
    expect(await panX()).toBeGreaterThanOrEqual(before + 60);
    await page.mouse.up();
    await page.waitForTimeout(150);
    expect(await panX()).toBeGreaterThanOrEqual(before + 60);
  });

  test('刷新后从草稿恢复仍能落笔（草稿不得把像素丢成空图层）', async ({ page }) => {
    const paintedPixels = () =>
      page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count += 1;
        return count;
      });

    const stroke = async () => {
      await page.getByRole('button', { name: '画笔', exact: true }).click();
      const box = (await page.getByLabel('photo canvas').boundingBox())!;
      const y = box.y + Math.min(box.height - 40, Math.max(40, box.height / 2));
      await page.mouse.move(box.x + 80, y);
      await page.mouse.down();
      await page.mouse.move(box.x + 320, y, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(200);
    };

    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();
    await stroke();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // 等草稿落盘（状态栏出现「已保存到本地草稿」）后刷新：恢复出来的图层必须还能继续画
    await expect(page.getByText('已保存到本地草稿')).toBeVisible({ timeout: 5000 });
    await page.reload();
    await expect(page.getByLabel('photo canvas')).toBeVisible();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');
    const restored = await paintedPixels();
    expect(restored).toBeGreaterThan(0);

    await page.getByRole('button', { name: '橡皮', exact: true }).click();
    const box = (await page.getByLabel('photo canvas').boundingBox())!;
    const y = box.y + Math.min(box.height - 40, Math.max(40, box.height / 2));
    await page.mouse.move(box.x + 80, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 320, y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    expect(await paintedPixels()).toBeLessThan(restored);
  });

  test('图层面板：混合模式 / 不透明度置于顶部一行，⋯ 菜单承载重命名与新建图层', async ({
    page,
  }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    // 空态下也能通过 ⋯ 菜单创建第一个图层
    await page.getByTestId('layer-menu-trigger').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('menuitem', { name: '空白图层' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // 顶部一行只作用于当前选中图层
    await page.getByLabel('混合模式').selectOption('multiply');
    await expect(page.getByLabel('混合模式')).toHaveValue('multiply');
    await page.getByRole('slider', { name: '不透明度' }).fill('60');
    await expect(page.getByRole('slider', { name: '不透明度' })).toHaveValue('60');

    // ⋯ 菜单内的重命名文本框
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menu').getByLabel('重命名').fill('我的图层');
    await page.keyboard.press('Escape');
    await expect(page.getByText('我的图层').first()).toBeVisible();
  });

  test('画布右键菜单：选区后续操作（填充 / 反选 / 通过拷贝新建图层）', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    const paintedPixels = () =>
      page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count += 1;
        return count;
      });

    const menu = page.getByTestId('canvas-context-menu');
    const openMenu = async () => {
      const canvas = page.getByLabel('photo canvas');
      await canvas.scrollIntoViewIfNeeded();
      const box = (await canvas.boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
      await expect(menu).toBeVisible();
    };

    // 无选区：菜单只有画布级操作
    await openMenu();
    await expect(menu.getByRole('menuitem', { name: '全选' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '填充选区（前景色）' })).toHaveCount(0);

    // 全选 → 选区操作出现，填充整块画布
    await menu.getByRole('menuitem', { name: '全选' }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByText('选区 1280 × 720')).toBeVisible();
    await openMenu();
    await expect(menu.getByRole('menuitem', { name: '清除选区内容' })).toBeVisible();
    await menu.getByRole('menuitem', { name: '填充选区（前景色）' }).click();
    await page.waitForTimeout(200);
    const filled = await paintedPixels();
    expect(filled).toBeGreaterThan(0);

    // 矩形选区 → 反选 → 清除：只有原选区内像素保留
    await page.keyboard.press('Control+a');
    await page.getByRole('button', { name: '矩形选区', exact: true }).click();
    const box = (await page.getByLabel('photo canvas').boundingBox())!;
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

    // 通过拷贝新建图层
    await page.keyboard.press('Control+a');
    await openMenu();
    await menu.getByRole('menuitem', { name: '通过拷贝新建图层' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 2');
  });

  test('吸管：取色有反馈，透明像素不覆盖前景色，Alt+点击可临时取色', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    /** 文档坐标 → 屏幕坐标：data-transform = "scale,tx,ty" */
    const stage = async () => {
      const box = (await page.getByLabel('photo canvas').boundingBox())!;
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

    // 涂一段红色笔迹（文档坐标 (200,200) → (600,400)）
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    await page.getByRole('button', { name: '#DC2626' }).click();
    let s = await stage();
    const from = s.at(200, 200);
    const to = s.at(600, 400);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    // 吸管取色：参数条显示前景色，并给出「已吸取」反馈
    await page.getByRole('button', { name: '吸管', exact: true }).click();
    await expect(page.getByTestId('eyedropper-bar')).toBeVisible();
    s = await stage();
    const onStroke = s.at(400, 300);
    await page.mouse.click(onStroke.x, onStroke.y);
    await expect(page.getByTestId('photo-notice')).toContainText('已吸取 #DC2626');
    await expect(page.getByTestId('eyedropper-bar')).toContainText('#DC2626');

    // 白底空白处 → 吸到白色
    const onWhite = s.at(1100, 400);
    await page.mouse.click(onWhite.x, onWhite.y);
    await expect(page.getByTestId('photo-notice')).toContainText('已吸取 #FFFFFF');

    // 透明画布：空白处提示透明，且不覆盖前景色
    await page.getByRole('button', { name: '新建画布' }).click();
    await page.getByLabel('画布背景').selectOption('transparent');
    await page.getByRole('button', { name: '创建' }).click();
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: '吸管', exact: true }).click();
    s = await stage();
    const onEmpty = s.at(1100, 400);
    await page.mouse.click(onEmpty.x, onEmpty.y);
    await expect(page.getByTestId('photo-notice')).toContainText('透明像素');
    await expect(page.getByTestId('eyedropper-bar')).toContainText('#FFFFFF');

    // Alt + 左键：在画笔工具下临时取色，且不切换工具
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    await page.keyboard.down('Alt');
    await page.mouse.click(onEmpty.x, onEmpty.y);
    await page.keyboard.up('Alt');
    await expect(page.getByRole('button', { name: '画笔', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('滚动条与滚轮：上下 / 左右滚动、Ctrl+滚轮锚点缩放、拖动滑块、适应窗口后隐藏', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    const transform = async () => {
      const raw = await page.evaluate(
        () => (document.querySelector('.photo-stage') as HTMLElement).dataset.transform!,
      );
      const [scale, x, y] = raw.split(',').map(Number);
      return { scale, x, y, raw };
    };
    const box = (await page.getByLabel('photo canvas').boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    // 1) 100% 放大后内容必然超出视口 → 两条滚动条都出现
    await page.getByRole('button', { name: '100%', exact: true }).click();
    await expect(page.getByTestId('canvas-scrollbar-x')).toBeVisible();
    await expect(page.getByTestId('canvas-scrollbar-y')).toBeVisible();

    // 2) 普通滚轮 = 平移（内容向上/向左移动）
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

    // 3) Ctrl + 滚轮 = 以光标为锚点缩放：光标下的文档坐标保持不动
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

    // 4) 拖动纵向滚动条滑块 → 视口平移
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

    // 5) 适应窗口后内容小于视口 → 滚动条隐藏
    await page.getByRole('button', { name: '适应窗口' }).click();
    await page.waitForTimeout(200);
    await expect(page.getByTestId('canvas-scrollbar-y')).toHaveCount(0);
  });

  test('缩放控件：四个图标按钮图形各不相同，文字说明走 tooltip', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByTestId('photo-zoom')).toBeVisible();

    const markup = async (name: string) =>
      (await page.getByRole('button', { name }).innerHTML()).replace(/\s+/g, '');

    // 放大 / 缩小必须是不同的图形（曾经两个按钮共用一个放大镜图标）
    expect(await markup('放大')).not.toBe(await markup('缩小'));

    // 适应窗口 / 100%：图标按钮 + tooltip，不再有可见文字
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

  test('新建画布对话框：指定尺寸后画布统计更新', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await page.getByRole('button', { name: '新建画布' }).click();
    await page.getByLabel('宽度').fill('800');
    await page.getByLabel('高度').fill('600');
    await page.getByRole('button', { name: '创建' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('800 × 600');
  });

  test('导出 PSD：下载 .psd 且可在 Photoshop / Photopea 继续编辑', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    // 两层内容：位图 + 编组内再一层，验证层树映射不报错
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menuitem', { name: '空白图层' }).click();
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menuitem', { name: '从图层新建编组' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 2');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出图片' }).click();
    await page.getByTestId('export-psd').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.psd$/);

    // 落盘后用文件头校验：PSD 以 8BPS 开头
    const path = await download.path();
    const header = (await import('node:fs')).readFileSync(path!).subarray(0, 4).toString('latin1');
    expect(header).toBe('8BPS');
  });

  test('智能对象：位图转换后保留源像素尺寸，可再栅格化', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    // 一张位图图层（落笔自动创建）
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const box = (await page.getByLabel('photo canvas').boundingBox())!;
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + 200, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // 转为智能对象
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '转换为智能对象' }).click();

    await page.getByRole('button', { name: '属性', exact: true }).click();
    await expect(page.getByTestId('smart-section')).toBeVisible();
    // 源像素尺寸来自原始资产（画布 1280×720 上的图层宽度）
    await expect(page.getByTestId('smart-section')).toContainText('1280 × 720');

    // 缩小呈现尺寸：源尺寸不变（非破坏）
    const width = page.getByLabel('宽度');
    await width.fill('640');
    await width.dispatchEvent('change');
    await expect(page.getByTestId('smart-section')).toContainText('1280 × 720');

    // 栅格化：回到普通位图，智能对象小节消失
    await page.getByTestId('smart-rasterize').click();
    await expect(page.getByTestId('smart-section')).toHaveCount(0);
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');
  });

  test('调整图层：作用于下方全部内容，改亮度即时生效且可撤销', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    // 底色：一张画满的位图（用油漆桶铺满画布，排除背景干扰）
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '空白图层' }).click();
    await page.getByRole('button', { name: '油漆桶', exact: true }).click();
    const box = (await page.getByLabel('photo canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    /** 取内容层画布中心像素亮度 */
    const centerLuma = () =>
      page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const { data } = ctx.getImageData(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height / 2),
          1,
          1,
        );
        return Math.round(data[0] * 0.299 + data[1] * 0.587 + data[2] * 0.114);
      });

    // 新建调整图层 → 选中它 → 调亮度
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '新建调整图层' }).click();
    await page.getByRole('button', { name: '调整', exact: true }).click();
    const before = await centerLuma();

    const brightness = page.getByLabel('亮度');
    await brightness.fill('80');
    await brightness.dispatchEvent('change');
    await expect.poll(centerLuma).toBeGreaterThan(before);

    // 撤销（滑杆过程不进历史，用工具栏按钮触发）：亮度回到原值
    await page.getByRole('button', { name: '撤销' }).click();
    await expect.poll(centerLuma).toBe(before);
  });

  test('图层蒙版：隐藏全部 → 画笔涂白显示 → 反相 → 删除', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    // 建一张有内容的位图图层
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const box = (await page.getByLabel('photo canvas').boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 320, box.y + 260, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    /** 内容层画布上的可见像素数（蒙版会直接改变它） */
    const countInk = () =>
      page.evaluate(() => {
        const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 8) n += 1;
        return n;
      });
    const before = await countInk();
    expect(before).toBeGreaterThan(0);

    // 属性页 → 添加蒙版（隐藏全部）
    await page.getByRole('button', { name: '属性', exact: true }).click();
    await page.getByRole('button', { name: '隐藏全部' }).click();
    await expect(page.getByTestId('mask-remove')).toBeVisible();
    await expect.poll(countInk).toBe(0);

    // 进入蒙版编辑：画笔涂白 = 显示该区域
    await page.getByTestId('mask-edit-toggle').click();
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 240, { steps: 10 });
    await page.mouse.up();
    const revealed = await countInk();
    expect(revealed).toBeGreaterThan(0);

    // 反相：黑白互换 → 显示区域取反（与涂白区域互补，不再是同一批像素）
    await page.getByTestId('mask-edit-toggle').click();
    await page.getByTestId('mask-invert').click();
    await expect.poll(countInk).not.toBe(revealed);
    const inverted = await countInk();
    expect(inverted).toBeGreaterThan(0);
    // 互补：两部分之和不超过原始像素数（重叠部分按一次计）
    expect(inverted + revealed).toBeLessThanOrEqual(before + revealed);

    // 删除蒙版：回到完整可见
    await page.getByTestId('mask-remove').click();
    await expect.poll(countInk).toBe(before);
  });

  test('图层编组：新建组 → 图层移入 → 折叠隐藏子图层 → 解散', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    // 先有一张位图图层
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '空白图层' }).click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // 从图层新建编组
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '从图层新建编组' }).click();
    // 编组 + 组内图层共 2 行
    await expect(page.getByTestId('layer-panel').locator('li')).toHaveCount(2);

    // 面板倒序呈现（最上层在前）：组内图层在第一行且缩进 12px，编组本身在第二行不缩进
    const rows = page.getByTestId('layer-panel').locator('li');
    await expect(rows.nth(0)).toHaveCSS('margin-left', '12px');
    await expect(rows.nth(1)).toHaveCSS('margin-left', '0px');

    // 折叠：子树整段隐藏
    await page.locator('[data-testid^="group-toggle-"]').first().click();
    await expect(rows).toHaveCount(1);
    await page.locator('[data-testid^="group-toggle-"]').first().click();
    await expect(rows).toHaveCount(2);

    // 解散编组：菜单在编组那一行（第二行）上
    await rows.nth(1).getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: '解散编组' }).click();
    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');
  });

  test('历史面板：按操作名列出步骤，点击可跳转并清空', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    // 画笔落笔 → 自动新建图层（一步历史）
    await page.getByRole('button', { name: '画笔', exact: true }).click();
    const box = (await page.getByLabel('photo canvas').boundingBox())!;
    await page.mouse.move(box.x + 120, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 180, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    await page.getByRole('button', { name: '历史', exact: true }).click();
    const list = page.getByTestId('history-list');
    await expect(list).toBeVisible();
    // 打开文档 → 新建图层 → 画笔落笔（当前）
    await expect(list.locator('li')).toHaveCount(3);
    await expect(page.getByTestId('history-row-1')).toContainText('新建图层');
    await expect(page.getByTestId('history-row-2')).toContainText('画笔');
    await expect(page.getByTestId('history-row-2')).toHaveAttribute('data-current', 'true');

    // 点第 0 行：跳回初始状态（图层被撤销）
    await page.getByTestId('history-row-0').click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 0');
    await expect(page.getByTestId('history-row-0')).toHaveAttribute('data-current', 'true');

    // 跳回最后一行：重做两步
    await page.getByTestId('history-row-2').click();
    await expect(page.getByTestId('photo-stats')).toContainText('图层 1');

    // 清空历史：只剩当前状态一行
    await page.getByTestId('history-clear').click();
    await expect(list.locator('li')).toHaveCount(1);
  });
});

// 照片编辑器国际化（en-US）：界面语言切换后不得残留中文
test.describe('照片编辑器国际化（en-US）', () => {
  test.use({ locale: 'en-US' });

  test('英文界面无残留中文（含各标签页 / 弹窗 / 右键菜单）', async ({ page }) => {
    await page.goto('/tools/photo-editor');
    await expect(page.getByLabel('photo canvas')).toBeVisible();

    await expect(page.getByLabel('Canvas name')).toHaveAttribute('placeholder', 'Untitled canvas');

    // 空白图层 → 自动名应为英文
    await page.getByTestId('layer-menu-trigger').click();
    await page.getByRole('menuitem', { name: 'Blank layer' }).click();
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menuitem', { name: 'Text layer' }).click();
    await page.getByTestId('layer-menu-trigger').first().click();
    await page.getByRole('menuitem', { name: 'Shape layer' }).click();
    await expect(page.getByText('Layer 1').first()).toBeVisible();
    await expect(page.getByText('Text 1').first()).toBeVisible();
    await expect(page.getByText('Shape 1').first()).toBeVisible();

    // 混合模式下拉为英文
    const mix = page.getByLabel('Blend mode');
    await expect(mix.locator('option')).toContainText(['Normal', 'Multiply']);

    // 形状下拉为英文
    await page.getByRole('button', { name: 'Shape', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Rounded rectangle' })).toBeVisible();

    // 新建画布对话框：预设为中性文本，按钮为英文
    await page.getByRole('button', { name: 'New canvas' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Preset').locator('option').first()).toHaveText(
      '1280 × 720 · 16:9',
    );
    await page.getByRole('button', { name: 'Cancel' }).click();

    // 逐个标签页 / 菜单 / 弹窗扫描：不应出现 CJK
    const scan = () =>
      page.evaluate(() => {
        const main = document.querySelector('main') ?? document.body;
        const text = (main as HTMLElement).innerText;
        return text.split('\n').filter((line) => /[\u3400-\u9FFF\uF900-\uFAFF]/.test(line));
      });
    const found: string[] = [];
    for (const tab of ['Properties', 'Adjust', 'Filters', 'Layers']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await page.waitForTimeout(120);
      found.push(...(await scan()).map((line) => `${tab}: ${line}`));
    }
    await page.getByRole('button', { name: 'Export image' }).click();
    found.push(...(await scan()).map((line) => `export: ${line}`));
    await page.getByRole('button', { name: 'Cancel' }).click();

    const box = (await page.getByLabel('photo canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await expect(page.getByTestId('canvas-context-menu')).toBeVisible();
    found.push(...(await scan()).map((line) => `ctx: ${line}`));
    await page.keyboard.press('Escape');

    // 扫描工具区所有可见文本：不应出现 CJK
    const cjk = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const text = (main as HTMLElement).innerText;
      return text.split('\n').filter((line) => /[\u3400-\u9FFF\uF900-\uFAFF]/.test(line));
    });
    expect(found).toEqual([]);
    expect(cjk).toEqual([]);
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

// 办公工具「放映」：与幻灯片工具同一套入口（DocumentHeader afterNew）
test.describe('办公工具放映（zh-CN）', () => {
  test.use({ locale: 'zh-CN' });

  const overlay = (page: Page) => page.getByTestId('present-overlay');

  test('照片编辑器：放映合成位图并可 Esc 退出', async ({ page }) => {
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

  test('文字处理器：放映只读文档', async ({ page }) => {
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

  test('电子表格：放映只读表格', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/spreadsheet-editor');
    await page.getByTestId('sheet-present').click();
    await expect(overlay(page)).toBeVisible();
    // 空工作簿也要呈现表头 + 空表
    await expect(page.getByRole('table')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('流程图：放映画布截图', async ({ page }) => {
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

  test('脑图：放映画布截图', async ({ page }) => {
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

// 多页浏览：页签条翻页 + 缩略图总览（流程图 / 脑图）
test.describe('多页浏览（zh-CN）', () => {
  test.use({ locale: 'zh-CN' });

  test('流程图：总览 / 翻页 / 页码', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/tools/flowchart-editor');

    // 加一个节点，再加一页
    await page.getByRole('button', { name: '过程', exact: true }).click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
    await page.getByTestId('page-counter').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('page-counter')).toContainText('1');
    await page.getByRole('button', { name: '新建页面' }).click();
    await expect(page.getByTestId('page-counter')).toContainText('2');

    // 上一页 / 下一页
    await page.getByTestId('page-prev').click();
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();
    await page.getByTestId('page-next').click();
    await expect(page.getByText(/节点:\s*0/)).toBeVisible();

    // 总览：两页缩略图都在，第一页有内容
    await page.getByTestId('page-overview-open').click();
    const overview = page.getByTestId('page-overview');
    await expect(overview).toBeVisible();
    await expect(overview.getByTestId('page-thumb')).toHaveCount(1);
    // 第二页还没有内容 → 卡片上给出「空白页」提示
    await expect(overview.getByText('空白页')).toBeVisible();

    // 点第一页卡片跳转并关闭总览
    await page.getByTestId('page-card-select-0').click();
    await expect(overview).toHaveCount(0);
    await expect(page.getByText(/节点:\s*1/)).toBeVisible();

    // Ctrl+PageDown 翻页
    await page.keyboard.press('Control+PageDown');
    await expect(page.getByText(/节点:\s*0/)).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('脑图：总览 / 翻页 / 页码', async ({ page }) => {
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
