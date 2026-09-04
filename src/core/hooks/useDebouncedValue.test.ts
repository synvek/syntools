import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers());

  it('延迟 delay 毫秒后才返回最新值', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'ab' });
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(149));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  it('连续输入会重置计时，只保留最后一次值', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 100), {
      initialProps: { v: '1' },
    });
    rerender({ v: '12' });
    act(() => vi.advanceTimersByTime(60));
    rerender({ v: '123' });
    act(() => vi.advanceTimersByTime(60));
    // 第二次输入重置了计时器，此时仍未更新
    expect(result.current).toBe('1');
    act(() => vi.advanceTimersByTime(40));
    expect(result.current).toBe('123');
  });
});
