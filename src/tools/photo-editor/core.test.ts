import { describe, expect, it } from 'vitest';
import {
  BLEND_MODES,
  CANVAS_PRESETS,
  FILTERS,
  MAX_CANVAS_SIZE,
  MAX_ZOOM,
  MIN_CANVAS_SIZE,
  MIN_ZOOM,
  OVERSCROLL_SCREEN,
  bakeSignature,
  buildFilterString,
  clampScale,
  clampViewport,
  checkImageFile,
  checkProjectFile,
  clampBrushSize,
  clampPercent,
  clampRect,
  clampUnit,
  computeFitScale,
  defaultColorBalance,
  defaultCurves,
  defaultLevels,
  effectiveLocked,
  effectiveVisible,
  hasExtendedAdjustments,
  flattenStack,
  historyTimeline,
  layerAssetIds,
  maskSignature,
  moveSubtree,
  subtreeIdsOf,
  formatBytes,
  fullSelection,
  hexToRgb,
  intersectRect,
  invertSelection,
  needsPixelPass,
  normalizeRect,
  pointInSelection,
  polygonBounds,
  rgbToHex,
  sanitizeFilename,
  scrollMetrics,
  selectionPolygon,
  simplifyPath,
  viewportFromScroll,
  zoomAtPoint,
} from './core';
import { createAdjustments } from './model/factory';
import { photoStrings } from './strings';
import type { Selection } from './model/types';
import type { GroupLayer, HistoryEntry, HistoryLabel, Layer, PhotoDoc } from './model/types';

describe('Clamping and formatting', () => {
  it('brush size lands in the valid range, invalid values fall back to the minimum', () => {
    expect(clampBrushSize(0)).toBe(1);
    expect(clampBrushSize(9999)).toBe(400);
    expect(clampBrushSize(Number.NaN)).toBe(1);
    expect(clampBrushSize(12.6)).toBe(13);
  });

  it('percentages and opacity are rounded within their range', () => {
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(-120)).toBe(-100);
    expect(clampUnit(1.8)).toBe(1);
    expect(clampUnit(0.456)).toBe(0.46);
  });

  it('file names strip path separators', () => {
    expect(sanitizeFilename('a/b:c*d?')).toBe('a-b-c-d-');
    expect(sanitizeFilename('   ')).toBe('photo');
  });

  it('byte formatting', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0MB');
  });
});

describe('Colors', () => {
  it('converts between hex and rgb', () => {
    expect(hexToRgb('#2563EB')).toEqual({ r: 37, g: 99, b: 235 });
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(hexToRgb('nope')).toBeNull();
    expect(rgbToHex(37, 99, 235)).toBe('#2563EB');
  });
});

describe('Adjustments → filter pipeline', () => {
  it('default parameters produce no CSS filter', () => {
    expect(buildFilterString(createAdjustments())).toBe('');
  });

  it('brightness and exposure stack, hue gets its own segment', () => {
    const result = buildFilterString({
      ...createAdjustments(),
      brightness: 20,
      hue: 90,
      saturation: -50,
    });
    expect(result).toContain('brightness(1.2)');
    expect(result).toContain('hue-rotate(90deg)');
    expect(result).toContain('saturate(0.5)');
  });

  it('temperature / sharpen / non-CSS filters need the pixel pass', () => {
    expect(needsPixelPass(createAdjustments(), [{ id: 'grayscale' }])).toBe(false);
    expect(needsPixelPass(createAdjustments(), [{ id: 'gaussianBlur' }])).toBe(false);
    expect(needsPixelPass({ ...createAdjustments(), temperature: 10 }, [])).toBe(true);
    expect(needsPixelPass({ ...createAdjustments(), sharpen: 40 }, [])).toBe(true);
    expect(needsPixelPass(createAdjustments(), [{ id: 'pixelate' }])).toBe(true);
    expect(needsPixelPass(createAdjustments(), [{ id: 'motionBlur' }])).toBe(true);
  });

  it('enabling extended adjustments also needs the pixel pass', () => {
    expect(hasExtendedAdjustments(createAdjustments())).toBe(false);
    expect(hasExtendedAdjustments({ ...createAdjustments(), levels: defaultLevels() })).toBe(true);
    expect(hasExtendedAdjustments({ ...createAdjustments(), desaturate: true })).toBe(true);
    expect(hasExtendedAdjustments({ ...createAdjustments(), curves: defaultCurves() })).toBe(true);
    expect(needsPixelPass({ ...createAdjustments(), threshold: 128 }, [])).toBe(true);
    expect(
      needsPixelPass({ ...createAdjustments(), colorBalance: defaultColorBalance() }, []),
    ).toBe(true);
  });

  it('the bake signature changes with parameters and the version number', () => {
    const base = bakeSignature('asset-1', 1, createAdjustments(), []);
    const revChanged = bakeSignature('asset-1', 2, createAdjustments(), []);
    const paramChanged = bakeSignature(
      'asset-1',
      1,
      { ...createAdjustments(), brightness: 10 },
      [],
    );
    expect(base).not.toBe(revChanged);
    expect(base).not.toBe(paramChanged);
  });
});

