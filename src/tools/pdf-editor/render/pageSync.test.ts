import { describe, expect, it } from 'vitest';
import { isAtBottom, pickCurrentPage } from './pageSync';

describe('pickCurrentPage', () => {
  it('取顶部锚点上方最靠下的一页', () => {
    expect(pickCurrentPage([0, 400, 800], 8, false)).toBe(1);
    expect(pickCurrentPage([-500, 0, 400], 8, false)).toBe(2);
    expect(pickCurrentPage([-900, -500, -100], 8, false)).toBe(3);
  });

  it('没有页面时退回第 1 页', () => {
    expect(pickCurrentPage([], 0, false)).toBe(1);
    expect(pickCurrentPage([], 0, true)).toBe(1);
  });

  it('滚到底部时最后一页胜出：末页顶不上去，锚点规则会误判成前一页', () => {
    // 三页文档滚到最底：第 3 页顶边仍在视口下方 200px
    const tops = [-1400, -900, 200];
    expect(pickCurrentPage(tops, 8, false)).toBe(2);
    expect(pickCurrentPage(tops, 8, true)).toBe(3);
  });
});

describe('isAtBottom', () => {
  it('内容不溢出时不算到底（否则每页都算最后一页）', () => {
    expect(isAtBottom({ scrollTop: 0, scrollHeight: 800, clientHeight: 800 })).toBe(false);
  });

  it('滚到末尾算到底，容忍 1px 亚像素误差', () => {
    expect(isAtBottom({ scrollTop: 1200, scrollHeight: 2000, clientHeight: 800 })).toBe(true);
    expect(isAtBottom({ scrollTop: 1199, scrollHeight: 2000, clientHeight: 800 })).toBe(true);
  });

  it('中间与顶部不算到底', () => {
    expect(isAtBottom({ scrollTop: 600, scrollHeight: 2000, clientHeight: 800 })).toBe(false);
    expect(isAtBottom({ scrollTop: 0, scrollHeight: 2000, clientHeight: 800 })).toBe(false);
  });
});
