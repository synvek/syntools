import { useMemo, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorState, type Editor } from '@tiptap/react';
import { Icon } from '@/core/components/Icon';
import type { ViewMode } from './draft';
import { findSelectedFootnote } from './footnotes';
import { normalizeImageLayer } from './imageLayer';
import { TextColorPicker } from './TextColorPicker';
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
import {
  LETTER_SPACING_PRESETS,
  TEXT_TRANSFORM_SAMPLES,
  TEXT_TRANSFORM_VALUES,
  type TextTransformValue,
} from './charFormat';

interface ToolButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Toolbar button: blue background when active, compact, with aria-pressed and a tooltip */
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
 * Undo/redo icon: the standard "bent arrow + arc" shape (as in Excalidraw / tldraw and friends),
 * with stroke settings matching the built-in Icon set (24 viewBox, currentColor stroke).
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

/** Refresh icon: clockwise arrow + open ring (same stroke settings as the undo/redo icons) */
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

/** Footnote icon: baseline + superscript digit, carrying the same visual meaning as Word's "Insert Footnote" */
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
      {/* Superscript digit 1 */}
      <path d="M14 4.6 16 3.2v5.9" />
      {/* Separator + body baseline, conveying "the footnote sits at the bottom of the page" */}
      <path d="M5.5 12.5h6" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

/** Image alignment icon: box + three alignment lines (left/center/right differ, so the buttons don't look identical) */
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

/** Decorative bars inside the alignment buttons (left/center/right/justify) */
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
  /** Wide variant: keeps long font names (e.g. Franklin Gothic Medium) from being truncated */
  wide?: boolean;
}

/** Inline toolbar dropdown: same style as the pdfMode selector, compact height */
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

/** Zoom levels (100% = 1) */
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