describe('Geometry', () => {
  it('a dragged rectangle normalizes to positive width and height', () => {
    expect(normalizeRect({ x: 30, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 20,
      height: 30,
    });
  });

  it('the rectangle is clipped to the canvas', () => {
    const clamped = clampRect(
      { x: -10, y: 90, width: 100, height: 100 },
      { width: 100, height: 100 },
    );
    expect(clamped).toEqual({ x: 0, y: 90, width: 100, height: 10 });
  });

  it('intersecting and non-intersecting', () => {
    expect(
      intersectRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    ).toEqual({
      x: 5,
      y: 5,
      width: 5,
      height: 5,
    });
    expect(
      intersectRect({ x: 0, y: 0, width: 5, height: 5 }, { x: 10, y: 10, width: 5, height: 5 }),
    ).toBeNull();
  });

  it('fit-to-view leaves a margin and never upscales small images', () => {
    // Fits 460 wide / 260 tall → take the smaller one, 0.46
    expect(
      computeFitScale({ width: 1000, height: 500 }, { width: 500, height: 300 }, 20),
    ).toBeCloseTo(0.46, 2);
    expect(computeFitScale({ width: 100, height: 100 }, { width: 1000, height: 1000 }, 20)).toBe(1);
  });

  it('lasso vertices are thinned and the bounding box computed', () => {
    const path = [0, 0, 1, 0, 2, 0, 3, 0, 30, 20];
    expect(simplifyPath(path).length).toBeLessThan(path.length);
    expect(polygonBounds([0, 0, 10, 20])).toEqual({ x: 0, y: 0, width: 10, height: 20 });
  });
});

describe('Selection hit-testing', () => {
  const rect: Selection = {
    kind: 'rect',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    path: [],
    feather: 0,
  };
  const ellipse: Selection = { ...rect, kind: 'ellipse' };
  const lasso: Selection = {
    ...rect,
    kind: 'lasso',
    path: [0, 0, 100, 0, 100, 50, 0, 50],
  };

  it('a rectangular selection is tested by its bounding box', () => {
    expect(pointInSelection(rect, 50, 25)).toBe(true);
    expect(pointInSelection(rect, 120, 25)).toBe(false);
  });

  it('an elliptical selection excludes the corners', () => {
    expect(pointInSelection(ellipse, 50, 25)).toBe(true);
    expect(pointInSelection(ellipse, 2, 2)).toBe(false);
  });

  it('a lasso is tested as a polygon', () => {
    expect(pointInSelection(lasso, 50, 25)).toBe(true);
    expect(pointInSelection(lasso, -5, 25)).toBe(false);
  });
});

describe('Viewport scrolling and zoom', () => {
  const doc = { width: 1280, height: 720 };
  const size = { width: 650, height: 518 };

  it('zoom clamps to the limits, invalid values fall back to the minimum', () => {
    expect(clampScale(100)).toBe(MAX_ZOOM);
    expect(clampScale(0.0001)).toBe(MIN_ZOOM);
    expect(clampScale(Number.NaN)).toBe(MIN_ZOOM);
    expect(clampScale(0.5)).toBe(0.5);
  });

  it('overflowing content produces a scroll range, fitting content gives 0', () => {
    // 100%: a 1280×720 canvas in a 650×518 viewport → both axes scroll
    const big = scrollMetrics(doc, { ...size, scale: 1, x: 0, y: 0 });
    expect(big.rangeX).toBeGreaterThan(0);
    expect(big.rangeY).toBeGreaterThan(0);
    expect(big.worldW).toBe(1280 + 2 * OVERSCROLL_SCREEN);
    expect(big.worldW - big.rangeX).toBeCloseTo(big.viewW, 5);

    // 5%: the whole canvas fits the viewport → range is 0 (no scrollbar)
    const small = scrollMetrics(doc, { ...size, scale: 0.05, x: 0, y: 0 });
    expect(small.rangeX).toBe(0);
    expect(small.rangeY).toBe(0);
  });

  it('the viewport position is clamped to the world', () => {
    const metrics = scrollMetrics(doc, { ...size, scale: 1, x: 99999, y: -99999 });
    expect(metrics.left).toBe(metrics.worldLeft);
    expect(metrics.top).toBe(metrics.worldTop + metrics.rangeY);

    const clamped = clampViewport({ x: -99999, y: 99999, scale: 1 }, doc, size);
    expect(clamped.x).toBe(-(metrics.worldLeft + metrics.rangeX));
    expect(clamped.y).toBe(-metrics.worldTop);
  });

  it('world coordinates ↔ screen pan are inverses (allowing integer-pixel rounding)', () => {
    // Take values inside the range: world coordinates [-320, 300] (horizontal) / [-320, 4] (vertical)
    const { x, y } = viewportFromScroll(-100, -100, 0.5);
    expect({ x, y }).toEqual({ x: 50, y: 50 });

    const back = scrollMetrics(doc, { ...size, scale: 0.5, x, y });
    // Screen pixels are rounded → mapping back to document units is off by at most 1/scale
    expect(Math.abs(back.left + 100)).toBeLessThanOrEqual(1 / 0.5);
    expect(Math.abs(back.top + 100)).toBeLessThanOrEqual(1 / 0.5);
  });

  it('zoom at the cursor: the document point under the anchor stays put', () => {
    const before = { x: 28, y: 92, scale: 0.5 };
    const anchor = { x: 300, y: 200 };
    const docX = (anchor.x - before.x) / before.scale;
    const docY = (anchor.y - before.y) / before.scale;

    const next = zoomAtPoint(before, 1.25, anchor);
    expect(next.scale).toBe(1.25);
    expect((anchor.x - next.x) / next.scale).toBeCloseTo(docX, 3);
    expect((anchor.y - next.y) / next.scale).toBeCloseTo(docY, 3);
  });

  it('anchored zoom obeys the same limits', () => {
    const next = zoomAtPoint({ x: 0, y: 0, scale: 1 }, 100, { x: 0, y: 0 });
    expect(next.scale).toBe(MAX_ZOOM);
  });
});

describe('Selection follow-up helpers', () => {
  const canvas = { width: 200, height: 100 };
  const rect: Selection = {
    kind: 'rect',
    x: 50,
    y: 25,
    width: 100,
    height: 50,
    path: [],
    feather: 0,
  };

  it('select all covers the whole canvas', () => {
    const all = fullSelection(canvas);
    expect(all.kind).toBe('rect');
    expect(all.width).toBe(200);
    expect(pointInSelection(all, 199, 99)).toBe(true);
  });

  it('invert: the original selection becomes a hole, everything else is hit', () => {
    const inverted = invertSelection(rect, canvas);
    // Invert turns the original contour into a difference contour (the multi-contour model replaced the old single hole field)
    expect(inverted.parts?.length ?? 0).toBeGreaterThan(0);
    expect(inverted.parts?.some((part) => part.add === false)).toBe(true);
    // The original selection center falls in the hole → not part of the inverted result
    expect(pointInSelection(inverted, 100, 50)).toBe(false);
    // Other canvas positions are part of the inverted result
    expect(pointInSelection(inverted, 10, 10)).toBe(true);
    expect(pointInSelection(inverted, 190, 90)).toBe(true);
  });

  it('an elliptical selection converts to polygon vertices (48 samples)', () => {
    const points = selectionPolygon({ ...rect, kind: 'ellipse' });
    expect(points.length).toBe(96);
  });

  it('a rectangular selection converts to polygon vertices', () => {
    expect(selectionPolygon(rect)).toEqual([50, 25, 150, 25, 150, 75, 50, 75]);
  });
});

describe('File validation', () => {
  it('image extension / empty file / over the limit', () => {
    expect(checkImageFile({ name: 'a.png', size: 1024 }).ok).toBe(true);
    expect(checkImageFile({ name: 'a.txt', size: 1024 })).toEqual({
      ok: false,
      error: 'NOT_IMAGE',
    });
    expect(checkImageFile({ name: 'a.png', size: 0 })).toEqual({ ok: false, error: 'EMPTY' });
    const tooLarge = checkImageFile({ name: 'a.jpg', size: 40 * 1024 * 1024 });
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.params?.max).toBe(30);
  });

  it('project files must be json', () => {
    expect(checkProjectFile({ name: 'a.photo.json', size: 100 }).ok).toBe(true);
    expect(checkProjectFile({ name: 'a.png', size: 100 })).toEqual({
      ok: false,
      error: 'NOT_PROJECT',
    });
  });
});

