import { describe, expect, it, vi } from 'vitest';
import { createDoc, createShapeElement, createSlide, createTextElement } from '../model/factory';
import type { AnimationStep, SlideDoc } from '../model/types';
import { exportSlidesToVectorPdf } from './pdfVector';

// Konva 在 jsdom 里画不出东西：位图兜底换成真实的 1×1 PNG（与 pdfVector.test.ts 同款）
vi.mock('./raster', () => ({
  renderSlideToDataUrl: () =>
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
}));

/**
 * P2-5.6：静态输出面（矢量 PDF / 打印 / 缩略图）必须画**动画终态**。
 *
 * 入场动画只存在于 `Slide.animations` 里、只被放映层消费，所以"静态渲染天然是终态"这个结论
 * 成立的前提是：静态管线完全不读这两个字段。这里用「同一份内容加不加动画，PDF 必须逐字节一致」
 * 把它钉住——一旦将来有人为了"在缩略图上画第一帧"去读 animations，这条会立刻红。
 *
 * 缩略图走 Konva（jsdom 无 2D 上下文），因此缩略图面用 e2e 覆盖；PDF 与打印共用同一份静态页模型。
 */

function deck(withMotion: boolean): SlideDoc {
  const target = createDoc('frame');
  const text = createTextElement(target, 'Final title');
  text.x = 80;
  text.y = 60;
  const shape = createShapeElement(target, { kind: 'rect', prst: 'rect' });
  shape.x = 80;
  shape.y = 200;
  target.slides[0].elements = [text, shape];
  target.slides.push(createSlide(target.slides[0].layoutId));
  target.slides[1].elements = [createTextElement(target, 'Second page')];

  if (withMotion) {
    target.slides[0].transition = { type: 'fade', duration: 400, advanceOnClick: true };
    const steps: AnimationStep[] = [
      {
        id: 'a1',
        elementId: text.id,
        effect: 'fadeIn',
        duration: 500,
        delay: 0,
        trigger: 'onClick',
      },
      {
        id: 'a2',
        elementId: shape.id,
        effect: 'flyIn',
        duration: 500,
        delay: 200,
        trigger: 'afterPrevious',
      },
    ];
    target.slides[0].animations = steps;
  }
  return target;
}

describe('静态输出面使用动画终态', () => {
  it('加不加动画，矢量 PDF 逐字节一致（含页数与可搜索性统计）', async () => {
    const plain = await exportSlidesToVectorPdf(deck(false));
    const animated = await exportSlidesToVectorPdf(deck(true));
    expect(plain.ok).toBe(true);
    expect(animated.ok).toBe(true);
    if (!plain.ok || !animated.ok) return;

    expect(animated.value.vectorPages).toBe(plain.value.vectorPages);
    expect(animated.value.rasterPages).toBe(plain.value.rasterPages);
    expect(new Uint8Array(animated.value.bytes)).toEqual(new Uint8Array(plain.value.bytes));
  });

  it('动画数据不改变"该页能否矢量化"的判定', async () => {
    // 入场动画不是位图元素，不会把页面推进栅格兜底
    const animated = await exportSlidesToVectorPdf(deck(true));
    expect(animated.ok).toBe(true);
    if (!animated.ok) return;
    expect(animated.value.rasterPages).toBe(0);
  });
});
