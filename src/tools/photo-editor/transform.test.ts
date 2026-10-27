import { describe, expect, it } from 'vitest';
import {
  angleFromCenter,
  hitTransformHandle,
  resizeLayerBox,
  rotateLayerBox,
  toLocalPoint,
  transformHandles,
} from './core';
import type { LayerBox } from './core';

const box = (patch: Partial<LayerBox> = {}): LayerBox => ({
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  rotation: 0,
  ...patch,
});

describe('transformHandles', () => {
  it('places the four corners and edge midpoints on the box', () => {
    const handles = transformHandles(box(), 26);
    const at = (id: string) => handles.find((h) => h.id === id)!;
    expect(at('nw')).toMatchObject({ x: 100, y: 100 });
    expect(at('se')).toMatchObject({ x: 300, y: 200 });
    expect(at('n')).toMatchObject({ x: 200, y: 100 });
    expect(at('w')).toMatchObject({ x: 100, y: 150 });
    // The rotate handle sits outside the top edge (26 document units)
    expect(at('rotate')).toMatchObject({ x: 200, y: 74 });
  });

  it('rotates handles around the box center', () => {
    const handles = transformHandles(box({ rotation: 90 }));
    const at = (id: string) => handles.find((h) => h.id === id)!;
    // After a 90° rotation the "east" midpoint lands 100 units below the center (200,150)
    const east = at('e');
    expect(Math.round(east.x)).toBe(200);
    expect(Math.round(east.y)).toBe(250);
  });
});

describe('toLocalPoint', () => {
  it('is the identity for an unrotated box centre', () => {
    expect(toLocalPoint(box(), 200, 150)).toMatchObject({ x: 0, y: 0 });
  });

  it('inverts rotation', () => {
    // At 90°, the point directly below the center corresponds to local +x
    const local = toLocalPoint(box({ rotation: 90 }), 200, 200);
    expect(Math.round(local.x)).toBe(50);
    expect(Math.round(local.y)).toBe(0);
  });
});

describe('resizeLayerBox', () => {
  it('drags the east handle and keeps the west edge fixed', () => {
    const next = resizeLayerBox(box(), 'e', { x: 150, y: 0 });
    expect(next.x).toBe(100);
    expect(next.width).toBe(250);
    expect(next.height).toBe(100);
  });

  it('clamps to the minimum size', () => {
    const next = resizeLayerBox(box(), 'e', { x: -500, y: 0 });
    expect(next.width).toBeGreaterThanOrEqual(8);
  });

  it('Alt resizes symmetrically around the centre', () => {
    const next = resizeLayerBox(box(), 'e', { x: 150, y: 0 }, { fromCenter: true });
    // Half width 150 → width 300, center unchanged
    expect(next.width).toBe(300);
    expect(next.x + next.width / 2).toBe(200);
  });

  it('Shift keeps the aspect ratio for corner handles', () => {
    const next = resizeLayerBox(box(), 'se', { x: 150, y: 60 }, { keepRatio: true });
    expect(next.width / next.height).toBeCloseTo(2, 1);
  });

  it('preserves rotation while resizing', () => {
    const next = resizeLayerBox(box({ rotation: 30 }), 'e', { x: 150, y: 0 });
    expect(next.rotation).toBe(30);
  });
});

describe('rotateLayerBox', () => {
  it('adds the delta and normalises into -180..180', () => {
    expect(rotateLayerBox(box(), 30).rotation).toBe(30);
    expect(rotateLayerBox(box({ rotation: 170 }), 30).rotation).toBe(-160);
  });

  it('snaps to 15° steps when requested', () => {
    expect(rotateLayerBox(box(), 20, true).rotation).toBe(15);
    expect(rotateLayerBox(box(), 24, true).rotation).toBe(30);
  });
});

describe('angleFromCenter', () => {
  it('measures the pointer angle around the layer centre', () => {
    expect(Math.round(angleFromCenter(box(), 200, 50))).toBe(-90);
    expect(Math.round(angleFromCenter(box(), 400, 150))).toBe(0);
  });
});

describe('hitTransformHandle', () => {
  it('matches a handle within the radius', () => {
    expect(hitTransformHandle(box(), 300, 200, 10)).toBe('se');
  });

  it('reports inside for points within the box', () => {
    expect(hitTransformHandle(box(), 200, 150, 10)).toBe('inside');
  });

  it('reports null outside the box', () => {
    expect(hitTransformHandle(box(), 500, 500, 10)).toBeNull();
  });

  it('matches the rotation handle offset from the top edge', () => {
    const target = transformHandles(box(), 26).find((h) => h.id === 'rotate')!;
    expect(hitTransformHandle(box(), target.x, target.y, 6, 26)).toBe('rotate');
  });
});
