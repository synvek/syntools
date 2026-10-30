import { describe, expect, it } from 'vitest';
import { resolvePresetGeometry } from '../../../core/drawing/shapeDefs';
import { createDoc, createLineElement, createShapeElement } from './factory';
import {
  connectorSitePoint,
  lineGeometryFromPoints,
  nearestConnectorSite,
  withResolvedConnectors,
} from './connectors';
import type { LineElement, ShapeElement } from './types';

function shape(x = 100, y = 100, width = 200, height = 100): ShapeElement {
  const element = createShapeElement(createDoc(), resolvePresetGeometry('rect')) as ShapeElement;
  element.x = x;
  element.y = y;
  element.width = width;
  element.height = height;
  return element;
}

describe('连接线几何', () => {
  it('连接点按元素包围盒计算', () => {
    const element = shape();
    expect(connectorSitePoint(element, 0)).toEqual({ x: 200, y: 100 });
    expect(connectorSitePoint(element, 2)).toEqual({ x: 300, y: 150 });
    expect(connectorSitePoint(element, 6)).toEqual({ x: 100, y: 150 });
  });

  it('直线与正交折线都归一化到包围盒', () => {
    const straight = lineGeometryFromPoints({ x: 0, y: 0 }, { x: 100, y: 50 }, 'straight');
    expect(straight).toMatchObject({ x: 0, y: 0, width: 100, height: 50 });
    expect(straight.points).toEqual([0, 0, 100, 50]);

    const elbow = lineGeometryFromPoints({ x: 0, y: 0 }, { x: 100, y: 50 }, 'elbow');
    expect(elbow.points).toEqual([0, 0, 50, 0, 50, 50, 100, 50]);
  });

  it('绑定端点跟随形状移动', () => {
    const box = shape();
    const line = createLineElement(createDoc()) as LineElement;
    line.startCxn = { shapeId: box.id, site: 2 };
    line.endCxn = { shapeId: box.id, site: 6 };

    const first = withResolvedConnectors([box, line])[1] as LineElement;
    expect(first.points).toEqual([200, 0, 0, 0]);
    expect(first.width).toBe(200);

    const moved = { ...box, x: 160 };
    const second = withResolvedConnectors([moved, line])[1] as LineElement;
    expect(second.x).toBe(160);
    expect(second.points).toEqual([200, 0, 0, 0]);
  });

  it('自由线不被重算，保持引用不变', () => {
    const line = createLineElement(createDoc()) as LineElement;
    expect(withResolvedConnectors([line])[0]).toBe(line);
  });

  it('端点吸附只在阈值内命中非线元素', () => {
    const box = shape();
    const line = createLineElement(createDoc()) as LineElement;
    const hit = nearestConnectorSite([box, line], { x: 101, y: 151 }, line.id, 12);
    expect(hit).toMatchObject({ shapeId: box.id, site: 6 });

    expect(nearestConnectorSite([box], { x: 500, y: 500 }, undefined, 12)).toBeNull();
  });
});
