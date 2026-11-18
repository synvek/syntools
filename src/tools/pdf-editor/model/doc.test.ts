import { describe, expect, it } from 'vitest';
import {
  addObject,
  clampPage,
  clampZoom,
  createDoc,
  createEmptyDoc,
  deletePage,
  duplicatePage,
  insertBlankPage,
  insertPagesFrom,
  isDirty,
  markSaved,
  MAX_ZOOM,
  MIN_ZOOM,
  movePage,
  movePageById,
  pageById,
  pageIdFor,
  removeObject,
  restorePage,
  rotateAllPages,
  setCurrentPage,
  setPageRotation,
  setViewMode,
  setZoom,
  setZoomMode,
  touch,
  updateObject,
  visiblePageCount,
  visiblePages,
} from './doc';
import { createTextObject } from './objects';
import type { PdfSource } from './types';

const pageId = (sourceIndex: number) => pageIdFor('main', sourceIndex);

const source = (pageCount: number): PdfSource => ({
  key: 'main',
  bytes: new Uint8Array([1, 2, 3]),
  pageCount,
  encrypted: false,
  fingerprint: 'fp-test',
});

const makeDoc = (pageCount = 4) =>
  createDoc({ name: 'contract.pdf', source: source(pageCount), id: 'doc-1', now: 1000 });

describe('createDoc / createEmptyDoc', () => {
  it('按源页数生成页状态，初始干净', () => {
    const doc = makeDoc(3);

    expect(doc.pages).toHaveLength(3);
    expect(doc.pages.map((page) => page.sourceIndex)).toEqual([0, 1, 2]);
    expect(doc.pages.every((page) => page.rotation === 0)).toBe(true);
    expect(doc.revision).toBe(0);
    expect(doc.savedRevision).toBe(0);
    expect(isDirty(doc)).toBe(false);
    expect(doc.view).toEqual({ mode: 'continuous', zoom: 1, zoomMode: 'fit-width', page: 1 });
    expect(doc.meta.title).toBe('contract');
  });

  it('空文档没有页，保存前可被识别', () => {
    const doc = createEmptyDoc(2000);
    expect(doc.source.pageCount).toBe(0);
    expect(doc.pages).toEqual([]);
    expect(visiblePageCount(doc)).toBe(0);
    expect(clampPage(doc, 5)).toBe(1);
  });

  it('未显式传 id 时生成唯一 id', () => {
    const a = createDoc({ name: 'a.pdf', source: source(1) });
    const b = createDoc({ name: 'b.pdf', source: source(1) });
    expect(a.id).not.toBe(b.id);
    expect(a.id.startsWith('pdf-')).toBe(true);
  });
});

describe('缩放与页码（视图变化不算脏）', () => {
  it('clampZoom 限制在 50%–400% 并保留两位', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(1.337)).toBe(1.34);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it('setZoom 不改变 revision', () => {
    const doc = makeDoc();
    const next = setZoom(doc, 2);
    expect(next.view.zoom).toBe(2);
    expect(next.revision).toBe(doc.revision);
    expect(setZoom(doc, 1)).toBe(doc);
  });

  it('setZoomMode / setViewMode 幂等且不脏', () => {
    const doc = makeDoc();
    const next = setZoomMode(setViewMode(doc, 'single'), 'fit-page');
    expect(next.view.mode).toBe('single');
    expect(next.view.zoomMode).toBe('fit-page');
    expect(isDirty(next)).toBe(false);
    expect(setViewMode(next, 'single')).toBe(next);
    expect(setZoomMode(next, 'fit-page')).toBe(next);
  });

  it('setCurrentPage 夹在 1..可见页数', () => {
    const doc = makeDoc(3);
    expect(setCurrentPage(doc, 0).view.page).toBe(1);
    expect(setCurrentPage(doc, 99).view.page).toBe(3);
    expect(setCurrentPage(doc, 2.4).view.page).toBe(2);
    expect(setCurrentPage(doc, 1)).toBe(doc);
  });
});

