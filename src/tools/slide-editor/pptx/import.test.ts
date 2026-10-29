import { describe, expect, it } from 'vitest';
import { createDoc, createShapeElement, createTextElement } from '../model/factory';
import type { ShapeElement, TextElement } from '../model/types';
import { exportPptx } from './export';
import { importPptxFile } from './import';

/**
 * Import-side regressions found by the OOXML round-trip baseline
 * (`src/tools/baseline/roundtrip.test.ts`, sample `slide/shadow-transform`): the writer emitted
 * `a:outerShdw` but the reader never produced a `shadow`, so a shadow silently vanished on re-import.
 */

const fileOf = (bytes: Uint8Array, name: string): File => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: bytes.byteLength, arrayBuffer: async () => buffer } as unknown as File;
};

async function roundTrip<T extends ShapeElement | TextElement>(element: T): Promise<T> {
  const doc = createDoc('shadow');
  doc.slides[0].elements = [element];
  const exported = await exportPptx(doc);
  expect(exported.ok).toBe(true);
  if (!exported.ok) throw new Error(exported.error);

  const imported = await importPptxFile(fileOf(exported.value, 'shadow.pptx'));
  expect(imported.ok).toBe(true);
  if (!imported.ok) throw new Error(imported.error);

  const first = imported.value.doc.slides[0].elements[0];
  expect(first).toBeDefined();
  return first as T;
}

describe('导入：外阴影（基线 slide/shadow-transform 的回归）', () => {
  it('形状的阴影在往返后保留 blur / 偏移 / 颜色 / 透明度', async () => {
    const doc = createDoc('shadow');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
    shape.shadow = { color: '#112233', blur: 18, offsetX: 6, offsetY: 8, opacity: 0.4 };

    const imported = await roundTrip(shape);
    expect(imported.shadow).toEqual({
      color: '#112233',
      blur: 18,
      offsetX: 6,
      offsetY: 8,
      opacity: 0.4,
    });
  });

  it('文本框的阴影同样保留（负向偏移 + 默认不透明度）', async () => {
    const doc = createDoc('shadow-text');
    const text = createTextElement(doc, 'shadowed') as TextElement;
    text.shadow = { color: '#000000', blur: 4, offsetX: -5, offsetY: -7 };

    const imported = await roundTrip(text);
    expect(imported.shadow).toMatchObject({ blur: 4, offsetX: -5, offsetY: -7 });
    expect(imported.shadow?.color).toBe('#000000');
  });

  it('没有阴影的元素不会凭空多出 shadow 字段', async () => {
    const doc = createDoc('plain');
    const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;

    const imported = await roundTrip(shape);
    expect(imported.shadow).toBeUndefined();
  });
});
