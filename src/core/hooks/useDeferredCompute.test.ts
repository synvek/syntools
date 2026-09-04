import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDeferredCompute } from './useDeferredCompute';

describe('useDeferredCompute', () => {
  afterEach(() => vi.useRealTimers());

  it('首次挂载同步计算', () => {
    const { result } = renderHook(() => useDeferredCompute('ab', (s) => s.length));
    expect(result.current).toBe(2);
  });

  it('输入停止 delay 毫秒后才重算', () => {
    vi.useFakeTimers();
    const compute = vi.fn((s: string) => s.length);
    const { result, rerender } = renderHook(({ v }) => useDeferredCompute(v, compute, 100), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'abc' });
    act(() => vi.advanceTimersByTime(99));
    expect(result.current).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(3);
    expect(compute).toHaveBeenLastCalledWith('abc');
  });

  it('连续输入只计算最后一次', () => {
    vi.useFakeTimers();
    const compute = vi.fn((s: string) => s.length);
    const { result, rerender } = renderHook(({ v }) => useDeferredCompute(v, compute, 100), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'ab' });
    act(() => vi.advanceTimersByTime(50));
    rerender({ v: 'abcd' });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(4);
    // 首次同步 1 次 + 延迟 1 次，中间的输入被合并
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
