import { describe, expect, it } from 'vitest';
import { SNAP_THRESHOLD_PX, collectSnapTargets, snapBoxPosition } from './core';
import { createDoc } from './model/factory';
import type { Guide, Layer, PhotoDoc } from './model/types';

/**
 * Pure-logic tests for snapping (smart guides).
 *
 * Snapping is the classic "almost aligned" case: not snapping at 2 px makes people nudge over and over,
 * snapping too eagerly feels out of control, so three contracts are pinned here: snap within the threshold, release beyond it, and let the toggle / modifier switch it off.
 */

const raster = (over: Partial<Layer> & { id: string }): Layer =>
  ({
    kind: 'raster',
    name: over.id,
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    flipX: false,
    flipY: false,
    assetId: `asset-${over.id}`,
    rev: 0,
    adjustments: [],
    filters: [],
    ...over,
  }) as Layer;

const docWith = (layers: Layer[], over: Partial<PhotoDoc> = {}): PhotoDoc => ({
  ...createDoc(),
  width: 800,
  height: 600,
  layers,
  activeLayerId: layers[0]?.id ?? null,
  ...over,
});

describe('collectSnapTargets: where candidate lines come from', () => {
  it('canvas edges and center are always candidates', () => {
    const targets = collectSnapTargets(docWith([]));
    expect(targets.vertical).toEqual([0, 400, 800]);
    expect(targets.horizontal).toEqual([0, 300, 600]);
  });

  it('the left / center / right and top / middle / bottom of other visible layers are candidates', () => {
    const doc = docWith([raster({ id: 'a', x: 100, y: 200, width: 80, height: 40 })]);
    const targets = collectSnapTargets(doc);
    expect(targets.vertical).toEqual(expect.arrayContaining([100, 140, 180]));
    expect(targets.horizontal).toEqual(expect.arrayContaining([200, 220, 240]));
  });

  it('the dragged layer itself is excluded (it would snap to itself)', () => {
    const doc = docWith([raster({ id: 'a', x: 100, y: 200 }), raster({ id: 'b', x: 500, y: 400 })]);
    const targets = collectSnapTargets(doc, { excludeLayerId: 'a' });
    expect(targets.vertical).not.toContain(100);
    expect(targets.vertical).toEqual(expect.arrayContaining([500, 550, 600]));
  });

  it('hidden layers do not snap', () => {
    const doc = docWith([raster({ id: 'a', x: 700, visible: false })]);
    expect(collectSnapTargets(doc).vertical).not.toContain(700);
  });

  it('existing guides join the candidates by axis', () => {
    const guides: Guide[] = [
      { axis: 'v', pos: 123 },
      { axis: 'h', pos: 456 },
    ];
    const targets = collectSnapTargets(docWith([]), { guides });
    expect(targets.vertical).toContain(123);
    expect(targets.horizontal).toContain(456);
  });
});

describe('snapBoxPosition: the snap decision', () => {
  const targets = { vertical: [400], horizontal: [300] };

  it('within the threshold the center snaps to the candidate and a guide is returned', () => {
    // Box center 402 → 2 px from the candidate line, threshold 6 → should snap
    const result = snapBoxPosition({ x: 352, y: 100, width: 100, height: 40 }, targets, 6);
    expect(result.x).toBe(350);
    expect(result.guides).toEqual([{ axis: 'x', position: 400 }]);
  });

  it('beyond the threshold nothing moves and no guide appears', () => {
    // The three lines are 200 / 250 / 300, all beyond the threshold from the candidate at 400
    const result = snapBoxPosition({ x: 200, y: 100, width: 100, height: 40 }, targets, 6);
    expect(result.x).toBe(200);
    expect(result.guides).toEqual([]);
  });

  it('when already aligned nothing moves but the guide still appears (showing alignment)', () => {
    const result = snapBoxPosition({ x: 300, y: 100, width: 100, height: 40 }, targets, 6);
    expect(result.x).toBe(300);
    expect(result.guides).toEqual([{ axis: 'x', position: 400 }]);
  });

  it('left, right and center can all snap (any one of the three hitting is enough)', () => {
    // Outside the right edge 400 + 8 = 408; putting the right edge at 402 should snap
    const result = snapBoxPosition({ x: 302, y: 0, width: 100, height: 40 }, targets, 6);
    expect(result.x + 100).toBe(400);
    expect(result.guides[0]).toEqual({ axis: 'x', position: 400 });
  });

  it('both axes can snap at once', () => {
    const result = snapBoxPosition({ x: 350, y: 250, width: 100, height: 100 }, targets, 6);
    expect(result.x).toBe(350);
    expect(result.y).toBe(300 - 50);
    expect(result.guides).toHaveLength(2);
    expect(result.guides.map((guide) => guide.axis).sort()).toEqual(['x', 'y']);
  });

  it('takes the nearest candidate within the threshold (never a farther but larger one)', () => {
    const many = { vertical: [396, 400], horizontal: [] };
    const result = snapBoxPosition({ x: 352, y: 0, width: 100, height: 10 }, many, 6);
    // Center 402 is closer to 400 (2 < 6) and 6 away from 396 — so 400 wins
    expect(result.x).toBe(350);
  });

  it('returns the input unchanged when snapping is off', () => {
    const result = snapBoxPosition({ x: 352, y: 100, width: 100, height: 40 }, targets, 6, {
      enabled: false,
    });
    expect(result).toEqual({ x: 352, y: 100, guides: [] });
  });

  it('a threshold of 0 disables snapping (including the extreme-zoom edge case)', () => {
    const result = snapBoxPosition({ x: 352, y: 100, width: 100, height: 40 }, targets, 0);
    expect(result.x).toBe(352);
  });

  it('with the grid on it snaps to the nearest grid line', () => {
    const result = snapBoxPosition(
      { x: 17, y: 100, width: 10, height: 10 },
      { vertical: [], horizontal: [] },
      4,
      { gridSize: 20 },
    );
    // The grid only snaps the top-left corner: left edge 17 → nearest grid line 20 (center line 22 is not used)
    expect(result.x).toBe(20);
    expect(result.guides[0]).toEqual({ axis: 'x', position: 20 });
  });

  it('screen-threshold semantics: the smaller the zoom, the larger the threshold in document units', () => {
    // For the same box at zoom 0.1, 6 screen pixels = 60 document units, enough to reach the distant candidate
    const result = snapBoxPosition(
      { x: 352, y: 0, width: 100, height: 10 },
      { vertical: [400], horizontal: [] },
      SNAP_THRESHOLD_PX / 0.1,
    );
    expect(result.x).toBe(350);
  });
});
