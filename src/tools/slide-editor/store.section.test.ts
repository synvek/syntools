import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, createSlide } from './model/factory';
import { useSlideStore } from './store';

/** Slide sections: split / rename / delete through the store (P2-S6) */

function reset(): void {
  const doc = createDoc('sections');
  doc.slides.push(createSlide(), createSlide());
  useSlideStore.setState({
    doc,
    slideIndex: 0,
    selection: [],
    past: [],
    future: [],
    report: null,
    pathEditId: null,
    activePathNode: null,
    groupPath: [],
    commentAuthor: '甲',
    activeThreadId: null,
    viewMode: 'normal',
    masterKind: 'master',
    masterIndex: 0,
  });
}

const slides = () => useSlideStore.getState().doc.slides;

describe('slide sections (store)', () => {
  beforeEach(reset);

  it('splits at a slide and keeps the boundaries ordered', () => {
    useSlideStore.getState().splitSection(2, '正文');
    const sections = useSlideStore.getState().doc.sections ?? [];
    expect(sections.map((item) => item.name)).toEqual(['Section', '正文']);
    expect(sections.map((item) => item.startSlideId)).toEqual([slides()[0].id, slides()[2].id]);
  });

  it('ignores a split on the first slide', () => {
    useSlideStore.getState().splitSection(0, 'x');
    expect(useSlideStore.getState().doc.sections).toEqual([]);
  });

  it('renames and deletes sections', () => {
    useSlideStore.getState().splitSection(1, '第一节');
    const created = useSlideStore.getState().doc.sections ?? [];
    useSlideStore.getState().renameSection(created[1].id, '改名后');
    expect((useSlideStore.getState().doc.sections ?? [])[1].name).toBe('改名后');

    useSlideStore.getState().removeSection(created[1].id);
    expect(useSlideStore.getState().doc.sections).toEqual([]);
  });

  it('drops a boundary whose first slide is deleted', () => {
    useSlideStore.getState().splitSection(1, '第二节');
    expect(useSlideStore.getState().doc.sections).toHaveLength(2);

    // Slide 1 is the boundary of the second section: deleting it merges the sections instead of
    // leaving a phantom boundary behind
    useSlideStore.getState().removeSlide(1);
    expect(useSlideStore.getState().doc.sections ?? []).toEqual([]);
  });

  it('is undoable', () => {
    useSlideStore.getState().splitSection(1, '第二节');
    expect(useSlideStore.getState().doc.sections).toHaveLength(2);
    useSlideStore.getState().undo();
    expect(useSlideStore.getState().doc.sections ?? []).toEqual([]);
  });
});
