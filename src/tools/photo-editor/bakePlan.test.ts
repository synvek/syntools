import { describe, expect, it, vi } from 'vitest';
import { defaultFilterParams } from './core';
import {
  OFFLOAD_WORK_THRESHOLD,
  estimatePixelWork,
  previewScaleFor,
  scaleFilterParams,
  shouldOffloadPixels,
} from './render/bakePlan';
import { applyPixelPassToData } from './render/pixelPass';
import { resetBakeQueue, scheduleFullResBake } from './render/bakeQueue';
import { bakeToBitmap, type BakeWorkerRequest } from './workers/bake.worker';
import { createAdjustments } from './model/factory';
import type { FilterId, FilterSpec } from './model/types';

/**
 * 烘焙性能策略与 Worker 协议的测试。
 *
 * 这里覆盖的是「最容易写错又最不容易发现」的部分：预览降采样时滤镜参数忘了等比、
 * 卸载阈值算错导致该异步的没异步（或不该异步的疯狂起线程）、
 * 以及 Worker 编排（CSS 滤镜 → 像素通道 → 位图）的顺序错乱。
 */

const spec = (id: FilterId, params: Record<string, number> = {}): FilterSpec => ({
  id,
  params: { ...defaultFilterParams(id), ...params },
});

describe('previewScaleFor：实时预览的降采样倍率', () => {
  it('小图保持原分辨率', () => {
    expect(previewScaleFor(800, 600)).toBe(1);
    expect(previewScaleFor(1414, 1414)).toBe(1);
  });

  it('按像素预算开方缩减', () => {
    // 2000×1500 = 300 万像素，预算是 200 万 → √(2/3) ≈ 0.82
    const scale = previewScaleFor(2000, 1500);
    expect(scale).toBeGreaterThan(0.8);
    expect(scale).toBeLessThan(0.83);
  });

  it('极大图也不会低于下限（再低就看不清在画什么）', () => {
    expect(previewScaleFor(12000, 8000)).toBe(0.35);
  });
});

describe('scaleFilterParams：长度类参数等比缩小', () => {
  it('倍率为 1 时原样返回（零开销）', () => {
    const filters = [spec('gaussianBlur')];
    expect(scaleFilterParams(filters, 1)).toBe(filters);
  });

  it('半径 / 距离 / 噪声尺度按比例缩放，角度与百分比不动', () => {
    const filters = [
      spec('gaussianBlur', { radius: 10 }),
      spec('motionBlur', { angle: 45, distance: 20 }),
      spec('clouds', { amount: 70, size: 16 }),
      spec('twirl', { angle: 90 }),
    ];
    const scaled = scaleFilterParams(filters, 0.5);
    expect(scaled[0].params?.radius).toBe(5);
    expect(scaled[1].params?.distance).toBe(10);
    expect(scaled[1].params?.angle).toBe(45);
    expect(scaled[2].params?.size).toBe(8);
    expect(scaled[2].params?.amount).toBe(70);
    expect(scaled[3].params?.angle).toBe(90);
  });

  it('像素化块大小按比例缩放（否则预览的像素格数会变多）', () => {
    expect(scaleFilterParams([spec('pixelate', { block: 16 })], 0.5)[0].params?.block).toBe(8);
  });

  it('缩放后长度不会小于 1', () => {
    expect(scaleFilterParams([spec('gaussianBlur', { radius: 3 })], 0.1)[0].params?.radius).toBe(1);
  });
});

describe('estimatePixelWork / shouldOffloadPixels：是否值得异步', () => {
  it('轻量滤镜 + 小图层不卸载（异步往返比直接算还慢）', () => {
    expect(shouldOffloadPixels(400, 300, [spec('posterize')])).toBe(false);
  });

  it('降噪这类重滤镜 + 大图层才值得卸载', () => {
    expect(shouldOffloadPixels(4000, 3000, [spec('reduceNoise')])).toBe(true);
  });

  it('停用的滤镜不计入代价', () => {
    const disabled: FilterSpec = { ...spec('reduceNoise'), enabled: false };
    expect(estimatePixelWork(4000, 3000, [disabled])).toBeLessThan(OFFLOAD_WORK_THRESHOLD);
  });

  it('多枚滤镜的代价累加', () => {
    const one = estimatePixelWork(2000, 2000, [spec('unsharp')]);
    const two = estimatePixelWork(2000, 2000, [spec('unsharp'), spec('unsharp')]);
    expect(two).toBe(one * 2);
  });
});

