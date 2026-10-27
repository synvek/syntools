import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toBlob, toJpeg, toPng, toSvg } from 'html-to-image';
import type { ToolResult } from '@/core/types';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { HintTip } from '@/core/components/DocumentHeader';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ShareButton } from '@/core/components/ShareButton';
import { downloadBlob } from '@/core/lib/download';
import { copyImage, copyRichText } from './clipboard';
import {
  SHARE_PARAM,
  SHARE_COMPRESSED_LIMIT,
  encodeCompressedShare,
  readSharedCodeState,
} from './shareCode';
import {
  buildCardBodyHtml,
  cardBackground,
  cardCssVars,
  cardStyleBlock,
  CARD_BACKGROUNDS,
  CARD_SCALES,
  CARD_SHADOWS,
  exportBackgroundCss,
  normalizeCardStyle,
  type CardScale,
  type CodeCardStyle,
} from './cardOptions';
import { CodeSurface, type CodeSurfaceHandle } from './CodeSurface';
import { chordOf, detectMac, formatChord, type EditorAction } from './editorKeymap';
import { splitHighlightedLines } from './highlightLines';
import { FindReplaceBar, type FindFocusRequest, type FindOptionState } from './FindReplaceBar';
import { findMatches, replaceAll, replaceOne, stepIndex, type FindMatch } from './findReplace';
import { replaceRanges, type TextRange, type WordSelection } from './multiEdit';
import {
  DEFAULT_FILENAME,
  DEFAULT_LANG_ID,
  DEFAULT_THEME,
  IMPORT_ACCEPT,
  LANG_SPECS,
  buildExportFilename,
  buildSnippet,
  buildStandaloneHtml,
  checkImportFile,
  countStats,
  detectLanguageByExt,
  getLangSpec,
  isLangId,
  sanitizeFilename,
} from './core';
import { clearDraft, readDraft, writeDraft } from './draft';
import { formatCode, isPrettierLanguage, type IndentOption } from './format';
import { highlightCode } from './prism';
import { registerCodeEditorStrings } from './strings';
import {
  CODE_THEMES,
  TOKEN_FIELDS,
  getTheme,
  isThemeId,
  themeCssVars,
  themeStyleBlock,
} from './themes';

// Tool strings register lazily with this chunk so the initial language bundle stays small
registerCodeEditorStrings(i18n);

const SAMPLE_CODE = `public class HelloWorld {
  public static void main(String[] args) {
    System.out.println("Hello, SynTools!");
  }
}`;

const DRAFT_DEBOUNCE_MS = 1000;
type BusyKind = 'format' | 'png' | 'jpg' | 'svg' | null;
type Failure = Extract<ToolResult<unknown>, { ok: false }>;
type ImageKind = 'png' | 'jpg' | 'svg';

/** Stable empty match / range arrays: avoids a new reference on every render when a feature is off */
const EMPTY_MATCHES: FindMatch[] = [];
const EMPTY_RANGES: TextRange[] = [];

/** Shared look for the small controls in the card style panel */
const CARD_FIELD = 'flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300';
const CARD_INPUT =
  'h-7 min-w-0 rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

/** Edit toolbar buttons: they share CodeSurface's action entry point with the shortcuts */
const OP_ACTIONS: Array<{ action: EditorAction; labelKey: string }> = [
  { action: 'selectAllOccurrences', labelKey: 'selectOccurrences' },
  { action: 'toggleLineComment', labelKey: 'comment' },
  { action: 'moveLineUp', labelKey: 'moveUp' },
  { action: 'moveLineDown', labelKey: 'moveDown' },
  { action: 'copyLineDown', labelKey: 'duplicate' },
  { action: 'deleteLine', labelKey: 'deleteLine' },
  { action: 'transposeLine', labelKey: 'transpose' },
  { action: 'indent', labelKey: 'indent' },
  { action: 'outdent', labelKey: 'outdent' },
  { action: 'gotoLine', labelKey: 'gotoLine' },
];

function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

