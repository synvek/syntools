import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { TextColorPicker } from './TextColorPicker';

/**
 * 回归点：Tauri 里原生 `<input type="color">` 的系统色板选完不会自动关闭，
 * 因此文字颜色改为「预设色板 + 选完即收」，这里锁住收起行为。
 */
describe('文字颜色弹层', () => {
  const trigger = () => screen.getByRole('button', { name: 'tools.richText.color' });
  const panel = () => screen.queryByTestId('rich-text-color-panel');

  const setup = () => {
    const onPick = vi.fn();
    const onReset = vi.fn();
    render(<TextColorPicker value="#111827" onPick={onPick} onReset={onReset} />);
    return { onPick, onReset };
  };

  it('默认收起，点击按钮后展开', () => {
    setup();
    expect(panel()).toBeNull();
    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('选中预设色后立即应用并自动收起', () => {
    const { onPick } = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: '#E11D48' }));
    expect(onPick).toHaveBeenCalledWith('#E11D48');
    expect(panel()).toBeNull();
  });

  it('点击面板外部或按 Esc 收起', () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.mouseDown(document.body);
    expect(panel()).toBeNull();

    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel()).toBeNull();
  });

  it('「默认颜色」清除显式文字色并收起', () => {
    const { onReset } = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.colorDefault' }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(panel()).toBeNull();
  });
});