describe('String completeness', () => {
  const flatten = (tree: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [`${prefix}${key}`]
        : flatten(value as Record<string, unknown>, `${prefix}${key}.`),
    );

  it('nine languages share exactly the same key set as Simplified Chinese (catches missing translations)', () => {
    const keys = Object.keys(photoStrings);
    expect(keys).toHaveLength(9);

    const base = flatten(photoStrings.zh).sort();
    expect(base.length).toBeGreaterThan(120);
    for (const [lang, tree] of Object.entries(photoStrings)) {
      expect({ lang, keys: flatten(tree).sort() }).toEqual({ lang, keys: base });
    }
  });

  it('no language has empty strings', () => {
    const values = (tree: Record<string, unknown>): string[] =>
      Object.values(tree).flatMap((value) =>
        typeof value === 'string' ? [value] : values(value as Record<string, unknown>),
      );

    for (const [lang, tree] of Object.entries(photoStrings)) {
      expect({ lang, empty: values(tree).filter((text) => !text.trim()) }).toEqual({
        lang,
        empty: [],
      });
    }
  });
});

describe('Tool constants', () => {
  it('preset sizes are all within the valid range', () => {
    for (const preset of CANVAS_PRESETS) {
      expect(preset.width).toBeGreaterThanOrEqual(MIN_CANVAS_SIZE);
      expect(preset.height).toBeLessThanOrEqual(MAX_CANVAS_SIZE);
    }
  });

  it('blend modes and filter enums can populate dropdowns', () => {
    expect(BLEND_MODES[0]).toBe('normal');
    expect(FILTERS.length).toBeGreaterThanOrEqual(10);
    expect(FILTERS).toContain('grayscale');
  });
});

