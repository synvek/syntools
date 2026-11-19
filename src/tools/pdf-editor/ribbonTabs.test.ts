import { describe, expect, it, vi } from 'vitest';
import type { RibbonItem, RibbonTab } from '@/core/components/ribbon/types';
import {
  buildPdfRibbonTabs,
  nextActiveTab,
  parseZoomPercent,
  resolveContextTab,
} from './ribbonTabs';
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
    setAnnotateColor: vi.fn(),
    setAnnotateWidth: vi.fn(),
    deleteSelection: vi.fn(),
    clearAnnotations: vi.fn(),
    setObjectColor: vi.fn(),
    setObjectWidth: vi.fn(),
    setObjectFit: vi.fn(),
    setObjectOpacity: vi.fn(),
    setObjectFontSize: vi.fn(),
    toggleObjectBold: vi.fn(),
    toggleObjectItalic: vi.fn(),
    setObjectAlign: vi.fn(),
    setObjectZ: vi.fn(),
    toggleObjectLock: vi.fn(),
    insertImage: vi.fn(),
    openSignature: vi.fn(),
    openStamp: vi.fn(),
    copySelection: vi.fn(),
    cutSelection: vi.fn(),
    pasteSelection: vi.fn(),
    alignObjects: vi.fn(),
    distributeObjects: vi.fn(),
    toggleFormatPainter: vi.fn(),
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

  it('只暴露 开始 / 视图 两个标签', () => {
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

  it('注释 / 编辑 / 注释格式 / 文本框格式并入开始，翻页移入视图', () => {
    expect(tabs[0].groups.map((group) => group.id)).toEqual([
      'select',
      'zoom',
      'markup',
      'shapes',
      'ink',
      'insert',
      'format',
      'manage',
      'ann-format',
      'arrange',
      'text-style',
      'text-align',
      'text-color',
      'clipboard',
      'object-align',
      'object-distribute',
      'format-painter',
      'export',
    ]);
    expect(tabs[1].groups.map((group) => group.id)).toEqual([
      'view-mode',
      'navigate',
      'panels',
      'display',
    ]);
  });

  it('面板尚未实现时不注册面板分组（避免空按钮）', () => {
    const tabs = buildPdfRibbonTabs(makeCtx({ panelsAvailable: false }));
    expect(tabs[1].groups.map((group) => group.id)).toEqual(['view-mode', 'navigate', 'display']);
    expect(allItems(tabs).some((item) => item.id === 'thumbnails')).toBe(false);
  });
});

