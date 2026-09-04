import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  it('无存储值时使用初始值', () => {
    const { result } = renderHook(() => useLocalStorage('k', 'init'));
    expect(result.current[0]).toBe('init');
  });

  it('读取已有存储值', () => {
    localStorage.setItem('k', JSON.stringify({ n: 3 }));
    const { result } = renderHook(() => useLocalStorage<{ n: number }>('k', { n: 0 }));
    expect(result.current[0]).toEqual({ n: 3 });
  });

  it('更新状态并同步写入 localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('k', 'x'));
    act(() => result.current[1]('y'));
    expect(result.current[0]).toBe('y');
    expect(localStorage.getItem('k')).toBe(JSON.stringify('y'));
  });

  it('存储内容损坏时回退初始值', () => {
    localStorage.setItem('bad', '{oops');
    const { result } = renderHook(() => useLocalStorage('bad', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });
});
