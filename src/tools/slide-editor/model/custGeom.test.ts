import { describe, expect, it } from 'vitest';
import {
  commandsFromGeometry,
  commandsToSvg,
  geometryFromPoints,
  hasCustomGeometry,
  movePathAnchor,
  movePathControl,
  pathNodes,
  removePathAnchor,
  scaleCommands,
  svgToCommands,
  togglePathNodeSmooth,
} from './custGeom';
import type { PathCommand } from './types';

/** Normalized custom-geometry commands: SVG serialization, scaling and parsing back */

const triangle: PathCommand[] = [
  { c: 'M', x: 0, y: 0 },
  { c: 'L', x: 1, y: 0 },
  { c: 'L', x: 0.5, y: 1 },
  { c: 'Z' },
];

const square: PathCommand[] = [
  { c: 'M', x: 0, y: 0 },
  { c: 'L', x: 1, y: 0 },
  { c: 'L', x: 1, y: 1 },
  { c: 'L', x: 0, y: 1 },
  { c: 'Z' },
];

describe('commandsToSvg', () => {
  it('serializes every command type', () => {
    const commands: PathCommand[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 0.5, y: 0 },
      { c: 'C', x1: 0.6, y1: 0.1, x2: 0.9, y2: 0.4, x: 1, y: 0.5 },
      { c: 'Q', x1: 0.75, y1: 0.9, x: 0.5, y: 1 },
      { c: 'Z' },
    ];
    expect(commandsToSvg(commands)).toBe(
      'M 0 0 L 0.5 0 C 0.6 0.1 0.9 0.4 1 0.5 Q 0.75 0.9 0.5 1 Z',
    );
  });

  it('rounds and normalizes negative zero', () => {
    expect(commandsToSvg([{ c: 'M', x: -0.0000001, y: 1 / 3 }])).toBe('M 0 0.33333');
  });
});

describe('scaleCommands', () => {
  it('maps normalized points onto the element box', () => {
    const scaled = scaleCommands(triangle, 200, 100);
    expect(scaled[2]).toEqual({ c: 'L', x: 100, y: 100 });
    expect(scaled[0]).toEqual({ c: 'M', x: 0, y: 0 });
  });

  it('scales curves and leaves close untouched', () => {
    const scaled = scaleCommands(
      [{ c: 'C', x1: 0.5, y1: 0.5, x2: 1, y2: 1, x: 0.25, y: 0.75 }, { c: 'Z' }],
      100,
      200,
    );
    expect(scaled[0]).toEqual({ c: 'C', x1: 50, y1: 100, x2: 100, y2: 200, x: 25, y: 150 });
    expect(scaled[1]).toEqual({ c: 'Z' });
  });

  it('does not mutate the source commands', () => {
    scaleCommands(triangle, 10, 10);
    expect(triangle[1]).toEqual({ c: 'L', x: 1, y: 0 });
  });
});

describe('svgToCommands', () => {
  it('round-trips absolute paths', () => {
    expect(svgToCommands(commandsToSvg(triangle))).toEqual(triangle);
  });

  it('expands relative commands into absolute ones', () => {
    const commands = svgToCommands('m 0 0 l 1 0 l -0.5 1 z');
    expect(commands).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 1, y: 0 },
      { c: 'L', x: 0.5, y: 1 },
      { c: 'Z' },
    ]);
  });

  it('supports horizontal / vertical moves and quadratic curves', () => {
    const commands = svgToCommands('M 0 0 H 1 V 1 Q 0.5 0.5 0 1 Z');
    expect(commands).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 1, y: 0 },
      { c: 'L', x: 1, y: 1 },
      { c: 'Q', x1: 0.5, y1: 0.5, x: 0, y: 1 },
      { c: 'Z' },
    ]);
  });

  it('ignores unsupported commands instead of producing garbage', () => {
    const commands = svgToCommands('M 0 0 A 1 1 0 0 1 1 1 L 1 0');
    expect(commands.filter((command) => command.c === 'L')).toHaveLength(1);
  });
});

describe('geometryFromPoints', () => {
  it('normalizes the points into their bounding box', () => {
    const built = geometryFromPoints([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 200, y: 260 },
    ]);
    expect(built).not.toBeNull();
    expect(built).toMatchObject({ x: 100, y: 100, width: 200, height: 160 });
    expect(built?.geom.custGeom).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 1, y: 0 },
      { c: 'L', x: 0.5, y: 1 },
      { c: 'Z' },
    ]);
    expect(built?.geom.kind).toBe('path');
  });

  it('gives a straight line a non-zero box so it stays selectable', () => {
    const built = geometryFromPoints([
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ]);
    expect(built?.width).toBe(2);
    expect(built?.height).toBe(2);
  });

  it('needs at least two points', () => {
    expect(geometryFromPoints([])).toBeNull();
    expect(geometryFromPoints([{ x: 1, y: 1 }])).toBeNull();
  });
});

describe('hasCustomGeometry', () => {
  it('requires at least a move and one more command', () => {
    expect(hasCustomGeometry({ custGeom: [{ c: 'M', x: 0, y: 0 }] })).toBe(false);
    expect(hasCustomGeometry({ custGeom: triangle })).toBe(true);
    expect(hasCustomGeometry({})).toBe(false);
  });
});

describe('commandsFromGeometry', () => {
  it('prefers explicit commands and falls back to the legacy path string', () => {
    expect(commandsFromGeometry({ custGeom: triangle })).toEqual(triangle);
    expect(commandsFromGeometry({ path: 'M 0 0 L 1 0 L 0.5 1 Z' })).toEqual(triangle);
    expect(commandsFromGeometry({})).toEqual([]);
  });
});