describe('buildPdfRibbonTabs — 禁用与提示', () => {
  it('没有文档时全部命令禁用并给出原因', () => {
    const tabs = buildPdfRibbonTabs(makeCtx({ hasDoc: false }));
    for (const item of allItems(tabs)) {
      expect(item.disabled).toBe(true);
      expect(item.hint).toBeTruthy();
    }

    // 基础命令统一提示"先打开文件"；注释颜色/线宽并入开始后，仍要先选注释工具
    const base = tabs
      .flatMap((tab) => tab.groups)
      .filter((group) => ['select', 'zoom', 'navigate', 'export'].includes(group.id))
      .flatMap((group) => group.items);
    for (const item of base) expect(item.hint).toBe('openFirstHint');
    expect(findItem(tabs, 'format', 'annotate-color').hint).toBe('hintPickTool');
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

describe('buildPdfRibbonTabs — 注释命令（已并入开始）', () => {
  const style = {
    markupColor: '#fde047',
    inkColor: '#e11d48',
    inkWidth: 2,
    shapeStroke: '#0ea5e9',
    shapeWidth: 2,
    opacity: 1,
  };

  const withAnnotate = (overrides: Partial<PdfRibbonContext> = {}) =>
    buildPdfRibbonTabs(
      makeCtx({ annotate: { style, selectionCount: 0, objectCount: 0 }, ...overrides }),
    );

  const isActive = (tabs: RibbonTab[], groupId: string, itemId: string): boolean => {
    const item = findItem(tabs, groupId, itemId);
    if (item.kind !== 'toggle') throw new Error(`${itemId} must be a toggle`);
    return item.active === true;
  };

  it('工具 toggle 跟随当前工具，点击切换工具', () => {
    const actions = makeActions();
    const tabs = withAnnotate({ tool: 'highlight', actions });

    expect(isActive(tabs, 'markup', 'highlight')).toBe(true);
    expect(isActive(tabs, 'markup', 'underline')).toBe(false);
    expect(isActive(tabs, 'ink', 'ink')).toBe(false);

    fire(tabs, 'shapes', 'rect');
    fire(tabs, 'ink', 'eraser');
    expect(actions.setTool).toHaveBeenCalledWith('rect');
    expect(actions.setTool).toHaveBeenCalledWith('eraser');
  });

  it('颜色与线宽只对拥有该属性的工具可用', () => {
    const actions = makeActions();
    const tabs = withAnnotate({ tool: 'ink', actions });

    const color = findItem(tabs, 'format', 'annotate-color');
    if (color.kind !== 'color') throw new Error('color item expected');
    expect(color.disabled).toBe(false);
    expect(color.value).toBe('#e11d48');
    color.onPick('#000000');
    expect(actions.setAnnotateColor).toHaveBeenCalledWith('#000000');

    const width = findItem(tabs, 'format', 'annotate-width');
    if (width.kind !== 'select') throw new Error('width item expected');
    expect(width.disabled).toBe(false);
    width.onChange('4');
    expect(actions.setAnnotateWidth).toHaveBeenCalledWith(4);

    // 选择工具没有颜色可改：禁用并提示先选工具
    const idle = withAnnotate({ tool: 'select' });
    const idleColor = findItem(idle, 'format', 'annotate-color');
    expect(idleColor.disabled).toBe(true);
    expect(idleColor.hint).toBe('hintPickTool');
    expect(findItem(idle, 'format', 'annotate-width').disabled).toBe(true);
  });

  it('形状工具读的是描边颜色', () => {
    const tabs = withAnnotate({ tool: 'arrow' });
    const color = findItem(tabs, 'format', 'annotate-color');
    if (color.kind !== 'color') throw new Error('color item expected');
    expect(color.value).toBe('#0ea5e9');
  });

  it('管理分组按选中数与对象数禁用', () => {
    const actions = makeActions();
    const empty = withAnnotate({ actions });
    expect(findItem(empty, 'manage', 'delete-selection').disabled).toBe(true);
    expect(findItem(empty, 'manage', 'clear-annotations').disabled).toBe(true);

    const filled = withAnnotate({
      actions,
      annotate: { style, selectionCount: 2, objectCount: 5 },
    });
    fire(filled, 'manage', 'delete-selection');
    fire(filled, 'manage', 'clear-annotations');
    expect(actions.deleteSelection).toHaveBeenCalledTimes(1);
    expect(actions.clearAnnotations).toHaveBeenCalledTimes(1);
  });
});

describe('buildPdfRibbonTabs — 上下文标签', () => {
  const textSelection = {
    kind: 'text' as const,
    opacity: 0.8,
    locked: false,
    color: '#111111',
    fontSize: 12,
    bold: false,
    italic: true,
    align: 'left' as const,
  };

  it('按对象类型解析上下文标签', () => {
    expect(resolveContextTab(null)).toBeNull();
    expect(resolveContextTab({ kind: 'image', opacity: 1, locked: false })).toBe('image-format');
    expect(resolveContextTab({ kind: 'stamp', opacity: 1, locked: false })).toBe('image-format');
    // 文本框与注释对象的格式控件都常驻开始，不再弹标签
    expect(resolveContextTab(textSelection)).toBeNull();
    expect(resolveContextTab({ kind: 'markup', opacity: 1, locked: false })).toBeNull();
    expect(resolveContextTab({ kind: 'note', opacity: 1, locked: false })).toBeNull();
    expect(resolveContextTab({ kind: 'ink', opacity: 1, locked: false })).toBeNull();
  });

  it('只有图片对象打开上下文标签，取消选择回到来源标签', () => {
    const withImage = buildPdfRibbonTabs(
      makeCtx({ selection: { kind: 'image', opacity: 1, locked: false } }),
    );
    expect(withImage.map((tab) => tab.id)).toEqual(['home', 'view', 'image-format']);

    // 选中文本框不再切标签：格式控件就在开始里
    const withText = buildPdfRibbonTabs(makeCtx({ selection: textSelection }));
    expect(withText.map((tab) => tab.id)).toEqual(['home', 'view']);

    const cleared = buildPdfRibbonTabs(makeCtx({ selection: null }));
    expect(cleared.map((tab) => tab.id)).toEqual(['home', 'view']);

    expect(nextActiveTab('home', 'image-format', 'home')).toBe('image-format');
    expect(nextActiveTab('image-format', null, 'home')).toBe('home');
    expect(nextActiveTab('home', null, 'home')).toBe('home');
  });

  it('文本框格式并入开始后接线字号/粗体/对齐/颜色', () => {
    const actions = makeActions();
    const tabs = buildPdfRibbonTabs(makeCtx({ actions, selection: textSelection }));

    const size = findItem(tabs, 'text-style', 'font-size');
    if (size.kind !== 'select') throw new Error('font size must be a select');
    expect(size.value).toBe('12');
    expect(size.disabled).toBe(false);
    size.onChange('18');
    expect(actions.setObjectFontSize).toHaveBeenCalledWith(18);

    // 没选中文本框时这些命令常驻但禁用（原来的问题是"整个标签都不出现"）
    const idle = buildPdfRibbonTabs(makeCtx({ selection: null }));
    expect(findItem(idle, 'text-style', 'font-size').disabled).toBe(true);
    expect(findItem(idle, 'text-align', 'align-center').disabled).toBe(true);
    expect(findItem(idle, 'text-color', 'text-color').disabled).toBe(true);

    fire(tabs, 'text-style', 'bold');
    fire(tabs, 'text-style', 'italic');
    fire(tabs, 'text-align', 'align-center');
    expect(actions.toggleObjectBold).toHaveBeenCalledTimes(1);
    expect(actions.toggleObjectItalic).toHaveBeenCalledTimes(1);
    expect(actions.setObjectAlign).toHaveBeenCalledWith('center');

    const color = findItem(tabs, 'text-color', 'text-color');
    if (color.kind !== 'color') throw new Error('color item expected');
    expect(color.value).toBe('#111111');
    color.onPick('#ff0000');
    expect(actions.setObjectColor).toHaveBeenCalledWith('#ff0000');

    // 透明度是所有对象共用的命令，现在常驻开始标签
    const opacity = findItem(tabs, 'ann-format', 'opacity');
    if (opacity.kind !== 'select') throw new Error('opacity must be a select');
    opacity.onChange('50');
    expect(actions.setObjectOpacity).toHaveBeenCalledWith(0.5);
  });

  it('锁定对象禁用编辑，但保留解锁与删除', () => {
    const actions = makeActions();
    const tabs = buildPdfRibbonTabs(
      makeCtx({
        actions,
        selection: { kind: 'image', opacity: 1, locked: true, fit: 'contain' },
      }),
    );

    const fit = findItem(tabs, 'image-fit', 'fit');
    if (fit.kind !== 'select') throw new Error('fit must be a select');
    expect(fit.disabled).toBe(true);

    const lock = findItem(tabs, 'arrange', 'lock');
    expect(lock.disabled).toBe(false);
    expect(lock.kind === 'toggle' && lock.active).toBe(true);
    fire(tabs, 'arrange', 'lock');
    expect(actions.toggleObjectLock).toHaveBeenCalledTimes(1);

    fire(tabs, 'arrange', 'delete');
    expect(actions.deleteSelection).toHaveBeenCalledTimes(1);
  });

  it('排列菜单提供四向层级命令', () => {
    const actions = makeActions();
    const tabs = buildPdfRibbonTabs(
      makeCtx({
        actions,
        selection: { kind: 'markup', opacity: 1, locked: false, color: '#fde047' },
      }),
    );

    const menu = findItem(tabs, 'arrange', 'z-order');
    if (menu.kind !== 'menu') throw new Error('z-order must be a menu');
    expect(menu.menu.map((entry) => entry.id)).toEqual(['front', 'forward', 'backward', 'back']);
    menu.menu[0].onSelect();
    menu.menu[3].onSelect();
    expect(actions.setObjectZ).toHaveBeenCalledWith('front');
    expect(actions.setObjectZ).toHaveBeenCalledWith('back');
  });

  it('标记对象可以改色但没有线宽', () => {
    const tabs = buildPdfRibbonTabs(
      makeCtx({ selection: { kind: 'markup', opacity: 1, locked: false, color: '#fde047' } }),
    );
    const color = findItem(tabs, 'ann-format', 'ann-color');
    expect(color.disabled).toBe(false);
    const width = findItem(tabs, 'ann-format', 'ann-width');
    expect(width.disabled).toBe(true);
  });
});

describe('M3 插入与编辑命令（已并入开始）', () => {
  it('注释插入组提供修补、图片、签名、图章四个入口', () => {
    const tabs = buildPdfRibbonTabs(makeCtx());
    const insert = tabs.flatMap((tab) => tab.groups).find((group) => group.id === 'insert');
    expect(insert?.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(['image', 'signature', 'stamp', 'patch']),
    );
    expect(findItem(tabs, 'insert', 'patch')).toMatchObject({ kind: 'toggle', active: false });
  });

  it('剪贴板按选区数量启用', () => {
    const empty = buildPdfRibbonTabs(makeCtx());
    expect(findItem(empty, 'clipboard', 'copy').disabled).toBe(true);
    expect(findItem(empty, 'clipboard', 'paste').disabled).toBe(true);

    const withSelection = buildPdfRibbonTabs(
      makeCtx({ edit: { selectionCount: 2, clipboard: 1, painter: false } }),
    );
    expect(findItem(withSelection, 'clipboard', 'copy').disabled).toBe(false);
    expect(findItem(withSelection, 'clipboard', 'paste').disabled).toBe(false);
  });

  it('对齐需要两个对象、分布需要三个，命令参数正确', () => {
    const actions = makeActions();
    const two = buildPdfRibbonTabs(
      makeCtx({ actions, edit: { selectionCount: 2, clipboard: 0, painter: false } }),
    );
    expect(findItem(two, 'object-align', 'align-object-middle').disabled).toBe(false);
    expect(findItem(two, 'object-distribute', 'distribute-h').disabled).toBe(true);
    fire(two, 'object-align', 'align-object-left');
    expect(actions.alignObjects).toHaveBeenCalledWith('left');

    const three = buildPdfRibbonTabs(
      makeCtx({ actions, edit: { selectionCount: 3, clipboard: 0, painter: false } }),
    );
    expect(findItem(three, 'object-distribute', 'distribute-v').disabled).toBe(false);
    fire(three, 'object-distribute', 'distribute-v');
    expect(actions.distributeObjects).toHaveBeenCalledWith('vertical');
  });

  it('格式刷显示已取格式状态', () => {
    const actions = makeActions();
    const tabs = buildPdfRibbonTabs(
      makeCtx({ actions, edit: { selectionCount: 1, clipboard: 0, painter: true } }),
    );
    const painter = findItem(tabs, 'format-painter', 'format-painter');
    expect(painter).toMatchObject({ kind: 'toggle', active: true, label: 'painterArmed' });
    fire(tabs, 'format-painter', 'format-painter');
    expect(actions.toggleFormatPainter).toHaveBeenCalled();
  });
});