interface EditorToolbarProps {
  editor: Editor | null;
  onToggleFind: () => void;
  findOpen: boolean;
  onToggleOutline: () => void;
  outlineOpen: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** Page setup */
  pageSetupOpen: boolean;
  onTogglePageSetup: () => void;
  /** Horizontal ruler visibility */
  rulerOpen: boolean;
  onToggleRuler: () => void;
  /** Insert table of contents */
  onInsertToc: () => void;
  /** Refresh TOC (recompute pagination and page numbers) */
  onRefreshToc: () => void;
  tocDisabled: boolean;
  /** Footnote: edit the selected footnote, otherwise insert a new one */
  onFootnote: () => void;
  /** Formula: edit the selected formula, otherwise insert a new one */
  onMath: () => void;
  /** Style panel */
  stylesOpen: boolean;
  onToggleStyles: () => void;
  /** Shape panel (insert / edit a DrawingML preset shape) */
  shapesOpen: boolean;
  onToggleShapes: () => void;
  /** Template panel */
  templatesOpen: boolean;
  onToggleTemplates: () => void;
  /** Spellcheck panel */
  spellcheckOpen: boolean;
  onToggleSpellcheck: () => void;
  /** Comments and tracked changes */
  reviewOpen: boolean;
  onToggleReview: () => void;
  /** Version history */
  onOpenVersions: () => void;
  versionsDisabled: boolean;
  /** View zoom */
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

/**
 * Rich text toolbar (two rows):
 * - Row 1 "content formatting": history / paragraph styles / character formatting / lists / insert / align / indent / conditional groups (image, table) / find
 * - Row 2 "document & view": outline / page setup / TOC / styles / comments & changes / version history ... with zoom and view mode on the right
 * useEditorState subscribes to active states precisely, keeping the whole tree from re-rendering on every keystroke.
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
  rulerOpen,
  onToggleRuler,
  onInsertToc,
  onRefreshToc,
  tocDisabled,
  onFootnote,
  onMath,
  stylesOpen,
  onToggleStyles,
  shapesOpen,
  onToggleShapes,
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

  // Probe system fonts once on mount: the font menu lists only fonts actually installed on this system
  const installedFonts = useMemo(() => detectInstalledFonts(createSystemFontProbe()), []);
  const defaultFontName = useMemo(
    () => detectDefaultFontName(navigator.userAgent, navigator.platform ?? ''),
    [],
  );
  const fontOptions = useMemo(() => {
    const installed = installedFonts.some(
      (font) => font.name.toLowerCase() === defaultFontName.toLowerCase(),
    );
    // The first entry shows the concrete font name (the one actually applied to body text); falls back to a generic label when undetected
    const label = installed ? defaultFontName : t('tools.richText.fontDefault');
    return [
      ...buildFontOptions(installedFonts, label, defaultFontName),
      { value: 'sans-serif', label: t('tools.richText.fontSans') },
      { value: 'serif', label: t('tools.richText.fontSerif') },
      { value: 'monospace', label: t('tools.richText.fontMono') },
    ];
  }, [installedFonts, defaultFontName, t]);

  // Font size / line spacing also show concrete values: the document default when unset
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
  // Letter spacing: "0" clears it; the rest are the CSS px presets (labels are values, no i18n needed)
  const letterSpacingOptions = useMemo(
    () => [
      { value: '', label: '0' },
      ...LETTER_SPACING_PRESETS.filter((value) => value > 0).map((value) => ({
        value: String(value),
        label: String(value),
      })),
    ],
    [],
  );
  // Text transform: labels are visual samples (ABC / abc / Abc), so no translation is needed
  const textTransformOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...TEXT_TRANSFORM_VALUES.map((value) => ({ value, label: TEXT_TRANSFORM_SAMPLES[value] })),
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
        highlight: e.isActive('highlight'),
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        code: e.isActive('code'),
        superscript: e.isActive('superscript'),
        subscript: e.isActive('subscript'),
        letterSpacing: String(e.getAttributes('letterSpacing').px ?? ''),
        textTransform: String(e.getAttributes('textTransform').transform ?? ''),
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
        shapeSelected: e.isActive('docShape'),
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
  // Palette and native color picker only handle #rrggbb: non-standard values (e.g. named colors from imported docs) fall back to the default text color
  const currentColor = /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : '#111827';

  // Image widths are stored in pixels; the toolbar exposes percentage presets (converted against the current content width)
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
    // After dragging the resize handle the width is an arbitrary pixel value: show "Custom (Npx)" so it doesn't look auto again
    ...(imageWidthValue === 'custom' && imageWidth !== null
      ? [{ value: 'custom', label: t('tools.richText.imageWidthCustom', { px: imageWidth }) }]
      : []),
  ];

  // The root container must not use overflow-hidden: popovers (text color, etc.) are absolutely positioned and would be clipped by the toolbar's bottom edge
  return (
    <div
      data-testid="rich-text-toolbar"
      className="sticky top-0 z-10 -mx-1 rounded-lg border border-gray-200 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
    >
      {/* Row 1: content formatting */}
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
            label={t('tools.richText.superscript')}
            active={state.superscript}
            onClick={() => chain().toggleSuperscript().run()}
          >
            <span>
              x<sup>2</sup>
            </span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.subscript')}
            active={state.subscript}
            onClick={() => chain().toggleSubscript().run()}
          >
            <span>
              x<sub>2</sub>
            </span>
          </ToolButton>
          <ToolButton
            label={t('tools.richText.code')}
            active={state.code}
            onClick={() => chain().toggleCode().run()}
          >
            <span className="font-mono">&lt;/&gt;</span>
          </ToolButton>
          {/* Character-level formatting: letter spacing (px) and text-transform */}
          <ToolbarSelect
            label={t('tools.richText.letterSpacing')}
            value={state.letterSpacing}
            onChange={(value) =>
              chain()
                .setLetterSpacing(value ? Number(value) : null)
                .run()
            }
            options={letterSpacingOptions}
          />
          <ToolbarSelect
            label={t('tools.richText.textTransform')}
            value={state.textTransform}
            onChange={(value) =>
              chain()
                .setTextTransform((value || null) as TextTransformValue | null)
                .run()
            }
            options={textTransformOptions}
          />
          {/* Text color: preset palette popover that closes after picking (the native system picker doesn't close itself) */}
          <TextColorPicker
            value={currentColor}
            onPick={(color) => chain().setColor(color).run()}
            onReset={() => chain().unsetColor().run()}
          />
          {/* Highlighter: fixed yellow highlight; the blue button background reflects ON/OFF */}
          <ToolButton
            label={t('tools.richText.highlight')}
            active={state.highlight}
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
          <ToolButton
            label={t('tools.richText.shapeInsert')}
            active={shapesOpen || state.shapeSelected}
            onClick={onToggleShapes}
          >
            {/* Square + circle: the classic "insert shape" glyph */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="11" height="11" rx="1.5" />
              <circle cx="16" cy="16" r="5" />
            </svg>
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
            {/* Monochrome line icon in the same style as the divider/align buttons (dashed page break) */}
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

        {/* Paragraph layout: first-line indent and space before/after */}
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

        {/* Image: width / alignment / layer (inline, in front of text, behind text) */}
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
                  // Convert the percentage preset to pixels using the content width (image widths are stored in pixels)
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
                  { value: 'wrap-left', label: t('tools.richText.imageLayerWrapLeft') },
                  { value: 'wrap-right', label: t('tools.richText.imageLayerWrapRight') },
                  { value: 'top-bottom', label: t('tools.richText.imageLayerTopBottom') },
                  { value: 'front', label: t('tools.richText.imageLayerFront') },
                  { value: 'behind', label: t('tools.richText.imageLayerBehind') },
                ]}
              />
            </div>
          </>
        ) : null}

        {/* Table styles: borders / zebra stripes */}
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

      {/* Row 2: document & view (has its own background, so it needs its own radius or it covers the toolbar's bottom corners) */}
      <div className="flex flex-wrap items-center gap-1 rounded-b-lg border-t border-gray-200 bg-gray-50/70 px-1 py-1 dark:border-gray-700 dark:bg-gray-800/40">
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
        <ToolButton label={t('tools.richText.ruler')} active={rulerOpen} onClick={onToggleRuler}>
          <Icon name="rulerTicks" className="h-4 w-4" />
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

        {/* View controls right-aligned: zoom + view mode */}
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
