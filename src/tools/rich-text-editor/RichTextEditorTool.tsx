import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent, useEditor } from '@tiptap/react';
import { DocumentHeader, HintTip } from '@/core/components/DocumentHeader';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { Icon } from '@/core/components/Icon';
import { ProgressBar } from '@/core/components/ProgressBar';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes } from '@/core/pdf/download';
import type { ToolResult } from '@/core/types';
import { PrintLayer } from './A4Page';
import { EditorToolbar } from './EditorToolbar';
import {
  buildExportFilename,
  countDocStats,
  createEmptyDocHtml,
  htmlToPlain,
  sanitizeDocHtml,
} from './core';
import { clearDraft, readDraft, writeDraft } from './draft';
import { exportDocxBlob, importDocx } from './docx';
import { createExtensions } from './extensions';
import { printToPdf, snapshotToPdf } from './pdf';
import { registerRichTextStrings } from './strings';
import './editor.css';

// 工具文案随本 chunk 懒加载注册，不占用首屏语言包体积
registerRichTextStrings(i18n);

type Failure = Extract<ToolResult<unknown>, { ok: false }>;
type PdfMode = 'text' | 'snapshot';
type BusyKind = 'import' | 'docx' | 'pdf' | null;

const SAVE_DEBOUNCE_MS = 600;

/** 等待下一帧渲染完成（打印/截图前必须完成布局） */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * 富文本编辑器工具：本地编辑 + Word(.docx) 导入导出 + 双模式 PDF 导出。
 * 所有内容处理均在浏览器完成，不产生任何外发请求。
 */