describe('layer stack flattening and inheritance (groups / masks first)', () => {
  const base = {
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal' as const,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
  };

  function makeDoc(layers: Layer[]): PhotoDoc {
    return {
      id: 'd',
      name: '',
      width: 800,
      height: 600,
      background: 'white',
      layers,
      activeLayerId: null,
      swatches: [],
    };
  }

  const raster = (id: string, patch: Partial<Layer> = {}): Layer =>
    ({
      ...base,
      id,
      kind: 'raster',
      assetId: `a-${id}`,
      rev: 1,
      adjustments: {} as never,
      filters: [],
      ...patch,
    }) as Layer;
  const group = (id: string, patch: Partial<Layer> = {}): Layer =>
    ({ ...base, id, kind: 'group', passThrough: true, ...patch }) as Layer;

  it('the flat stack expands by parentId into a begin/end wrapped sequence', () => {
    const doc = makeDoc([
      raster('bottom'),
      group('g', { parentId: null }),
      raster('in1', { parentId: 'g' }),
      raster('in2', { parentId: 'g' }),
      raster('top'),
    ]);
    const steps = flattenStack(doc);
    expect(steps.map((step) => `${step.kind}:${step.layer.id}`)).toEqual([
      'layer:bottom',
      'group-begin:g',
      'layer:in1',
      'layer:in2',
      'group-end:g',
      'layer:top',
    ]);
  });

  it('groups nest, and empty groups still emit a pair', () => {
    const doc = makeDoc([
      group('outer'),
      group('inner', { parentId: 'outer' }),
      raster('deep', { parentId: 'inner' }),
      group('empty', { parentId: 'outer' }),
    ]);
    expect(flattenStack(doc).map((step) => `${step.kind}:${step.layer.id}`)).toEqual([
      'group-begin:outer',
      'group-begin:inner',
      'layer:deep',
      'group-end:inner',
      'group-begin:empty',
      'group-end:empty',
      'group-end:outer',
    ]);
  });

  it('a parentId pointing at a missing layer demotes it to top level instead of dropping it', () => {
    const doc = makeDoc([raster('orphan', { parentId: 'ghost' })]);
    expect(flattenStack(doc).map((step) => step.layer.id)).toEqual(['orphan']);
  });

  it('visibility / lock inherit from ancestors', () => {
    const doc = makeDoc([
      group('g', { visible: false }),
      raster('child', { parentId: 'g' }),
      raster('free'),
    ]);
    const child = doc.layers[1];
    const free = doc.layers[2];
    expect(effectiveVisible(doc, child)).toBe(false);
    expect(effectiveVisible(doc, free)).toBe(true);

    const lockedDoc = makeDoc([group('g', { locked: true }), raster('child', { parentId: 'g' })]);
    expect(effectiveLocked(lockedDoc, lockedDoc.layers[1])).toBe(true);
    expect(effectiveLocked(doc, free)).toBe(false);
  });

  it('its own hidden / locked flags apply too', () => {
    const doc = makeDoc([raster('a', { visible: false }), raster('b', { locked: true })]);
    expect(effectiveVisible(doc, doc.layers[0])).toBe(false);
    expect(effectiveLocked(doc, doc.layers[1])).toBe(true);
  });

  it('mask signature: null when absent / disabled, key changes with pixels or parameters', () => {
    const plain = raster('a');
    expect(maskSignature(plain)).toBeNull();

    const masked = raster('b', {
      mask: { assetId: 'm1', rev: 2, enabled: true, inverted: false, density: 1, feather: 3 },
    });
    const key = maskSignature(masked)!;
    expect(key).toContain('m1');
    expect(maskSignature(raster('b', { mask: { ...masked.mask!, enabled: false } }))).toBeNull();
    expect(maskSignature(raster('b', { mask: { ...masked.mask!, rev: 3 } }))).not.toBe(key);
    expect(maskSignature(raster('b', { mask: { ...masked.mask!, inverted: true } }))).not.toBe(key);
  });

  it('asset collection covers bitmaps, smart-object sources and masks', () => {
    expect(layerAssetIds(raster('a'))).toEqual(['a-a']);
    expect(
      layerAssetIds({
        ...base,
        id: 's',
        kind: 'smart',
        sourceAssetId: 'src',
        sourceWidth: 10,
        sourceHeight: 10,
        mask: { assetId: 'm', rev: 1, enabled: true, inverted: false, density: 1, feather: 0 },
      } as Layer),
    ).toEqual(['src', 'm']);
    expect(layerAssetIds(group('g'))).toEqual([]);
  });
});

