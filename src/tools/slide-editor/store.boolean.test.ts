import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, createShapeElement } from './model/factory';
import type { SlideElement } from './model/types';
import { useSlideStore } from './store';

/** Boolean combine through the store (P2-S5): picking, history (undo) and z-order placement */

function reset(): void {
  useSlideStore.setState({
    doc: createDoc('boolean'),
    slideIndex: 0,
    selection: [],
    past: [],
    future: [],
    report: null,
    pathEditId: null,
    activePathNode: null,
    groupPath: [],
    viewMode: 'normal',
    masterKind: 'master',
    masterIndex: 0,
  });
}

function addRect(x: number, y: number): string {
  const element = createShapeElement(useSlideStore.getState().doc, { kind: 'rect', prst: 'rect' });
  element.x = x;
  element.y = y;
  element.width = 50;
  element.height = 40;
  useSlideStore.getState().addElement(element);
  return element.id;
}

function elements(): SlideElement[] {
  return useSlideStore.getState().doc.slides[0].elements;
}

describe('combineSelection', () => {
  beforeEach(reset);

  it('少于两个形状时直接跳过，不写历史', async () => {
    const a = addRect(10, 10);
    const pastBefore = useSlideStore.getState().past.length;
    useSlideStore.getState().select([a]);

    await expect(useSlideStore.getState().combineSelection('union')).resolves.toBe(
      'too-few-shapes',
    );
    expect(useSlideStore.getState().past.length).toBe(pastBefore);
    expect(elements()).toHaveLength(1);
  });

  it('组合不参与布尔运算（只数形状）', async () => {
    const a = addRect(10, 10);
    const b = addRect(200, 200);
    useSlideStore.getState().select([a, b]);
    useSlideStore.getState().groupSelected();
    const group = elements().find((element) => element.type === 'group');

    const c = addRect(400, 400);
    useSlideStore.getState().select([group?.id ?? '', c]);
    await expect(useSlideStore.getState().combineSelection('union')).resolves.toBe(
      'too-few-shapes',
    );
    expect(elements()).toHaveLength(2);
  });

  it('并集得到一个形状并选中它，撤销可恢复两个输入', async () => {
    const a = addRect(10, 10);
    const b = addRect(30, 30);
    useSlideStore.getState().select([a, b]);

    await expect(useSlideStore.getState().combineSelection('union')).resolves.toBe('ok');

    const merged = elements();
    expect(merged).toHaveLength(1);
    const element = merged[0];
    expect(element.type).toBe('shape');
    if (element.type !== 'shape') return;
    expect(element.geom.kind).toBe('path');
    expect(element.geom.custGeom?.length).toBeGreaterThan(0);
    expect(useSlideStore.getState().selection).toEqual([element.id]);

    useSlideStore.getState().undo();
    expect(
      elements()
        .map((item) => item.id)
        .sort(),
    ).toEqual([a, b].sort());
  });

  it('结果落在最底输入的层级位置', async () => {
    const bottom = addRect(10, 10);
    const middle = addRect(300, 300);
    const top = addRect(30, 30);
    useSlideStore.getState().select([bottom, top]);

    await expect(useSlideStore.getState().combineSelection('union')).resolves.toBe('ok');

    const ids = elements().map((element) => element.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(bottom);
    // The untouched shape keeps its relative stacking order above the result
    expect(ids[1]).toBe(middle);
  });

  it('空结果不改文档、不写历史', async () => {
    const a = addRect(0, 0);
    const b = addRect(600, 400);
    useSlideStore.getState().select([a, b]);
    const pastBefore = useSlideStore.getState().past.length;

    await expect(useSlideStore.getState().combineSelection('intersect')).resolves.toBe(
      'empty-result',
    );
    expect(useSlideStore.getState().past.length).toBe(pastBefore);
    expect(
      elements()
        .map((element) => element.id)
        .sort(),
    ).toEqual([a, b].sort());
  });
});
