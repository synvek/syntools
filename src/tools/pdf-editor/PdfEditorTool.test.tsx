import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ToolResult } from '@/core/types';

// Mock the pdfjs boundary only: the open pipeline, state machine and shell all stay real.
vi.mock('@/core/pdf/render', () => ({ openPdfjsDoc: vi.fn() }));

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
    source: { bytes: new Uint8Array([1]), pageCount: 3, encrypted: false, fingerprint: 'fp' },
    id: 'doc-test',
    now: 0,
  });
}

const nativeGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  openMock.mockReset();
  // jsdom ships no canvas backend; PageCanvas only needs a truthy 2D context because the fake
  // document never paints anything.
  HTMLCanvasElement.prototype.getContext = (() => ({})) as typeof nativeGetContext;
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
    expect(screen.getByRole('tab', { name: '开始' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '视图' })).toBeInTheDocument();
    expect(screen.getByTestId('page-area-slot')).toBeInTheDocument();
    expect(screen.queryByText('打开一份 PDF 开始编辑')).toBeNull();
    expect(screen.getByTestId('pdf-status-page')).toHaveTextContent('第 1 / 3 页');
    expect(screen.getByTestId('ribbon-history-undo')).toBeDisabled();

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