describe('页面旋转', () => {
  it('单页旋转叠加而不是替换', () => {
    const doc = makeDoc(2);
    const rotated = setPageRotation(doc, pageId(0), 90);
    expect(rotated.pages[0].rotation).toBe(90);
    expect(rotated.pages[1].rotation).toBe(0);
    expect(rotated.revision).toBe(1);
    expect(isDirty(rotated)).toBe(true);

    const wrapped = setPageRotation(rotated, pageId(0), 270);
    expect(wrapped.pages[0].rotation).toBe(0);
  });

  it('没有实际变化时返回同一对象', () => {
    const doc = makeDoc(2);
    expect(setPageRotation(doc, pageId(0), 0)).toBe(doc);
    expect(setPageRotation(doc, pageId(0), 360)).toBe(doc);
    expect(setPageRotation(doc, 'page-missing', 90)).toBe(doc);
  });

  it('rotateAllPages 跳过已删除页', () => {
    const doc = deletePage(makeDoc(3), 2);
    const rotated = rotateAllPages(doc, 180);
    expect(rotated.pages.map((page) => page.rotation)).toEqual([180, 0, 180]);
  });
});

describe('页面顺序与删除', () => {
  it('删除只打标记，pages 长度不变', () => {
    const doc = makeDoc(4);
    const next = deletePage(doc, 2);

    expect(next.pages).toHaveLength(4);
    expect(next.pages.filter((page) => page.deleted).map((page) => page.sourceIndex)).toEqual([1]);
    expect(visiblePages(next).map((page) => page.sourceIndex)).toEqual([0, 2, 3]);
    expect(visiblePageCount(next)).toBe(3);
  });

  it('删除当前页后页码回到范围内', () => {
    const doc = setCurrentPage(makeDoc(4), 4);
    const next = deletePage(doc, 4);
    expect(next.view.page).toBe(3);
  });

  it('越界删除是空操作，不会误删其它页', () => {
    const doc = makeDoc(2);
    expect(deletePage(doc, 0)).toBe(doc);
    expect(deletePage(doc, 99)).toBe(doc);
    expect(deletePage(doc, Number.NaN)).toBe(doc);
    expect(visiblePageCount(doc)).toBe(2);
  });

  it('删光所有页后再删是空操作', () => {
    let doc = makeDoc(2);
    doc = deletePage(doc, 1);
    doc = deletePage(doc, 1);

    expect(visiblePageCount(doc)).toBe(0);
    expect(deletePage(doc, 1)).toBe(doc);
    expect(doc.view.page).toBe(1);
  });

  it('restorePage 恢复被删页', () => {
    const doc = deletePage(makeDoc(2), 1);
    const restored = restorePage(doc, pageId(0));
    expect(visiblePageCount(restored)).toBe(2);
    expect(restorePage(restored, pageId(0))).toBe(restored);
  });

  it('movePage 按可见顺序移动，被删页停在末尾', () => {
    let doc = makeDoc(4);
    doc = deletePage(doc, 2);
    doc = movePage(doc, 1, 3);

    expect(visiblePages(doc).map((page) => page.sourceIndex)).toEqual([2, 3, 0]);
    expect(doc.pages).toHaveLength(4);
    expect(doc.pages.filter((page) => page.deleted).map((page) => page.sourceIndex)).toEqual([1]);
    expect(isDirty(doc)).toBe(true);
  });

  it('movePage 同位置或不足两页时不变', () => {
    const doc = makeDoc(3);
    expect(movePage(doc, 2, 2)).toBe(doc);

    const single = makeDoc(1);
    expect(movePage(single, 1, 1)).toBe(single);
    expect(single.pages).toHaveLength(1);
  });
});

describe('保存状态', () => {
  it('markSaved 清零脏标记且不改 revision', () => {
    const doc = setPageRotation(makeDoc(2), pageId(0), 90);
    expect(isDirty(doc)).toBe(true);
    const saved = markSaved(doc, 5000);
    expect(saved.revision).toBe(doc.revision);
    expect(saved.savedRevision).toBe(doc.revision);
    expect(saved.updatedAt).toBe(5000);
    expect(isDirty(saved)).toBe(false);
  });

  it('touch 每次自增 revision', () => {
    const doc = touch(touch(makeDoc(1), 10), 20);
    expect(doc.revision).toBe(2);
    expect(doc.updatedAt).toBe(20);
  });
});

