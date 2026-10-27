import { describe, expect, it } from 'vitest';
import {
  VIEW_ROTATION_STEP,
  clampViewport,
  computeFitScale,
  docToScreen,
  normalizeViewRotation,
  rotatedDocBounds,
  screenToDoc,
  stagePosition,
  zoomAtPoint,
} from './core';

/**
 * Coordinate mapping tests for view rotation.
 *
 * View rotation lives or dies on the inverse relationship between "screen ↔ document": one missed rotation
 * shows up as "the click point drifts with the angle" — fatal yet easy to miss — so two contracts are
 * locked down here: **round-trip consistency** and **zero angle degrades to the old behavior**.
 */

const size = { width: 800, height: 600 };
const viewport = { scale: 0.5, x: 120, y: 90 };

describe('normalizeViewRotation', () => {
  it('normalizes to (-180, 180]', () => {
    expect(normalizeViewRotation(0)).toBe(0);
    expect(normalizeViewRotation(370)).toBe(10);
    expect(normalizeViewRotation(-190)).toBe(170);
    expect(normalizeViewRotation(180)).toBe(180);
    expect(normalizeViewRotation(540)).toBe(180);
    expect(normalizeViewRotation(-180)).toBe(180);
  });

  it('illegal values fall back to 0, kept to two decimals', () => {
    expect(normalizeViewRotation(Number.NaN)).toBe(0);
    expect(normalizeViewRotation(11.23456)).toBe(11.23);
  });

  it('step constants match the menus', () => {
    expect(VIEW_ROTATION_STEP).toBe(15);
  });
});

