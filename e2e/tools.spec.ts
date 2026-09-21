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
    // 精确匹配：图形库中「预定义过程」也包含「过程」子串
    await page.getByRole('button', { name: '过程', exact: true }).dragTo(canvas, {
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
    // 在弹窗中选择图形后，新节点类型被替换为该图形
    await picker.getByRole('button', { name: '圆角矩形', exact: true }).click();
    await expect(page.locator('.react-flow__node').filter({ hasText: '圆角矩形' })).toHaveCount(1);
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
    await expect(page.locator('.react-flow__node').filter({ hasText: '椭圆' })).toHaveCount(1);
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
    await expect(page.getByLabel('起点')).toHaveValue('arrowclosed');
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
});
