import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { downloadBlob, downloadText } from '@/core/lib/download';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_DOCUMENT_NAME,
  MAX_MARKDOWN_BYTES,
  applyHeadingIds,
  buildHtmlDocument,
  countMarkdownStats,
  extractOutline,
  renderMarkdown,
  withExtension,
  type MarkdownOutlineItem,
} from './core';
import { clearDraft, readDraft, writeDraft, type MarkdownViewMode } from './draft';
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor';
import { Outline } from './Outline';

const MODES: MarkdownViewMode[] = ['edit', 'split', 'preview'];
/** 草稿写入节流：输入停顿后再落盘，避免每次按键都写 localStorage */
const DRAFT_DEBOUNCE_MS = 800;
/** 提示条的展示时长 */
const NOTICE_MS = 2400;
const ACCEPT = '.md,.markdown,.txt,text/markdown,text/plain';

const GHOST_BUTTON =
  'inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors duration-150 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800';

/**
 * Markdown 编辑器：CodeJar 语法高亮 + 实时预览 + 大纲 + 统计 + 文件读写。
 *
 * 三种视图：编辑 / 分屏 / 预览；分屏时编辑器滚动按比例带动预览。
 * 内容与偏好自动存入 localStorage 草稿，刷新或误关后自动恢复。
 */
