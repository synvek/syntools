import { describe, expect, it } from 'vitest';
import { createDoc, createShapeElement } from '../model/factory';
import type { ShapeElement, SlideDoc } from '../model/types';
import { custGeomXml, geometryFromCustGeom, parseCustGeom } from './custGeom';
import { exportPptxLegacy } from './export';
import { importPptxFile } from './import';
import { parseXml } from './xml';

/** a:custGeom reading / writing: OOXML path commands ↔ normalized model commands */

const SHAPE_PATH = `<a:custGeom><a:avLst/><a:pathLst><a:path w="100000" h="100000">
<a:moveTo><a:pt x="0" y="100000"/></a:moveTo>
<a:lnTo><a:pt x="100000" y="100000"/></a:lnTo>
<a:cubicBezTo><a:pt x="80000" y="60000"/><a:pt x="20000" y="60000"/><a:pt x="50000" y="0"/></a:cubicBezTo>
<a:close/>
</a:path></a:pathLst></a:custGeom>`;

function parseGeomNode(): Record<string, unknown> {
  const [root] = parseXml(SHAPE_PATH);
  return root;
}

describe('parseCustGeom', () => {
  it('reads moveTo / lnTo / cubicBezTo / close and normalizes coordinates', () => {
    const commands = parseCustGeom(parseGeomNode());
    expect(commands).toEqual([
      { c: 'M', x: 0, y: 1 },
      { c: 'L', x: 1, y: 1 },
      { c: 'C', x1: 0.8, y1: 0.6, x2: 0.2, y2: 0.6, x: 0.5, y: 0 },
      { c: 'Z' },
    ]);
  });

  it('uses the path extent declared on a:path', () => {
    const xml = `<a:custGeom><a:pathLst><a:path w="200" h="100">
      <a:moveTo><a:pt x="100" y="50"/></a:moveTo><a:lnTo><a:pt x="200" y="100"/></a:lnTo>
    </a:path></a:pathLst></a:custGeom>`;
    const [root] = parseXml(xml);
    expect(parseCustGeom(root)).toEqual([
      { c: 'M', x: 0.5, y: 0.5 },
      { c: 'L', x: 1, y: 1 },
    ]);
  });

  it('returns an empty list when there is no path', () => {
    const [root] = parseXml('<a:custGeom><a:avLst/></a:custGeom>');
    expect(parseCustGeom(root)).toEqual([]);
  });
});

describe('geometryFromCustGeom', () => {
  it('builds a path geometry with an SVG string', () => {
    const geometry = geometryFromCustGeom(parseGeomNode());
    expect(geometry?.kind).toBe('path');
    expect(geometry?.prst).toBe('rect');
    expect(geometry?.path).toContain('M 0 1');
    expect(geometry?.custGeom).toHaveLength(4);
  });

  it('returns null for geometry without a usable path', () => {
    const [root] = parseXml(
      '<a:custGeom><a:pathLst><a:path w="1" h="1"/></a:pathLst></a:custGeom>',
    );
    expect(geometryFromCustGeom(root)).toBeNull();
  });
});

describe('自定义几何的完整往返', () => {
  function customDoc(): SlideDoc {
    const doc = createDoc('custom');
    const shape = createShapeElement(doc, { kind: 'path', prst: 'rect' }) as ShapeElement;
    shape.geom.custGeom = [
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 1, y: 0 },
      { c: 'L', x: 0.5, y: 1 },
      { c: 'Z' },
    ];
    doc.slides[0].elements = [shape];
    return doc;
  }

  it('导出 PPTX 再导入后路径命令保持一致', async () => {
    const exported = await exportPptxLegacy(customDoc());
    expect(exported.ok).toBe(true);
    const bytes = (exported as { ok: true; value: Uint8Array }).value;

    const imported = await importPptxFile(new File([bytes], 'custom.pptx'));
    expect(imported.ok).toBe(true);
    const doc = (imported as { ok: true; value: { doc: SlideDoc } }).value.doc;
    const shape = doc.slides[0].elements.find(
      (element): element is ShapeElement => element.type === 'shape',
    );
    expect(shape?.geom.kind).toBe('path');
    expect(shape?.geom.custGeom).toHaveLength(4);
    expect(shape?.geom.custGeom?.[2]).toEqual({ c: 'L', x: 0.5, y: 1 });
    expect(shape?.geom.path).toContain('M 0 0');
  });
});

describe('custGeomXml', () => {
  it('writes every command back with the path extent applied', () => {
    const xml = custGeomXml([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 1, y: 0.5 },
      { c: 'C', x1: 0.8, y1: 0.6, x2: 0.2, y2: 0.4, x: 0, y: 1 },
      { c: 'Q', x1: 0.5, y1: 0.5, x: 0.25, y: 1 },
      { c: 'Z' },
    ]);
    expect(xml).toContain('<a:moveTo><a:pt x="0" y="0"/></a:moveTo>');
    expect(xml).toContain('<a:lnTo><a:pt x="100000" y="50000"/></a:lnTo>');
    expect(xml).toContain('<a:cubicBezTo>');
    expect(xml).toContain('<a:quadBezTo>');
    expect(xml).toContain('<a:close/>');
    expect(xml).toContain('w="100000" h="100000"');
  });

  it('round-trips commands through XML', () => {
    const commands = [
      { c: 'M' as const, x: 0, y: 1 },
      { c: 'L' as const, x: 1, y: 1 },
      { c: 'L' as const, x: 0.5, y: 0 },
      { c: 'Z' as const },
    ];
    const [root] = parseXml(custGeomXml(commands));
    expect(parseCustGeom(root)).toEqual(commands);
  });
});
