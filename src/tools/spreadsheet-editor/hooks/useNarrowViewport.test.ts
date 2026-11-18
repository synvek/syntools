import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NARROW_VIEWPORT_QUERY, useNarrowViewport } from './useNarrowViewport';

/**
 * 可手动拨动的媒体查询：jsdom 的 `matchMedia` 永远返回 `matches: false`，
 * 不给它一个"能被推一下"的替身，窄屏这条分支根本跑不到。
 */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches: initial,
    media: NARROW_VIEWPORT_QUERY,
    addEventListener: (_type: 'change', listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: 'change', listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => list),
  );
  return {
    list,
    listenerCount: () => listeners.size,
    set(next: boolean) {
      list.matches = next;
      for (const listener of listeners) listener();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useNarrowViewport', () => {
  it('宽屏时返回 false，并按 768px 询问媒体查询', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useNarrowViewport());
    expect(result.current).toBe(false);
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 768px)');
  });

  it('窄屏时返回 true', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useNarrowViewport());
    expect(result.current).toBe(true);
  });

  it('跨过断点时跟着变（旋转屏幕不一定是 resize 事件）', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useNarrowViewport());
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe(false);
  });

  it('卸载时退订，不留一个永远活着的监听器', () => {
    const media = stubMatchMedia(true);
    const { unmount } = renderHook(() => useNarrowViewport());
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it('没有 matchMedia（SSR / 预渲染）时按宽屏处理，不抛错', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useNarrowViewport());
    expect(result.current).toBe(false);
  });
});
