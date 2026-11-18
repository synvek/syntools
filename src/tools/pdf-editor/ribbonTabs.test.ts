import { describe, expect, it, vi } from 'vitest';
import type { RibbonItem, RibbonTab } from '@/core/components/ribbon/types';
import { buildPdfRibbonTabs, parseZoomPercent } from './ribbonTabs';
import type { PdfRibbonActions, PdfRibbonContext } from './ribbonTabs';

/** Labels come back as key names without the `tools.pdfEditor.` prefix, which is easy to assert */
const t = (key: string) => key.replace('tools.pdfEditor.', '');

function makeActions(overrides: Partial<PdfRibbonActions> = {}): PdfRibbonActions {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    setTool: vi.fn(),
    setZoom: vi.fn(),
    fit: vi.fn(),
    goToPage: vi.fn(),
    prevPage: vi.fn(),
    nextPage: vi.fn(),
    setViewMode: vi.fn(),
    togglePanel: vi.fn(),
    toggleDarkCanvas: vi.fn(),
    ...overrides,
  };
}

function makeCtx(overrides: Partial<PdfRibbonContext> = {}): PdfRibbonContext {
  return {
    t,
    hasDoc: true,
    view: { mode: 'continuous', zoom: 1, zoomMode: 'fit-width', page: 1, pageCount: 3 },
    history: { canUndo: false, canRedo: false },
    panels: { thumbnails: false, outline: false, properties: false },
    panelsAvailable: true,
    darkCanvas: false,
    tool: 'select',
    actions: makeActions(),
    ...overrides,
  };
}

function allItems(tabs: RibbonTab[]): RibbonItem[] {
  return tabs.flatMap((tab) =>
    tab.groups.flatMap((group) => (group.rows ? group.rows.flat() : group.items)),
  );
}

function findItem(tabs: RibbonTab[], groupId: string, itemId: string): RibbonItem {
  const group = tabs.flatMap((tab) => tab.groups).find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(`missing group ${groupId}`);
  const item = (group.rows ? group.rows.flat() : group.items).find(
    (candidate) => candidate.id === itemId,
  );
  if (!item) throw new Error(`missing item ${groupId}/${itemId}`);
  return item;
}

function fire(tabs: RibbonTab[], groupId: string, itemId: string): void {
  const item = findItem(tabs, groupId, itemId);
  if (item.kind === 'button' || item.kind === 'toggle') {
    item.onSelect();
    return;
  }
  throw new Error(`${groupId}/${itemId} is not a click command`);
}

