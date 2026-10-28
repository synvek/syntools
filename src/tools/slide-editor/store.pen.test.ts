import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc } from './model/factory';
import type { ShapeElement } from './model/types';
import { useSlideStore } from './store';

/** Pen tool state machine: points → custom-geometry shape */

function reset(): void {
  useSlideStore.setState({
    doc: createDoc('pen'),
    slideIndex: 0,
    selection: [],
    past: [],
    future: [],
    report: null,
    penMode: false,
    penPoints: [],
    viewMode: 'normal',
    masterKind: 'master',
    masterIndex: 0,
  });
}

describe('pen tool', () => {
  beforeEach(reset);

  it('inserts a custom-geometry shape when the path is closed', () => {
    useSlideStore.getState().setPenMode(true);
    useSlideStore.getState().addPenPoint({ x: 100, y: 100 });
    useSlideStore.getState().addPenPoint({ x: 300, y: 100 });
    useSlideStore.getState().addPenPoint({ x: 200, y: 260 });
    useSlideStore.getState().finishPen();

    const state = useSlideStore.getState();
    const shape = state.doc.slides[0].elements[0] as ShapeElement;
    expect(shape.type).toBe('shape');
    expect(shape.geom.custGeom).toHaveLength(4);
    expect(shape.geom.custGeom?.[1]).toEqual({ c: 'L', x: 1, y: 0 });
    expect({ x: shape.x, y: shape.y, width: shape.width, height: shape.height }).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 160,
    });
    // The tool resets and the new shape becomes the selection
    expect(state.penMode).toBe(false);
    expect(state.penPoints).toEqual([]);
    expect(state.selection).toEqual([shape.id]);
    // One undo step for the whole drawing
    expect(state.past).toHaveLength(1);
  });

  it('drops the near-duplicate point produced by the closing double-click', () => {
    useSlideStore.getState().setPenMode(true);
    useSlideStore.getState().addPenPoint({ x: 10, y: 10 });
    useSlideStore.getState().addPenPoint({ x: 210, y: 10 });
    useSlideStore.getState().addPenPoint({ x: 210, y: 10 });
    useSlideStore.getState().finishPen();

    const shape = useSlideStore.getState().doc.slides[0].elements[0] as ShapeElement;
    expect(shape.geom.custGeom).toHaveLength(3);
  });

  it('needs at least two points and leaves no element behind', () => {
    useSlideStore.getState().setPenMode(true);
    useSlideStore.getState().addPenPoint({ x: 10, y: 10 });
    useSlideStore.getState().finishPen();

    const state = useSlideStore.getState();
    expect(state.doc.slides[0].elements).toHaveLength(0);
    expect(state.penMode).toBe(false);
  });

  it('ignores clicks while the tool is off', () => {
    useSlideStore.getState().addPenPoint({ x: 10, y: 10 });
    expect(useSlideStore.getState().penPoints).toEqual([]);
  });

  it('cancel clears the in-progress path', () => {
    useSlideStore.getState().setPenMode(true);
    useSlideStore.getState().addPenPoint({ x: 10, y: 10 });
    useSlideStore.getState().cancelPen();

    const state = useSlideStore.getState();
    expect(state.penMode).toBe(false);
    expect(state.penPoints).toEqual([]);
    expect(state.doc.slides[0].elements).toHaveLength(0);
  });

  it('leaving the tool clears points placed so far', () => {
    useSlideStore.getState().setPenMode(true);
    useSlideStore.getState().addPenPoint({ x: 10, y: 10 });
    useSlideStore.getState().setPenMode(false);
    expect(useSlideStore.getState().penPoints).toEqual([]);
  });
});
