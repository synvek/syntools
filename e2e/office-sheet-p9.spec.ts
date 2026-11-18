import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * P2-9：ARIA 网格投影的**全页**验证。
 *
 * 两条原则写在这里，因为它们比测试本身更重要：
 *
 * 1. **只豁免引擎，不豁免自己**。整页扫描会命中 Univer 自己的节点（popover trigger 上挂
 *    `aria-expanded`、图标按钮没有名字、名称框没有 label）。那三条进豁免清单，并且每条都带
 *    **到期条件**；本项目的节点一律修——侧栏 / 搜索框的 `text-gray-400` 与 `opacity-70`
 *    就是把小字压到 1.84:1 的元凶，P0-4 的注释里写着"留给后续"，这次直接改掉。
 * 2. **豁免清单必须有到期条件**，否则它会变成永久遮羞布（方案 §8.2 的原话）。
 */
const UNIVER_ALLOWANCE = [
  {
    id: 'aria-allowed-attr',
    target: '.univer-right-0',
    reason: 'Univer 在 <a> 上挂 aria-expanded（popover trigger）',
    expires: '引擎升级，或 P2-11 的内部 API 封装把该 trigger 换成我们自绘的按钮',
  },
  {
    id: 'button-name',
    target: '.univer-size-4',
    reason: 'Univer 工具栏图标按钮没有可访问名字',
    expires: '引擎升级；无法升级时由我们遍历注入 aria-label（需要 P2-11 的注入器）',
  },
  {
    id: 'label',
    target: '.univer-pl-1\\.5',
    reason: 'Univer 名称框 <input> 没有 label',
    expires: '同上',
  },
] as const;

test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

test.describe('P2-9 无障碍', () => {
  test('整页 axe：0 critical / 0 serious（引擎违规按清单豁免）', async ({ page }) => {
    await page.goto('/tools/spreadsheet-editor');
    await expect(page.getByTestId('sheet-a11y-grid')).toHaveCount(1);
    // 让引擎把首屏渲染完（浮层 / 工具栏都会在引导后才出现）
    await page.waitForTimeout(2000);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );

    const remaining = blocking
      .flatMap((violation) =>
        violation.nodes.map((node) => ({
          id: violation.id,
          impact: violation.impact,
          target: node.target.join(' '),
          html: node.html.slice(0, 120),
        })),
      )
      .filter(
        (hit) =>
          !UNIVER_ALLOWANCE.some(
            (allow) => allow.id === hit.id && hit.target.includes(allow.target),
          ),
      );

    expect(
      remaining,
      '出现新的 critical/serious 违规：要么修掉，要么在 UNIVER_ALLOWANCE 里写明理由与到期条件',
    ).toEqual([]);
  });

  test('网格可聚焦，且 aria-activedescendant 指向投影网格里的活动格', async ({ page }) => {
    await page.goto('/tools/spreadsheet-editor');
    const canvas = page.locator('.sheet-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('role', 'application');
    // 投影网格是画布的兄弟节点，靠 aria-owns 挂成合法后代
    await expect(canvas).toHaveAttribute('aria-owns', 'sheet-a11y-grid');

    // 点进画布 → 键盘必须留在表格区域内（Tab 在引擎内移动单元格，这是表格的通行语义）
    await canvas.click();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);

    const focusInSheet = await page.evaluate(
      () =>
        document.activeElement !== null && document.activeElement.closest('.sheet-canvas') !== null,
    );
    expect(focusInSheet, '点击后焦点应留在表格区域内，而不是掉回 body').toBe(true);

    // 投影层跟上了选区：恰好一个 aria-selected 的格子，且画布的 activedescendant 指向它
    const selected = page.locator('#sheet-a11y-grid [role="gridcell"][aria-selected="true"]');
    await expect(selected).toHaveCount(1);
    const activeId = await canvas.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    await expect(page.locator(`#${activeId}`)).toHaveCount(1);
  });
});