describe('pathNodes', () => {
  it('lists every anchor and reads handles from the neighbouring command', () => {
    const nodes = pathNodes(square);
    expect(nodes.map((node) => node.index)).toEqual([0, 1, 2, 3]);
    expect(nodes[1]).toMatchObject({ x: 1, y: 0, smooth: false });
    expect(nodes[1].in).toBeUndefined();
    expect(nodes[1].out).toBeUndefined();
  });

  it('detects a smooth node from collinear handles', () => {
    const curved: PathCommand[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'C', x1: 0.2, y1: 0, x2: 0.4, y2: 0, x: 0.5, y: 0 },
      { c: 'C', x1: 0.6, y1: 0, x2: 0.8, y2: 0, x: 1, y: 0 },
      { c: 'Z' },
    ];
    const nodes = pathNodes(curved);
    expect(nodes[1].in).toEqual({ x: 0.4, y: 0 });
    expect(nodes[1].out).toEqual({ x: 0.6, y: 0 });
    expect(nodes[1].smooth).toBe(true);
    // Handles bent away from the anchor are a corner
    const bent = pathNodes([
      { c: 'M', x: 0, y: 0 },
      { c: 'C', x1: 0.2, y1: 0, x2: 0.4, y2: 0.1, x: 0.5, y: 0 },
      { c: 'C', x1: 0.6, y1: 0, x2: 0.8, y2: 0, x: 1, y: 0 },
      { c: 'Z' },
    ]);
    expect(bent[1].smooth).toBe(false);
  });
});

describe('movePathAnchor', () => {
  it('carries the incoming and outgoing control points', () => {
    const curved: PathCommand[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'C', x1: 0.2, y1: 0, x2: 0.4, y2: 0, x: 0.5, y: 0 },
      { c: 'C', x1: 0.6, y1: 0, x2: 0.8, y2: 0, x: 1, y: 0 },
      { c: 'Z' },
    ];
    const moved = movePathAnchor(curved, 1, 0.6, 0.2);
    expect(moved[1]).toEqual({ c: 'C', x1: 0.2, y1: 0, x2: 0.5, y2: 0.2, x: 0.6, y: 0.2 });
    expect(moved[2]).toEqual({ c: 'C', x1: 0.7, y1: 0.2, x2: 0.8, y2: 0, x: 1, y: 0 });
    // Source untouched
    expect(curved[1]).toMatchObject({ x: 0.5, y: 0 });
  });

  it('ignores close commands and no-op moves', () => {
    expect(movePathAnchor(square, 4, 0.5, 0.5)).toBe(square);
    expect(movePathAnchor(square, 1, 1, 0)).toBe(square);
  });
});

describe('movePathControl', () => {
  const curved: PathCommand[] = [
    { c: 'M', x: 0, y: 0 },
    { c: 'C', x1: 0.2, y1: 0, x2: 0.4, y2: 0, x: 0.5, y: 0 },
    { c: 'C', x1: 0.6, y1: 0, x2: 0.8, y2: 0, x: 1, y: 0 },
    { c: 'Z' },
  ];

  it('moves the in-handle stored on its own command', () => {
    const next = movePathControl(curved, 1, 'in', 0.45, 0.05);
    expect(next[1]).toMatchObject({ x2: 0.45, y2: 0.05 });
  });

  it('moves the out-handle stored on the following command', () => {
    const next = movePathControl(curved, 1, 'out', 0.65, 0.05);
    expect(next[2]).toMatchObject({ x1: 0.65, y1: 0.05 });
  });

  it('keeps a smooth node smooth by mirroring the opposite handle', () => {
    const next = movePathControl(curved, 1, 'in', 0.45, 0.1);
    const node = pathNodes(next).find((item) => item.index === 1);
    expect(node?.smooth).toBe(true);
    expect(node?.out?.x).toBeCloseTo(0.5447, 3);
    expect(node?.out?.y).toBeCloseTo(-0.0894, 3);
  });
});

describe('removePathAnchor', () => {
  it('drops one anchor and straightens the segment that replaced it', () => {
    const curved: PathCommand[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'C', x1: 0.2, y1: 0, x2: 0.4, y2: 0, x: 0.5, y: 0 },
      { c: 'C', x1: 0.6, y1: 0, x2: 0.8, y2: 0, x: 1, y: 0 },
      { c: 'Z' },
    ];
    const next = removePathAnchor(curved, 1);
    expect(next).toEqual([{ c: 'M', x: 0, y: 0 }, { c: 'L', x: 1, y: 0 }, { c: 'Z' }]);
  });

  it('promotes the following command when the move is removed', () => {
    expect(removePathAnchor(square, 0)).toEqual([
      { c: 'M', x: 1, y: 0 },
      { c: 'L', x: 1, y: 1 },
      { c: 'L', x: 0, y: 1 },
      { c: 'Z' },
    ]);
  });

  it('never drops below two anchors', () => {
    const two: PathCommand[] = [{ c: 'M', x: 0, y: 0 }, { c: 'L', x: 1, y: 0 }, { c: 'Z' }];
    expect(removePathAnchor(two, 0)).toBe(two);
  });
});

describe('togglePathNodeSmooth', () => {
  it('turns a corner into a curve with collinear handles', () => {
    const smoothed = togglePathNodeSmooth(square, 1);
    expect(smoothed[1].c).toBe('C');
    expect(smoothed[2].c).toBe('C');
    const node = pathNodes(smoothed).find((item) => item.index === 1);
    expect(node?.smooth).toBe(true);
    expect(node?.in?.x).toBeCloseTo(0.7643, 3);
    expect(node?.out?.x).toBeCloseTo(1.2357, 3);
  });

  it('turns a smooth node back into a corner', () => {
    const smoothed = togglePathNodeSmooth(square, 1);
    expect(togglePathNodeSmooth(smoothed, 1)).toEqual(square);
  });
});
