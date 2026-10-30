import { beforeEach, describe, expect, it } from 'vitest';
import { createAnimationStep } from './model/animation';
import { createDoc, createShapeElement } from './model/factory';
import { useSlideStore } from './store';

/** 动画挂在 slide 上，但元素删除后必须一起清理（P2-5.1 的悬空步骤防护） */

function reset(): void {
  useSlideStore.setState({
    doc: createDoc('animation'),
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

function addRect(): string {
  const element = createShapeElement(useSlideStore.getState().doc, {
    kind: 'rect',
    prst: 'rect',
  });
  useSlideStore.getState().addElement(element);
  return element.id;
}

describe('slide animations in the store', () => {
  beforeEach(reset);

  it('keeps animations on the slide and drops them when the element is deleted', () => {
    const id = addRect();
    const store = useSlideStore.getState();
    store.updateSlide({ animations: [createAnimationStep(id, 'fadeIn')] });
    expect(useSlideStore.getState().doc.slides[0].animations).toHaveLength(1);

    useSlideStore.setState({ selection: [id] });
    useSlideStore.getState().removeSelected();

    const slide = useSlideStore.getState().doc.slides[0];
    expect(slide.elements).toHaveLength(0);
    expect(slide.animations).toEqual([]);
  });

  it('leaves other elements’ animations alone', () => {
    const kept = addRect();
    const removed = addRect();
    useSlideStore.getState().updateSlide({
      animations: [createAnimationStep(kept, 'fadeIn'), createAnimationStep(removed, 'flyIn')],
    });

    useSlideStore.setState({ selection: [removed] });
    useSlideStore.getState().removeSelected();
    const animations = useSlideStore.getState().doc.slides[0].animations ?? [];
    expect(animations.map((step) => step.elementId)).toEqual([kept]);
  });

  it('stores the slide transition and clears it when set to none', () => {
    useSlideStore.getState().updateSlide({
      transition: { type: 'fade', duration: 400, advanceOnClick: true },
    });
    expect(useSlideStore.getState().doc.slides[0].transition?.type).toBe('fade');
    useSlideStore.getState().updateSlide({ transition: undefined });
    expect(useSlideStore.getState().doc.slides[0].transition).toBeUndefined();
  });
});