describe('History timeline (panel data source)', () => {
  const entry = (label: HistoryLabel, at: number): HistoryEntry => ({
    doc: {
      id: 'd',
      name: '',
      width: 10,
      height: 10,
      background: 'white',
      layers: [],
      activeLayerId: null,
      swatches: [],
    },
    label,
    at,
  });

  it('with only the current state it is a single open-document row', () => {
    const rows = historyTimeline([], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: 'histOpen', current: true });
  });

  it('each row shows the action that produced that state; the current row takes the last action', () => {
    const rows = historyTimeline([entry('histAddLayer', 100), entry('histBrush', 200)], []);
    expect(rows.map((row) => row.label)).toEqual(['histOpen', 'histAddLayer', 'histBrush']);
    expect(rows.map((row) => row.current)).toEqual([false, false, true]);
  });

  it('redoable rows sit at the end and are not marked current', () => {
    const rows = historyTimeline([entry('histBrush', 100)], [entry('histBrush', 300)]);
    expect(rows).toHaveLength(3);
    expect(rows[1].current).toBe(true);
    expect(rows[2]).toMatchObject({ label: 'histBrush', current: false });
  });

  it('the row index is the jumpTo target: past.length is current', () => {
    const past = [entry('histAddLayer', 1), entry('histMerge', 2)];
    const rows = historyTimeline(past, []);
    expect(rows.findIndex((row) => row.current)).toBe(past.length);
  });
});