export default function MarkdownEditorTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '', g: true, b: false }), []);

  const [text, setText] = useState(init.i);
  const [gfm, setGfm] = useState(init.g);
  const [breaks, setBreaks] = useState(init.b);
  const [view, setView] = useState<MarkdownViewMode>('split');
  const [syncScroll, setSyncScroll] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorHandleRef = useRef<MarkdownEditorHandle | null>(null);
  const hydratedRef = useRef(false);
  const skipSaveRef = useRef(true);
  const noticeTimerRef = useRef<number | null>(null);

  const notify = useCallback(
    (key: string) => {
      setNotice(t(key));
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
    },
    [t],
  );

  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  // 首次进入：分享链接优先；否则恢复本地草稿
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (init.i) return;
    const draft = readDraft();
    if (!draft) return;
    if (draft.text) setText(draft.text);
    setView(draft.view);
    setGfm(draft.gfm);
    setBreaks(draft.breaks);
    setSyncScroll(draft.syncScroll);
    setOutlineOpen(draft.outline);
    if (draft.name) setName(draft.name);
    if (draft.text) notify('tools.markdown.draftRestored');
  }, [init.i, notify]);

  // 草稿写入（节流）；首次渲染跳过，避免用初始值覆盖刚读出的草稿
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (!text) {
        clearDraft();
        return;
      }
      writeDraft({ text, view, gfm, breaks, syncScroll, outline: outlineOpen, name });
    }, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, view, gfm, breaks, syncScroll, outlineOpen, name]);

  const result = useMemo(() => renderMarkdown(text, { gfm, breaks }), [text, gfm, breaks]);
  const html = useMemo(() => (result.ok ? applyHeadingIds(result.value) : ''), [result]);
  const outline = useMemo(() => extractOutline(text), [text]);
  const stats = useMemo(() => countMarkdownStats(text), [text]);
  const showError = text.trim().length > 0 && !result.ok;

  const save = useCallback(() => {
    if (!text) return;
    downloadText(text, withExtension(name || DEFAULT_DOCUMENT_NAME, '.md'));
  }, [text, name]);

  // Ctrl/⌘+S 保存（编辑器与预览区通用）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      save();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]);

  const scrollPreviewTo = useCallback((id: string) => {
    const container = previewRef.current;
    const target = container?.querySelector<HTMLElement>(`#${id}`);
    if (!container || !target) return;
    container.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: 'smooth' });
  }, []);

  const handleEditorScroll = useCallback(
    (ratio: number) => {
      if (!syncScroll || view !== 'split') return;
      const container = previewRef.current;
      if (!container) return;
      const max = container.scrollHeight - container.clientHeight;
      if (max <= 0) return;
      container.scrollTop = ratio * max;
    },
    [syncScroll, view],
  );

  const handleOutlineSelect = useCallback(
    (item: MarkdownOutlineItem) => {
      if (view !== 'preview') {
        const handle = editorHandleRef.current;
        if (handle) {
          handle.jar.restore({ start: item.offset, end: item.offset, dir: '->' });
          handle.focus();
        }
      }
      if (view !== 'edit') scrollPreviewTo(item.id);
    },
    [scrollPreviewTo, view],
  );

  const loadFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_MARKDOWN_BYTES) {
        notify('tools.markdown.fileTooLarge');
        return;
      }
      try {
        const content = await file.text();
        setText(content);
        setName(file.name.replace(/\.(md|markdown|txt)$/i, ''));
      } catch {
        notify('tools.markdown.fileError');
      }
    },
    [notify],
  );

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 清空以便重复选择同一个文件
    e.target.value = '';
    if (file) void loadFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadFile(file);
  };

  const copy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      notify('tools.markdown.copied');
    } catch {
      notify('tools.markdown.fileError');
    }
  };

  const exportHtml = () => {
    if (!html) return;
    downloadBlob(
      buildHtmlDocument(name || DEFAULT_DOCUMENT_NAME, html),
      withExtension(name || DEFAULT_DOCUMENT_NAME, '.html'),
      'text/html;charset=utf-8',
    );
  };

  const handleClear = () => {
    setText('');
    clearDraft();
  };

  return (
    <div className="flex flex-col gap-3" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <OptionBar>
        <div
          role="group"
          aria-label={t('tools.markdown.mode.aria')}
          className="flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-700"
        >
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={`px-2.5 py-1 text-xs transition-colors duration-150 ${
                view === mode
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {t(`tools.markdown.mode.${mode}`)}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={gfm}
            onChange={(e) => setGfm(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.markdown.gfm')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={breaks}
            onChange={(e) => setBreaks(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.markdown.breaks')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={syncScroll}
            onChange={(e) => setSyncScroll(e.target.checked)}
            disabled={view !== 'split'}
            className="h-4 w-4 accent-blue-600 disabled:opacity-50"
          />
          {t('tools.markdown.syncScroll')}
        </label>
        <button
          type="button"
          aria-pressed={outlineOpen}
          onClick={() => setOutlineOpen((value) => !value)}
          className={`${GHOST_BUTTON} ${outlineOpen ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300' : ''}`}
        >
          {t('tools.markdown.outline')}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            aria-label={t('tools.markdown.file.open')}
            onChange={onFileChange}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className={GHOST_BUTTON}>
            {t('tools.markdown.file.open')}
          </button>
          <button type="button" onClick={save} disabled={!text} className={GHOST_BUTTON}>
            {t('tools.markdown.file.save')}
          </button>
          <button
            type="button"
            onClick={() => void copy(text)}
            disabled={!text}
            className={GHOST_BUTTON}
          >
            {t('tools.markdown.file.copyMd')}
          </button>
          <button
            type="button"
            onClick={() => void copy(html)}
            disabled={!html}
            className={GHOST_BUTTON}
          >
            {t('tools.markdown.file.copyHtml')}
          </button>
          <button type="button" onClick={exportHtml} disabled={!html} className={GHOST_BUTTON}>
            {t('tools.markdown.file.exportHtml')}
          </button>
          <ClearButton onClick={handleClear} disabled={!text} />
          <ShareButton getState={() => ({ i: text, g: gfm, b: breaks })} />
        </div>
      </OptionBar>

      <div className="flex min-h-5 items-center gap-2">
        {notice ? (
          <span role="status" className="text-xs text-blue-600 dark:text-blue-400">
            {notice}
          </span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('tools.markdown.dropHint')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {view !== 'preview' ? (
          <MarkdownEditor
            value={text}
            onChange={setText}
            placeholder={t('tools.markdown.placeholder')}
            onScrollRatio={handleEditorScroll}
            onReady={(handle) => {
              editorHandleRef.current = handle;
            }}
          />
        ) : null}

        {view !== 'edit' ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.markdown.preview')}
            </span>
            {showError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {t(`tools.markdown.err.${result.ok ? 'PARSE' : result.error}`)}
              </p>
            ) : (
              <div
                ref={previewRef}
                data-testid="markdown-preview"
                className="markdown-body relative min-h-[320px] flex-1 overflow-auto rounded-md border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
          </div>
        ) : null}

        {outlineOpen ? (
          <div className="w-full lg:w-52 lg:shrink-0">
            <Outline items={outline} onSelect={handleOutlineSelect} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>
          {t('tools.markdown.stats.words')} {stats.words}
        </span>
        <span>
          {t('tools.markdown.stats.chars')} {stats.characters}
        </span>
        <span>
          {t('tools.markdown.stats.lines')} {stats.lines}
        </span>
        <span>
          {t('tools.markdown.stats.reading')} {stats.readingMinutes}{' '}
          {t('tools.markdown.stats.minutes')}
        </span>
        <span className="ml-auto">{t('tools.markdown.shortcuts')}</span>
      </div>
    </div>
  );
}
