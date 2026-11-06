import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { hasOverlay, overlayDepth, useOverlayStack } from './useOverlayStack';

function Layer({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  useOverlayStack(open, onDismiss);
  return null;
}

describe('useOverlayStack (P0-4.1)', () => {
  it('tracks registered layers and cleans up on unmount', () => {
    expect(hasOverlay()).toBe(false);
    const { unmount } = render(<Layer open onDismiss={() => {}} />);
    expect(overlayDepth()).toBe(1);
    expect(hasOverlay()).toBe(true);
    unmount();
    expect(overlayDepth()).toBe(0);
    expect(hasOverlay()).toBe(false);
  });

  it('one Escape dismisses only the topmost layer, then the next one', () => {
    const bottom = vi.fn();
    const top = vi.fn();
    const { rerender } = render(
      <>
        <Layer open onDismiss={bottom} />
        <Layer open onDismiss={top} />
      </>,
    );
    expect(overlayDepth()).toBe(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).not.toHaveBeenCalled();

    // The top layer closed, so the remaining layer becomes topmost
    rerender(
      <>
        <Layer open onDismiss={bottom} />
        <Layer open={false} onDismiss={top} />
      </>,
    );
    expect(overlayDepth()).toBe(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(bottom).toHaveBeenCalledTimes(1);
    expect(top).toHaveBeenCalledTimes(1);
  });

  it('never dismisses a covered layer', () => {
    const bottom = vi.fn();
    const top = vi.fn();
    render(
      <>
        <Layer open onDismiss={bottom} />
        <Layer open onDismiss={top} />
      </>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(bottom).toHaveBeenCalledTimes(0);
    expect(top).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Escape keys', () => {
    const dismiss = vi.fn();
    render(<Layer open onDismiss={dismiss} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('a closed layer does not consume Escape', () => {
    const dismiss = vi.fn();
    render(<Layer open={false} onDismiss={dismiss} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dismiss).not.toHaveBeenCalled();
    expect(overlayDepth()).toBe(0);
  });
});
