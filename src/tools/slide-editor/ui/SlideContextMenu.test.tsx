import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { createDoc, createShapeElement, createTextElement, rectGeometry } from '../model/factory';
import type { SlideElement } from '../model/types';
import { containerElements, useSlideStore } from '../store';
import { SlideContextMenu, type SlideContextTarget } from './SlideContextMenu';

/**
 * The store is a singleton shared within the file, so reset session state (selection / clipboard / toggles) first,
 * otherwise leftovers like gridSnap from a previous case leak into the next one.
 */
beforeEach(() => {
  useSlideStore.setState({
    selection: [],
    clipboard: [],
    gridSnap: false,
    showRulers: true,
    viewMode: 'normal',
    slideIndex: 0,
    past: [],
    future: [],
  });
});

/** Build a "2 elements on the first slide" document, load it into the store, and return the elements (text first, rect second) */
function seedDoc(): SlideElement[] {
  const doc = createDoc();
  const text = createTextElement(doc, '标题');
  const shape = createShapeElement(doc, rectGeometry());
  const elements = [text, shape];
  useSlideStore.getState().loadDoc({
    ...doc,
    slides: doc.slides.map((slide, index) => (index === 0 ? { ...slide, elements } : slide)),
  });
  return elements;
}

function open(target: SlideContextTarget, onEditText?: (id: string) => void) {
  const onClose = vi.fn();
  render(<SlideContextMenu target={target} onClose={onClose} onEditText={onEditText} />);
  return { onClose };
}

const elementMenu = (elementId: string): SlideContextTarget => ({
  kind: 'element',
  x: 120,
  y: 160,
  elementId,
});

describe('幻灯片右键菜单', () => {
  it('元素菜单：给出剪贴板 / 排列 / 锁定 / 母版 / 删除入口', () => {
    const [text] = seedDoc();
    useSlideStore.getState().select([text.id]);
    open(elementMenu(text.id));

    expect(screen.getByRole('menu', { name: 'tools.slide.contextMenu' })).toBeTruthy();
    for (const key of [
      'tools.slide.cut',
      'common.copy',
      'tools.slide.paste',
      'tools.slide.duplicateElement',
      'tools.slide.bringToFront',
      'tools.slide.bringForward',
      'tools.slide.sendBackward',
      'tools.slide.sendToBack',
      'tools.slide.lock',
      'tools.slide.hide',
      'tools.slide.promoteToMaster',
      'tools.slide.deleteElement',
    ]) {
      expect(screen.getByRole('menuitem', { name: key })).toBeTruthy();
    }
    // Can't group with a single element selected; can't paste with an empty session clipboard
    expect(screen.getByRole('menuitem', { name: 'tools.slide.group' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'tools.slide.paste' })).toBeDisabled();
  });

  it('元素菜单：纯矩形没有正文，不提供「编辑文字」', () => {
    const [, shape] = seedDoc();
    useSlideStore.getState().select([shape.id]);
    open(elementMenu(shape.id));

    expect(screen.queryByRole('menuitem', { name: 'tools.slide.editText' })).toBeNull();
  });

  it('元素菜单：编辑文字把右键命中的元素交给调用方', () => {
    const [text] = seedDoc();
    const onEditText = vi.fn();
    useSlideStore.getState().select([text.id]);
    open(elementMenu(text.id), onEditText);

    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.slide.editText' }));
    expect(onEditText).toHaveBeenCalledWith(text.id);
  });

  it('元素菜单：删除元素后关闭菜单', () => {
    const [text] = seedDoc();
    useSlideStore.getState().select([text.id]);
    const { onClose } = open(elementMenu(text.id));

    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.slide.deleteElement' }));

    expect(onClose).toHaveBeenCalled();
    expect(containerElements(useSlideStore.getState()).map((el) => el.id)).not.toContain(text.id);
  });

  it('元素菜单：隐藏作用于当前选中元素', () => {
    const [text] = seedDoc();
    useSlideStore.getState().select([text.id]);
    open(elementMenu(text.id));
    expect(screen.getByRole('menuitem', { name: 'tools.slide.hide' })).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.slide.hide' }));
    expect(containerElements(useSlideStore.getState())[0].visible).toBe(false);
  });

  it('画布菜单：全选命中当前容器全部元素，开关项直接切换', () => {
    seedDoc();
    open({ kind: 'canvas', x: 20, y: 20 });

    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.slide.selectAll' }));
    expect(useSlideStore.getState().selection).toHaveLength(2);

    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.slide.gridSnap' }));
    expect(useSlideStore.getState().gridSnap).toBe(true);
  });

  it('画布菜单：只有一页时不允许删除当前页', () => {
    seedDoc();
    open({ kind: 'canvas', x: 20, y: 20 });
    expect(screen.getByRole('menuitem', { name: 'tools.slide.deleteSlide' })).toBeDisabled();
  });

  it('页缩略图菜单：复制作用于右键的那一页', () => {
    seedDoc();
    useSlideStore.getState().addSlide();
    expect(useSlideStore.getState().doc.slides).toHaveLength(2);

    open({ kind: 'slide', x: 30, y: 40, slideIndex: 0 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'tools.slide.duplicate' }));
    expect(useSlideStore.getState().doc.slides).toHaveLength(3);
  });

  it('页缩略图菜单：首页不可上移、末页不可下移', () => {
    seedDoc();
    useSlideStore.getState().addSlide();

    open({ kind: 'slide', x: 30, y: 40, slideIndex: 0 });
    expect(screen.getByRole('menuitem', { name: 'tools.slide.moveUp' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'tools.slide.moveDown' })).not.toBeDisabled();
  });
});
