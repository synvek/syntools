import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SheetTabs } from './SheetTabs';

afterEach(() => vi.restoreAllMocks());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** P2-7：标签栏右键"隐藏 / 取消隐藏"——隐藏表不消失，置灰留在原处，随时能找回来 */

const noop = () => {};

function renderTabs(
  sheets: { id: string; name: string; hidden: boolean }[],
  onToggleHidden = vi.fn(),
) {
  render(
    <SheetTabs
      sheets={sheets}
      activeId={sheets[0]?.id ?? null}
      onSelect={noop}
      onAdd={noop}
      onRename={noop}
      onDelete={noop}
      onDuplicate={noop}
      onToggleHidden={onToggleHidden}
    />,
  );
  return onToggleHidden;
}

function openMenu(name: string) {
  fireEvent.contextMenu(screen.getByRole('tab', { name: new RegExp(name) }));
}

describe('SheetTabs 隐藏工作表', () => {
  const sheets = [
    { id: 'a', name: 'Data', hidden: false },
    { id: 'b', name: 'Notes', hidden: false },
    { id: 'c', name: 'Archive', hidden: true },
  ];

  it('可见表给出"隐藏"，隐藏表给出"取消隐藏"', () => {
    renderTabs(sheets);

    openMenu('Notes');
    expect(screen.getByText('tools.sheet.hideSheet')).toBeTruthy();
    expect(screen.queryByText('tools.sheet.showSheet')).toBeNull();

    fireEvent.click(document.body);
    openMenu('Archive');
    expect(screen.getByText('tools.sheet.showSheet')).toBeTruthy();
    expect(screen.queryByText('tools.sheet.hideSheet')).toBeNull();
  });

  it('点击后把目标状态交回上层（隐藏 → true，取消隐藏 → false）', () => {
    const onToggleHidden = renderTabs(sheets);

    openMenu('Notes');
    fireEvent.click(screen.getByText('tools.sheet.hideSheet'));
    expect(onToggleHidden).toHaveBeenCalledWith('b', true);

    openMenu('Archive');
    fireEvent.click(screen.getByText('tools.sheet.showSheet'));
    expect(onToggleHidden).toHaveBeenCalledWith('c', false);
  });

  it('只剩一张可见表时禁用隐藏（Excel 不允许）', () => {
    renderTabs([
      { id: 'a', name: 'Data', hidden: false },
      { id: 'b', name: 'Archive', hidden: true },
    ]);
    openMenu('Data');
    const item = screen.getByText('tools.sheet.hideSheet').closest('button');
    expect(item?.disabled).toBe(true);
    expect(item?.getAttribute('title')).toBe('tools.sheet.lastVisibleSheet');
  });

  it('隐藏表仍在标签栏里（置灰可点），不会凭空消失', () => {
    renderTabs(sheets);
    const tab = screen.getByRole('tab', { name: /Archive/ });
    expect(tab.className).toContain('italic');
    expect(tab.getAttribute('title')).toBe('Archive (tools.sheet.hiddenSheet)');
  });
});
