import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, createSlide, createTextElement } from './model/factory';
import { useSlideStore } from './store';

/** Summary page (S6.3): insertion point, selection and link hygiene */

function reset(): void {
  const doc = createDoc('summary');
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

const state = () => useSlideStore.getState();

describe('summary page (store)', () => {
  beforeEach(reset);

  it('inserts the page right after the current slide and selects it', () => {
    state().insertSummarySlide('摘要');
    const { doc, slideIndex } = state();
    expect(doc.slides).toHaveLength(4);
    expect(slideIndex).toBe(1);
    expect(doc.slides[1].elements.some((element) => element.linkToSlideId)).toBe(true);
  });

  it('appends after the last slide when the deck is already at the end', () => {
    state().selectSlide(2);
    state().insertSummarySlide('摘要');
    const { doc, slideIndex } = state();
    expect(doc.slides).toHaveLength(4);
    expect(slideIndex).toBe(3);
  });

  it('is undoable in one step', () => {
    state().insertSummarySlide('摘要');
    expect(state().doc.slides).toHaveLength(4);
    state().undo();
    expect(state().doc.slides).toHaveLength(3);
  });

  it('drops links that point at a deleted slide', () => {
    state().insertSummarySlide('摘要');
    const target = state().doc.slides[2].id;
    const summary = state().doc.slides[1];
    expect(summary.elements.some((element) => element.linkToSlideId === target)).toBe(true);

    state().removeSlide(2);
    const remaining = state().doc.slides.flatMap((slide) => slide.elements);
    expect(remaining.some((element) => element.linkToSlideId === target)).toBe(false);
  });

  it('keeps links to slides that still exist', () => {
    const doc = state().doc;
    const element = createTextElement(doc, 'a');
    element.linkToSlideId = doc.slides[2].id;
    state().addElement(element);
    state().removeSlide(1);

    const kept = state().doc.slides[0].elements.find((item) => item.id === element.id);
    expect(kept?.linkToSlideId).toBe(doc.slides[2].id);
  });
});