describe('Group stack operations (pure functions)', () => {
  const base = {
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal' as const,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
  };
  const leaf = (id: string, parentId: string | null = null): Layer =>
    ({
      ...base,
      id,
      kind: 'raster',
      parentId,
      assetId: `a-${id}`,
      rev: 1,
      adjustments: {} as never,
      filters: [],
    }) as Layer;
  const grp = (id: string, parentId: string | null = null, passThrough = true): GroupLayer =>
    ({ ...base, id, kind: 'group', parentId, passThrough }) as GroupLayer;

  const docOf = (layers: Layer[]): PhotoDoc => ({
    id: 'd',
    name: '',
    width: 800,
    height: 600,
    background: 'white',
    layers,
    activeLayerId: null,
    swatches: [],
  });

  it('the subtree contains itself and every descendant', () => {
    const doc = docOf([grp('g'), leaf('c1', 'g'), grp('g2', 'g'), leaf('c2', 'g2'), leaf('out')]);
    expect(subtreeIdsOf(doc, 'g')).toEqual(['g', 'c1', 'g2', 'c2']);
    expect(subtreeIdsOf(doc, 'out')).toEqual(['out']);
  });

  it('move into a group: the layer and its subtree follow the group, and parentId updates', () => {
    const doc = docOf([leaf('a'), grp('g'), leaf('b')]);
    const next = moveSubtree(doc.layers, 'a', 'g');
    expect(next.map((l) => l.id)).toEqual(['g', 'a', 'b']);
    expect(next.find((l) => l.id === 'a')!.parentId).toBe('g');
  });

  it('move to top level: lands at the end of the array (topmost)', () => {
    const doc = docOf([grp('g'), leaf('c', 'g'), leaf('b')]);
    const next = moveSubtree(doc.layers, 'c', null);
    expect(next.map((l) => l.id)).toEqual(['g', 'b', 'c']);
    expect(next.find((l) => l.id === 'c')!.parentId).toBeNull();
  });

  it('moving a group carries the whole subtree', () => {
    const doc = docOf([leaf('bottom'), grp('g'), leaf('c1', 'g'), leaf('c2', 'g'), leaf('top')]);
    const next = moveSubtree(doc.layers, 'g', null);
    expect(next.map((l) => l.id)).toEqual(['bottom', 'top', 'g', 'c1', 'c2']);
  });

  it('refuses to move a group into its own descendant (would create a cycle)', () => {
    const layers = [grp('g'), grp('inner', 'g'), leaf('c', 'inner')];
    expect(moveSubtree(layers, 'g', 'inner')).toBe(layers);
    expect(moveSubtree(layers, 'g', 'g')).toBe(layers);
  });

  it('returns the input unchanged when the target parent is missing', () => {
    const layers = [leaf('a')];
    expect(moveSubtree(layers, 'a', 'ghost')).toBe(layers);
  });

  it('pure: does not mutate the input arrays', () => {
    const layers = [grp('g'), leaf('a')];
    moveSubtree(layers, 'a', 'g');
    expect(layers.map((l) => l.id)).toEqual(['g', 'a']);
    expect(layers[1].parentId).toBeNull();
  });
});