describe('对象增删改', () => {
  const text = () =>
    createTextObject({
      page: pageId(0),
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 },
      text: 'Hello',
      z: 1,
    });

  it('addObject 追加并标脏', () => {
    const doc = makeDoc(1);
    const object = text();
    const next = addObject(doc, object);
    expect(next.objects).toHaveLength(1);
    expect(next.objects[0]).toBe(object);
    expect(next.revision).toBe(1);
  });

  it('updateObject 只在返回值变化时标脏', () => {
    const doc = addObject(makeDoc(1), text());
    const id = doc.objects[0].id;

    const updated = updateObject(doc, id, (object) =>
      object.kind === 'text' ? { ...object, text: 'Hello 2' } : object,
    );
    expect(updated.revision).toBe(2);
    expect(updated.objects[0].kind === 'text' && updated.objects[0].text).toBe('Hello 2');

    expect(updateObject(updated, id, (object) => object)).toBe(updated);
    expect(updateObject(updated, 'missing', (object) => object)).toBe(updated);
  });

  it('removeObject 未命中时不变', () => {
    const doc = addObject(makeDoc(1), text());
    expect(removeObject(doc, 'missing')).toBe(doc);
    const next = removeObject(doc, doc.objects[0].id);
    expect(next.objects).toEqual([]);
    expect(next.revision).toBe(doc.revision + 1);
  });
});

describe('页面 id 与多来源（模型 v2）', () => {
  const attachment = (key = 'attach-1'): PdfSource => ({
    key,
    bytes: new Uint8Array([9, 9, 9]),
    pageCount: 2,
    encrypted: false,
    fingerprint: `fp-${key}`,
  });

  it('创建时按来源生成稳定 id，删除不影响其它页 id', () => {
    const doc = makeDoc(3);
    expect(doc.pages.map((page) => page.id)).toEqual(['page-main-0', 'page-main-1', 'page-main-2']);
    const deleted = deletePage(doc, 3);
    expect(pageById(deleted, 'page-main-0')?.id).toBe('page-main-0');
    expect(pageById(deleted, 'page-main-1')?.deleted).toBeUndefined();
    expect(pageById(deleted, 'page-main-2')?.deleted).toBe(true);
  });

  it('insertBlankPage 插到可见位置并带上尺寸', () => {
    const doc = insertBlankPage(makeDoc(2), 2, { widthPt: 300, heightPt: 400 });
    const visible = visiblePages(doc);

    expect(visible).toHaveLength(3);
    expect(visible[1].blank).toEqual({ widthPt: 300, heightPt: 400 });
    expect(visible[1].sourceIndex).toBe(-1);
    expect(doc.view.page).toBe(2);
    expect(doc.attachments).toHaveLength(0);
  });

  it('insertPagesFrom 复制页、登记附件，同 key 不重复登记', () => {
    let doc = insertPagesFrom(makeDoc(1), 2, attachment(), [1, 0]);
    expect(visiblePages(doc)).toHaveLength(3);
    expect(visiblePages(doc).map((page) => page.sourceIndex)).toEqual([0, 1, 0]);
    expect(doc.attachments).toHaveLength(1);

    doc = insertPagesFrom(doc, 1, attachment(), [1]);
    expect(doc.attachments).toHaveLength(1);
    expect(visiblePages(doc)).toHaveLength(4);
    // Second insert of the same source page needs a unique id
    const ids = doc.pages.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('insertPagesFrom 拒绝加密来源与越界索引', () => {
    const doc = makeDoc(1);
    expect(insertPagesFrom(doc, 2, { ...attachment('attach-x'), encrypted: true }, [0])).toBe(doc);
    expect(insertPagesFrom(doc, 2, attachment(), [5])).toBe(doc);
  });

  it('duplicatePage 紧跟原页，id 唯一、对象仍锚在原页', () => {
    const doc = makeDoc(2);
    const duplicated = duplicatePage(doc, 'page-main-0');

    expect(visiblePages(duplicated).map((page) => page.id)).toEqual([
      'page-main-0',
      'page-main-0-copy',
      'page-main-1',
    ]);
    expect(duplicated.view.page).toBe(2);
  });

  it('movePageById 跨位置移动并跟随当前页', () => {
    const moved = movePageById(makeDoc(3), 'page-main-0', 3);
    expect(visiblePages(moved).map((page) => page.id)).toEqual([
      'page-main-1',
      'page-main-2',
      'page-main-0',
    ]);
    expect(moved.view.page).toBe(3);
    expect(movePageById(moved, 'missing', 1)).toBe(moved);
  });
});
