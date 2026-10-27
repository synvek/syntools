import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CodeJar, type Position } from 'codejar';
import { CopyButton } from '@/core/components/CopyButton';
import { findBracketPair } from './brackets';
import type { LangSpec } from './core';
import { isUndoRedo, matchShortcut, type EditorAction, type EditorKeyEvent } from './editorKeymap';
import type { FindMatch } from './findReplace';
import { defaultFoldMode, foldRanges, type FoldRange } from './folding';
import {
  EDITOR_PADDING_LEFT_PX,
  LINE_HEIGHT_PX,
  LINE_HEIGHT_VAR,
  TAB_SIZE,
  lineAtOffsetY,
  lineTopPx,
} from './lineHeight';
import { countLines, leadingColumns, offsetToLineCol, splitLines } from './lines';
import { wordRanges, type TextRange, type WordSelection } from './multiEdit';
import {
  deleteLines,
  duplicateLines,
  indentLines,
  moveLines,
  selectLine,
  toggleBlockComment,
  toggleLineComment,
  transposeLine,
  type EditorSelection,
} from './lineOps';
import { highlightCode } from './prism';
import './editor.css';

export interface CodeSurfaceProps {
  value: string;
  onChange: (value: string) => void;
  /** Prism grammar name; 'none' disables highlighting */
  prismKey: string;
  /** Theme variables (`--ce-*`) */
  themeVars: Record<string, string>;
  /** Indent unit inserted by the Tab key */
  indentUnit: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  /** Current language: supplies comment markers (line ops) and fold mode (brackets / indent) */
  spec: LangSpec;
  /** Actions needing UI involvement (format / go-to-line / find) go to the tool layer; returns whether handled */
  onAction?: (action: EditorAction) => boolean;
  /** Find matches (computed by the tool layer; the overlay renders visible ones only) */
  matches?: FindMatch[];
  /** Current match (highlighted more strongly) */
  currentMatch?: FindMatch | null;
  /** Targets for batch replacement (all occurrences of a word) */
  multiRanges?: TextRange[];
  placeholder?: string;
  ariaLabel: string;
}

/** Editor action entry point: toolbar buttons and shortcuts share this logic */
export interface CodeSurfaceHandle {
  runAction: (action: EditorAction) => boolean;
  /** Select the given line and scroll it into view (for go-to-line) */
  focusLine: (line: number) => void;
  /** Positions of the word under the caret across the document (for batch replacement) */
  wordSelectionAtCaret: () => WordSelection | null;
  /** Scroll a match into view (for find navigation; leaves content, history and focus untouched) */
  revealRange: (start: number) => void;
  /** Replace the content with new text (approximate caret kept) and record history so undo works */
  applyText: (text: string) => void;
}

/** Character offset of the caret inside the editor; null when the selection is outside */
function caretOffset(el: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const head = document.createRange();
  head.selectNodeContents(el);
  head.setEnd(range.startContainer, range.startOffset);
  return head.toString().length;
}

/**
 * Measure the actual position of a character inside the editor.
 * Bracket highlights are drawn by pixel in the overlay, and the editor may contain CJK
 * (double-width) characters, so a "column × char width" conversion would drift; a DOM Range
 * measurement avoids that.
 */
function measureChar(root: HTMLElement, offset: number): DOMRect | null {
  let remaining = offset;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const length = textNode.data.length;
    if (remaining < length) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.setEnd(textNode, remaining + 1);
      return range.getBoundingClientRect();
    }
    remaining -= length;
    node = walker.nextNode();
  }
  return null;
}

