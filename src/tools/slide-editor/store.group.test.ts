import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, createShapeElement } from './model/factory';
import { findElementDeep } from './model/tree';
import type { GroupElement } from './model/types';
import { useSlideStore } from './store';

/** Group-internal editing: entering a group, selecting and patching its children (P1-1.5) */

function reset(): void {
  useSlideStore.setState({
    doc: createDoc('group'),
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

/** Two rects grouped into one group; returns { group, a, b } */
function makeGroup(): { group: GroupElement; a: string; b: string } {
  const a = addRect(10, 10);
  const b = addRect(100, 100);
  const store = useSlideStore.getState();
  store.select([a, b]);
  store.groupSelected();
  const group = useSlideStore
    .getState()
    .doc.slides[0].elements.find((element) => element.type === 'group') as GroupElement;
  return { group, a, b };
}

describe('group editing', () => {
  beforeEach(reset);

  it('enters a group and clears the selection', () => {
    const { group } = makeGroup();
    useSlideStore.getState().enterGroup(group.id);

    const state = useSlideStore.getState();
    expect(state.groupPath).toEqual([group.id]);
    expect(state.selection).toEqual([]);
  });

  it('ignores ids that are not a group on the current level', () => {
    const { a } = makeGroup();
    useSlideStore.getState().enterGroup(a);
    expect(useSlideStore.getState().groupPath).toEqual([]);
  });

  it('patches a child inside the group without moving the group box', () => {
    const { group, a } = makeGroup();
    useSlideStore.getState().enterGroup(group.id);
    useSlideStore.getState().patchElement(a, { x: 5, y: 7 });

    const elements = useSlideStore.getState().doc.slides[0].elements;
    expect(findElementDeep(elements, a)).toMatchObject({ x: 5, y: 7 });
    expect(elements.find((element) => element.id === group.id)).toMatchObject({
      x: group.x,
      y: group.y,
    });
  });

  it('nudges the selected child in group-local coordinates', () => {
    const { group, a } = makeGroup();
    useSlideStore.getState().enterGroup(group.id);
    useSlideStore.getState().select([a]);
    const before = findElementDeep(useSlideStore.getState().doc.slides[0].elements, a);
    useSlideStore.getState().moveSelected(3, 4);
    const after = findElementDeep(useSlideStore.getState().doc.slides[0].elements, a);
    expect(after).toMatchObject({ x: (before?.x ?? 0) + 3, y: (before?.y ?? 0) + 4 });
  });

  it('keeps the group open while selecting its children and exits on a top-level pick', () => {
    const { group, a } = makeGroup();
    const outside = addRect(300, 300);
    useSlideStore.getState().enterGroup(group.id);

    useSlideStore.getState().select([a]);
    expect(useSlideStore.getState().groupPath).toEqual([group.id]);

    useSlideStore.getState().select([outside]);
    expect(useSlideStore.getState().groupPath).toEqual([]);
  });

  it('exitGroup pops one level and selects the group', () => {
    const { group } = makeGroup();
    useSlideStore.getState().enterGroup(group.id);
    useSlideStore.getState().exitGroup();

    const state = useSlideStore.getState();
    expect(state.groupPath).toEqual([]);
    expect(state.selection).toEqual([group.id]);
  });

  it('deletes a child without deleting the group', () => {
    const { group, a, b } = makeGroup();
    useSlideStore.getState().enterGroup(group.id);
    useSlideStore.getState().select([a]);
    useSlideStore.getState().removeSelected();

    const elements = useSlideStore.getState().doc.slides[0].elements;
    expect(findElementDeep(elements, a)).toBeUndefined();
    expect(findElementDeep(elements, b)).toBeDefined();
    expect(elements.find((element) => element.id === group.id)).toBeDefined();
  });

  it('leaves the group on undo', () => {
    const { group } = makeGroup();
    useSlideStore.getState().enterGroup(group.id);
    useSlideStore.getState().undo();
    expect(useSlideStore.getState().groupPath).toEqual([]);
  });
});
