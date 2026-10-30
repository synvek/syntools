import { describe, expect, it } from 'vitest';
import { resolvePresetGeometry } from '../../../core/drawing/shapeDefs';
import { createDoc, createLineElement, createShapeElement } from '../model/factory';
import type { LineElement, ShapeElement, SlideDoc } from '../model/types';
import { exportPptxLegacy } from './export';
import { importPptxFile } from './import';
import { slideXml } from './write';

function adjustedDoc(): SlideDoc {
  const doc = createDoc('adj');
  const shape = createShapeElement(
    doc,
    resolvePresetGeometry('roundRect', { adj1: 0.4 }),
  ) as ShapeElement;
  shape.x = 100;
  shape.y = 100;
  shape.width = 200;
  shape.height = 100;

  const line = createLineElement(doc) as LineElement;
  line.startCxn = { shapeId: shape.id, site: 2 };
  line.endCxn = { shapeId: shape.id, site: 6 };
  line.head = 'triangle';
  line.tail = 'arrow';

  doc.slides[0].elements = [shape, line];
  return doc;
}

describe('形状调整值与连接线 OOXML 往返', () => {
  it('导出写入 avLst、箭头与连接点', () => {
    const doc = adjustedDoc();
    const xml = slideXml(doc.slides[0].elements, new Map());
    expect(xml).toContain('<a:gd name="adj1" fmla="val 40000"/>');
    expect(xml).toContain('<a:headEnd type="triangle"/>');
    expect(xml).toContain('<a:tailEnd type="arrow"/>');
    expect(xml).toMatch(/<a:stCxn id="\d+" idx="2"\/>/);
    expect(xml).toMatch(/<a:endCxn id="\d+" idx="6"\/>/);
  });

  it('导出再导入后保留调整值、箭头与绑定', async () => {
    const exported = await exportPptxLegacy(adjustedDoc());
    expect(exported.ok).toBe(true);
    const bytes = (exported as { ok: true; value: Uint8Array }).value;
    const file = new File([bytes], 'adj.pptx');

    const imported = await importPptxFile(file);
    expect(imported.ok).toBe(true);
    const doc = (imported as { ok: true; value: { doc: SlideDoc } }).value.doc;
    const elements = doc.slides[0].elements;

    const shape = elements.find(
      (element) => element.type === 'shape' && element.geom.prst === 'roundRect',
    ) as ShapeElement | undefined;
    expect(shape).toBeDefined();
    expect(shape?.geom.adj?.adj1).toBeCloseTo(0.4, 3);

    const line = elements.find(
      (element) => element.type === 'line' && element.startCxn !== undefined,
    ) as LineElement | undefined;
    expect(line).toBeDefined();
    expect(line?.startCxn?.shapeId).toBe(shape?.id);
    expect(line?.endCxn?.shapeId).toBe(shape?.id);
    expect(line?.startCxn?.site).toBe(2);
    expect(line?.endCxn?.site).toBe(6);
    expect(line?.head).toBe('triangle');
    expect(line?.tail).toBe('arrow');
  });
});
