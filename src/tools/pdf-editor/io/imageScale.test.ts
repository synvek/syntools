import { describe, expect, it } from 'vitest';
import { fitWithin, fittedBox, imageFormat, MAX_IMAGE_EDGE } from './imageScale';

describe('fitWithin', () => {
  it('按长边缩到 2000 px', () => {
    const size = fitWithin({ width: 4000, height: 3000 });

    expect(size).toEqual({ width: 2000, height: 1500, scale: 0.5 });
    expect(MAX_IMAGE_EDGE).toBe(2000);
  });

  it('不放大小图', () => {
    expect(fitWithin({ width: 800, height: 600 })).toEqual({
      width: 800,
      height: 600,
      scale: 1,
    });
  });

  it('竖图按高度缩，宽高至少 1 px', () => {
    const tall = fitWithin({ width: 300, height: 9000 });
    expect(tall.height).toBe(2000);
    expect(tall.width).toBe(67);

    const sliver = fitWithin({ width: 9000, height: 1 });
    expect(sliver.height).toBe(1);
  });
});

describe('imageFormat', () => {
  it('识别 png / jpeg 数据 URL', () => {
    expect(imageFormat('data:image/png;base64,AAA')).toBe('png');
    expect(imageFormat('data:image/jpeg;base64,AAA')).toBe('jpg');
    expect(imageFormat('data:image/jpg;base64,AAA')).toBe('jpg');
  });

  it('其他格式返回 null', () => {
    expect(imageFormat('data:image/webp;base64,AAA')).toBeNull();
    expect(imageFormat('https://example.com/a.png')).toBeNull();
  });
});

describe('fittedBox', () => {
  const frame = { width: 200, height: 100 };
  const natural = { width: 100, height: 100 };

  it('contain 内切并居中', () => {
    expect(fittedBox(frame, natural, 'contain')).toEqual({
      width: 100,
      height: 100,
      offsetX: 50,
      offsetY: 0,
    });
  });

  it('cover 铺满并可溢出', () => {
    expect(fittedBox(frame, natural, 'cover')).toEqual({
      width: 200,
      height: 200,
      offsetX: 0,
      offsetY: -50,
    });
  });

  it('fill 直接拉伸', () => {
    expect(fittedBox(frame, natural, 'fill')).toEqual({
      width: 200,
      height: 100,
      offsetX: 0,
      offsetY: 0,
    });
  });
});
