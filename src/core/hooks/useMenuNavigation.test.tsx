import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { overlayDepth } from './useOverlayStack';
import { useMenuNavigation } from './useMenuNavigation';

/** Mirrors how RibbonGroup renders an overlay: trigger and menu share one `data-ribbon-group`. */
function Gallery({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rootRef, onKeyDown } = useMenuNavigation(open, onClose);
  if (!open) return null;
  return (
    <div data-ribbon-group="">
      <button type="button" data-testid="trigger">
        open
      </button>
      <div ref={rootRef} onKeyDown={onKeyDown} role="menu" data-testid="gallery">
        <button type="button" role="menuitem" data-testid="item-1">
          one
        </button>
        <button type="button" role="menuitem" data-testid="item-2">
          two
        </button>
        <button type="button" role="menuitem" data-testid="item-3">
          three
        </button>
      </div>
    </div>
  );
}

describe('useMenuNavigation (P0-4.4)', () => {
  it('focuses the first item on open and returns focus to the opener on unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<Gallery open onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByTestId('item-1'));
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('moves with arrow keys, wraps at both ends and honours Home / End', () => {
    render(<Gallery open onClose={() => {}} />);
    const gallery = screen.getByTestId('gallery');
    const first = screen.getByTestId('item-1');
    const second = screen.getByTestId('item-2');
    const third = screen.getByTestId('item-3');
    first.focus();

    fireEvent.keyDown(gallery, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(gallery, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(gallery, { key: 'End' });
    expect(document.activeElement).toBe(third);
    fireEvent.keyDown(gallery, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(gallery, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(third);
    fireEvent.keyDown(gallery, { key: 'Home' });
    expect(document.activeElement).toBe(first);
  });

  it('uses the dismiss stack for Escape and ignores other keys', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Gallery open onClose={onClose} />);
    expect(overlayDepth()).toBe(1);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(overlayDepth()).toBe(0);
  });

  it('dismisses on an outside pointer-down but leaves the trigger to its own click', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Gallery open onClose={onClose} />);
    fireEvent.pointerDown(screen.getByTestId('trigger'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('registers no layer while closed', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Gallery open={false} onClose={onClose} />);
    expect(overlayDepth()).toBe(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });
});