describe('rotatedDocBounds: the bounding box after rotation', () => {
  it('zero angle gives the original size', () => {
    expect(rotatedDocBounds({ width: 800, height: 600 }, 0)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('at 90° width and height swap', () => {
    const bounds = rotatedDocBounds({ width: 800, height: 600 }, 90);
    expect(bounds.width).toBeCloseTo(600, 6);
    expect(bounds.height).toBeCloseTo(800, 6);
  });

  it('at 45° it grows by the trig value of π/4', () => {
    const bounds = rotatedDocBounds({ width: 100, height: 100 }, 45);
    expect(bounds.width).toBeCloseTo(100 * Math.SQRT2, 6);
  });
});

describe('docToScreen / screenToDoc: inverses of each other', () => {
  it('zero rotation degrades to the old behavior (existing interactions and e2e stay unaffected)', () => {
    const screen = docToScreen({ x: 200, y: 100 }, viewport, size, 0);
    expect(screen).toEqual({ x: 120 + 200 * 0.5, y: 90 + 100 * 0.5 });
    expect(screenToDoc({ x: 220, y: 140 }, viewport, size, 0)).toEqual({ x: 200, y: 100 });
  });

  it('round-trips at any angle', () => {
    for (const rotation of [-165, -90, -30, 15, 45, 90, 135, 180]) {
      for (const point of [
        { x: 0, y: 0 },
        { x: 800, y: 600 },
        { x: 123, y: 456 },
      ]) {
        const screen = docToScreen(point, viewport, size, rotation);
        const back = screenToDoc(screen, viewport, size, rotation);
        expect(back.x).toBeCloseTo(point.x, 6);
        expect(back.y).toBeCloseTo(point.y, 6);
      }
    }
  });

  it('the document point at the viewport center is unchanged at any angle', () => {
    const center = { x: size.width / 2, y: size.height / 2 };
    const zero = screenToDoc(center, viewport, size, 0);
    for (const rotation of [-90, 30, 120]) {
      const rotated = screenToDoc(center, viewport, size, rotation);
      expect(rotated.x).toBeCloseTo(zero.x, 6);
      expect(rotated.y).toBeCloseTo(zero.y, 6);
    }
  });

  it('at 90° the document x axis maps onto the screen y axis', () => {
    const origin = docToScreen({ x: 0, y: 0 }, viewport, size, 90);
    const along = docToScreen({ x: 100, y: 0 }, viewport, size, 90);
    // 90° clockwise: document +x becomes screen +y
    expect(along.x).toBeCloseTo(origin.x, 6);
    expect(along.y).toBeCloseTo(origin.y + 50, 6);
  });
});

describe('stagePosition: the Konva layer position', () => {
  it('at zero angle it equals the viewport pan', () => {
    expect(stagePosition({ x: 120, y: 90 }, size, 0)).toEqual({ x: 120, y: 90 });
  });

  it('rotation is about the viewport center, which is a fixed point', () => {
    const center = { x: size.width / 2, y: size.height / 2 };
    const positioned = stagePosition(center, size, 90);
    expect(positioned.x).toBeCloseTo(center.x, 6);
    expect(positioned.y).toBeCloseTo(center.y, 6);
  });

  it('matches docToScreen: the document origin lands in the same place', () => {
    for (const rotation of [-45, 30, 90]) {
      const positioned = stagePosition(viewport, size, rotation);
      const viaStage = { x: positioned.x + 0 * viewport.scale, y: positioned.y };
      const viaScreen = docToScreen({ x: 0, y: 0 }, viewport, size, rotation);
      expect(viaStage.x).toBeCloseTo(viaScreen.x, 6);
      expect(viaStage.y).toBeCloseTo(viaScreen.y, 6);
    }
  });
});

describe('computeFitScale: fitting the bounding box', () => {
  const doc = { width: 800, height: 600 };

  it('zero angle matches the old behavior', () => {
    expect(computeFitScale(doc, { width: 1000, height: 700 }, 32, 0)).toBe(
      computeFitScale(doc, { width: 1000, height: 700 }, 32),
    );
  });

  it('at 90° it uses the swapped bounding box and yields a smaller scale', () => {
    const size420 = { width: 420, height: 320 };
    const upright = computeFitScale(doc, size420, 32, 0);
    const rotated = computeFitScale(doc, size420, 32, 90);
    expect(rotated).toBeLessThan(upright);
    // After 90° the bounding box becomes 600×800: vertical (320-64)/800 = 0.32 is the bottleneck
    expect(rotated).toBeCloseTo(Math.round(((320 - 64) / 800) * 1000) / 1000, 6);
  });
});

describe('zoomAtPoint: the anchor stays put under rotation', () => {
  it('after zooming at any angle the document point under the anchor is unchanged', () => {
    const anchor = { x: 500, y: 300 };
    for (const rotation of [-60, 0, 45, 90]) {
      const before = screenToDoc(anchor, viewport, size, rotation);
      const next = zoomAtPoint(viewport, 1.25, anchor, size, rotation);
      const after = screenToDoc(anchor, { ...viewport, ...next }, size, rotation);
      // Viewport translation is rounded to keep pixels crisp, so sub-pixel error (~0.08 document units) is allowed
      expect(Math.abs(after.x - before.x)).toBeLessThan(1);
      expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    }
  });

  it('without dimensions it degrades to the old linear math', () => {
    const next = zoomAtPoint(viewport, 1, { x: 220, y: 140 });
    expect(next).toEqual({ scale: 1, x: Math.round(220 - 200 * 1), y: Math.round(140 - 100 * 1) });
  });
});

describe('clampViewport: every canvas corner stays reachable after rotation', () => {
  const doc = { width: 800, height: 600 };

  it('zero angle matches the old behavior', () => {
    const next = clampViewport({ x: 99999, y: -99999, scale: 1 }, doc, size, undefined, 0);
    expect(next).toEqual(clampViewport({ x: 99999, y: -99999, scale: 1 }, doc, size));
  });

  it('rotation widens the scroll range to the bounding box (otherwise the canvas gets locked)', () => {
    const rotated = clampViewport({ x: 99999, y: -99999, scale: 1 }, doc, size, undefined, 45);
    const upright = clampViewport({ x: 99999, y: -99999, scale: 1 }, doc, size, undefined, 0);
    expect(Math.abs(rotated.x)).toBeGreaterThanOrEqual(Math.abs(upright.x));
    expect(Number.isFinite(rotated.x) && Number.isFinite(rotated.y)).toBe(true);
  });
});
