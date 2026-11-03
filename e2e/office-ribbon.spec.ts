import { expect, test, type Page } from '@playwright/test';

// The UI follows the browser locale; assertions rely on Simplified Chinese copy
test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });

/**
 * Office-style ribbon e2e.
 *
 * Proves the three things that only a browser can prove:
 * 1. Univer's built-in ribbon is really gone (not merely hidden) while the formula bar survives.
 * 2. The custom ribbon drives the grid: toggles reflect the selection format through the facade.
 * 3. The Office collapse behaviour works (tab strip only + flyout panel).
 */

async function openSheet(page: Page): Promise<void> {
  await page.goto('/tools/spreadsheet-editor');
  await expect(page.locator('.sheet-canvas')).toBeVisible();
  await expect(page.locator('canvas[id^="univer-sheet-main-canvas"]').first()).toBeVisible();
  // Give the grid a real selection (A1 is selected by default, but the facade only reports a range
  // once the render unit has received a pointer event)
  await page.locator('.sheet-canvas').click({ position: { x: 220, y: 160 } });
}

/** Toggle a command and read back its pressed state after the mutation round-trip */
async function expectToggle(page: Page, testId: string, pressed: 'true' | 'false'): Promise<void> {
  await expect(page.getByTestId(testId)).toHaveAttribute('aria-pressed', pressed);
}

