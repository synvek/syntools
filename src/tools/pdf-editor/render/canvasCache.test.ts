import { beforeEach, describe, expect, it } from 'vitest';
import {
  CANVAS_CACHE_MAX,
  cacheCanvas,
  canvasCacheKey,
  canvasCacheSize,
  clearCanvasCache,
  takeCachedCanvas,
} from './canvasCache';

const fakeCanvas = (width = 100, height = 80) =>
  ({ width, height }) as unknown as HTMLCanvasElement;

describe('canvasCacheKey', () => {
  it('按文档/页/缩放/DPR 区分位图', () => {
    const doc = { fingerprints: ['fp-a', null] };
    const key = canvasCacheKey(doc, 3, 1.25, 2);
    expect(key).toBe('fp-a:3:1.2500:2.00');
    expect(canvasCacheKey(doc, 3, 1.25, 2)).toBe(key);
    expect(canvasCacheKey(doc, 4, 1.25, 2)).not.toBe(key);
    expect(canvasCacheKey(null, 3, 1.25, 2)).toBe('doc:3:1.2500:2.00');
  });
});

describe('canvasCache', () => {
  beforeEach(() => clearCanvasCache());

  it('取出后不再命中，避免同一画布挂到两个页面', () => {
    const canvas = fakeCanvas();
    cacheCanvas('a', canvas);
    expect(takeCachedCanvas('a')).toBe(canvas);
    expect(takeCachedCanvas('a')).toBeNull();
    expect(canvasCacheSize()).toBe(0);
  });

  it('超过上限淘汰最久未用的位图并释放后备存储', () => {
    const canvases = Array.from({ length: CANVAS_CACHE_MAX + 2 }, () => fakeCanvas());
    canvases.forEach((canvas, index) => cacheCanvas(`k${index}`, canvas));

    expect(canvasCacheSize()).toBe(CANVAS_CACHE_MAX);
    expect(canvases[0].width).toBe(0);
    expect(canvases[1].width).toBe(0);
    // The newest one is still there
    expect(takeCachedCanvas(`k${CANVAS_CACHE_MAX + 1}`)).toBe(canvases[CANVAS_CACHE_MAX + 1]);
  });

  it('重新放入会刷新顺序', () => {
    const first = fakeCanvas();
    cacheCanvas('first', first);
    for (let index = 0; index < CANVAS_CACHE_MAX - 1; index += 1) {
      cacheCanvas(`k${index}`, fakeCanvas());
    }
    // `first` is the oldest; putting it again moves it to the newest slot
    cacheCanvas('first', takeCachedCanvas('first') as HTMLCanvasElement);
    cacheCanvas('overflow', fakeCanvas());

    expect(canvasCacheSize()).toBe(CANVAS_CACHE_MAX);
    expect(first.width).toBe(100);
  });

  it('清空会释放全部画布', () => {
    const canvas = fakeCanvas();
    cacheCanvas('a', canvas);
    clearCanvasCache();
    expect(canvas.width).toBe(0);
    expect(canvasCacheSize()).toBe(0);
  });
});
