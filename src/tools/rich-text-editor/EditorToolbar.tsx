import { useMemo, useRef } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorState, type Editor } from '@tiptap/react';
import { Ribbon } from '@/core/components/ribbon/Ribbon';
import type { EditorMenu } from '@/core/components/editorChrome';
import { RIBBON_ICON_BUTTON } from '@/core/components/ribbon/ribbonTheme';
import { RibbonIcon } from '@/core/components/ribbon/ribbonIcons';
import { findSelectedFootnote } from './footnotes';
import { findSelectedEndnote } from './endnotes';
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
import { MM_TO_PX } from './pageSetup';
import {
  LETTER_SPACING_PRESETS,
  TEXT_TRANSFORM_SAMPLES,
  TEXT_TRANSFORM_VALUES,
} from './charFormat';
import {
  buildRichTextRibbonTabs,
  type RichTextRibbonActions,
  type RichTextRibbonOptions,
  type RichTextToolbarState,
} from './ribbonTabs';

/** Table row height presets (mm): rows are stored in px, the ribbon talks mm like Word does */
const ROW_HEIGHT_MM_PRESETS = [8, 12, 16, 20] as const;

export interface EditorToolbarProps extends RichTextRibbonActions {
  editor: Editor | null;
  /** 文件 / 编辑 / 插入 / 视图 menus rendered as icon dropdowns on the tab strip */
  menus?: EditorMenu[];
  menuAriaLabel?: string;
  /** Save state, clear, title, new doc, present — right end of the tab strip */
  headerRight?: ReactNode;
}

/**
 * Word processor ribbon: six Office tabs (开始 / 插入 / 页面布局 / 引用 / 审阅 / 视图).
 *
 * The component owns only what a component can own — the editor state subscription, the installed
 * font probe and the DOM measurements behind the image-width presets. Every command is described in
 * `ribbonTabs.tsx`, so the tabs read like Word's and stay testable without an editor instance.
 *
 * `useEditorState` keeps the tree from re-rendering on every keystroke: it re-renders only when one of
 * the selected attributes actually changes.
 */
export function EditorToolbar({
  editor,
  menus,
  menuAriaLabel,
  headerRight,
  ...actions
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
  const headingOptions = useMemo(
    () => [
      { value: 'paragraph', label: t('tools.richText.paragraph') },
      ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
        value: String(level),
        label: t(`tools.richText.h${level}`),
      })),
    ],
    [t],
  );

  const state = useEditorState<RichTextToolbarState | null>({
    editor,
    selector: (ctx): RichTextToolbarState | null => {
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
        smallCaps: e.isActive('smallCaps'),
        indentLeft: Number(e.getAttributes('paragraph').indentLeft ?? 0),
        hangingIndent: Number(e.getAttributes('paragraph').hangingIndent ?? 0),
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
        cellVAlign: String(
          e.getAttributes('tableCell').verticalAlign ??
            e.getAttributes('tableHeader').verticalAlign ??
            '',
        ),
        rowHeight: ((): number | null => {
          const raw = e.getAttributes('tableRow').height;
          return typeof raw === 'number' ? raw : null;
        })(),
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
        endnoteSelected: findSelectedEndnote(e.state) !== null,
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

  // Image widths are stored in pixels; the ribbon exposes percentage presets (converted against the current content width)
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

  // Cell vertical alignment: `top` is the layout default, so it shares the empty ("default") option
  const cellVAlignValue = state.cellVAlign === 'top' ? '' : state.cellVAlign;
  const rowHeight = state.rowHeight === null ? null : Math.round(state.rowHeight);
  const matchedRowHeightMm = ROW_HEIGHT_MM_PRESETS.find(
    (mm) => rowHeight !== null && Math.abs(rowHeight - mm * MM_TO_PX) <= 2,
  );
  const rowHeightValue =
    rowHeight === null
      ? ''
      : matchedRowHeightMm !== undefined
        ? String(matchedRowHeightMm)
        : 'custom';
  const rowHeightOptions = [
    { value: '', label: t('tools.richText.rowHeightAuto') },
    ...ROW_HEIGHT_MM_PRESETS.map((mm) => ({
      value: String(mm),
      label: t('tools.richText.rowHeightMm', { mm }),
    })),
    // Rows imported from Word can carry an arbitrary height: show it instead of falling back to "auto"
    ...(rowHeightValue === 'custom' && rowHeight !== null
      ? [{ value: 'custom', label: t('tools.richText.rowHeightCustom', { px: rowHeight }) }]
      : []),
  ];

  const options: RichTextRibbonOptions = {
    fontFamilyValue: matchFontOption(state.fontFamily, fontOptions),
    fontOptions,
    fontSizeOptions,
    lineHeightOptions,
    letterSpacingOptions,
    textTransformOptions,
    headingOptions,
    contentWidth,
    imageWidthValue,
    imageWidthOptions,
    cellVAlignValue,
    rowHeightValue,
    rowHeightOptions,
  };

  const tabs = buildRichTextRibbonTabs({
    editor,
    state,
    t,
    actions,
    options,
    onPickImage: () => fileRef.current?.click(),
  });

  const quickAccess = (
    <>
      <button
        type="button"
        aria-label={t('tools.richText.undo')}
        title={t('tools.richText.undo')}
        data-testid="ribbon-qat-undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
        className={`${RIBBON_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <RibbonIcon name="undo" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t('tools.richText.redo')}
        title={t('tools.richText.redo')}
        data-testid="ribbon-qat-redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
        className={`${RIBBON_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <RibbonIcon name="redo" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t('tools.richText.findReplace')}
        title={t('tools.richText.findReplace')}
        aria-pressed={actions.findOpen}
        data-testid="ribbon-qat-find"
        onClick={actions.onToggleFind}
        className={`${RIBBON_ICON_BUTTON} ${actions.findOpen ? 'bg-black/10 dark:bg-white/20' : ''}`}
      >
        <RibbonIcon name="search" className="h-3.5 w-3.5" />
      </button>
    </>
  );

  // The shell keeps `overflow` visible: ribbon menus and the shape gallery are absolutely positioned
  return (
    <div
      data-testid="rich-text-toolbar"
      className="sticky top-0 z-20 -mx-1 rounded-lg border border-gray-200 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
    >
      <Ribbon
        ariaLabel={t('tools.richText.ribbon.label')}
        accent="blue"
        tabs={tabs}
        menus={menus}
        menuAriaLabel={menuAriaLabel}
        quickAccess={quickAccess}
        headerRight={headerRight}
        collapseLabel={t('tools.richText.ribbon.collapse')}
        expandLabel={t('tools.richText.ribbon.expand')}
        moreLabel={t('common.more')}
        testId="word-ribbon"
        className="!border-0 !shadow-none"
      />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
    </div>
  );
}
