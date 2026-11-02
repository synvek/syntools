import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RibbonTab } from './types';
import { Ribbon } from './Ribbon';

/**
 * Locks down the interaction contract of the shared ribbon: tab switching, two-level command
 * hierarchy, split buttons, disabled state, collapse + flyout and the colour picker.
 *
 * `ResizeObserver` is absent in jsdom — the components treat an unmeasurable container as "no
 * auto-collapse", which is exactly what these tests rely on.
 */
function makeTabs(onBold: () => void, onPaste: () => void): RibbonTab[] {
  return [
    {
      id: 'home',
      label: '开始',
      groups: [
        {
          id: 'clipboard',
          label: '剪贴板',
          onLauncher: onPaste,
          items: [
            {
              kind: 'split',
              id: 'paste',
              label: '粘贴',
              icon: 'copy',
              onSelect: onPaste,
              menu: [
                { id: 'paste-values', label: '粘贴数值', onSelect: onPaste },
                { id: 'paste-format', label: '粘贴格式', disabled: true, onSelect: onPaste },
              ],
            },
            { kind: 'button', id: 'cut', label: '剪切', size: 'small', onSelect: onPaste },
          ],
        },
        {
          id: 'font',
          label: '字体',
          items: [
            {
              kind: 'toggle',
              id: 'bold',
              label: '加粗',
              icon: 'bold',
              active: true,
              onSelect: onBold,
            },
            {
              kind: 'button',
              id: 'italic',
              label: '倾斜',
              icon: 'italic',
              disabled: true,
              onSelect: onBold,
            },
            {
              kind: 'color',
              id: 'fill',
              label: '填充颜色',
              icon: 'fillColor',
              value: '#ffffff',
              onPick: onBold,
              onReset: onBold,
              resetLabel: '无填充',
            },
            {
              kind: 'select',
              id: 'font-size',
              label: '字号',
              value: '11',
              width: 'xs',
              options: [
                { value: '11', label: '11' },
                { value: '12', label: '12' },
              ],
              onChange: onBold,
            },
          ],
        },
      ],
    },
    {
      id: 'insert',
      label: '插入',
      groups: [
        {
          id: 'illustrations',
          label: '插图',
          items: [{ kind: 'button', id: 'chart', label: '图表', onSelect: onBold }],
        },
      ],
    },
  ];
}

const renderRibbon = () => {
  const onBold = vi.fn();
  const onPaste = vi.fn();
  const onCollapsedChange = vi.fn();
  const utils = render(
    <Ribbon
      ariaLabel="功能区"
      tabs={makeTabs(onBold, onPaste)}
      accent="green"
      quickAccess={<span data-testid="qat">qat</span>}
      collapseLabel="折叠功能区"
      expandLabel="展开功能区"
      testId="test-ribbon"
      onCollapsedChange={onCollapsedChange}
    />,
  );
  return { onBold, onPaste, onCollapsedChange, ...utils };
};

describe('ribbon', () => {
  it('renders tabs, quick access and the first tab panel with group captions', () => {
    renderRibbon();
    expect(screen.getByRole('tablist', { name: '功能区' })).toBeTruthy();
    expect(screen.getByTestId('qat')).toBeTruthy();
    expect(screen.getByRole('tab', { name: '开始' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('剪贴板')).toBeTruthy();
    expect(screen.getByText('字体')).toBeTruthy();
  });

  it('switches tab content and marks the toggle state', () => {
    renderRibbon();
    fireEvent.click(screen.getByRole('tab', { name: '插入' }));
    expect(screen.getByText('插图')).toBeTruthy();
    expect(screen.queryByText('剪贴板')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '开始' }));
    const bold = screen.getByTestId('ribbon-font-bold');
    expect(bold.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(bold);
    expect(screen.getByTestId('ribbon-font-bold')).toBeTruthy();
  });

  it('runs the primary command of a split button and opens its menu from the arrow', () => {
    const { onPaste } = renderRibbon();
    fireEvent.click(screen.getByTestId('ribbon-clipboard-paste'));
    expect(onPaste).toHaveBeenCalledTimes(1);

    const arrow = screen.getByRole('button', { name: '粘贴 ▾' });
    fireEvent.click(arrow);
    expect(arrow.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: '粘贴数值' }));
    expect(onPaste).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes the menu on Esc and keeps disabled entries inert', () => {
    const { onPaste } = renderRibbon();
    fireEvent.click(screen.getByRole('button', { name: '粘贴 ▾' }));
    const disabledItem = screen.getByRole('menuitem', { name: '粘贴格式' });
    expect((disabledItem as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(disabledItem);
    expect(onPaste).toHaveBeenCalledTimes(0);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does not fire a disabled command', () => {
    const { onBold } = renderRibbon();
    fireEvent.click(screen.getByTestId('ribbon-font-italic'));
    expect(onBold).not.toHaveBeenCalled();
  });

  it('collapses to the tab strip, expands a flyout on tab click, and closes it after a command', () => {
    const { onCollapsedChange, onBold } = renderRibbon();
    fireEvent.click(screen.getByTestId('ribbon-collapse-toggle'));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId('ribbon-font-bold')).toBeNull();

    fireEvent.click(screen.getByTestId('ribbon-collapse-toggle'));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('ribbon-font-bold')).toBeTruthy();
    onBold.mockClear();
  });

  it('honours a controlled collapsed prop and shows a flyout panel', () => {
    const onBold = vi.fn();
    render(
      <Ribbon
        ariaLabel="功能区"
        tabs={makeTabs(onBold, vi.fn())}
        collapsed
        collapseLabel="折叠功能区"
        expandLabel="展开功能区"
        testId="test-ribbon"
      />,
    );
    expect(screen.queryByRole('tabpanel')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '开始' }));
    const panel = screen.getByRole('tabpanel');
    expect(panel).toBeTruthy();
    fireEvent.click(screen.getByTestId('ribbon-font-bold'));
    expect(onBold).toHaveBeenCalledTimes(1);
    // Running a command from the flyout collapses it again
    expect(screen.queryByRole('tabpanel')).toBeNull();
  });

  it('moves between tabs with the keyboard (roving tabindex)', () => {
    renderRibbon();
    const home = screen.getByRole('tab', { name: '开始' });
    expect(home.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: '插入' }).getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(home, { key: 'ArrowRight' });
    const insert = screen.getByRole('tab', { name: '插入' });
    expect(insert.getAttribute('aria-selected')).toBe('true');
    expect(insert.getAttribute('tabindex')).toBe('0');

    fireEvent.keyDown(insert, { key: 'Home' });
    expect(screen.getByRole('tab', { name: '开始' }).getAttribute('aria-selected')).toBe('true');
  });

  it('picks a colour swatch and closes the palette', () => {
    const { onBold } = renderRibbon();
    const trigger = screen.getByTestId('ribbon-font-fill');
    fireEvent.click(trigger);
    expect(screen.getByTestId('ribbon-font-fill-panel')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '#C00000' }));
    expect(onBold).toHaveBeenCalledWith('#C00000');
    expect(screen.queryByTestId('ribbon-font-fill-panel')).toBeNull();
  });

  it('opens a group settings surface from the dialog launcher', () => {
    const { onPaste } = renderRibbon();
    fireEvent.click(screen.getByRole('button', { name: '剪贴板 ▾' }));
    expect(onPaste).toHaveBeenCalledTimes(1);
  });
});