export default function RichTextEditorTool() {
  const { t } = useTranslation();
  const initial = useMemo(() => readDraft(), []);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [snapshotHtml, setSnapshotHtml] = useState(initial?.html ?? createEmptyDocHtml());
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [progress, setProgress] = useState(0);
  const [pdfMode, setPdfMode] = useState<PdfMode>('text');
  const [printReady, setPrintReady] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [saved, setSaved] = useState(Boolean(initial));
  const flowRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;

  const placeholder = useMemo(() => t('tools.richText.placeholder'), [t]);
  const extensions = useMemo(() => createExtensions(placeholder), [placeholder]);

  const editor = useEditor({ extensions, content: snapshotHtml });

  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const html = editor.getHTML();
        setSnapshotHtml(html);
        setSaved(writeDraft({ title: titleRef.current, html }));
      }, SAVE_DEBOUNCE_MS);
    };
    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      if (timer) clearTimeout(timer);
    };
  }, [editor]);

  // 标题变化同样落盘为草稿
  useEffect(() => {
    if (!editor) return;
    const timer = setTimeout(() => {
      const html = editor.getHTML();
      setSaved(writeDraft({ title, html }));
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title, editor]);

  // 放映用只读 HTML：复用导出 PDF 的同一套净化逻辑，避免注入风险
  const presentHtml = useMemo(() => {
    const result = sanitizeDocHtml(snapshotHtml);
    return result.ok ? result.value : '';
  }, [snapshotHtml]);

  const stats = useMemo(() => countDocStats(htmlToPlain(snapshotHtml)), [snapshotHtml]);
  const isEmpty = stats.chars === 0;

  const handleImport = async (file: File) => {
    setBusy('import');
    setFailure(null);
    const result = await importDocx(file);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    editor?.commands.setContent(result.value);
    setSnapshotHtml(result.value);
    setSaved(writeDraft({ title: titleRef.current, html: result.value }));
    if (!titleRef.current.trim()) {
      setTitle(file.name.replace(/\.docx$/i, ''));
    }
  };

  const handleExportDocx = async () => {
    if (!editor) return;
    setBusy('docx');
    setFailure(null);
    const result = await exportDocxBlob(editor.getHTML(), title);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    downloadBlob(result.value, buildExportFilename(title || 'document', 'docx'));
  };

  const handleExportPdf = async () => {
    setFailure(null);
    setProgress(0);
    setPrintReady(true);
    await nextFrame();
    try {
      if (pdfMode === 'text') {
        // 打印视图中的文字可选可检索，且中文无需嵌入字体
        printToPdf();
        return;
      }
      const flow = flowRef.current;
      if (!flow) {
        setFailure({ ok: false, error: 'RENDER_FAILED' });
        return;
      }
      setBusy('pdf');
      const result = await snapshotToPdf(flow, setProgress);
      setBusy(null);
      if (!result.ok) {
        setFailure(result);
        return;
      }
      downloadBytes(
        result.value,
        buildExportFilename(title || 'document', 'pdf'),
        'application/pdf',
      );
    } finally {
      setBusy(null);
      setPrintReady(false);
    }
  };

  const handleClear = () => {
    editor?.commands.clearContent();
    clearDraft();
    setTitle('');
    setSnapshotHtml(createEmptyDocHtml());
    setSaved(false);
    setFailure(null);
  };

  const handleNew = () => {
    const hasContent = stats.chars > 0 || title.trim().length > 0;
    if (hasContent && !window.confirm(t('common.discardConfirm'))) return;
    handleClear();
  };

  return (
    <div className="flex flex-col gap-4">
      <DocumentHeader
        titleLabel={t('tools.richText.docTitle')}
        titlePlaceholder={t('tools.richText.titlePlaceholder')}
        title={title}
        onTitleChange={setTitle}
        newLabel={t('common.newDoc')}
        newIcon="text"
        onNew={handleNew}
        afterNew={
          <button
            type="button"
            data-testid="rich-text-present"
            onClick={() => setPresenting(true)}
            disabled={isEmpty}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Icon name="present" className="h-4 w-4" />
            {t('tools.richText.present')}
          </button>
        }
        io={
          <>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              title={t('tools.richText.importHint')}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="upload" className="h-4 w-4" />
              {t('tools.richText.importDocx')}
            </button>

            <button
              type="button"
              onClick={() => void handleExportDocx()}
              disabled={busy !== null || isEmpty}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              {busy === 'docx' ? t('tools.richText.exporting') : t('tools.richText.exportDocx')}
            </button>

            <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              {t('tools.richText.pdfMode')}
              <select
                value={pdfMode}
                onChange={(e) => setPdfMode(e.target.value as PdfMode)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="text">{t('tools.richText.modeText')}</option>
                <option value="snapshot">{t('tools.richText.modeSnapshot')}</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={busy !== null || isEmpty}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              <Icon name="pdf" className="h-4 w-4" />
              {busy === 'pdf' ? t('tools.richText.exporting') : t('tools.richText.exportPdf')}
            </button>

            {/* 导出模式说明改为 tooltip，避免占用行内空间 */}
            <HintTip
              label={t('tools.richText.pdfMode')}
              text={
                pdfMode === 'text'
                  ? t('tools.richText.modeTextHint')
                  : t('tools.richText.modeSnapshotHint')
              }
            />
          </>
        }
        stats={
          <>
            <span>
              {t('tools.richText.chars')}: {stats.chars}
            </span>
            <span>
              {t('tools.richText.words')}: {stats.words}
            </span>
            <span>
              {t('tools.richText.paragraphs')}: {stats.paragraphs}
            </span>
          </>
        }
        status={saved ? t('tools.richText.saved') : t('tools.richText.saving')}
        onClear={handleClear}
        clearDisabled={isEmpty && !title}
      />

      <EditorToolbar editor={editor} />

      <div className="mx-auto w-full max-w-[860px]">
        <div className="rte-surface rounded-lg border border-gray-200 bg-white px-8 py-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <EditorContent editor={editor} />
        </div>
      </div>

      {busy === 'pdf' && <ProgressBar value={progress} label={t('tools.richText.exporting')} />}

      {presenting ? (
        <PresentOverlay
          title={title.trim() || t('tools.richText.titlePlaceholder')}
          onClose={() => setPresenting(false)}
          exitLabel={t('tools.richText.exitPresent')}
          failedLabel={t('tools.richText.presentFailed')}
          failed={!presentHtml}
          align="top"
        >
          {/* 只读页面：直接复用打印版式（170mm 白纸 + 文档字体），不改动编辑器本身 */}
          <div
            data-testid="present-document"
            className="rte-print-flow max-h-full overflow-auto rounded-lg px-10 py-10 shadow-2xl"
            dangerouslySetInnerHTML={{ __html: presentHtml }}
          />
        </PresentOverlay>
      ) : null}

      <input
        ref={importInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleImport(file);
        }}
      />

      {failure && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.richText', failure)}
        </p>
      )}

      {printReady && <PrintLayer html={snapshotHtml} flowRef={flowRef} />}
    </div>
  );
}