test.describe('word processor ribbon', () => {
  test('six Office tabs replace the flat toolbar', async ({ page }) => {
    await page.goto('/tools/rich-text-editor');
    await expect(page.locator('.tiptap')).toBeVisible();

    await expect(page.getByTestId('word-ribbon')).toBeVisible();
    for (const tab of ['开始', '插入', '页面布局', '引用', '审阅', '视图']) {
      await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible();
    }
    // Group captions use the Office vocabulary
    await expect(page.getByText('字体', { exact: true })).toBeVisible();
    await expect(page.getByText('段落', { exact: true })).toBeVisible();
  });

  test('bold is a toggle that reflects the caret', async ({ page }) => {
    await page.goto('/tools/rich-text-editor');
    await page.locator('.tiptap').click();
    await page.keyboard.type('Ribbon');

    // Select the typed text: bolding with a collapsed caret only arms the mark for the next characters
    await page.keyboard.press('ControlOrMeta+a');
    const bold = page.getByTestId('ribbon-font-bold');
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.tiptap strong')).toHaveCount(1);
    await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
  });

  test('the view tab owns the ruler and the zoom level', async ({ page }) => {
    await page.goto('/tools/rich-text-editor');
    await expect(page.locator('.tiptap')).toBeVisible();

    await page.getByRole('tab', { name: '视图', exact: true }).click();
    const ruler = page.getByRole('button', { name: '标尺', exact: true });
    await expect(ruler).toHaveAttribute('aria-pressed', 'true');
    await ruler.click();
    await expect(page.getByTestId('rich-text-ruler')).toHaveCount(0);
  });

  test('selecting a shape opens the contextual 形状格式 tab, not a second toolbar', async ({
    page,
  }) => {
    await page.goto('/tools/rich-text-editor');
    await expect(page.locator('.tiptap')).toBeVisible();

    await page.getByRole('tab', { name: '插入', exact: true }).click();
    await page.getByRole('button', { name: '插入形状' }).click();
    await page
      .getByTestId('rich-text-shape-menu')
      .locator('[data-shape-preset="roundRect"]')
      .click();

    // Preset → drag on the page (the gallery only arms the draw layer)
    const surface = await page.locator('.tiptap').boundingBox();
    if (!surface) throw new Error('editor is not laid out');
    await page.mouse.move(surface.x + 120, surface.y + 120);
    await page.mouse.down();
    await page.mouse.move(surface.x + 320, surface.y + 240, { steps: 8 });
    await page.mouse.up();

    const shape = page.locator('.tiptap .rte-shape-node');
    await expect(shape).toHaveCount(1);
    // No leftover flat toolbar: shape formatting lives on the ribbon
    await expect(page.getByTestId('rich-text-shape-format-bar')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: '形状格式', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // The context tab drives the node attributes (fill lives in the colour item's swatch)
    await page.getByTestId('ribbon-shape-style-shape-fill').click();
    await page.getByRole('button', { name: '#C00000' }).click();
    await expect(shape).toHaveAttribute('data-shape-fill', '#c00000');

    // 更改形状 opens the same visual gallery as 插入 → 形状 (no preset codes in a text menu)
    await page.getByRole('button', { name: '更改形状', exact: true }).click();
    const gallery = page.getByTestId('rich-text-shape-change');
    await expect(gallery).toBeVisible();
    await gallery.locator('[data-shape-preset="ellipse"]').click();
    await expect(shape).toHaveAttribute('data-shape-prst', 'ellipse');
    await expect(gallery).toHaveCount(0);

    // Text is edited in place: double-click the shape, type, commit by clicking outside
    const box = await shape.boundingBox();
    if (!box) throw new Error('shape is not laid out');
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    const textEditor = page.getByTestId('rich-text-shape-text-editor');
    await expect(textEditor).toBeVisible();
    await page.keyboard.type('季度汇总');
    await page.locator('.tiptap p').first().click();
    await expect(textEditor).toHaveCount(0);
    await expect(shape).toHaveAttribute('data-shape-text', '季度汇总');

    // Leaving the shape drops the tab and returns to 开始
    await expect(page.getByRole('tab', { name: '形状格式', exact: true })).toHaveCount(0);
  });
});

test.describe('slide editor ribbon', () => {
  test('eight Office tabs and an insert tab that really inserts', async ({ page }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    await expect(page.getByTestId('slide-ribbon')).toBeVisible();
    for (const tab of ['开始', '插入', '绘图', '设计', '动画', '幻灯片放映', '审阅', '视图']) {
      await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible();
    }

    await page.getByRole('tab', { name: '插入', exact: true }).click();
    await page.getByRole('button', { name: '文本框' }).click();
    await expect(page.getByText('已选中 1 个元素')).toBeVisible();
  });

  test('formatting commands stay on the home tab and disable without a selection', async ({
    page,
  }) => {
    await page.goto('/tools/slide-editor');
    await expect(page.getByLabel('slide canvas')).toBeVisible();

    const bold = page.getByTestId('ribbon-font-bold');
    await expect(bold).toBeDisabled();

    await page.getByRole('tab', { name: '插入', exact: true }).click();
    await page.getByRole('button', { name: '文本框' }).click();
    await page.getByRole('tab', { name: '开始', exact: true }).click();
    await expect(bold).toBeEnabled();
    await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('spreadsheet ribbon', () => {
  test('replaces the built-in Univer toolbar but keeps the formula bar', async ({ page }) => {
    await openSheet(page);
    await expect(page.locator('[data-u-comp="ribbon-toolbar"]')).toHaveCount(0);
    await expect(page.getByTestId('sheet-ribbon')).toBeVisible();
    await expect(page.getByRole('tab', { name: '开始' })).toHaveAttribute('aria-selected', 'true');
    // Group captions are part of the Office language and are rendered under each group
    await expect(page.getByText('剪贴板', { exact: true })).toBeVisible();
    await expect(page.getByText('字体', { exact: true })).toBeVisible();
  });

  test('switches tabs and exposes the command groups of each tab', async ({ page }) => {
    await openSheet(page);
    await page.getByRole('tab', { name: '插入' }).click();
    await expect(page.getByTestId('ribbon-tables-pivotTable')).toBeVisible();

    await page.getByRole('tab', { name: '数据' }).click();
    await expect(page.getByTestId('ribbon-data-tools-dataValidation')).toBeVisible();

    await page.getByRole('tab', { name: '视图' }).click();
    await expect(page.getByTestId('ribbon-freeze-group-freeze')).toBeVisible();
  });

  test('drives cell formatting through the Univer facade', async ({ page }) => {
    await openSheet(page);
    // The default selection is A1; toggling bold must stick and be reported back to the ribbon
    await page.getByTestId('ribbon-font-bold').click();
    await expectToggle(page, 'ribbon-font-bold', 'true');

    await page.getByTestId('ribbon-font-italic').click();
    await expectToggle(page, 'ribbon-font-italic', 'true');

    // Clicking bold again clears it (mixed/off → on → off)
    await page.getByTestId('ribbon-font-bold').click();
    await expectToggle(page, 'ribbon-font-bold', 'false');

    // Alignment toggles are mutually exclusive
    await page.getByTestId('ribbon-align-alignCenter').click();
    await expectToggle(page, 'ribbon-align-alignCenter', 'true');
    await expectToggle(page, 'ribbon-align-alignLeft', 'false');
  });

  test('applies number formats and border presets', async ({ page }) => {
    await openSheet(page);
    // The number-format box is an Office-style combo: open it and pick by the formatted sample
    const numberFormat = page.getByTestId('ribbon-number-number-format').getByRole('combobox');
    await numberFormat.click();
    await page.getByRole('option', { name: /百分比/ }).click();
    await expect(numberFormat).toHaveText(/百分比/);
    await expect(page.getByRole('listbox')).toHaveCount(0);

    await page.getByRole('button', { name: '边框 ▾' }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: '所有框线' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('freezes panes, hides gridlines and keeps the toggles in sync', async ({ page }) => {
    await openSheet(page);
    await page.getByRole('tab', { name: '视图' }).click();

    await page.getByTestId('ribbon-freeze-group-toggleGridlines').click();
    await expectToggle(page, 'ribbon-freeze-group-toggleGridlines', 'false');
    await page.getByTestId('ribbon-freeze-group-toggleGridlines').click();
    await expectToggle(page, 'ribbon-freeze-group-toggleGridlines', 'true');

    await page.getByTestId('ribbon-freeze-group-freeze').click();
    await expectToggle(page, 'ribbon-freeze-group-freeze', 'true');
  });

  test('collapses to the tab strip and reopens a flyout panel', async ({ page }) => {
    await openSheet(page);
    await page.getByTestId('ribbon-collapse-toggle').click();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: '开始' })).toBeVisible();

    await page.getByRole('tab', { name: '开始' }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(page.getByTestId('ribbon-font-bold')).toBeVisible();

    // Running a command from the flyout closes it again
    await page.getByTestId('ribbon-font-bold').click();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);

    await page.getByTestId('ribbon-collapse-toggle').click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('keeps one ⋯ menu holding only the commands the ribbon does not have', async ({ page }) => {
    await openSheet(page);

    // One trigger, three dots, no per-menu buttons left over from the old menu bar
    await expect(page.getByTestId('menubar-more')).toBeVisible();
    await expect(page.getByTestId('menubar-file')).toHaveCount(0);
    await expect(page.getByTestId('menubar-edit')).toHaveCount(0);
    await expect(page.getByTestId('menubar-insert')).toHaveCount(0);

    await page.getByTestId('menubar-more').click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: '新建' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '导出 Excel (.xlsx)' })).toBeVisible();

    // …and the duplicates are gone: undo/redo, insert chart and print all live on the ribbon
    await expect(menu.getByRole('menuitem', { name: '撤销' })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: '插入图表' })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: '打印' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  });
});
