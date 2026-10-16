import { describe, expect, it } from 'vitest';
import { initializeCanvas, readPsd, writePsdUint8Array } from 'ag-psd';
import {
  createColorOverlay,
  createDropShadow,
  createInnerShadow,
  createOuterGlow,
  createStroke,
} from '../core';
import { mapPsdEffects } from './importMap';
import { toPsdEffects } from './styleMap';
import type { LayerStyle } from '../model/types';

/**
 * 图层效果的**真实往返**测试：我们的样式 → `toPsdEffects` → ag-psd 序列化成 PSD 字节 → ag-psd 读回 → `mapPsdEffects`。
 *
 * 为什么不只测映射函数：写出的单位约定（尤其 ag-psd 的 `opacity` 是 0~1 的 FixedPoint8）只有经过一次
 * 真实序列化才能验证。本次就是靠这组用例发现读入侧把 opacity 当成了百分比 ——
 * 那种错误在界面上表现为「PSD 里的投影淡到看不见」，很难归因。
 *
 * 用 `imageData` + `useImageData` 传递像素，因此整条链路不依赖 Canvas（jsdom 可跑）。
 */

const PIXELS = new Uint8ClampedArray(2 * 2 * 4).fill(200);

/**
 * jsdom 没有 2D 上下文，而 ag-psd 在读路径上会走 `createImageData`（默认实现要一张临时画布）。
 * `initializeCanvas` 正是为此提供的注入点：这里给它一个「只造 ImageData、不真画像素」的替身。
 * 因为 `useImageData: true` 时 ag-psd 直接读原始像素数据，不需要真正的绘图能力。
 */
initializeCanvas(
  (width = 1, height = 1) =>
    ({
      width,
      height,
      getContext: () => null,
      toDataURL: () => '',
    }) as unknown as HTMLCanvasElement,
  (width, height) =>
    ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }) as unknown as ImageData,
);

function roundTrip(style: LayerStyle | null): LayerStyle | null {
  const effects = toPsdEffects(style);
  const bytes = writePsdUint8Array({
    width: 2,
    height: 2,
    children: [
      {
        name: 'Layer',
        top: 0,
        left: 0,
        bottom: 2,
        right: 2,
        imageData: { data: PIXELS, width: 2, height: 2 },
        ...(effects ? { effects } : {}),
      },
    ],
  } as never);
  const psd = readPsd(bytes, {
    useImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
  });
  return mapPsdEffects((psd.children?.[0] as { effects?: never } | undefined)?.effects);
}

describe('图层效果写出的边界', () => {
  it('没有样式 / 空样式时返回 undefined（ag-psd 会完全跳过 lfx2 段）', () => {
    expect(toPsdEffects(null)).toBeUndefined();
    expect(toPsdEffects({})).toBeUndefined();
  });

  it('未启用的效果照样写出（参数要保留，只是标记为 disabled）', () => {
    const shadow = { ...createDropShadow(), enabled: false };
    const effects = toPsdEffects({ dropShadow: shadow });
    expect(effects?.dropShadow?.[0]).toMatchObject({ present: true, enabled: false });
  });

  it('尺寸一律写成 { units: Pixels, value }（直接写数字会被序列化成 0）', () => {
    const effects = toPsdEffects({ dropShadow: { ...createDropShadow(), distance: 7, spread: 3 } });
    expect(effects?.dropShadow?.[0].distance).toEqual({ units: 'Pixels', value: 7 });
    expect(effects?.dropShadow?.[0].choke).toEqual({ units: 'Pixels', value: 3 });
  });
});

describe('投影往返', () => {
  it('颜色 / 不透明度 / 角度 / 距离 / 扩展 / 模糊全部保留', () => {
    const style: LayerStyle = {
      dropShadow: {
        ...createDropShadow(),
        enabled: true,
        color: '#FF8000',
        opacity: 0.6,
        angle: 135,
        distance: 9,
        spread: 4,
        size: 12,
      },
    };
    const back = roundTrip(style);
    expect(back?.dropShadow).toMatchObject({
      enabled: true,
      color: '#FF8000',
      angle: 135,
      distance: 9,
      spread: 4,
      size: 12,
    });
    // 不透明度是 0~1 的 FixedPoint8：容忍 1/255 的量化误差
    expect(back?.dropShadow?.opacity).toBeCloseTo(0.6, 2);
  });

  it('内阴影往返（无扩展参数）', () => {
    const back = roundTrip({
      innerShadow: {
        ...createInnerShadow(),
        enabled: true,
        color: '#0000FF',
        opacity: 1,
        angle: 90,
        distance: 5,
        size: 8,
      },
    });
    expect(back?.innerShadow).toMatchObject({ color: '#0000FF', angle: 90, distance: 5, size: 8 });
    expect(back?.innerShadow?.opacity).toBeCloseTo(1, 2);
  });
});

describe('外发光 / 颜色叠加 / 描边往返', () => {
  it('外发光：颜色与半径保留', () => {
    const back = roundTrip({
      outerGlow: { ...createOuterGlow(), enabled: true, color: '#22C55E', opacity: 0.75, size: 14 },
    });
    expect(back?.outerGlow).toMatchObject({ enabled: true, color: '#22C55E', size: 14 });
    expect(back?.outerGlow?.opacity).toBeCloseTo(0.75, 2);
  });

  it('颜色叠加：走 PSD 的 solidFill', () => {
    const back = roundTrip({
      colorOverlay: { ...createColorOverlay(), enabled: true, color: '#123456', opacity: 0.5 },
    });
    expect(back?.colorOverlay).toMatchObject({ enabled: true, color: '#123456' });
    expect(back?.colorOverlay?.opacity).toBeCloseTo(0.5, 2);
  });

  it('描边：位置与粗细保留（outside / inside / center）', () => {
    for (const position of ['outside', 'inside', 'center'] as const) {
      const back = roundTrip({
        stroke: {
          ...createStroke(),
          enabled: true,
          color: '#FFFFFF',
          opacity: 1,
          size: 6,
          position,
        },
      });
      expect(back?.stroke).toMatchObject({ enabled: true, color: '#FFFFFF', size: 6, position });
    }
  });
});

describe('多效果共存', () => {
  it('五种效果一次写出并全部读回', () => {
    const back = roundTrip({
      dropShadow: { ...createDropShadow(), enabled: true, size: 6 },
      innerShadow: { ...createInnerShadow(), enabled: true, size: 4 },
      outerGlow: { ...createOuterGlow(), enabled: true, size: 10 },
      colorOverlay: { ...createColorOverlay(), enabled: true, color: '#ABCDEF' },
      stroke: { ...createStroke(), enabled: true, size: 3, position: 'outside' },
    });
    expect(back).not.toBeNull();
    expect(Object.keys(back ?? {}).sort()).toEqual([
      'colorOverlay',
      'dropShadow',
      'innerShadow',
      'outerGlow',
      'stroke',
    ]);
  });

  it('无样式时读回也是 null（不会凭空造出效果）', () => {
    expect(roundTrip(null)).toBeNull();
  });
});
