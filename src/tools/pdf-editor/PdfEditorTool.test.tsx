import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from '@cantoo/pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ToolResult } from '@/core/types';

// Mock the pdfjs boundary only: the open pipeline, state machine and shell all stay real.
// `renderPageDataUrl` is used by the thumbnail rail and must exist as a mock, otherwise opening the
// panel rejects with "No export is defined on the mock".
vi.mock('@/core/pdf/render', () => ({
  openPdfjsDoc: vi.fn(),
  renderPageDataUrl: vi.fn(async () => ({ ok: false, error: 'PROCESS_FAILED' })),
}));

import { i18n } from '@/core/i18n';
import { openPdfjsDoc } from '@/core/pdf/render';
import { createDoc } from './model/doc';
import PdfEditorTool from './PdfEditorTool';
import type { PdfRibbonActions } from './ribbonTabs';
import { buildPdfRibbonTabs } from './ribbonTabs';
import { pdfEditorStrings } from './strings';
import { PdfEditorView } from './ui/PdfEditorView';
import { SaveStatus } from './ui/SaveStatus';

const openMock = vi.mocked(openPdfjsDoc);

const tr = (key: string) => i18n.t(key) as string;

function makeActions(): PdfRibbonActions {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    setTool: vi.fn(),
    setZoom: vi.fn(),
    fit: vi.fn(),
    goToPage: vi.fn(),
    prevPage: vi.fn(),
    nextPage: vi.fn(),
    setViewMode: vi.fn(),
    togglePanel: vi.fn(),
    toggleDarkCanvas: vi.fn(),
  };
}

function fakePdfDoc(pageCount = 3): PDFDocumentProxy {
  return {
    numPages: pageCount,
    fingerprints: ['fp-test'],
    destroy: vi.fn(() => Promise.resolve()),
    getPage: vi.fn(async () => ({
      rotate: 0,
      getViewport: ({ scale }: { scale: number }) => ({
        width: 595 * scale,
        height: 842 * scale,
      }),
      render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
    })),
  } as unknown as PDFDocumentProxy;
}

// jsdom's File has no arrayBuffer(); the open pipeline only needs name/type/size/arrayBuffer.
function fakeFile(name: string, type: string): File {
  const bytes = new TextEncoder().encode('%PDF-1.4');
  return {
    name,
    type,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  } as unknown as File;
}

function pdfFile(name = 'doc.pdf'): File {
  return fakeFile(name, 'application/pdf');
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('file input not rendered');
  return input;
}

function choose(container: HTMLElement, file: File): void {
  fireEvent.change(fileInput(container), { target: { files: [file] } });
}

function fakeDocModel() {
  return createDoc({
    name: 'contract.pdf',
    source: {
      key: 'main',
      bytes: new Uint8Array([1]),
      pageCount: 3,
      encrypted: false,
      fingerprint: 'fp',
    },
    id: 'doc-test',
    now: 0,
  });
}

const nativeGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  openMock.mockReset();
  // Panel toggles persist to localStorage; a leaked flag would open rails in the next test
  localStorage.clear();
  // jsdom ships no canvas backend; PageCanvas only needs a truthy 2D context because the fake
  // document never paints anything.
  HTMLCanvasElement.prototype.getContext = (() => ({})) as unknown as typeof nativeGetContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = nativeGetContext;
});

