import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { TextColorPicker } from './TextColorPicker';

/**
 * Regression guard: in Tauri the native `<input type="color">` palette does not close after picking,
 * so text color uses "preset swatches + close on pick"; these tests lock that behavior down.
 */
describe('text color popover', () => {
  const trigger = () => screen.getByRole('button', { name: 'tools.richText.color' });
  const panel = () => screen.queryByTestId('rich-text-color-panel');

  const setup = () => {
    const onPick = vi.fn();
    const onReset = vi.fn();
    render(<TextColorPicker value="#111827" onPick={onPick} onReset={onReset} />);
    return { onPick, onReset };
  };

  it('starts collapsed and opens on button click', () => {
    setup();
    expect(panel()).toBeNull();
    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('applies a preset color immediately and closes', () => {
    const { onPick } = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: '#E11D48' }));
    expect(onPick).toHaveBeenCalledWith('#E11D48');
    expect(panel()).toBeNull();
  });

  it('closes on an outside click or Esc', () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.mouseDown(document.body);
    expect(panel()).toBeNull();

    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel()).toBeNull();
  });

  it('"Default color" clears the explicit color and closes', () => {
    const { onReset } = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'tools.richText.colorDefault' }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(panel()).toBeNull();
  });
});