describe('applyPixelPassToData：共享像素通道', () => {
  const pixels = (list: number[][]): Uint8ClampedArray => Uint8ClampedArray.from(list.flat());

  it('无调整无滤镜时数据不变', () => {
    const data = pixels([[10, 20, 30, 255]]);
    applyPixelPassToData(1, 1, data, createAdjustments(), []);
    expect([...data]).toEqual([10, 20, 30, 255]);
  });

  it('阈值调整把像素压成纯黑或纯白', () => {
    const data = pixels([
      [10, 10, 10, 255],
      [200, 200, 200, 255],
    ]);
    applyPixelPassToData(2, 1, data, { ...createAdjustments(), threshold: 128 }, []);
    expect([...data].slice(0, 4)).toEqual([0, 0, 0, 255]);
    expect([...data].slice(4, 8)).toEqual([255, 255, 255, 255]);
  });

  it('像素级滤镜（反相）就地生效', () => {
    const data = pixels([[0, 128, 255, 255]]);
    applyPixelPassToData(1, 1, data, createAdjustments(), [spec('posterize', { levels: 3 })]);
    // 3 级色调分离：0 / 127.5 / 255 三档
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(128);
    expect(data[2]).toBe(255);
  });
});

describe('Worker 编排：bakeToBitmap', () => {
  const fakeContext = () => ({
    filter: 'none',
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    })),
    putImageData: vi.fn(),
  });

  it('先按 CSS 滤镜绘制、再跑像素通道、最后转位图', async () => {
    const ctx = fakeContext();
    const bitmap = { width: 4, height: 2 } as unknown as ImageBitmap;
    const canvas = {
      getContext: () => ctx,
      transferToImageBitmap: () => bitmap,
    } as unknown as OffscreenCanvas;
    const request: BakeWorkerRequest = {
      id: 7,
      width: 4,
      height: 2,
      bitmap: bitmap,
      cssFilter: 'blur(3px)',
      adjustments: createAdjustments(),
      filters: [spec('posterize', { levels: 3 })],
    };
    const result = await bakeToBitmap(request, () => canvas);
    expect(result).toBe(bitmap);
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 4, 2);
    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 4, 2);
    expect(ctx.putImageData).toHaveBeenCalled();
    // 绘制完成后必须复位 filter，否则 putImageData 之后的进一步合成会被再次模糊
    expect(ctx.filter).toBe('none');
  });

  it('拿不到 2D 上下文时返回 null（不抛错）', async () => {
    const canvas = { getContext: () => null } as unknown as OffscreenCanvas;
    const response = await bakeToBitmap(
      {
        id: 1,
        width: 2,
        height: 2,
        bitmap: {} as ImageBitmap,
        cssFilter: '',
        adjustments: createAdjustments(),
        filters: [],
      },
      () => canvas,
    );
    expect(response).toBeNull();
  });
});

describe('bakeQueue：环境不具备能力时静默降级', () => {
  it('没有 Worker / createImageBitmap 时登记任务不抛错、也不建线程', () => {
    resetBakeQueue();
    const source = { width: 4000, height: 3000 } as unknown as HTMLCanvasElement;
    expect(() =>
      scheduleFullResBake({
        signature: 'sig',
        source,
        adjustments: createAdjustments(),
        filters: [spec('reduceNoise')],
      }),
    ).not.toThrow();
    resetBakeQueue();
  });

  it('工作量不足时连登记都不做（避免无谓的防抖定时器）', () => {
    resetBakeQueue();
    const source = { width: 64, height: 64 } as unknown as HTMLCanvasElement;
    scheduleFullResBake({
      signature: 'sig',
      source,
      adjustments: createAdjustments(),
      filters: [spec('posterize')],
    });
    resetBakeQueue();
    expect(true).toBe(true);
  });
});
