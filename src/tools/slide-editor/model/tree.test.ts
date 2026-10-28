import { describe, expect, it } from 'vitest';
import {
  elementsAtPath,
  findElementDeep,
  flattenElements,
  offsetElementsDeep,
  patchElementsDeep,
  removeElementsDeep,
} from './tree';
import type { SlideElement } from './types';

/** Depth-aware walks used by group-internal editing */

function rect(id: string, x = 0, y = 0): SlideElement {
  return { id, type: 'shape', x, y, width: 10, height: 10, geom: { kind: 'rect', prst: 'rect' } };
}

function group(id: string, children: SlideElement[]): SlideElement {
  return { id, type: 'group', x: 0, y: 0, width: 100, height: 100, children };
}

const inner = group('g2', [rect('a', 5, 5)]);
const tree: SlideElement[] = [rect('top'), group('g1', [inner, rect('b', 10, 20)])];

describe('flattenElements', () => {
  it('lists parents before their children', () => {
    expect(flattenElements(tree).map((element) => element.id)).toEqual([
      'top',
      'g1',
      'g2',
      'a',
      'b',
    ]);
  });
});

describe('findElementDeep', () => {
  it('finds nested children and misses unknown ids', () => {
    expect(findElementDeep(tree, 'a')?.type).toBe('shape');
    expect(findElementDeep(tree, 'g2')?.type).toBe('group');
    expect(findElementDeep(tree, 'nope')).toBeUndefined();
  });
});

describe('patchElementsDeep', () => {
  it('patches a nested child without touching siblings', () => {
    const next = patchElementsDeep(tree, new Map([['a', { x: 42 } as Partial<SlideElement>]]));
    expect(findElementDeep(next, 'a')).toMatchObject({ x: 42, y: 5 });
    expect(findElementDeep(next, 'b')).toMatchObject({ x: 10, y: 20 });
  });

  it('returns the same reference when nothing matches', () => {
    expect(patchElementsDeep(tree, new Map())).toBe(tree);
  });
});

describe('removeElementsDeep', () => {
  it('removes a nested child', () => {
    const next = removeElementsDeep(tree, ['a']);
    expect(findElementDeep(next, 'a')).toBeUndefined();
    expect(findElementDeep(next, 'b')).toBeDefined();
  });

  it('keeps untouched layers identical', () => {
    expect(removeElementsDeep(tree, ['missing'])).toBe(tree);
  });
});

describe('offsetElementsDeep', () => {
  it('moves only the selected nested child', () => {
    const next = offsetElementsDeep(tree, ['b'], (element) => ({
      x: element.x + 3,
      y: element.y + 4,
    }));
    expect(findElementDeep(next, 'b')).toMatchObject({ x: 13, y: 24 });
    expect(findElementDeep(next, 'a')).toMatchObject({ x: 5, y: 5 });
    expect(findElementDeep(next, 'g1')).toMatchObject({ x: 0, y: 0 });
  });

  it('returns the same reference when the offset is null', () => {
    expect(offsetElementsDeep(tree, ['b'], () => null)).toBe(tree);
  });
});

describe('elementsAtPath', () => {
  it('walks the entered group chain', () => {
    expect(elementsAtPath(tree, [])).toBe(tree);
    expect(elementsAtPath(tree, ['g1']).map((element) => element.id)).toEqual(['g2', 'b']);
    expect(elementsAtPath(tree, ['g1', 'g2']).map((element) => element.id)).toEqual(['a']);
    // A broken path falls back to the deepest valid level instead of throwing
    expect(elementsAtPath(tree, ['nope']).map((element) => element.id)).toEqual(['top', 'g1']);
  });
});
