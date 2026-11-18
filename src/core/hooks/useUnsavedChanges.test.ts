import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUnsavedChanges } from './useUnsavedChanges';

function fireBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('useUnsavedChanges', () => {
  it('dirty 时拦截离开，clean 时不拦截', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty, '未保存'), {
      initialProps: { dirty: true },
    });

    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    rerender({ dirty: false });
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('卸载后移除监听，不留悬空 handler', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useUnsavedChanges(true, '未保存'));
    const handler = add.mock.calls.find(([type]) => type === 'beforeunload')?.[1];
    expect(handler).toBeTypeOf('function');

    unmount();
    expect(remove.mock.calls.some(([type, fn]) => type === 'beforeunload' && fn === handler)).toBe(
      true,
    );

    add.mockRestore();
    remove.mockRestore();
  });

  it('dirty 反复重渲染不会重复注册', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const { rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: true },
    });

    rerender({ dirty: true });
    rerender({ dirty: true });

    const count = add.mock.calls.filter(([type]) => type === 'beforeunload').length;
    expect(count).toBe(1);

    add.mockRestore();
  });
});