/** Editable syntax-highlighted editor (CodeJar + Prism) with gutter, line overlays and shortcut bus */
export const CodeSurface = forwardRef<CodeSurfaceHandle, CodeSurfaceProps>(function CodeSurface(
  {
    value,
    onChange,
    prismKey,
    themeVars,
    indentUnit,
    showLineNumbers,
    wordWrap,
    spec,
    onAction,
    matches,
    currentMatch,
    multiRanges,
    placeholder,
    ariaLabel,
  },
  ref,
) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const jarRef = useRef<ReturnType<typeof CodeJar> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  const prismRef = useRef(prismKey);
  prismRef.current = prismKey;
  const indentRef = useRef(indentUnit);
  indentRef.current = indentUnit;
  const specRef = useRef(spec);
  specRef.current = spec;
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const [caretLine, setCaretLine] = useState(1);
  const [caret, setCaret] = useState(0);
  const caretRef = useRef(0);
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  const [activeFold, setActiveFold] = useState<FoldRange | null>(null);
  const [bracketBoxes, setBracketBoxes] = useState<
    Array<{ left: number; top: number; width: number; height: number }>
  >([]);
  /** Suppress focus restore during programmatic focus (see the highlight callback) */
  const suppressFocusRestoreRef = useRef(false);

  /**
   * Repaint callback (CodeJar debounces it 30ms after input, then calls `restore()` on the selection).
   * Note: setting a selection on a contenteditable steals focus back to the editor, so when a repaint
   * happens while focus is elsewhere (e.g. the find input) this restores focus afterwards —
   * otherwise the next Enter would land in the editor and insert a newline.
   * `suppressFocusRestoreRef` exempts our own programmatic focus.
   */
  const highlight = useCallback((editor: HTMLElement) => {
    const code = editor.textContent ?? '';
    editor.innerHTML = highlightCode(code, prismRef.current);
    const suppressed = suppressFocusRestoreRef.current;
    const previous = document.activeElement;
    if (suppressed || !previous || previous === editor || !(previous instanceof HTMLElement))
      return;
    queueMicrotask(() => {
      // Restore only when focus really was stolen (the editor has it) and the element is still connected
      if (document.activeElement === editor && previous.isConnected) previous.focus();
    });
  }, []);

  /** Replace the editor content with new text and restore the selection (also records history for undo) */
  const applySelection = useCallback((next: EditorSelection) => {
    const jar = jarRef.current;
    const el = hostRef.current;
    if (!jar || !el) return;
    // A programmatic edit intentionally focuses the editor, so skip the focus restore in the repaint callback
    suppressFocusRestoreRef.current = true;
    jar.updateCode(next.text, true);
    suppressFocusRestoreRef.current = false;
    // Take focus back: the toolbar button stole it, and CodeJar only records history while focused
    el.focus();
    try {
      jar.restore({ start: next.selectionStart, end: next.selectionEnd, dir: '->' });
    } catch {
      /* A failed caret restore does not affect the content */
    }
    // Record the post-edit state so one undo returns to the pre-edit text (as CodeJar does for paste / cut)
    jar.recordHistory();
  }, []);

  /**
   * Scroll the given offset into view (used by find navigation and bracket jumps).
   *
   * Deliberately **does not** steal focus or rewrite the native selection: while the find input
   * holds focus, moving focus back to the editor would make the user's next Enter insert a newline.
   */
  const revealRange = useCallback((start: number) => {
    const el = hostRef.current;
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    const top = lineTopPx(offsetToLineCol(el.textContent ?? '', start).line);
    const bottom = scroller.scrollTop + scroller.clientHeight;
    if (top < scroller.scrollTop || top + LINE_HEIGHT_PX > bottom) {
      scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 2);
    }
  }, []);

  /** Run an editor action; false means the action must be handled by the tool layer */
  const runAction = useCallback(
    (action: EditorAction): boolean => {
      const el = hostRef.current;
      const jar = jarRef.current;
      if (!el || !jar) return false;

      const text = el.textContent ?? '';
      let pos: Position | null = null;
      try {
        pos = jar.save();
      } catch {
        pos = null; // save() throws when there is no selection
      }
      const selectionStart = pos ? Math.min(pos.start, pos.end) : 0;
      const selectionEnd = pos ? Math.max(pos.start, pos.end) : 0;
      const langSpec = specRef.current;

      switch (action) {
        case 'toggleLineComment': {
          const result = toggleLineComment(
            text,
            selectionStart,
            selectionEnd,
            langSpec.lineComment,
          );
          if (!result.ok) return false;
          applySelection(result.value);
          return true;
        }
        case 'toggleBlockComment': {
          const result = toggleBlockComment(
            text,
            selectionStart,
            selectionEnd,
            langSpec.blockComment,
          );
          if (!result.ok) return false;
          applySelection(result.value);
          return true;
        }
        case 'jumpToBracket': {
          const pair = findBracketPair(text, selectionEnd, langSpec);
          if (!pair) return false;
          // Jump to the other end of the bracket at the caret (focus is already in the editor here)
          const target = selectionEnd <= pair.open ? pair.close : pair.open;
          el.focus();
          try {
            jar.restore({ start: target, end: target, dir: '->' });
          } catch {
            /* A failed caret restore does not affect the content */
          }
          revealRange(target);
          setCaret(target);
          return true;
        }
        case 'moveLineUp':
          applySelection(moveLines(text, selectionStart, selectionEnd, 'up'));
          return true;
        case 'moveLineDown':
          applySelection(moveLines(text, selectionStart, selectionEnd, 'down'));
          return true;
        case 'copyLineUp':
          applySelection(duplicateLines(text, selectionStart, selectionEnd, 'up'));
          return true;
        case 'copyLineDown':
          applySelection(duplicateLines(text, selectionStart, selectionEnd, 'down'));
          return true;
        case 'deleteLine':
          applySelection(deleteLines(text, selectionStart, selectionEnd));
          return true;
        case 'transposeLine':
          applySelection(transposeLine(text, selectionStart, selectionEnd));
          return true;
        case 'indent':
          applySelection(indentLines(text, selectionStart, selectionEnd, indentRef.current, 1));
          return true;
        case 'outdent':
          applySelection(indentLines(text, selectionStart, selectionEnd, indentRef.current, -1));
          return true;
        default:
          return onActionRef.current?.(action) ?? false;
      }
    },
    [applySelection, revealRange],
  );

  /** Select the given line and scroll it into view (for go-to-line) */
  const focusLine = useCallback(
    (line: number) => {
      const el = hostRef.current;
      if (!el) return;
      applySelection(selectLine(el.textContent ?? '', line));
    },
    [applySelection],
  );

  /** Positions of the word under the caret across the document (for batch replacement) */
  const wordSelectionAtCaret = useCallback((): WordSelection | null => {
    const el = hostRef.current;
    if (!el) return null;
    return wordRanges(el.textContent ?? '', caretRef.current);
  }, []);

  /** Replace the content with new text (caret kept where possible) and record history for a single undo */
  const applyText = useCallback(
    (text: string) => {
      const jar = jarRef.current;
      if (!jar) return;
      let caret = 0;
      try {
        const pos = jar.save();
        caret = pos ? Math.max(pos.start, pos.end) : 0;
      } catch {
        caret = 0;
      }
      const offset = Math.min(caret, text.length);
      applySelection({ text, selectionStart: offset, selectionEnd: offset });
    },
    [applySelection],
  );

  useImperativeHandle(
    ref,
    () => ({ runAction, focusLine, revealRange, applyText, wordSelectionAtCaret }),
    [applyText, focusLine, revealRange, runAction, wordSelectionAtCaret],
  );

  // Rebuild on mount / indent-unit change (CodeJar fixes its tab option at creation time)
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const jar = CodeJar(el, highlight, {
      tab: indentRef.current,
      addClosing: false,
      spellcheck: false,
      preserveIdent: true,
      catchTab: true,
    });
    jar.updateCode(valueRef.current, false);
    jar.onUpdate((code) => onChangeRef.current(code));
    jarRef.current = jar;
    return () => {
      jar.destroy();
      jarRef.current = null;
    };
  }, [highlight, indentUnit]);

  // Shortcuts must be parsed in the capture phase: CodeJar claims Tab / paste / undo and bails on defaultPrevented
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyEvent: EditorKeyEvent = {
        key: event.key,
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      };
      // Leave undo / redo to CodeJar but sync controlled state after dispatch (else preview and stats lag)
      if (isUndoRedo(keyEvent)) {
        queueMicrotask(() => onChangeRef.current(el.textContent ?? ''));
        return;
      }
      const action = matchShortcut(keyEvent);
      if (!action) return;
      if (!runAction(action)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    el.addEventListener('keydown', handleKeyDown, true);
    return () => el.removeEventListener('keydown', handleKeyDown, true);
  }, [runAction]);

  // Caret-line tracking (shared by the current-line highlight and later find / fold positioning):
  // Read the DOM text instead of the controlled value to avoid a one-frame lag while typing
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const sync = () => {
      const offset = caretOffset(el);
      if (offset === null) return;
      caretRef.current = offset;
      setCaret(offset);
      setCaretLine(offsetToLineCol(el.textContent ?? '', offset).line);
    };
    document.addEventListener('selectionchange', sync);
    el.addEventListener('keyup', sync);
    el.addEventListener('mouseup', sync);
    el.addEventListener('focus', sync);
    el.addEventListener('input', sync);
    return () => {
      document.removeEventListener('selectionchange', sync);
      el.removeEventListener('keyup', sync);
      el.removeEventListener('mouseup', sync);
      el.removeEventListener('focus', sync);
      el.removeEventListener('input', sync);
    };
  }, []);

  // Controlled updates from outside: clear / import / format / auto-format / share restore
  // Save and restore the caret while focused so auto-formatting does not jump it to the start mid-typing
  useEffect(() => {
    const jar = jarRef.current;
    const el = hostRef.current;
    if (!jar || !el) return;
    if (jar.toString() === value) return;
    let pos: Position | null = null;
    if (document.activeElement === el) {
      try {
        pos = jar.save();
      } catch {
        pos = null; // save() throws without a selection; safe to ignore
      }
    }
    jar.updateCode(value, false);
    if (pos) {
      try {
        jar.restore(pos);
      } catch {
        /* A failed caret restore does not affect the content */
      }
    }
  }, [value]);

  // Re-highlight after a language switch
  useEffect(() => {
    const jar = jarRef.current;
    if (!jar) return;
    jar.updateCode(jar.toString(), false);
  }, [prismKey]);

  // Viewport tracking: match highlights render only for visible lines, avoiding thousands of overlay nodes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => setViewport({ top: el.scrollTop, height: el.clientHeight });
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      observer?.disconnect();
    };
  }, []);

  // Bracket pair highlight: positions measured with DOM Range (a `ch` conversion drifts on CJK lines)
  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      setBracketBoxes([]);
      return;
    }
    const text = el.textContent ?? '';
    const pair = findBracketPair(text, caretRef.current, spec);
    if (!pair) {
      setBracketBoxes([]);
      return;
    }
    const surfaceRect = el.getBoundingClientRect();
    const boxes = [pair.open, pair.close]
      .map((offset) => measureChar(el, offset))
      .filter((rect): rect is DOMRect => rect !== null)
      .map((rect) => ({
        left: rect.left - surfaceRect.left,
        top: rect.top - surfaceRect.top,
        width: rect.width,
        height: rect.height,
      }));
    setBracketBoxes(boxes);
  }, [caret, spec, value]);

  const lines = countLines(value);
  // Word wrap desyncs line numbers from visual lines, so hide the gutter and line overlays then
  const showGutter = showLineNumbers && !wordWrap;
  const showLineOverlays = !wordWrap && value.length > 0;
  const gutterWidth = String(lines).length * 8 + 24;

  const visibleRange = useMemo(() => {
    // Before the first size measurement, render a small batch instead of the whole document
    if (viewport.height <= 0) return { first: 1, last: Math.min(lines, 50) };
    return {
      first: lineAtOffsetY(viewport.top, lines),
      last: lineAtOffsetY(viewport.top + viewport.height, lines),
    };
  }, [lines, viewport]);

  const visibleMatches = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    return matches.filter(
      (match) => match.line >= visibleRange.first && match.line <= visibleRange.last,
    );
  }, [matches, visibleRange]);

  // Indent guides from the leading-whitespace column count (`ch` units align exactly in a monospace font)
  const guides = useMemo(() => {
    if (wordWrap) return [];
    const unit = indentUnit === '\t' ? TAB_SIZE : Math.max(indentUnit.length, 1);
    const source = splitLines(value);
    const out: Array<{ key: string; line: number; column: number }> = [];
    for (let line = visibleRange.first; line <= visibleRange.last; line += 1) {
      const columns = leadingColumns(source[line - 1] ?? '', TAB_SIZE);
      for (let column = 0; column < columns && column / unit < 20; column += unit) {
        out.push({ key: `${line}:${column}`, line, column });
      }
    }
    return out;
  }, [indentUnit, value, visibleRange, wordWrap]);

  // Sort by line number: DOM order is Tab order, so it must match the visual order
  const folds = useMemo(
    () =>
      foldRanges(value, spec, defaultFoldMode(spec)).sort(
        (a, b) => a.headerLine - b.headerLine || b.endLine - a.endLine,
      ),
    [spec, value],
  );
  const visibleFolds = useMemo(
    () =>
      folds.filter(
        (range) =>
          range.headerLine >= visibleRange.first - 5 && range.headerLine <= visibleRange.last + 5,
      ),
    [folds, visibleRange],
  );

  const multiBands = useMemo(() => {
    if (!multiRanges || multiRanges.length === 0) return [];
    return multiRanges
      .map((range) => ({ range, line: offsetToLineCol(value, range.start).line }))
      .filter((band) => band.line >= visibleRange.first && band.line <= visibleRange.last);
  }, [multiRanges, value, visibleRange]);

  const activeFoldText = useMemo(() => {
    if (!activeFold) return '';
    return splitLines(value)
      .slice(activeFold.headerLine - 1, activeFold.endLine)
      .join('\n');
  }, [activeFold, value]);
  const activeFoldLines = activeFold ? activeFold.endLine - activeFold.headerLine + 1 : 0;

  const toggleFold = useCallback((range: FoldRange) => {
    setActiveFold((prev) =>
      prev && prev.headerLine === range.headerLine && prev.endLine === range.endLine ? null : range,
    );
  }, []);

  return (
    <div
      className={`ce-code ${wordWrap ? 'ce-wrap' : ''}`}
      style={{
        ...themeVars,
        [LINE_HEIGHT_VAR as string]: `${LINE_HEIGHT_PX}px`,
        ['--ce-gutter-w' as string]: showGutter ? `${gutterWidth}px` : '0px',
      }}
    >
      <div className="ce-scroll" ref={scrollRef}>
        {showGutter && (
          <div className="ce-gutter" aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
          </div>
        )}
        <div className="ce-stage">
          <div
            ref={hostRef}
            role="textbox"
            aria-multiline="true"
            aria-label={ariaLabel}
            tabIndex={0}
            spellCheck={false}
            className="ce-surface"
          />
          {/* Overlay: decorative nodes are all aria-hidden, but fold markers are interactive, so the container is not */}
          <div className="ce-overlay">
            {showLineOverlays && (
              <>
                <div
                  className="ce-line-active"
                  aria-hidden="true"
                  style={{ top: lineTopPx(caretLine) }}
                />
                {guides.map((guide) => (
                  <div
                    key={guide.key}
                    className="ce-guide"
                    aria-hidden="true"
                    style={{
                      top: lineTopPx(guide.line),
                      left: `calc(${EDITOR_PADDING_LEFT_PX}px + ${guide.column}ch)`,
                    }}
                  />
                ))}
              </>
            )}
            {bracketBoxes.map((box) => (
              <div
                key={`${box.left}:${box.top}`}
                className="ce-bracket"
                aria-hidden="true"
                style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
              />
            ))}
            {showLineOverlays && (
              <>
                {visibleMatches.map((match) => {
                  const isCurrent =
                    currentMatch !== null &&
                    currentMatch !== undefined &&
                    match.start === currentMatch.start &&
                    match.end === currentMatch.end;
                  return (
                    <div
                      key={`${match.start}:${match.end}`}
                      className={`ce-match${isCurrent ? ' ce-match-current' : ''}`}
                      aria-hidden="true"
                      style={{ top: lineTopPx(match.line) }}
                    />
                  );
                })}
                {activeFold && (
                  <>
                    <div
                      className="ce-fold-band"
                      aria-hidden="true"
                      style={{
                        top: lineTopPx(activeFold.headerLine),
                        height: activeFoldLines * LINE_HEIGHT_PX,
                      }}
                    />
                    <div
                      className="ce-fold-badge"
                      style={{ top: lineTopPx(activeFold.headerLine) }}
                    >
                      <span>{t('tools.codeEditor.fold.lines', { lines: activeFoldLines })}</span>
                      <CopyButton text={activeFoldText} label={t('tools.codeEditor.fold.copy')} />
                      <button
                        type="button"
                        aria-label={t('tools.codeEditor.fold.clear')}
                        title={t('tools.codeEditor.fold.clear')}
                        onClick={() => setActiveFold(null)}
                        className="ce-fold-close"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
                {multiBands.map((band) => (
                  <div
                    key={`${band.range.start}:${band.range.end}`}
                    className="ce-multi"
                    aria-hidden="true"
                    style={{ top: lineTopPx(band.line) }}
                  />
                ))}
                {visibleFolds.map((range) => (
                  <button
                    key={`${range.headerLine}:${range.endLine}`}
                    type="button"
                    className={`ce-fold-marker${
                      activeFold && activeFold.headerLine === range.headerLine
                        ? ' ce-fold-marker-active'
                        : ''
                    }`}
                    style={{ top: lineTopPx(range.headerLine) }}
                    aria-label={t('tools.codeEditor.fold.toggle', {
                      lines: range.endLine - range.headerLine + 1,
                    })}
                    aria-expanded={activeFold?.headerLine === range.headerLine}
                    title={t('tools.codeEditor.fold.note')}
                    onClick={() => toggleFold(range)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      {!value && placeholder && <div className="ce-placeholder">{placeholder}</div>}
    </div>
  );
});
