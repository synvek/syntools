import { beforeEach, describe, expect, it } from 'vitest';
import { resolvePresetGeometry } from '../../core/drawing/shapeDefs';
import { createDoc, createShapeElement } from './model/factory';
import type { ShapeElement } from './model/types';
import { useSlideStore } from './store';

/** 形状拖拽绘制：绘制态 + 按拉框尺寸建形状（PowerPoint 的顺序） */

function reset(): void {
  useSlideStore.setState({
    doc: createDoc('draw-shape'),
    slideIndex: 0,
    selection: [],
    past: [],
    future: [],
    report: null,
    penMode: false,
    penPoints: [],
    drawShapeGeom: null,
    viewMode: 'normal',
    masterKind: 'master',
    masterIndex: 0,
  });
}

function shapes(): ShapeElement[] {
  const { doc, slideIndex } = useSlideStore.getState();
  return doc.slides[slideIndex].elements.filter(
    (element): element is ShapeElement => element.type === 'shape',
  );
}

describe('shape draw mode', () => {
  beforeEach(reset);

  it('entering draw mode cancels the pen tool (two tools must not overlap)', () => {
    useSlideStore.getState().setPenMode(true);
    useSlideStore.getState().addPenPoint({ x: 10, y: 10 });
    useSlideStore.getState().setDrawShapeGeom(resolvePresetGeometry('ellipse'));
    const state = useSlideStore.getState();
    expect(state.penMode).toBe(false);
    expect(state.penPoints).toEqual([]);
    expect(state.drawShapeGeom?.kind).toBe('ellipse');
  });

  it('creates the shape with the dragged rectangle', () => {
    const geom = resolvePresetGeometry('rect');
    useSlideStore.getState().setDrawShapeGeom(geom);
    const geo = useSlideStore.getState().drawShapeGeom;
    expect(geo).not.toBeNull();
    useSlideStore.getState().addElement(
      createShapeElement(useSlideStore.getState().doc, geo!, {
        x: 120,
        y: 80,
        width: 260,
        height: 140,
      }),
    );
    useSlideStore.getState().setDrawShapeGeom(null);

    expect(useSlideStore.getState().drawShapeGeom).toBeNull();
    const [created] = shapes();
    expect(created).toBeDefined();
    expect(created.x).toBe(120);
    expect(created.y).toBe(80);
    expect(created.width).toBe(260);
    expect(created.height).toBe(140);
  });

  it('falls back to the centered default size when no rectangle is given', () => {
    const doc = useSlideStore.getState().doc;
    const element = createShapeElement(doc, resolvePresetGeometry('roundRect'));
    expect(element.width).toBe(240);
    expect(element.height).toBe(160);
    expect(element.x).toBe(Math.round((doc.width - 240) / 2));
  });

  it('rounds fractional pointer rectangles (canvas coordinates are floats)', () => {
    const doc = useSlideStore.getState().doc;
    const element = createShapeElement(doc, resolvePresetGeometry('rect'), {
      x: 10.6,
      y: 20.2,
      width: 100.4,
      height: 60.9,
    });
    expect(element).toMatchObject({ x: 11, y: 20, width: 100, height: 61 });
  });
});
