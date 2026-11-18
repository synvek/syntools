import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadOutline, resolveOutlinePage } from './outline';

interface FakeNode {
  title: string;
  dest?: unknown;
  items?: FakeNode[];
}

function fakeDoc(options: {
  outline?: FakeNode[] | null;
  destination?: unknown;
  pageIndex?: number;
}): PDFDocumentProxy {
  return {
    getOutline: vi.fn(async () => options.outline ?? null),
    getDestination: vi.fn(async () => options.destination ?? null),
    getPageIndex: vi.fn(async () => {
      if (options.pageIndex === undefined) throw new Error('bad ref');
      return options.pageIndex;
    }),
  } as unknown as PDFDocumentProxy;
}

describe('resolveOutlinePage', () => {
  it('显式目标里的数字索引 → 1 基页码', async () => {
    const doc = fakeDoc({});
    expect(await resolveOutlinePage(doc, [4, { name: 'XYZ' }])).toBe(5);
  });

  it('命名目标先 getDestination，再用 getPageIndex 解析引用', async () => {
    const doc = fakeDoc({ destination: [{ num: 9, gen: 0 }, { name: 'Fit' }], pageIndex: 6 });
    expect(await resolveOutlinePage(doc, 'chapter-2')).toBe(7);
    expect(doc.getDestination).toHaveBeenCalledWith('chapter-2');
  });

  it('无法解析的目标返回 null，不抛出', async () => {
    const doc = fakeDoc({ destination: null });
    expect(await resolveOutlinePage(doc, 'missing')).toBeNull();
    expect(await resolveOutlinePage(doc, null)).toBeNull();
    expect(await resolveOutlinePage(doc, [])).toBeNull();
  });
});

describe('loadOutline', () => {
  it('无大纲时返回空数组', async () => {
    expect(await loadOutline(fakeDoc({ outline: null }))).toEqual([]);
    expect(await loadOutline(fakeDoc({ outline: [] }))).toEqual([]);
  });

  it('递归解析嵌套条目，缺标题时用占位符', async () => {
    const doc = fakeDoc({
      outline: [
        { title: 'Chapter 1', dest: [0], items: [{ title: '  1.1  ', dest: [2] }] },
        { title: '', dest: null },
      ],
    });

    expect(await loadOutline(doc)).toEqual([
      {
        title: 'Chapter 1',
        page: 1,
        items: [{ title: '1.1', page: 3, items: [] }],
      },
      { title: '—', page: null, items: [] },
    ]);
  });
});
