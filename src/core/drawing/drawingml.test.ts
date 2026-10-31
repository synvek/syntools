import { describe, expect, it } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import {
  avLstXml,
  custGeomXml,
  frameGeomXml,
  geomXml,
  parseAdjLst,
  parseCustGeom,
  parseGeomXml,
  parseShapeGeometry,
  prstGeomXml,
} from './drawingml';
import type { PathCommand, ShapeGeometry } from './geometry';
import type { XmlNode } from './xmlNode';

/**
 * P3-1.0: the geometry fragments shared by pptx `p:sp`, xlsx `xdr:sp` and docx `wps:wsp`.
 * Both directions are tested here — each editor's own suite then guards behaviour parity.
 */

/** Same preserveOrder settings the slide / docx readers use */
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  preserveOrder: true,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

function parse(xml: string): XmlNode {
  const [root] = parser.parse(xml) as XmlNode[];
  return root;
}

/** Build an `a:spPr` node holding `inner`, the way both importers hand it over */
function spPrOf(inner: string): XmlNode {
  return { ':@': {}, 'a:spPr': parse(`<a:spPr>${inner}</a:spPr>`)['a:spPr'] };
}

const triangle: PathCommand[] = [
  { c: 'M', x: 0, y: 0 },
  { c: 'L', x: 1, y: 0 },
  { c: 'L', x: 0.5, y: 1 },
  { c: 'Z' },
];

describe('avLst 写入', () => {
  it('空调整值写成自闭合 a:avLst', () => {
    expect(avLstXml(undefined)).toBe('<a:avLst/>');
    expect(avLstXml({})).toBe('<a:avLst/>');
  });

  it('按 adj 名字稳定排序并换算成 1/100000', () => {
    expect(avLstXml({ adj2: 0.25, adj1: 0.4 })).toBe(
      '<a:avLst><a:gd name="adj1" fmla="val 40000"/><a:gd name="adj2" fmla="val 25000"/></a:avLst>',
    );
  });

  it('非有限值被丢弃', () => {
    expect(avLstXml({ adj1: Number.NaN, adj2: 0.5 })).toBe(
      '<a:avLst><a:gd name="adj2" fmla="val 50000"/></a:avLst>',
    );
  });
});

describe('prstGeom 写入', () => {
  it('缺省 prst 写成 rect', () => {
    expect(prstGeomXml('')).toBe('<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>');
  });

  it('带调整值的圆角矩形', () => {
    expect(prstGeomXml('roundRect', { adj1: 0.16667 })).toBe(
      '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj1" fmla="val 16667"/></a:avLst></a:prstGeom>',
    );
  });
});

describe('custGeom 往返', () => {
  it('custGeomXml → parseCustGeom 归一化坐标一致', () => {
    expect(parseCustGeom(parse(custGeomXml(triangle)))).toEqual(triangle);
  });

  it('parseCustGeom 对无 path 的节点返回空数组', () => {
    expect(parseCustGeom(undefined)).toEqual([]);
    expect(parseCustGeom(parse('<a:custGeom><a:avLst/></a:custGeom>'))).toEqual([]);
  });
});

describe('frameGeomXml（文本框/图片的圆角框）', () => {
  it('无圆角写成 rect', () => {
    expect(frameGeomXml(200, 100, 0)).toBe('<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>');
    expect(frameGeomXml(200, 0, 10)).toContain('prst="rect"');
  });

  it('圆角按短边归一，并夹在 0.5 以内', () => {
    expect(frameGeomXml(200, 100, 10)).toContain('fmla="val 10000"');
    expect(frameGeomXml(200, 100, 500)).toContain('fmla="val 50000"');
  });
});

describe('geomXml', () => {
  it('自定义路径优先级高于 prst', () => {
    const geom: ShapeGeometry = { kind: 'path', prst: 'rect', custGeom: triangle };
    expect(geomXml(geom)).toMatch(/^<a:custGeom>/);
  });

  it('普通形状写 prstGeom + avLst', () => {
    const geom: ShapeGeometry = {
      kind: 'rect',
      prst: 'roundRect',
      radius: 0.2,
      adj: { adj1: 0.2 },
    };
    expect(geomXml(geom)).toContain('<a:prstGeom prst="roundRect">');
    expect(geomXml(geom)).toContain('<a:gd name="adj1" fmla="val 20000"/>');
  });
});

describe('反向解析', () => {
  const spPrNode = spPrOf(
    '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj1" fmla="val 40000"/></a:avLst></a:prstGeom>',
  );

  it('parseGeomXml 读回 prst 与归一化调整值', () => {
    expect(parseGeomXml(spPrNode)).toEqual({ prst: 'roundRect', adj: { adj1: 0.4 } });
    expect(parseAdjLst(spPrNode)).toEqual({ adj1: 0.4 });
  });

  it('兼容旧式 a:geom', () => {
    expect(parseGeomXml(spPrOf('<a:geom prst="ellipse"/>'))).toEqual({
      prst: 'ellipse',
      adj: undefined,
    });
  });

  it('无几何节点时降级为 rect', () => {
    expect(parseGeomXml(spPrOf('<a:solidFill/>')).prst).toBe('rect');
  });

  it('parseShapeGeometry 解析出渲染几何（prst 与 custGeom 两条路径）', () => {
    expect(parseShapeGeometry(spPrNode).kind).toBe('rect');
    expect(parseShapeGeometry(spPrNode).adj?.adj1).toBeCloseTo(0.4, 5);

    const customGeom = parseShapeGeometry(spPrOf(custGeomXml(triangle)));
    expect(customGeom.kind).toBe('path');
    expect(customGeom.custGeom).toEqual(triangle);
  });

  it('未知 prst 降级为 rect 但保留名字（保真报告要能报出来）', () => {
    const geom = parseShapeGeometry(spPrOf('<a:prstGeom prst="notARealShape"/>'));
    expect(geom.kind).toBe('rect');
    expect(geom.prst).toBe('notARealShape');
  });
});
