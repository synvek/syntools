import { describe, expect, it, vi } from 'vitest';
import { startPointerDrag } from './pointerDrag';

/**
 * P1-7 触控：形状 / 图片手柄的拖拽必须认指针事件（鼠标、手指、笔同一套），并且按 pointerId
 * 过滤 —— 否则桌面上的鼠标移动会和触摸手势互相打断。
 */

/** `startPointerDrag` only reads these four members; jsdom cannot produce a real React event */
function down(element: Element, pointerId = 1): Parameters<typeof startPointerDrag>[0] {
  return {
    pointerId,
    currentTarget: element as HTMLElement,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as Parameters<typeof startPointerDrag>[0];
}

/** jsdom has no `PointerEvent`; the production code only reads these members */
function pointerEvent(
  type: string,
  init: { pointerId: number; clientX?: number; clientY?: number },
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: init.pointerId,
    pointerType: 'touch',
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  });
  return event;
}

function fire(type: string, init: { pointerId: number; clientX?: number; clientY?: number }): void {
  window.dispatchEvent(pointerEvent(type, init));
}

describe('startPointerDrag (P1-7)', () => {
  it('tracks touch moves on the window and commits once on pointerup', () => {
    const element = document.createElement('span');
    const move = vi.fn();
    const end = vi.fn();
    startPointerDrag(down(element), { move, end });

    // The finger leaves the 9px handle: window listeners keep the gesture alive
    fire('pointermove', { pointerId: 1, clientX: 40, clientY: 20 });
    fire('pointermove', { pointerId: 1, clientX: 60, clientY: 30 });

    expect(move).toHaveBeenCalledTimes(2);
    expect(move.mock.calls[0][0]).toMatchObject({ clientX: 40 });

    fire('pointerup', { pointerId: 1 });
    expect(end).toHaveBeenCalledTimes(1);

    // Detached: a late move from the same pointer must not move the shape again
    fire('pointermove', { pointerId: 1, clientX: 200, clientY: 200 });
    fire('pointerup', { pointerId: 1 });
    expect(move).toHaveBeenCalledTimes(2);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('ignores other pointers, so a second finger cannot hijack the drag', () => {
    const element = document.createElement('span');
    const move = vi.fn();
    const end = vi.fn();
    startPointerDrag(down(element, 7), { move, end });

    fire('pointermove', { pointerId: 8, clientX: 500, clientY: 500 });
    fire('pointerup', { pointerId: 8 });
    expect(move).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();

    fire('pointermove', { pointerId: 7, clientX: 10, clientY: 10 });
    expect(move).toHaveBeenCalledTimes(1);
  });

  it('commits an interrupted gesture (pointercancel) instead of leaving it half-applied', () => {
    const element = document.createElement('span');
    const end = vi.fn();
    startPointerDrag(down(element, 3), { move: vi.fn(), end });

    fire('pointercancel', { pointerId: 3 });
    expect(end).toHaveBeenCalledTimes(1);
  });
});
