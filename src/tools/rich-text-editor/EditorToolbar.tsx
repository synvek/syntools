import { useMemo, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorState, type Editor } from '@tiptap/react';
import { Icon } from '@/core/components/Icon';
import type { ViewMode } from './draft';
import { findSelectedFootnote } from './footnotes';
import { normalizeImageLayer } from './imageLayer';
import {
  DEFAULT_FONT_SIZE_PX,
  DEFAULT_LINE_HEIGHT,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  buildFontOptions,
  createSystemFontProbe,
  detectDefaultFontName,
  detectInstalledFonts,
  matchFontOption,
} from './typography';
import { CONTENT_WIDTH_PX } from './core';

interface ToolButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** 工具栏按钮：激活态蓝底，尺寸紧凑，带 aria-pressed 与 tooltip */
function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-xs transition-colors ${
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

/**
 * 撤销/重做图标：标准「弯箭头 + 圆弧」造型（与 Excalidraw / tldraw 等画板应用一致），
 * 描边参数与内置 Icon 集统一（24 视窗、当前色描边）。
 */
function UndoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
    </svg>
  );
}

/** 刷新图标：顺时针箭头 + 缺口圆环（与撤销/重做图标同一套描边参数） */
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-2.5 6.3" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

/** 脚注图标：基线 + 上标数字，与 Word「插入脚注」的视觉语义一致 */
function FootnoteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* 上标数字 1 */}
      <path d="M14 4.6 16 3.2v5.9" />
      {/* 分隔线 + 正文基线，表达「脚注落在页面底部」 */}
      <path d="M5.5 12.5h6" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

