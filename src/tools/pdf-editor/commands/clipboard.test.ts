import { beforeEach, describe, expect, it } from 'vitest';
import { createShapeObject, createTextObject } from '../model/objects';
import {
  clearClipboard,
  clipboardSize,
  copyObjects,
  deserializeClipboard,
  pasteObjects,
  serializeClipboard,
} from './clipboard';

const PAGE = 'page-main-0';
const RECT = { x: 0.2, y: 0.2, w: 0.2, h: 0.1 };

function shape(id = 'shape-1', extra: { z?: number; locked?: boolean } = {}) {
  return createShapeObject({ page: PAGE, rect: RECT, type: 'rect', id, ...extra });
}

describe('对象剪贴板', () => {
  beforeEach(() => {
    clearClipboard();
  });

  it('复制记录数量，粘贴生成新 id 并堆到最上层', () => {
    expect(copyObjects([shape('shape-1', { z: 4 })])).toBe(1);
    expect(clipboardSize()).toBe(1);

    const existing = [
      createTextObject({ page: 'page-main-1', rect: RECT, text: 'existing', z: 2, id: 'text-1' }),
    ];
    const pasted = pasteObjects({ objects: existing, pageId: 'page-main-1' });

    expect(pasted).toHaveLength(1);
    expect(pasted[0].id).not.toBe('shape-1');
    expect(pasted[0].page).toBe('page-main-1');
    expect(pasted[0].z).toBe(3);
    expect(pasted[0].rect.x).toBeCloseTo(0.22, 6);
    expect(pasted[0].rect.y).toBeCloseTo(0.22, 6);
    expect(pasted[0].rect.w).toBeCloseTo(0.2, 6);
  });

  it('粘贴会解锁并夹在页面内', () => {
    // Locked object in the bottom-right corner: the paste offset must be clamped away
    copyObjects([
      createShapeObject({
        page: PAGE,
        rect: { x: 0.85, y: 0.85, w: 0.15, h: 0.15 },
        type: 'rect',
        id: 'edge',
        locked: true,
      }),
    ]);

    const [pasted] = pasteObjects({ objects: [], pageId: PAGE });
    expect(pasted.locked).toBeUndefined();
    expect(pasted.rect.x).toBeCloseTo(0.87, 6);
    expect(pasted.rect.y).toBeCloseTo(0.87, 6);
    expect(pasted.rect.w).toBeCloseTo(0.13, 6);
    expect(pasted.rect.h).toBeCloseTo(0.13, 6);
  });

  it('多次粘贴按顺序叠放 z', () => {
    copyObjects([
      shape('a', { z: 1 }),
      createShapeObject({ page: PAGE, rect: RECT, type: 'ellipse', id: 'b', z: 2 }),
    ]);

    const pasted = pasteObjects({ objects: [shape('base', { z: 7 })], pageId: PAGE });
    expect(pasted.map((object) => object.z)).toEqual([8, 9]);
    expect(new Set(pasted.map((object) => object.id)).size).toBe(2);
  });

  it('空剪贴板粘贴返回空数组', () => {
    expect(clipboardSize()).toBe(0);
    expect(pasteObjects({ objects: [], pageId: PAGE })).toEqual([]);
  });

  it('clearClipboard 清空后 paste 无事发生', () => {
    copyObjects([shape()]);
    clearClipboard();

    expect(clipboardSize()).toBe(0);
    expect(pasteObjects({ objects: [], pageId: PAGE })).toEqual([]);
  });

  it('序列化后可还原，跨文档粘贴仍重新生成 id', () => {
    copyObjects([shape('shape-9', { z: 2 })]);
    const json = serializeClipboard();
    clearClipboard();
    expect(clipboardSize()).toBe(0);

    expect(deserializeClipboard(json)).toBe(1);
    const [pasted] = pasteObjects({ objects: [], pageId: 'page-main-4' });
    expect(pasted.id).not.toBe('shape-9');
    expect(pasted.page).toBe('page-main-4');
  });

  it('拒绝版本不符或损坏的载荷，且不清空现有剪贴板', () => {
    copyObjects([shape()]);
    expect(deserializeClipboard('{"version":99,"objects":[]}')).toBe(0);
    expect(deserializeClipboard('not json')).toBe(0);
    expect(deserializeClipboard('{"version":1,"objects":[{"id":1}]}')).toBe(0);
    expect(clipboardSize()).toBe(1);
  });
});