describe('buildPdfRibbonTabs — 结构', () => {
  const tabs = buildPdfRibbonTabs(makeCtx());

  it('M0 只暴露 开始 / 视图 两个标签', () => {
    expect(tabs.map((tab) => tab.id)).toEqual(['home', 'view']);
    expect(tabs.map((tab) => tab.label)).toEqual(['tabHome', 'tabView']);
  });

  it('标签、分组、命令的 id 都唯一', () => {
    expect(new Set(tabs.map((tab) => tab.id)).size).toBe(tabs.length);

    const groupIds = tabs.flatMap((tab) => tab.groups.map((group) => group.id));
    expect(new Set(groupIds).size).toBe(groupIds.length);

    const itemIds = allItems(tabs).map((item) => item.id);
    expect(new Set(itemIds).size).toBe(itemIds.length);
  });

  it('每个分组和命令都有非空文案', () => {
    for (const tab of tabs) {
      expect(tab.label.length).toBeGreaterThan(0);
      for (const group of tab.groups) {
        expect(group.label.length).toBeGreaterThan(0);
        const items = group.rows ? group.rows.flat() : group.items;
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) expect(item.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('分组顺序符合 Office 习惯（历史/选择/缩放/导航）', () => {
    expect(tabs[0].groups.map((group) => group.id)).toEqual([
      'history',
      'select',
      'zoom',
      'navigate',
    ]);
    expect(tabs[1].groups.map((group) => group.id)).toEqual(['view-mode', 'panels', 'display']);
  });

  it('面板尚未实现时不注册面板分组（避免空按钮）', () => {
    const tabs = buildPdfRibbonTabs(makeCtx({ panelsAvailable: false }));
    expect(tabs[1].groups.map((group) => group.id)).toEqual(['view-mode', 'display']);
    expect(allItems(tabs).some((item) => item.id === 'thumbnails')).toBe(false);
  });
});

describe('buildPdfRibbonTabs — 禁用与提示', () => {
  it('没有文档时全部命令禁用并给出原因', () => {
    const tabs = buildPdfRibbonTabs(makeCtx({ hasDoc: false }));
    for (const item of allItems(tabs)) {
      expect(item.disabled).toBe(true);
      expect(item.hint).toBe('openFirstHint');
    }
  });

  it('有文档时按撤销栈状态禁用撤销/重做', () => {
    const tabs = buildPdfRibbonTabs(makeCtx({ history: { canUndo: false, canRedo: true } }));
    expect(findItem(tabs, 'history', 'undo').disabled).toBe(true);
    expect(findItem(tabs, 'history', 'redo').disabled).toBe(false);
    expect(findItem(tabs, 'history', 'undo').hint).toBeUndefined();
  });

  it('首页禁用上一页，末页禁用下一页', () => {
    const first = buildPdfRibbonTabs(makeCtx());
    expect(findItem(first, 'navigate', 'prev').disabled).toBe(true);
    expect(findItem(first, 'navigate', 'next').disabled).toBe(false);

    const last = buildPdfRibbonTabs(
      makeCtx({
        view: { mode: 'continuous', zoom: 1, zoomMode: 'fit-width', page: 3, pageCount: 3 },
      }),
    );
    expect(findItem(last, 'navigate', 'prev').disabled).toBe(false);
    expect(findItem(last, 'navigate', 'next').disabled).toBe(true);
  });

  it('当前工具与面板状态反映在 toggle 上', () => {
    const tabs = buildPdfRibbonTabs(
      makeCtx({
        tool: 'hand',
        panels: { thumbnails: true, outline: false, properties: true },
        darkCanvas: true,
      }),
    );

    expect(findItem(tabs, 'select', 'select').kind === 'toggle').toBe(true);
    const select = findItem(tabs, 'select', 'select');
    const hand = findItem(tabs, 'select', 'hand');
    expect(select.kind === 'toggle' && select.active).toBe(false);
    expect(hand.kind === 'toggle' && hand.active).toBe(true);

    expect(findItem(tabs, 'panels', 'thumbnails').kind === 'toggle').toBe(true);
    const thumbnails = findItem(tabs, 'panels', 'thumbnails');
    const outline = findItem(tabs, 'panels', 'outline');
    expect(thumbnails.kind === 'toggle' && thumbnails.active).toBe(true);
    expect(outline.kind === 'toggle' && outline.active).toBe(false);

    const dark = findItem(tabs, 'display', 'dark-canvas');
    expect(dark.kind === 'toggle' && dark.active).toBe(true);
  });
});

describe('buildPdfRibbonTabs — 数值控件', () => {
  it('缩放显示当前百分比并提供 50%–400% 预设', () => {
    const tabs = buildPdfRibbonTabs(
      makeCtx({
        view: { mode: 'continuous', zoom: 1.5, zoomMode: 'custom', page: 1, pageCount: 3 },
      }),
    );
    const zoom = findItem(tabs, 'zoom', 'zoom');
    if (zoom.kind !== 'select') throw new Error('zoom must be a select');

    expect(zoom.value).toBe('150%');
    expect(zoom.editable).toBe(true);
    expect(zoom.options.map((option) => option.value)).toEqual([
      '50%',
      '75%',
      '100%',
      '125%',
      '150%',
      '200%',
      '300%',
      '400%',
    ]);
  });

  it('页码下拉覆盖全部可见页', () => {
    const tabs = buildPdfRibbonTabs(makeCtx());
    const page = findItem(tabs, 'navigate', 'page');
    if (page.kind !== 'select') throw new Error('page must be a select');

    expect(page.value).toBe('1');
    expect(page.options.map((option) => option.value)).toEqual(['1', '2', '3']);
  });

  it('无文档时不生成负页码选项', () => {
    const tabs = buildPdfRibbonTabs(
      makeCtx({ hasDoc: false, view: { ...makeCtx().view, pageCount: 0 } }),
    );
    const page = findItem(tabs, 'navigate', 'page');
    if (page.kind !== 'select') throw new Error('page must be a select');
    expect(page.options).toEqual([]);
  });

  it('视图模式选项使用单页/连续文案', () => {
    const tabs = buildPdfRibbonTabs(makeCtx());
    const mode = findItem(tabs, 'view-mode', 'mode');
    if (mode.kind !== 'select') throw new Error('mode must be a select');

    expect(mode.value).toBe('continuous');
    expect(mode.options).toEqual([
      { value: 'single', label: 'viewSingle' },
      { value: 'continuous', label: 'viewContinuous' },
    ]);
  });

  it('parseZoomPercent 容错', () => {
    expect(parseZoomPercent('150%')).toBe(1.5);
    expect(parseZoomPercent(' 120 % ')).toBe(1.2);
    expect(parseZoomPercent('80')).toBe(0.8);
    expect(parseZoomPercent('abc')).toBeNull();
    expect(parseZoomPercent('0%')).toBeNull();
    expect(parseZoomPercent('-50%')).toBeNull();
  });
});

describe('buildPdfRibbonTabs — 命令接线', () => {
  it('按钮与 toggle 调用对应 action', () => {
    const actions = makeActions();
    const tabs = buildPdfRibbonTabs(makeCtx({ actions }));

    fire(tabs, 'history', 'undo');
    fire(tabs, 'history', 'redo');
    fire(tabs, 'select', 'select');
    fire(tabs, 'select', 'hand');
    fire(tabs, 'navigate', 'prev');
    fire(tabs, 'navigate', 'next');
    fire(tabs, 'zoom', 'fit-width');
    fire(tabs, 'zoom', 'fit-page');
    fire(tabs, 'panels', 'thumbnails');
    fire(tabs, 'panels', 'outline');
    fire(tabs, 'panels', 'properties');
    fire(tabs, 'display', 'dark-canvas');

    expect(actions.undo).toHaveBeenCalledTimes(1);
    expect(actions.redo).toHaveBeenCalledTimes(1);
    expect(actions.setTool).toHaveBeenCalledWith('select');
    expect(actions.setTool).toHaveBeenCalledWith('hand');
    expect(actions.prevPage).toHaveBeenCalledTimes(1);
    expect(actions.nextPage).toHaveBeenCalledTimes(1);
    expect(actions.fit).toHaveBeenCalledWith('fit-width');
    expect(actions.fit).toHaveBeenCalledWith('fit-page');
    expect(actions.togglePanel).toHaveBeenCalledWith('thumbnails');
    expect(actions.togglePanel).toHaveBeenCalledWith('outline');
    expect(actions.togglePanel).toHaveBeenCalledWith('properties');
    expect(actions.toggleDarkCanvas).toHaveBeenCalledTimes(1);
  });

  it('下拉框把输入解析成模型值', () => {
    const actions = makeActions();
    const tabs = buildPdfRibbonTabs(makeCtx({ actions }));

    const zoom = findItem(tabs, 'zoom', 'zoom');
    if (zoom.kind !== 'select') throw new Error('zoom must be a select');
    zoom.onChange('200%');
    zoom.onChange('not-a-number');
    expect(actions.setZoom).toHaveBeenCalledTimes(1);
    expect(actions.setZoom).toHaveBeenCalledWith(2);

    const page = findItem(tabs, 'navigate', 'page');
    if (page.kind !== 'select') throw new Error('page must be a select');
    page.onChange('3');
    expect(actions.goToPage).toHaveBeenCalledWith(3);

    const mode = findItem(tabs, 'view-mode', 'mode');
    if (mode.kind !== 'select') throw new Error('mode must be a select');
    mode.onChange('single');
    expect(actions.setViewMode).toHaveBeenCalledWith('single');
  });
});