/** 图片对齐图标：方框 + 三条对齐线（左/中/右各不相同，避免三个按钮长得一样） */
function ImageAlignIcon({ position }: { position: 'left' | 'center' | 'right' }) {
  const bars =
    position === 'left'
      ? ['M2 9h8', 'M2 12h5', 'M2 15h8']
      : position === 'center'
        ? ['M1 9h10', 'M3.5 12h5', 'M1 15h10']
        : ['M2 9h8', 'M5 12h5', 'M2 15h8'];
  return (
    <svg
      viewBox="0 0 14 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <rect x="1.5" y="2" width="11" height="5" rx="1" />
      {bars.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** 对齐按钮里的装饰条（左/中/右/两端对齐） */
function AlignBars({ widths }: { widths: string[] }) {
  return (
    <span className="flex w-4 flex-col items-center gap-[2px]" aria-hidden="true">
      {widths.map((w, index) => (
        <span key={index} className="h-[2px] bg-current" style={{ width: w }} />
      ))}
    </span>
  );
}

interface ToolbarSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** 宽版：字体名较长（如 Franklin Gothic Medium）时避免被截断 */
  wide?: boolean;
}

/** 工具栏内联下拉：与 pdfMode 选择器同风格，紧凑高度 */
function ToolbarSelect({ label, value, onChange, options, wide }: ToolbarSelectProps) {
  return (
    <select
      aria-label={label}
      title={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 ${
        wide ? 'max-w-44' : 'max-w-32'
      }`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** 缩放档位（100% = 1） */
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

interface EditorToolbarProps {
  editor: Editor | null;
  onToggleFind: () => void;
  findOpen: boolean;
  onToggleOutline: () => void;
  outlineOpen: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** 页面设置 */
  pageSetupOpen: boolean;
  onTogglePageSetup: () => void;
  /** 插入目录 */
  onInsertToc: () => void;
  /** 刷新目录（重算分页与页码） */
  onRefreshToc: () => void;
  tocDisabled: boolean;
  /** 脚注：选中已有脚注时为编辑，否则为新建 */
  onFootnote: () => void;
  /** 公式：选中已有公式时为编辑，否则为新建 */
  onMath: () => void;
  /** 样式面板 */
  stylesOpen: boolean;
  onToggleStyles: () => void;
  /** 模板面板 */
  templatesOpen: boolean;
  onToggleTemplates: () => void;
  /** 拼写检查面板 */
  spellcheckOpen: boolean;
  onToggleSpellcheck: () => void;
  /** 批注与修订 */
  reviewOpen: boolean;
  onToggleReview: () => void;
  /** 历史版本 */
  onOpenVersions: () => void;
  versionsDisabled: boolean;
  /** 视图缩放 */
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

/**
 * 富文本工具栏（两层结构）：
 * - 第一层「内容格式」：历史 / 段落样式 / 字符格式 / 列表 / 插入 / 对齐 / 缩进 / 条件组（图片、表格）/ 查找
 * - 第二层「文档与视图」：大纲 / 页面设置 / 目录 / 样式 / 批注修订 / 历史版本 …… 右侧缩放与视图模式
 * 通过 useEditorState 精确订阅激活态，避免整棵树随输入频繁重渲染。
 */
export function EditorToolbar({
  editor,
  onToggleFind,
  findOpen,
  onToggleOutline,
  outlineOpen,
  viewMode,
  onViewModeChange,
  pageSetupOpen,
  onTogglePageSetup,
  onInsertToc,
  onRefreshToc,
  tocDisabled,
  onFootnote,
  onMath,
  stylesOpen,
  onToggleStyles,
  templatesOpen,
  onToggleTemplates,
  spellcheckOpen,
  onToggleSpellcheck,
  reviewOpen,
  onToggleReview,
  onOpenVersions,
  versionsDisabled,
  zoom,
  onZoomChange,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  // 系统字体探测只在挂载时做一次：字体菜单只列出当前系统真实安装的字体
  const installedFonts = useMemo(() => detectInstalledFonts(createSystemFontProbe()), []);
  const defaultFontName = useMemo(
    () => detectDefaultFontName(navigator.userAgent, navigator.platform ?? ''),
    [],
  );
  const fontOptions = useMemo(() => {
    const installed = installedFonts.some(
      (font) => font.name.toLowerCase() === defaultFontName.toLowerCase(),
    );
    // 首项显示具体字体名（正文实际生效的字体）；探测不到时退回通用文案
    const label = installed ? defaultFontName : t('tools.richText.fontDefault');
    return [
      ...buildFontOptions(installedFonts, label, defaultFontName),
      { value: 'sans-serif', label: t('tools.richText.fontSans') },
      { value: 'serif', label: t('tools.richText.fontSerif') },
      { value: 'monospace', label: t('tools.richText.fontMono') },
    ];
  }, [installedFonts, defaultFontName, t]);

  // 字号/行距同样显示具体数值：未显式设置时即文档默认值
  const fontSizeOptions = useMemo(
    () => [
      { value: '', label: String(DEFAULT_FONT_SIZE_PX) },
      ...FONT_SIZE_OPTIONS.map((size) => ({ value: `${size}px`, label: String(size) })),
    ],
    [],
  );
  const lineHeightOptions = useMemo(
    () => [
      { value: '', label: String(DEFAULT_LINE_HEIGHT) },
      ...LINE_HEIGHT_OPTIONS.map((value) => ({ value: String(value), label: String(value) })),
    ],
    [],
  );
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor;
      if (!e) return null;
      const headingLevel = ([1, 2, 3, 4, 5, 6] as const).find((level) =>
        e.isActive('heading', { level }),
      );
      return {
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        headingLevel,
        paragraph: e.isActive('paragraph'),
        fontSize: String(e.getAttributes('textStyle').fontSize ?? ''),
        fontFamily: String(e.getAttributes('textStyle').fontFamily ?? ''),
        lineHeight: String(e.getAttributes('textStyle').lineHeight ?? ''),
        color: String(e.getAttributes('textStyle').color ?? ''),
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        code: e.isActive('code'),
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        taskList: e.isActive('taskList'),
        blockquote: e.isActive('blockquote'),
        codeBlock: e.isActive('codeBlock'),
        link: e.isActive('link'),
        alignLeft: e.isActive('textAlign', { textAlign: 'left' }),
        alignCenter: e.isActive('textAlign', { textAlign: 'center' }),
        alignRight: e.isActive('textAlign', { textAlign: 'right' }),
        alignJustify: e.isActive('textAlign', { textAlign: 'justify' }),
        inTable: e.isActive('table'),
        headerRow: e.isActive('tableHeader'),
        canMergeCells: e.can().mergeCells(),
        canSplitCell: e.can().splitCell(),
        tableBordered: Boolean(e.getAttributes('table').bordered),
        tableZebra: Boolean(e.getAttributes('table').zebra),
        inImage: e.isActive('image') || Boolean(e.getAttributes('image').src),
        imageWidth: (e.getAttributes('image').width as number | undefined) ?? null,
        imageAlign: (e.getAttributes('image').align as string | undefined) ?? null,
        imageLayer: normalizeImageLayer(e.getAttributes('image').layer as string | undefined),
        paragraphSpacing: (() => {
          const attrs = e.getAttributes('paragraph');
          const before = Number(attrs.spacingBefore ?? 0);
          const after = Number(attrs.spacingAfter ?? 0);
          return `${before}-${after}`;
        })(),
        footnoteSelected: findSelectedFootnote(e.state) !== null,
        mathSelected: e.isActive('mathInline') || e.isActive('mathBlock'),
      };
    },
  });

  if (!editor || !state) return null;

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? '');
      if (src) editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  };

  const toggleLink = () => {
    if (state.link) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = window.prompt(t('tools.richText.linkPrompt'), 'https://');
    if (!href) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const chain = () => editor.chain().focus();
  // 原生取色器只接受 #rrggbb：非标准值（如导入文档里的命名色）回退到默认正文色
  const currentColor = /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : '#111827';

  // 图片宽度内部统一存像素，工具栏用百分比预设表达（换算基准 = 当前正文内容宽度）
  const contentWidth = Math.max(1, Math.round(editor.view.dom.clientWidth || CONTENT_WIDTH_PX));
  const presetWidths = [25, 50, 75, 100].map((pct) => ({
    pct,
    px: Math.round((pct / 100) * contentWidth),
    value: String(pct),
  }));
  const imageWidth = state.imageWidth === null ? null : Math.round(state.imageWidth);
  const matchedWidth = presetWidths.find(
    (preset) => imageWidth !== null && Math.abs(imageWidth - preset.px) <= 2,
  );
  const imageWidthValue = imageWidth === null ? '' : (matchedWidth?.value ?? 'custom');
  const imageWidthOptions = [
    { value: '', label: t('tools.richText.imageWidthAuto') },
    ...presetWidths.map((preset) => ({ value: preset.value, label: `${preset.pct}%` })),
    // 拖动缩放手柄后宽度是任意像素值：显示为「自定义 (Npx)」，避免看起来像回到了自动
    ...(imageWidthValue === 'custom' && imageWidth !== null
      ? [{ value: 'custom', label: t('tools.richText.imageWidthCustom', { px: imageWidth }) }]
      : []),
  ];

  return (
    <div
      data-testid="rich-text-toolbar"
      className="sticky top-0 z-10 -mx-1 overflow-hidden rounded-lg border border-gray-200 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
    >
      {/* 第一层：内容格式 */}
      <div className="flex flex-wrap items-center gap-1 p-1">
        <div className="flex items-center gap-1">
          <ToolButton
            label={t('tools.richText.undo')}
            disabled={!state.canUndo}
            onClick={() => chain().undo().run()}
          >
            <UndoIcon className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label={t('tools.richText.redo')}
            disabled={!state.canRedo}
            onClick={() => chain().redo().run()}
          >
            <RedoIcon className="h-4 w-4" />
          </ToolButton>
        </div>

        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex items-center gap-1">
          <ToolbarSelect
            label={t('tools.richText.headingSelect')}
            value={state.headingLevel ? String(state.headingLevel) : 'paragraph'}
            onChange={(value) =>
              value === 'paragraph'
                ? chain().setParagraph().run()
                : chain()
                    .toggleHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 })
                    .run()
            }
            options={[
              { value: 'paragraph', label: t('tools.richText.paragraph') },
              ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
                value: String(level),
                label: t(`tools.richText.h${level}`),
              })),
            ]}
          />
          <ToolbarSelect
            label={t('tools.richText.fontFamily')}
            value={matchFontOption(state.fontFamily, fontOptions)}
            onChange={(value) =>
              value ? chain().setFontFamily(value).run() : chain().unsetFontFamily().run()
            }
            options={fontOptions}
            wide
          />
          <ToolbarSelect
            label={t('tools.richText.fontSize')}
            value={state.fontSize}
            onChange={(value) =>
              value ? chain().setFontSize(value).run() : chain().unsetFontSize().run()
            }
            options={fontSizeOptions}
          />
          <ToolbarSelect
            label={t('tools.richText.lineHeight')}
            value={state.lineHeight}
            onChange={(value) =>
              value ? chain().setLineHeight(value).run() : chain().unsetLineHeight().run()
            }
            options={lineHeightOptions}
          />
          <ToolButton
            label={t('tools.richText.findReplace')}
            active={findOpen}
            onClick={onToggleFind}
          >
            <Icon name="search" className="h-4 w-4" />
          </ToolButton>
        </div>

        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex items-center gap-1">
          <ToolButton
            label={t('tools.richText.bold')}
            active={state.bold}
            onClick={() => chain().toggleBold().run()}
          >
            <span className="font-bold">B</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.italic')}
            active={state.italic}
            onClick={() => chain().toggleItalic().run()}
          >
            <span className="italic">I</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.underline')}
            active={state.underline}
            onClick={() => chain().toggleUnderline().run()}
          >
            <span className="underline">U</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.strike')}
            active={state.strike}
            onClick={() => chain().toggleStrike().run()}
          >
            <span className="line-through">S</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.code')}
            active={state.code}
            onClick={() => chain().toggleCode().run()}
          >
            <span className="font-mono">&lt;/&gt;</span>
          </ToolButton>
          {/* 文字颜色：只显示「A + 当前色」图标，名称走 tooltip */}
          <label
            title={t('tools.richText.color')}
            className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <span aria-hidden="true" className="flex w-4 flex-col items-center">
              <span className="text-sm font-semibold leading-none">A</span>
              <span
                className="mt-[2px] h-[3px] w-4 rounded-full border border-black/10"
                style={{ backgroundColor: currentColor }}
              />
            </span>
            <input
              type="color"
              aria-label={t('tools.richText.color')}
              value={currentColor}
              onChange={(e) => chain().setColor(e.target.value).run()}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <ToolButton
            label={t('tools.richText.highlight')}
            onClick={() => chain().toggleHighlight({ color: '#FEF08A' }).run()}
          >
            <span className="rounded bg-yellow-200 px-1 text-gray-900 dark:bg-yellow-300">A</span>
          </ToolButton>
        </div>

        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex items-center gap-1">
          <ToolButton
            label={t('tools.richText.bulletList')}
            active={state.bulletList}
            onClick={() => chain().toggleBulletList().run()}
          >
            <span className="text-base leading-none">&bull;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.orderedList')}
            active={state.orderedList}
            onClick={() => chain().toggleOrderedList().run()}
          >
            <span className="text-xs">1.</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.taskList')}
            active={state.taskList}
            onClick={() => chain().toggleTaskList().run()}
          >
            <Icon name="check" className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label={t('tools.richText.quote')}
            active={state.blockquote}
            onClick={() => chain().toggleBlockquote().run()}
          >
            <span className="text-base leading-none">&rdquo;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.codeBlock')}
            active={state.codeBlock}
            onClick={() => chain().toggleCodeBlock().run()}
          >
            <span className="font-mono">&#123;&#125;</span>
          </ToolButton>
        </div>

        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex items-center gap-1">
          <ToolButton label={t('tools.richText.link')} active={state.link} onClick={toggleLink}>
            <Icon name="link" className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label={
              state.mathSelected ? t('tools.richText.mathEdit') : t('tools.richText.mathInsert')
            }
            active={state.mathSelected}
            onClick={onMath}
          >
            <span className="font-serif text-sm italic leading-none">fx</span>
          </ToolButton>
          <ToolButton label={t('tools.richText.image')} onClick={() => fileRef.current?.click()}>
            <Icon name="image" className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label={t('tools.richText.divider')}
            onClick={() => chain().setHorizontalRule().run()}
          >
            <span className="text-base leading-none">&mdash;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.pageBreak')}
            onClick={() => chain().setPageBreak().run()}
          >
            {/* 与分隔线/对齐按钮同风格的单色线条图标（虚线断页） */}
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M2 5.5h12" strokeDasharray="3 2" />
              <path d="M2 10.5h12" strokeDasharray="3 2" />
            </svg>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.table')}
            onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            <Icon name="table" className="h-4 w-4" />
          </ToolButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pickImage}
          />
        </div>

        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        {state.inTable && (
          <div className="flex items-center gap-1 rounded-md bg-blue-50 px-1 dark:bg-blue-950/40">
            <ToolButton
              label={t('tools.richText.rowAbove')}
              onClick={() => chain().addRowBefore().run()}
            >
              <span className="text-xs leading-none">+&#8593;</span>
            </ToolButton>
            <ToolButton
              label={t('tools.richText.rowBelow')}
              onClick={() => chain().addRowAfter().run()}
            >
              <span className="text-xs leading-none">+&#8595;</span>
            </ToolButton>
            <ToolButton
              label={t('tools.richText.columnLeft')}
              onClick={() => chain().addColumnBefore().run()}
            >
              <span className="text-xs leading-none">+&#8592;</span>
            </ToolButton>
            <ToolButton
              label={t('tools.richText.columnRight')}
              onClick={() => chain().addColumnAfter().run()}
            >
              <span className="text-xs leading-none">+&#8594;</span>
            </ToolButton>
            <ToolButton
              label={t('tools.richText.deleteRow')}
              onClick={() => chain().deleteRow().run()}
            >
              <span className="text-xs leading-none">&minus;&#8595;</span>
            </ToolButton>
            <ToolButton
              label={t('tools.richText.deleteColumn')}
              onClick={() => chain().deleteColumn().run()}
            >
              <span className="text-xs leading-none">&minus;&#8594;</span>
            </ToolButton>
            <ToolButton
              label={t('tools.richText.headerRow')}
              active={state.headerRow}
              onClick={() => chain().toggleHeaderRow().run()}
            >
              <span className="text-xs font-semibold leading-none">TH</span>
            </ToolButton>
            {state.canMergeCells && (
              <ToolButton
                label={t('tools.richText.mergeCells')}
                onClick={() => chain().mergeCells().run()}
              >
                <span className="text-xs leading-none">&#8862;</span>
              </ToolButton>
            )}
            {state.canSplitCell && (
              <ToolButton
                label={t('tools.richText.splitCell')}
                onClick={() => chain().splitCell().run()}
              >
                <span className="text-xs leading-none">&#8863;</span>
              </ToolButton>
            )}
            <ToolButton
              label={t('tools.richText.deleteTable')}
              onClick={() => chain().deleteTable().run()}
            >
              <Icon name="close" className="h-4 w-4" />
            </ToolButton>
          </div>
        )}

        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex items-center gap-1">
          <ToolButton
            label={t('tools.richText.alignLeft')}
            active={state.alignLeft}
            onClick={() => chain().setTextAlign('left').run()}
          >
            <AlignBars widths={['100%', '60%', '100%']} />
          </ToolButton>
          <ToolButton
            label={t('tools.richText.alignCenter')}
            active={state.alignCenter}
            onClick={() => chain().setTextAlign('center').run()}
          >
            <AlignBars widths={['60%', '100%', '60%']} />
          </ToolButton>
          <ToolButton
            label={t('tools.richText.alignRight')}
            active={state.alignRight}
            onClick={() => chain().setTextAlign('right').run()}
          >
            <AlignBars widths={['100%', '60%', '60%']} />
          </ToolButton>
          <ToolButton
            label={t('tools.richText.alignJustify')}
            active={state.alignJustify}
            onClick={() => chain().setTextAlign('justify').run()}
          >
            <AlignBars widths={['100%', '100%', '100%']} />
          </ToolButton>
        </div>

        {/* 段落排版：首行缩进与段前段后 */}
        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex items-center gap-1">
          <ToolButton
            label={t('tools.richText.indentDecrease')}
            onClick={() => chain().indentParagraph(-24).run()}
          >
            <span className="text-xs font-semibold leading-none">&#8676;</span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.indentIncrease')}
            onClick={() => chain().indentParagraph(24).run()}
          >
            <span className="text-xs font-semibold leading-none">&#8677;</span>
          </ToolButton>
          <ToolbarSelect
            label={t('tools.richText.paragraphSpacing')}
            value={state.paragraphSpacing}
            onChange={(value) => {
              const [before, after] = value.split('-').map(Number);
              chain()
                .setParagraphSpacing(before || 0, after || 0)
                .run();
            }}
            options={[
              { value: '0-0', label: t('tools.richText.spacingPresetDefault') },
              { value: '0-12', label: t('tools.richText.spacingPresetCompact') },
              { value: '12-12', label: t('tools.richText.spacingPresetRelaxed') },
              { value: '24-24', label: t('tools.richText.spacingPresetLoose') },
            ]}
          />
        </div>

        {/* 图片：宽度 / 对齐 / 层级（嵌入、浮于文字上方、衬于文字下方） */}
        {state.inImage ? (
          <>
            <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-1">
              <ToolbarSelect
                label={t('tools.richText.imageWidth')}
                value={imageWidthValue}
                onChange={(value) => {
                  if (!value) {
                    chain().setImageWidth(null).run();
                    return;
                  }
                  if (value === 'custom') return;
                  // 百分比预设按正文内容宽度换算为像素（图片宽度统一存像素）
                  chain()
                    .setImageWidth(Math.round((Number(value) / 100) * contentWidth))
                    .run();
                }}
                options={imageWidthOptions}
              />
              {(['left', 'center', 'right'] as const).map((align) => (
                <ToolButton
                  key={align}
                  label={t(`tools.richText.imageAlign_${align}`)}
                  active={state.imageAlign === align}
                  onClick={() =>
                    chain()
                      .setImageStyle(state.imageWidth, state.imageAlign === align ? null : align)
                      .run()
                  }
                >
                  <ImageAlignIcon position={align} />
                </ToolButton>
              ))}
              <ToolbarSelect
                label={t('tools.richText.imageLayer')}
                value={state.imageLayer}
                onChange={(value) => chain().setImageLayer(normalizeImageLayer(value)).run()}
                options={[
                  { value: 'inline', label: t('tools.richText.imageLayerInline') },
                  { value: 'front', label: t('tools.richText.imageLayerFront') },
                  { value: 'behind', label: t('tools.richText.imageLayerBehind') },
                ]}
              />
            </div>
          </>
        ) : null}

        {/* 表格样式：边框 / 斑马纹 */}
        {state.inTable ? (
          <>
            <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-1">
              <ToolButton
                label={t('tools.richText.tableBorders')}
                active={state.tableBordered}
                onClick={() => chain().toggleTableBorders().run()}
              >
                <span className="text-xs leading-none">&#9634;</span>
              </ToolButton>
              <ToolButton
                label={t('tools.richText.tableZebra')}
                active={state.tableZebra}
                onClick={() => chain().toggleTableZebra().run()}
              >
                <span className="text-xs leading-none">&#9776;</span>
              </ToolButton>
            </div>
          </>
        ) : null}
      </div>

      {/* 第二层：文档与视图 */}
      <div className="flex flex-wrap items-center gap-1 border-t border-gray-200 bg-gray-50/70 px-1 py-1 dark:border-gray-700 dark:bg-gray-800/40">
        <span className="ml-1 mr-0.5 select-none text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {t('tools.richText.docSection')}
        </span>
        <ToolButton
          label={t('tools.richText.outline')}
          active={outlineOpen}
          onClick={onToggleOutline}
        >
          <Icon name="menu" className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.pageSetup')}
          active={pageSetupOpen}
          onClick={onTogglePageSetup}
        >
          <Icon name="ruler" className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.insertToc')}
          disabled={tocDisabled}
          onClick={onInsertToc}
        >
          <Icon name="listCheck" className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.refreshToc')}
          disabled={tocDisabled}
          onClick={onRefreshToc}
        >
          <RefreshIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={
            state.footnoteSelected
              ? t('tools.richText.footnoteEdit')
              : t('tools.richText.footnoteInsert')
          }
          active={state.footnoteSelected}
          onClick={onFootnote}
        >
          <FootnoteIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label={t('tools.richText.styles')} active={stylesOpen} onClick={onToggleStyles}>
          <Icon name="palette" className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.templates')}
          active={templatesOpen}
          onClick={onToggleTemplates}
        >
          <Icon name="grid" className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.spellcheck')}
          active={spellcheckOpen}
          onClick={onToggleSpellcheck}
        >
          <Icon name="book" className="h-4 w-4" />
        </ToolButton>
        <ToolButton label={t('tools.richText.review')} active={reviewOpen} onClick={onToggleReview}>
          <Icon name="pen" className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('tools.richText.versionHistory')}
          disabled={versionsDisabled}
          onClick={onOpenVersions}
        >
          <Icon name="clock" className="h-4 w-4" />
        </ToolButton>

        {/* 视图控制靠右：缩放 + 视图模式 */}
        <div className="ml-auto flex items-center gap-1">
          <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.zoom')}
            <ToolbarSelect
              label={t('tools.richText.zoom')}
              value={String(zoom)}
              onChange={(value) => onZoomChange(Number(value))}
              options={ZOOM_LEVELS.map((level) => ({
                value: String(level),
                label: `${Math.round(level * 100)}%`,
              }))}
            />
          </label>
          <ToolbarSelect
            label={t('tools.richText.viewMode')}
            value={viewMode}
            onChange={(value) => onViewModeChange(value as ViewMode)}
            options={[
              { value: 'flow', label: t('tools.richText.viewFlow') },
              { value: 'paged', label: t('tools.richText.viewPaged') },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