/** Syntax-highlighted code editor: multi-language formatting + 10 themes + source / HTML / image export */
export default function CodeEditorTool() {
  const { t } = useTranslation();
  const draft = useMemo(() => readDraft(), []);
  const hasShared = useMemo(() => new URLSearchParams(window.location.search).has(SHARE_PARAM), []);
  const init = useMemo(
    () =>
      readSharedCodeState({
        i: SAMPLE_CODE,
        l: DEFAULT_LANG_ID,
        th: DEFAULT_THEME,
        ind: 2,
        n: 1,
        w: 0,
        f: DEFAULT_FILENAME,
        cs: '',
      }),
    [],
  );
  const shared = hasShared ? init : null;
  /** Card style carried by a share link (compressed links can carry more layout state) */
  const sharedCard = useMemo(() => {
    const raw = shared?.cs;
    if (!raw) return null;
    try {
      return normalizeCardStyle(JSON.parse(String(raw)) as Partial<CodeCardStyle>);
    } catch {
      return null;
    }
  }, [shared]);
  const source = shared
    ? {
        code: String(init.i),
        lang: String(init.l),
        theme: String(init.th),
        ind: String(init.ind),
        file: String(init.f),
      }
    : draft
      ? {
          code: draft.code,
          lang: draft.language,
          theme: draft.theme,
          ind: draft.indent,
          file: draft.filename,
        }
      : {
          code: String(init.i),
          lang: String(init.l),
          theme: String(init.th),
          ind: String(init.ind),
          file: String(init.f),
        };

  const [code, setCode] = useState(source.code);
  const [languageId, setLanguageId] = useState(
    isLangId(source.lang) ? source.lang : DEFAULT_LANG_ID,
  );
  const [themeId, setThemeId] = useState(isThemeId(source.theme) ? source.theme : DEFAULT_THEME);
  const [indent, setIndent] = useState<IndentOption>(
    source.ind === 'tab' ? 'tab' : source.ind === '4' ? 4 : 2,
  );
  const [showLineNumbers, setShowLineNumbers] = useState(
    shared ? Number(init.n) !== 0 : (draft?.lineNumbers ?? true),
  );
  const [wordWrap, setWordWrap] = useState(
    shared ? Number(init.w) !== 0 : (draft?.wordWrap ?? false),
  );
  const [filename, setFilename] = useState(
    (shared ? String(init.f) : draft?.filename) || DEFAULT_FILENAME,
  );
  const [busy, setBusy] = useState<BusyKind>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState('1');
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findReplacement, setFindReplacement] = useState('');
  const [findOptions, setFindOptions] = useState<FindOptionState>({
    matchCase: false,
    wholeWord: false,
    regex: false,
  });
  const [findCurrent, setFindCurrent] = useState(-1);
  const [findFocus, setFindFocus] = useState<FindFocusRequest>({ target: 'query', seq: 0 });
  const [multiSelection, setMultiSelection] = useState<WordSelection | null>(null);
  const [multiReplacement, setMultiReplacement] = useState('');
  const [cardStyle, setCardStyle] = useState<CodeCardStyle>(() =>
    normalizeCardStyle(sharedCard ?? draft?.card),
  );
  const [cardScale, setCardScale] = useState<CardScale>(() =>
    draft?.cardScale === 1 || draft?.cardScale === 4 ? draft.cardScale : 2,
  );
  const [cardPanelOpen, setCardPanelOpen] = useState(false);
  const [highlightRaw, setHighlightRaw] = useState(() =>
    draft?.card?.highlightFrom
      ? `${draft.card.highlightFrom}${
          draft.card.highlightTo && draft.card.highlightTo !== draft.card.highlightFrom
            ? `-${draft.card.highlightTo}`
            : ''
        }`
      : '',
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<CodeSurfaceHandle>(null);
  const isMac = useMemo(() => detectMac(), []);

  const spec = getLangSpec(languageId);
  const theme = getTheme(themeId);
  const themeVars = useMemo(() => themeCssVars(theme), [theme]);
  const highlighted = useMemo(() => highlightCode(code, spec.prism), [code, spec.prism]);
  const snippet = useMemo(() => buildSnippet(highlighted, spec), [highlighted, spec]);
  // Export card: rendered per line (line numbers / line highlight / watermark); preview and HTML share it
  const cardVars = useMemo(() => cardCssVars(cardStyle), [cardStyle]);
  const cardBody = useMemo(
    () =>
      buildCardBodyHtml({
        label: spec.label,
        style: cardStyle,
        lines: splitHighlightedLines(highlighted),
      }),
    [cardStyle, highlighted, spec.label],
  );
  const cardBg = useMemo(
    () => cardBackground(cardStyle, theme.bg, theme.fg),
    [cardStyle, theme.bg, theme.fg],
  );
  const stats = useMemo(() => countStats(code), [code]);
  const baseName = sanitizeFilename(filename);
  const exportName = buildExportFilename(filename, spec);
  const indentUnit = indent === 'tab' ? '\t' : ' '.repeat(indent);
  const canAct = Boolean(code.trim());

  // Find results: recomputed when content / query / options change (the pure layer caps and guards them)
  const findOutcome = useMemo(
    () => findMatches(code, findQuery, findOptions),
    [code, findOptions, findQuery],
  );
  // Keep a stable array reference: downstream useCallback / overlay depend on it
  const matches = useMemo(
    () => (findOutcome.ok ? findOutcome.value.matches : EMPTY_MATCHES),
    [findOutcome],
  );
  const findInvalid = !findOutcome.ok;
  const findTruncated = findOutcome.ok ? findOutcome.value.truncated : false;
  const currentMatch = findCurrent >= 0 ? (matches[findCurrent] ?? null) : null;

  // Reset to "not positioned" after a query / option change (the first Enter lands on the first match)
  useEffect(() => {
    setFindCurrent(-1);
  }, [findQuery, findOptions]);

  const openFind = useCallback((target: 'query' | 'replacement') => {
    setFindOpen(true);
    setFindFocus((prev) => ({ target, seq: prev.seq + 1 }));
  }, []);

  const stepMatch = useCallback(
    (delta: 1 | -1) => {
      if (matches.length === 0) return;
      const next = stepIndex(findCurrent, matches.length, delta);
      setFindCurrent(next);
      const match = matches[next];
      if (match) surfaceRef.current?.revealRange(match.start);
    },
    [findCurrent, matches],
  );

  const toggleFindOption = useCallback((key: keyof FindOptionState) => {
    setFindOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const replaceCurrentMatch = useCallback(() => {
    const match = matches[findCurrent >= 0 ? findCurrent : 0];
    if (!match) return;
    surfaceRef.current?.applyText(replaceOne(code, match, findQuery, findReplacement, findOptions));
  }, [code, findCurrent, findOptions, findQuery, findReplacement, matches]);

  const replaceAllMatches = useCallback(() => {
    const result = replaceAll(code, findQuery, findReplacement, findOptions);
    if (!result.ok) {
      setNotice(t('tools.codeEditor.find.tooMany'));
      return;
    }
    surfaceRef.current?.applyText(result.value);
    setFindCurrent(-1);
    setNotice(t('tools.codeEditor.find.done'));
  }, [code, findOptions, findQuery, findReplacement, t]);

  // Write the local draft once typing stops
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSaved(
        writeDraft({
          code,
          language: languageId,
          theme: themeId,
          indent: String(indent),
          filename,
          lineNumbers: showLineNumbers,
          wordWrap,
          card: cardStyle,
          cardScale,
        }),
      );
    }, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    cardScale,
    cardStyle,
    code,
    filename,
    indent,
    languageId,
    showLineNumbers,
    themeId,
    wordWrap,
  ]);

  const importFile = useCallback(async (file: File) => {
    const check = checkImportFile(file);
    if (!check.ok) {
      setFailure(check);
      return;
    }
    try {
      const text = await file.text();
      const detected = detectLanguageByExt(file.name);
      if (detected) setLanguageId(detected);
      setFilename(sanitizeFilename(file.name.replace(/\.[^.]+$/, '')));
      setCode(text);
      setFailure(null);
      setNotice(null);
    } catch {
      setFailure({ ok: false, error: 'READ_FAILED' });
    }
  }, []);

  const runFormat = useCallback(async () => {
    setBusy('format');
    const result = await formatCode(code, spec, indent);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    setCode(result.value.code);
    setFailure(null);
    setNotice(
      result.value.engine === 'fallback' && isPrettierLanguage(spec)
        ? t('tools.codeEditor.formatFallback')
        : t('tools.codeEditor.formatDone'),
    );
  }, [code, indent, spec, t]);

  const exportSource = useCallback(() => {
    if (!canAct) {
      setFailure({ ok: false, error: 'EMPTY' });
      return;
    }
    downloadBlob(code, exportName, 'text/plain;charset=utf-8');
    setFailure(null);
  }, [canAct, code, exportName]);

  const exportHtml = useCallback(() => {
    if (!canAct) {
      setFailure({ ok: false, error: 'EMPTY' });
      return;
    }
    // The card block follows the theme block, so same-named properties (padding / radius / shadow) use the card config
    const cssBlock = `${themeStyleBlock(theme)}\n${cardStyleBlock(cardStyle, cardBg)}`;
    const html = buildStandaloneHtml(highlighted, spec, cssBlock, baseName, cardBody);
    downloadBlob(html, `${baseName}.html`, 'text/html;charset=utf-8');
    setFailure(null);
  }, [baseName, canAct, cardBg, cardBody, cardStyle, highlighted, spec, theme]);

  const exportImage = useCallback(
    async (kind: ImageKind) => {
      const node = cardRef.current;
      if (!node || !canAct) {
        setFailure({ ok: false, error: 'EMPTY' });
        return;
      }
      setBusy(kind);
      try {
        const options = {
          cacheBust: true,
          pixelRatio: cardScale,
          backgroundColor: exportBackgroundCss(cardStyle, theme.bg, theme.mode === 'dark'),
        };
        if (kind === 'png') {
          downloadDataUrl(await toPng(node, options), `${baseName}.png`);
        } else if (kind === 'jpg') {
          downloadDataUrl(await toJpeg(node, { ...options, quality: 0.95 }), `${baseName}.jpg`);
        } else {
          const dataUrl = await toSvg(node, options);
          const comma = dataUrl.indexOf(',');
          const encoded = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
          downloadBlob(
            decodeURIComponent(encoded),
            `${baseName}.svg`,
            'image/svg+xml;charset=utf-8',
          );
        }
        setFailure(null);
      } catch {
        setFailure({ ok: false, error: 'EXPORT_FAILED' });
      } finally {
        setBusy(null);
      }
    },
    [baseName, canAct, cardScale, cardStyle, theme.bg, theme.mode],
  );

  const reset = useCallback(() => {
    setCode('');
    clearDraft();
    setFailure(null);
    setNotice(null);
    setGotoOpen(false);
  }, []);

  /** Actions needing UI involvement (shortcuts / toolbar) that CodeSurface does not handle */
  const handleAction = useCallback(
    (action: EditorAction): boolean => {
      switch (action) {
        case 'format':
          void runFormat();
          return true;
        case 'gotoLine':
          setGotoValue('1');
          setGotoOpen(true);
          return true;
        case 'find':
          openFind('query');
          return true;
        case 'findReplace':
          openFind('replacement');
          return true;
        case 'findNext':
          if (findOpen) stepMatch(1);
          else openFind('query');
          return true;
        case 'findPrev':
          if (findOpen) stepMatch(-1);
          else openFind('query');
          return true;
        case 'selectAllOccurrences': {
          const selection = surfaceRef.current?.wordSelectionAtCaret();
          if (!selection || selection.ranges.length < 2) {
            setNotice(t('tools.codeEditor.op.multiNoWord'));
            return false;
          }
          setMultiSelection(selection);
          setMultiReplacement('');
          return true;
        }
        case 'toggleLineComment':
        case 'toggleBlockComment':
          // CodeSurface only delegates here when the language has no comment syntax
          setNotice(t('tools.codeEditor.op.unsupported'));
          return false;
        default:
          return false;
      }
    },
    [findOpen, openFind, runFormat, stepMatch, t],
  );

  /** Update the card style (always normalised so out-of-range / invalid values never reach the DOM) */
  const updateCard = useCallback((patch: Partial<CodeCardStyle>) => {
    setCardStyle((prev) => normalizeCardStyle({ ...prev, ...patch }));
  }, []);

  /** Parse the "highlight lines" input (e.g. `2-5` / `3`); invalid input resets to unset */
  const updateHighlightLines = useCallback(
    (raw: string) => {
      const matched = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(raw);
      if (!matched) {
        updateCard({ highlightFrom: 0, highlightTo: 0 });
        return;
      }
      const from = Number(matched[1]);
      const to = matched[2] ? Number(matched[2]) : from;
      updateCard({ highlightFrom: from, highlightTo: Math.max(from, to) });
    },
    [updateCard],
  );

  /** Replace every occurrence of the current word (batch editing: a safe stand-in for multi-cursor) */
  const applyMultiReplace = useCallback(() => {
    if (!multiSelection) return;
    surfaceRef.current?.applyText(replaceRanges(code, multiSelection.ranges, multiReplacement));
    setMultiSelection(null);
  }, [code, multiReplacement, multiSelection]);

  /** Copy as a Markdown fenced code block (```lang) */
  const markdownSnippet = useMemo(() => {
    const fence = spec.id === 'markdown' ? 'text' : spec.id;
    return `\`\`\`${fence}\n${code}\n\`\`\``;
  }, [code, spec.id]);

  /** Copy rich text: a code block with theme colours (pastes into Word / Lark / blog editors) */
  const richHtml = useMemo(() => {
    const tokenCss = [
      '.token.comment{font-style:italic}',
      ...TOKEN_FIELDS.map((field) => `.token.${field}{color:${theme[field]}}`),
    ].join('');
    return (
      `<div style="background:${theme.bg};color:${theme.fg};padding:16px;border-radius:8px;` +
      `font-family:ui-monospace,Menlo,Consolas,'Liberation Mono',monospace;font-size:13px;line-height:1.6;overflow:auto">` +
      `<style>${tokenCss}</style><pre style="margin:0;white-space:pre">${snippet}</pre></div>`
    );
  }, [snippet, theme]);

  const copyRich = useCallback(async () => {
    if (!canAct) {
      setFailure({ ok: false, error: 'EMPTY' });
      return;
    }
    try {
      const result = await copyRichText(richHtml, code);
      setFailure(null);
      setNotice(
        t(result === 'rich' ? 'tools.codeEditor.copy.richDone' : 'tools.codeEditor.copy.plainDone'),
      );
    } catch {
      // Clipboard fully unavailable: fall back to downloading the HTML snippet instead of failing silently
      downloadBlob(snippet, `${baseName}.html`, 'text/html;charset=utf-8');
      setFailure(null);
      setNotice(t('tools.codeEditor.copy.copyFallback'));
    }
  }, [baseName, canAct, code, richHtml, snippet, t]);

  /** Copy the card image; falls back to downloading a PNG when the clipboard is unavailable */
  const copyCardImage = useCallback(async () => {
    const node = cardRef.current;
    if (!node || !canAct) {
      setFailure({ ok: false, error: 'EMPTY' });
      return;
    }
    setBusy('png');
    try {
      const blob = await toBlob(node, {
        cacheBust: true,
        pixelRatio: cardScale,
        backgroundColor: exportBackgroundCss(cardStyle, theme.bg, theme.mode === 'dark'),
      });
      if (!blob) throw new Error('empty blob');
      const copied = await copyImage(blob);
      setFailure(null);
      if (copied) {
        setNotice(t('tools.codeEditor.copy.imageDone'));
      } else {
        downloadBlob(blob, `${baseName}.png`, 'image/png');
        setNotice(t('tools.codeEditor.copy.imageFallback'));
      }
    } catch {
      setFailure({ ok: false, error: 'EXPORT_FAILED' });
    } finally {
      setBusy(null);
    }
  }, [baseName, canAct, cardScale, cardStyle, theme.bg, theme.mode, t]);

  const jumpToLine = useCallback(() => {
    const line = Number.parseInt(gotoValue, 10);
    if (!Number.isFinite(line)) return;
    surfaceRef.current?.focusLine(line);
    setGotoOpen(false);
  }, [gotoValue]);

  // Action buttons and shortcut hints derive from one binding table, so labels and keys never drift
  const ops = useMemo(
    () =>
      OP_ACTIONS.map((op) => {
        const chord = chordOf(op.action);
        const label = t(`tools.codeEditor.op.${op.labelKey}`);
        return {
          action: op.action,
          label,
          title: chord ? `${label} (${formatChord(chord, isMac)})` : label,
        };
      }),
    [isMac, t],
  );
  const shortcutHint = useMemo(() => {
    const withChord = (action: EditorAction, label: string) => {
      const chord = chordOf(action);
      return chord ? `${label} (${formatChord(chord, isMac)})` : label;
    };
    return [
      ...ops.map((op) => op.title),
      withChord('find', t('tools.codeEditor.find.label')),
      withChord('findReplace', t('tools.codeEditor.find.replaceLabel')),
    ].join(' · ');
  }, [isMac, ops, t]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeEditor.language')}
          <select
            value={languageId}
            onChange={(e) => setLanguageId(e.target.value)}
            aria-label={t('tools.codeEditor.language')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {LANG_SPECS.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeEditor.theme')}
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            aria-label={t('tools.codeEditor.theme')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {CODE_THEMES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeEditor.indent')}
          <select
            value={String(indent)}
            onChange={(e) =>
              setIndent(e.target.value === 'tab' ? 'tab' : (Number(e.target.value) as 2 | 4))
            }
            aria-label={t('tools.codeEditor.indent')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="2">{t('tools.codeEditor.indent2')}</option>
            <option value="4">{t('tools.codeEditor.indent4')}</option>
            <option value="tab">{t('tools.codeEditor.indentTab')}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showLineNumbers}
            onChange={(e) => setShowLineNumbers(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.codeEditor.lineNumbers')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={wordWrap}
            onChange={(e) => setWordWrap(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.codeEditor.wordWrap')}
        </label>
        <button
          type="button"
          onClick={() => void runFormat()}
          disabled={busy !== null || !canAct}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {busy === 'format' ? t('tools.codeEditor.formatting') : t('tools.codeEditor.format')}
        </button>
        <ShareButton
          getState={() => ({
            i: code,
            l: languageId,
            th: themeId,
            ind: String(indent),
            n: showLineNumbers ? 1 : 0,
            w: wordWrap ? 1 : 0,
            f: filename,
            cs: JSON.stringify(cardStyle),
          })}
          encodeParam={encodeCompressedShare}
          maxLength={SHARE_COMPRESSED_LIMIT}
          tooLongHint={t('tools.codeEditor.share.tooLongHint')}
        />
      </OptionBar>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.codeEditor.editor')}
            </span>
            <ClearButton onClick={reset} disabled={!code} label={t('tools.codeEditor.clear')} />
          </div>
          {multiSelection && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-2 py-1.5 dark:border-blue-900 dark:bg-blue-950/30">
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {t('tools.codeEditor.op.multiLabel')} ·{' '}
                {t('tools.codeEditor.op.multiHits', { ranges: multiSelection.ranges.length })}
              </span>
              <input
                autoFocus
                value={multiReplacement}
                aria-label={t('tools.codeEditor.op.multiLabel')}
                placeholder={t('tools.codeEditor.op.multiLabel')}
                onChange={(event) => setMultiReplacement(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyMultiReplace();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setMultiSelection(null);
                  }
                }}
                className="h-7 w-32 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={applyMultiReplace}
                className="h-7 rounded-md bg-blue-600 px-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t('tools.codeEditor.op.multiApply')}
              </button>
              <button
                type="button"
                onClick={() => setMultiSelection(null)}
                className="h-7 rounded-md border border-gray-300 px-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {t('tools.codeEditor.op.multiCancel')}
              </button>
            </div>
          )}
          {findOpen && (
            <FindReplaceBar
              query={findQuery}
              replacement={findReplacement}
              options={findOptions}
              total={matches.length}
              current={findCurrent}
              truncated={findTruncated}
              invalid={findInvalid}
              focus={findFocus}
              onQueryChange={setFindQuery}
              onReplacementChange={setFindReplacement}
              onToggleOption={toggleFindOption}
              onStep={stepMatch}
              onReplaceOne={replaceCurrentMatch}
              onReplaceAll={replaceAllMatches}
              onClose={() => setFindOpen(false)}
            />
          )}
          <CodeSurface
            ref={surfaceRef}
            value={code}
            onChange={setCode}
            prismKey={spec.prism}
            themeVars={themeVars}
            indentUnit={indentUnit}
            showLineNumbers={showLineNumbers}
            wordWrap={wordWrap}
            spec={spec}
            onAction={handleAction}
            matches={findOpen ? matches : EMPTY_MATCHES}
            currentMatch={findOpen ? currentMatch : null}
            multiRanges={multiSelection?.ranges ?? EMPTY_RANGES}
            placeholder={t('tools.codeEditor.placeholder')}
            ariaLabel={t('tools.codeEditor.editor')}
          />
          {/* Line toolbar sits below the editor: both columns keep one-line headers, aligning editor and card tops */}
          <div className="flex flex-wrap items-center gap-1.5">
            {ops.map((op) => (
              <button
                key={op.action}
                type="button"
                onClick={() => surfaceRef.current?.runAction(op.action)}
                disabled={!canAct || (op.action === 'toggleLineComment' && !spec.lineComment)}
                title={op.title}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {op.label}
              </button>
            ))}
            <HintTip text={shortcutHint} label={t('tools.codeEditor.op.hint')} />
            {gotoOpen && (
              <input
                type="number"
                min={1}
                autoFocus
                value={gotoValue}
                aria-label={t('tools.codeEditor.op.gotoLine')}
                onChange={(e) => setGotoValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    jumpToLine();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setGotoOpen(false);
                  }
                }}
                className="h-7 w-16 rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>{t('tools.codeEditor.stats', stats)}</span>
            <span>{saved ? t('tools.codeEditor.saved') : t('tools.codeEditor.saving')}</span>
          </div>
          {wordWrap && <p className="text-xs text-gray-400">{t('tools.codeEditor.wrapHint')}</p>}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t('tools.codeEditor.fold.note')}
          </p>
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          {/* Header holds only the title + card toggle: one line like the left column, aligning the card and editor tops */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.codeEditor.preview')}
            </span>
            <button
              type="button"
              aria-expanded={cardPanelOpen}
              onClick={() => setCardPanelOpen((prev) => !prev)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('tools.codeEditor.card.title')}
            </button>
          </div>
          <div
            ref={cardRef}
            className="ce-card"
            style={{ ...themeVars, ...cardVars, ...cardBg }}
            data-theme={theme.mode}
            aria-label={t('tools.codeEditor.preview')}
          >
            {canAct ? (
              // Shares the body structure with the standalone HTML (cardOptions.buildCardBodyHtml) for WYSIWYG
              <div dangerouslySetInnerHTML={{ __html: cardBody }} />
            ) : (
              <p style={{ color: theme.gutter }}>{t('tools.codeEditor.empty')}</p>
            )}
          </div>
          {cardPanelOpen && (
            <div
              data-testid="card-panel"
              className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
            >
              <div className="flex flex-wrap items-center gap-3">
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.window')}
                  <select
                    aria-label={t('tools.codeEditor.card.window')}
                    value={cardStyle.windowStyle}
                    onChange={(event) =>
                      updateCard({
                        windowStyle: event.target.value as CodeCardStyle['windowStyle'],
                      })
                    }
                    className={CARD_INPUT}
                  >
                    <option value="mac">{t('tools.codeEditor.card.window_mac')}</option>
                    <option value="title">{t('tools.codeEditor.card.window_title')}</option>
                    <option value="plain">{t('tools.codeEditor.card.window_plain')}</option>
                    <option value="none">{t('tools.codeEditor.card.window_none')}</option>
                  </select>
                </label>
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.padding')}
                  <input
                    type="range"
                    min={16}
                    max={128}
                    step={8}
                    aria-label={t('tools.codeEditor.card.padding')}
                    value={cardStyle.padding}
                    onChange={(event) => updateCard({ padding: Number(event.target.value) })}
                    className="w-24 accent-blue-600"
                  />
                  <span className="w-8 tabular-nums">{cardStyle.padding}</span>
                </label>
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.radius')}
                  <input
                    type="range"
                    min={0}
                    max={24}
                    aria-label={t('tools.codeEditor.card.radius')}
                    value={cardStyle.radius}
                    onChange={(event) => updateCard({ radius: Number(event.target.value) })}
                    className="w-20 accent-blue-600"
                  />
                  <span className="w-6 tabular-nums">{cardStyle.radius}</span>
                </label>
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.shadow')}
                  <select
                    aria-label={t('tools.codeEditor.card.shadow')}
                    value={cardStyle.shadow}
                    onChange={(event) =>
                      updateCard({ shadow: event.target.value as CodeCardStyle['shadow'] })
                    }
                    className={CARD_INPUT}
                  >
                    {CARD_SHADOWS.map((value) => (
                      <option key={value} value={value}>
                        {t(`tools.codeEditor.card.shadow_${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.background')}
                  <select
                    aria-label={t('tools.codeEditor.card.background')}
                    value={cardStyle.background}
                    onChange={(event) =>
                      updateCard({ background: event.target.value as CodeCardStyle['background'] })
                    }
                    className={CARD_INPUT}
                  >
                    {CARD_BACKGROUNDS.map((value) => (
                      <option key={value} value={value}>
                        {t(`tools.codeEditor.card.bg_${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.fontSize')}
                  <input
                    type="range"
                    min={12}
                    max={20}
                    aria-label={t('tools.codeEditor.card.fontSize')}
                    value={cardStyle.fontSize}
                    onChange={(event) => updateCard({ fontSize: Number(event.target.value) })}
                    className="w-20 accent-blue-600"
                  />
                  <span className="w-6 tabular-nums">{cardStyle.fontSize}</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={cardStyle.showLineNumbers}
                    onChange={(event) => updateCard({ showLineNumbers: event.target.checked })}
                    className="h-4 w-4 accent-blue-600"
                  />
                  {t('tools.codeEditor.lineNumbers')}
                </label>
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.highlightLines')}
                  <input
                    type="text"
                    value={highlightRaw}
                    placeholder={t('tools.codeEditor.card.highlightHint')}
                    aria-label={t('tools.codeEditor.card.highlightLines')}
                    onChange={(event) => {
                      setHighlightRaw(event.target.value);
                      updateHighlightLines(event.target.value);
                    }}
                    className={`${CARD_INPUT} w-20`}
                  />
                </label>
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.watermark')}
                  <input
                    type="text"
                    maxLength={60}
                    value={cardStyle.watermarkText}
                    aria-label={t('tools.codeEditor.card.watermark')}
                    onChange={(event) => updateCard({ watermarkText: event.target.value })}
                    className={`${CARD_INPUT} w-32`}
                  />
                </label>
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.watermarkOpacity')}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    aria-label={t('tools.codeEditor.card.watermarkOpacity')}
                    value={Math.round(cardStyle.watermarkOpacity * 100)}
                    onChange={(event) =>
                      updateCard({ watermarkOpacity: Number(event.target.value) / 100 })
                    }
                    className="w-20 accent-blue-600"
                  />
                </label>
                <label className={CARD_FIELD}>
                  {t('tools.codeEditor.card.scale')}
                  <select
                    aria-label={t('tools.codeEditor.card.scale')}
                    value={String(cardScale)}
                    onChange={(event) => setCardScale(Number(event.target.value) as CardScale)}
                    className={CARD_INPUT}
                  >
                    {CARD_SCALES.map((value) => (
                      <option key={value} value={value}>
                        {value}x
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
          {/* Copy actions sit below the card so they do not add header height and the column tops stay aligned */}
          <div className="flex flex-wrap gap-2">
            <CopyButton text={code} disabled={!canAct} label={t('tools.codeEditor.copyCode')} />
            <CopyButton text={snippet} disabled={!canAct} label={t('tools.codeEditor.copyHtml')} />
            <CopyButton
              text={markdownSnippet}
              disabled={!canAct}
              label={t('tools.codeEditor.copy.markdown')}
            />
            <button
              type="button"
              onClick={() => void copyRich()}
              disabled={!canAct}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('tools.codeEditor.copy.richText')}
            </button>
            <button
              type="button"
              onClick={() => void copyCardImage()}
              disabled={busy !== null || !canAct}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {busy === 'png' ? t('tools.codeEditor.exporting') : t('tools.codeEditor.copy.image')}
            </button>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.codeEditor.import')}
        </span>
        <FileDropZone
          onFile={(file) => void importFile(file)}
          accept={IMPORT_ACCEPT}
          hint={t('tools.codeEditor.importHint')}
          formats={t('tools.codeEditor.importFormats')}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <label className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeEditor.filename')}
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={DEFAULT_FILENAME}
            aria-label={t('tools.codeEditor.filename')}
            className="w-40 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('tools.codeEditor.finalName', { name: exportName })}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportSource}
            disabled={!canAct}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {t('tools.codeEditor.exportSource', { ext: spec.ext })}
          </button>
          <button
            type="button"
            onClick={exportHtml}
            disabled={!canAct}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.codeEditor.exportHtml')}
          </button>
          <button
            type="button"
            onClick={() => void exportImage('png')}
            disabled={busy !== null || !canAct}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {busy === 'png' ? t('tools.codeEditor.exporting') : t('tools.codeEditor.exportPng')}
          </button>
          <button
            type="button"
            onClick={() => void exportImage('jpg')}
            disabled={busy !== null || !canAct}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {busy === 'jpg' ? t('tools.codeEditor.exporting') : t('tools.codeEditor.exportJpg')}
          </button>
          <button
            type="button"
            onClick={() => void exportImage('svg')}
            disabled={busy !== null || !canAct}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {busy === 'svg' ? t('tools.codeEditor.exporting') : t('tools.codeEditor.exportSvg')}
          </button>
        </div>
      </section>

      {failure && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.codeEditor', failure)}
        </p>
      )}
      {notice && !failure && (
        <p className="text-xs text-gray-500 dark:text-gray-400" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