describe('PdfEditorTool 空态与校验', () => {
  it('没有文档时不渲染 Ribbon，只显示投放区与状态栏', () => {
    const { container } = render(<PdfEditorTool />);

    expect(screen.getByText('打开一份 PDF 开始编辑')).toBeInTheDocument();
    expect(screen.getByText('拖入或点击选择 PDF 文件')).toBeInTheDocument();
    expect(screen.getAllByText('文件仅在本机处理，不会上传。').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('pdf-ribbon')).toBeNull();
    expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('未打开文件');
    expect(fileInput(container)).toHaveAttribute('accept', '.pdf,application/pdf');
  });

  it('非 PDF 直接报错，不进入解析', async () => {
    const { container } = render(<PdfEditorTool />);

    choose(container, fakeFile('notes.txt', 'text/plain'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('请选择 PDF 文件'));
    expect(openMock).not.toHaveBeenCalled();
  });
});

describe('PdfEditorTool 打开流程', () => {
  it('打开成功后渲染功能区、页面与状态栏', async () => {
    openMock.mockResolvedValue({ ok: true, value: fakePdfDoc(3) } as ToolResult<PDFDocumentProxy>);
    const { container } = render(<PdfEditorTool />);

    choose(container, pdfFile('three-pages.pdf'));

    await waitFor(() => expect(screen.getByTestId('pdf-ribbon')).toBeInTheDocument());
    expect(screen.queryByText('打开一份 PDF 开始编辑')).toBeNull();
    expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('第 1 / 3 页');
    await waitFor(() => expect(screen.getAllByTestId('pdf-page')).toHaveLength(3));
    expect(screen.getByTestId('pdf-scroll-view')).toHaveAttribute('data-dark', 'false');
  });

  it('翻页命令更新状态栏与当前页', async () => {
    openMock.mockResolvedValue({ ok: true, value: fakePdfDoc(3) } as ToolResult<PDFDocumentProxy>);
    const { container } = render(<PdfEditorTool />);
    choose(container, pdfFile());

    await waitFor(() => expect(screen.getByTestId('pdf-ribbon')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('ribbon-navigate-next'));
    await waitFor(() =>
      expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('第 2 / 3 页'),
    );

    fireEvent.click(screen.getByTestId('ribbon-navigate-prev'));
    await waitFor(() =>
      expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('第 1 / 3 页'),
    );
    expect(screen.getByTestId('ribbon-navigate-prev')).toBeDisabled();
  });

  it('加密 PDF：提示密码、错误密码保留输入、正确后打开', async () => {
    openMock.mockResolvedValueOnce({ ok: false, error: 'NEED_PASSWORD' });
    const { container } = render(<PdfEditorTool />);

    choose(container, pdfFile('secret.pdf'));

    const password = await screen.findByLabelText('PDF 密码');
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '解锁' })).toBeDisabled();

    fireEvent.change(password, { target: { value: 'wrong' } });
    openMock.mockResolvedValueOnce({ ok: false, error: 'WRONG_PASSWORD' });
    fireEvent.click(screen.getByRole('button', { name: '解锁' }));

    await waitFor(() => expect(screen.getByText('密码错误，请重试')).toBeInTheDocument());
    // 这是不用 usePdfPassword 的原因：重试时输入不能被清空
    expect((screen.getByLabelText('PDF 密码') as HTMLInputElement).value).toBe('wrong');

    openMock.mockResolvedValueOnce({
      ok: true,
      value: fakePdfDoc(3),
    } as ToolResult<PDFDocumentProxy>);
    fireEvent.click(screen.getByRole('button', { name: '解锁' }));

    await waitFor(() => expect(screen.getByTestId('pdf-ribbon')).toBeInTheDocument());
    expect(screen.queryByLabelText('PDF 密码')).toBeNull();
    expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('第 1 / 3 页');
  });

  it('注释页选高亮后拖动，创建可选中对象，Esc 回到选择工具', async () => {
    openMock.mockResolvedValue({ ok: true, value: fakePdfDoc(1) } as ToolResult<PDFDocumentProxy>);
    // jsdom 没有布局：给页面一个 1200×800 的盒子，指针才能换算成归一化坐标。
    // 宽度同时作用于 ribbon 容器，必须 > 640，否则 ribbon 自动折叠成弹出面板。
    const box = {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1200,
      bottom: 800,
      width: 1200,
      height: 800,
      toJSON: () => ({}),
    } as DOMRect;
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(box);

    try {
      const { container } = render(<PdfEditorTool />);
      choose(container, pdfFile('one-page.pdf'));
      await waitFor(() => expect(screen.getByTestId('pdf-ribbon')).toBeInTheDocument());

      // 注释命令已并入开始标签，不需要先切标签
      fireEvent.click(screen.getByTestId('ribbon-markup-highlight'));

      const overlay = screen.getByTestId('pdf-overlay');
      expect(overlay).toHaveAttribute('data-tool', 'highlight');

      fireEvent(
        overlay,
        new MouseEvent('pointerdown', { bubbles: true, clientX: 120, clientY: 400 }),
      );
      fireEvent(
        overlay,
        new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 460 }),
      );
      fireEvent(
        overlay,
        new MouseEvent('pointerup', { bubbles: true, clientX: 300, clientY: 460 }),
      );

      await waitFor(() => expect(screen.getAllByTestId('pdf-object')).toHaveLength(1));
      const created = screen.getByTestId('pdf-object');
      expect(created).toHaveAttribute('data-kind', 'markup');
      expect(created).toHaveAttribute('data-selected', 'true');

      // 注释格式已并入开始标签：选中标记对象时对象颜色控件转为可用，不再弹出独立上下文标签
      expect(screen.queryByTestId('ribbon-tab-annotate-format')).toBeNull();
      expect(screen.getByTestId('ribbon-tab-home')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('ribbon-ann-format-ann-color')).not.toBeDisabled();

      // Esc：清空选择并退出注释工具（否则下一次点击又会画一个高亮）
      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => expect(overlay).toHaveAttribute('data-tool', 'select'));
      expect(screen.getByTestId('pdf-object')).toHaveAttribute('data-selected', 'false');
      // 取消选择后对象格式控件回到禁用状态
      expect(screen.getByTestId('ribbon-ann-format-ann-color')).toBeDisabled();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('缩略图工具栏：插入空白页、删除页，最后一页不可删', async () => {
    openMock.mockResolvedValue({ ok: true, value: fakePdfDoc(2) } as ToolResult<PDFDocumentProxy>);
    const { container } = render(<PdfEditorTool />);
    choose(container, pdfFile('two-pages.pdf'));
    await waitFor(() => expect(screen.getByTestId('pdf-ribbon')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('ribbon-tab-view'));
    fireEvent.click(screen.getByTestId('ribbon-panels-thumbnails'));
    await waitFor(() => expect(screen.getByTestId('pdf-page-toolbar')).toBeInTheDocument());
    // 面板开关写进 localStorage，刷新后保持
    expect(localStorage.getItem('syntools.pdf-editor.panels')).toContain('"thumbnails":true');

    fireEvent.click(screen.getByTestId('pdf-page-insert-blank'));
    await waitFor(() => expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('/ 3 页'));

    fireEvent.click(screen.getByTestId('pdf-page-delete'));
    await waitFor(() => expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('/ 2 页'));

    fireEvent.click(screen.getByTestId('pdf-page-delete'));
    await waitFor(() => expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('/ 1 页'));
    expect(screen.getByTestId('pdf-page-delete')).toBeDisabled();
  });

  it('从文件插入页：解析范围后页数与页序都更新', async () => {
    const other = await PDFDocument.create();
    other.addPage([595.28, 841.89]);
    other.addPage([595.28, 841.89]);
    const otherBytes = await other.save();

    openMock.mockResolvedValue({ ok: true, value: fakePdfDoc(2) } as ToolResult<PDFDocumentProxy>);
    const { container } = render(<PdfEditorTool />);
    choose(container, pdfFile('two-pages.pdf'));
    await waitFor(() => expect(screen.getByTestId('pdf-ribbon')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('ribbon-tab-view'));
    fireEvent.click(screen.getByTestId('ribbon-panels-thumbnails'));
    await waitFor(() => expect(screen.getByTestId('pdf-page-toolbar')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('pdf-page-insert-from-file'));
    fireEvent.change(screen.getByTestId('pdf-insert-pages-file'), {
      target: {
        files: [
          {
            name: 'other.pdf',
            type: 'application/pdf',
            size: otherBytes.byteLength,
            lastModified: 0,
            arrayBuffer: async () => otherBytes.buffer,
          } as unknown as File,
        ],
      },
    });

    await waitFor(() => expect(screen.getByTestId('pdf-insert-pages-range')).toHaveValue('1-2'));
    fireEvent.click(screen.getByTestId('pdf-insert-pages-confirm'));

    await waitFor(() => expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('/ 4 页'));
    expect(screen.queryByTestId('pdf-insert-pages-dialog')).toBeNull();
  });
});

describe('PdfEditorView 表现层', () => {
  it('有文档时显示 Ribbon、页面插槽与状态栏', () => {
    const actions = makeActions();
    const tabs = buildPdfRibbonTabs({
      t: tr,
      hasDoc: true,
      view: { mode: 'continuous', zoom: 1, zoomMode: 'fit-width', page: 1, pageCount: 3 },
      history: { canUndo: false, canRedo: false },
      panels: { thumbnails: true, outline: false, properties: false },
      panelsAvailable: true,
      darkCanvas: false,
      tool: 'select',
      actions,
    });

    render(
      <PdfEditorView
        doc={fakeDocModel()}
        tabs={tabs}
        onFile={vi.fn()}
        pageArea={<div data-testid="page-area-slot" />}
      />,
    );

    expect(screen.getByTestId('pdf-ribbon')).toBeInTheDocument();
    // M4-6 follow-up: the ribbon must stay under the app header while pages scroll
    expect(screen.getByTestId('pdf-ribbon-sticky')).toHaveClass('sticky', 'top-14');
    expect(screen.getByRole('tab', { name: '开始' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '视图' })).toBeInTheDocument();
    // Only the page viewport scrolls: the workspace row is pinned to the first screen's leftover height,
    // otherwise the canvases stretch it and the window scrolls the tool title away with the pages.
    expect(screen.getByTestId('pdf-work-area').style.height).toMatch(/^\d+px$/);
    expect(screen.getByTestId('page-area-slot')).toBeInTheDocument();
    expect(screen.queryByText('打开一份 PDF 开始编辑')).toBeNull();
    expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('第 1 / 3 页');

    fireEvent.click(screen.getByTestId('ribbon-navigate-next'));
    expect(actions.nextPage).toHaveBeenCalledTimes(1);
  });

  it('切到视图标签后可切换深色画布', () => {
    const actions = makeActions();
    const tabs = buildPdfRibbonTabs({
      t: tr,
      hasDoc: true,
      view: { mode: 'continuous', zoom: 1, zoomMode: 'fit-width', page: 2, pageCount: 3 },
      history: { canUndo: true, canRedo: false },
      panels: { thumbnails: true, outline: false, properties: false },
      panelsAvailable: true,
      darkCanvas: false,
      tool: 'select',
      actions,
    });

    render(<PdfEditorView doc={fakeDocModel()} tabs={tabs} onFile={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: '视图' }));
    expect(screen.getByTestId('ribbon-panels-thumbnails')).toHaveAttribute('aria-pressed', 'true');

    const dark = screen.getByTestId('ribbon-display-dark-canvas');
    expect(dark).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(dark);
    expect(actions.toggleDarkCanvas).toHaveBeenCalledTimes(1);
  });
});

describe('SaveStatus', () => {
  it('按状态显示对应文案与颜色', () => {
    const { rerender } = render(<SaveStatus state="dirty" name="contract.pdf" />);

    expect(screen.getByTestId('pdf-save-status')).toHaveAttribute('data-state', 'dirty');
    expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();

    rerender(<SaveStatus state="saved" />);
    expect(screen.getByTestId('pdf-save-status')).toHaveAttribute('data-state', 'saved');
    expect(screen.getByText('已保存')).toBeInTheDocument();
  });
});

describe('文案注册', () => {
  it('9 种语言的文案都注册到了 tools.pdfEditor.*', () => {
    for (const lng of Object.keys(pdfEditorStrings)) {
      expect(i18n.getResource(lng, 'translation', 'tools.pdfEditor.tabHome')).toBeTruthy();
      expect(i18n.getResource(lng, 'translation', 'tools.pdfEditor.statusNoFile')).toBeTruthy();
      expect(i18n.getResource(lng, 'translation', 'tools.pdfEditor.err.NOT_PDF')).toBeTruthy();
    }
  });

  it('toolsMeta 已进入外壳语言包（导航与搜索可读）', () => {
    expect(i18n.getResource('zh', 'translation', 'toolsMeta.pdf-editor.name')).toBe('PDF 编辑器');
    expect(i18n.getResource('en', 'translation', 'toolsMeta.pdf-editor.name')).toBe('PDF Editor');
  });
});
