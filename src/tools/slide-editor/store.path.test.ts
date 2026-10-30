import { beforeEach, describe, expect, it } from 'vitest';
import { geometryFromPoints } from '../../core/drawing/custGeom';
import { createDoc, createShapeElement } from './model/factory';
import type { ShapeElement } from './model/types';
import { useSlideStore } from './store';

/** Node editing state machine on custom-geometry shapes (P1-1.4) */

function reset(): void {
  useSlideStore.setState({
    doc: createDoc('path'),
    slideIndex: 0,
    selection: [],
    past: [],
    future: [],
    report: null,
    penMode: false,
    penPoints: [],
    pathEditId: null,
    activePathNode: null,
    viewMode: 'normal',
    masterKind: 'master',
    masterIndex: 0,
  });
}

/** Insert a triangle (normalized commands: M 0 0 / L 1 0 / L 0.5 1 / Z) and return its id */
function addTriangle(): string {
  const built = geometryFromPoints([
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 200, y: 260 },
  ]);
  const element = createShapeElement(useSlideStore.getState().doc, built!.geom);
  element.x = built!.x;
  element.y = built!.y;
  element.width = built!.width;
  element.height = built!.height;
  useSlideStore.getState().addElement(element);
  return element.id;
}

function shapeOf(id: string): ShapeElement {
  return useSlideStore.getState().doc.slides[0].elements.find((el) => el.id === id) as ShapeElement;
}

describe('path node editing', () => {
  beforeEach(reset);

  it('enters node editing only for a custom-geometry shape', () => {
    const id = addTriangle();
    useSlideStore.getState().setPathEdit(id);
    expect(useSlideStore.getState().pathEditId).toBe(id);
    expect(useSlideStore.getState().activePathNode).toBeNull();

    useSlideStore.getState().setPathEdit(null);
    expect(useSlideStore.getState().pathEditId).toBeNull();

    // A preset shape has no editable path
    const preset = createShapeElement(useSlideStore.getState().doc, {
      kind: 'rect',
      prst: 'roundRect',
    });
    useSlideStore.getState().addElement(preset);
    useSlideStore.getState().setPathEdit(preset.id);
    expect(useSlideStore.getState().pathEditId).toBeNull();
  });

  it('moves an anchor with a single undo step and keeps the svg path in sync', () => {
    const id = addTriangle();
    const before = useSlideStore.getState().past.length;

    useSlideStore.getState().movePathNode(id, 1, 0.9, 0.1);

    const shape = shapeOf(id);
    expect(shape.geom.custGeom?.[1]).toEqual({ c: 'L', x: 0.9, y: 0.1 });
    expect(shape.geom.path).toBe('M 0 0 L 0.9 0.1 L 0.5 1 Z');
    expect(useSlideStore.getState().past).toHaveLength(before + 1);

    // A no-op move must not push history
    useSlideStore.getState().movePathNode(id, 1, 0.9, 0.1);
    expect(useSlideStore.getState().past).toHaveLength(before + 1);
  });

  it('toggles an anchor between smooth and corner', () => {
    const id = addTriangle();
    useSlideStore.getState().togglePathNode(id, 1);

    let commands = shapeOf(id).geom.custGeom ?? [];
    expect(commands[1].c).toBe('C');
    expect(commands[2].c).toBe('C');

    useSlideStore.getState().togglePathNode(id, 1);
    commands = shapeOf(id).geom.custGeom ?? [];
    expect(commands[1]).toEqual({ c: 'L', x: 1, y: 0 });
    expect(commands[2]).toEqual({ c: 'L', x: 0.5, y: 1 });
  });

  it('deletes anchors down to the two-anchor floor', () => {
    const id = addTriangle();
    useSlideStore.getState().setActivePathNode(1);
    useSlideStore.getState().removePathNode(id, 1);

    expect(shapeOf(id).geom.custGeom).toHaveLength(3);
    expect(useSlideStore.getState().activePathNode).toBeNull();

    useSlideStore.getState().removePathNode(id, 1);
    const commands = shapeOf(id).geom.custGeom ?? [];
    expect(commands).toHaveLength(3);

    // The floor: a second removal leaves the path untouched
    useSlideStore.getState().removePathNode(id, 1);
    expect(shapeOf(id).geom.custGeom).toHaveLength(3);
  });

  it('exits node editing when the selection moves away', () => {
    const id = addTriangle();
    const second = addTriangle();
    useSlideStore.getState().setPathEdit(id);
    useSlideStore.getState().select([second]);
    expect(useSlideStore.getState().pathEditId).toBeNull();
  });

  it('clears node editing on undo', () => {
    const id = addTriangle();
    useSlideStore.getState().setPathEdit(id);
    useSlideStore.getState().movePathNode(id, 1, 0.9, 0.1);
    useSlideStore.getState().undo();
    expect(useSlideStore.getState().pathEditId).toBeNull();
  });
});
