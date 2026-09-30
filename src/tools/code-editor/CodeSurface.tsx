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
  /** Prism 语法名，'none' 表示不高亮 */
  prismKey: string;
  /** 主题变量（--ce-*） */
  themeVars: Record<string, string>;
  /** Tab 键插入的缩进单元 */
  indentUnit: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  /** 当前语言：提供注释符（行操作）与折叠模式（括号 / 缩进） */
  spec: LangSpec;
  /** 需要 UI 参与的动作（格式化 / 跳转行 / 查找）交给工具层，返回是否已处理 */
  onAction?: (action: EditorAction) => boolean;
  /** 查找命中（由工具层计算，覆盖层只渲染可视区域内的高亮） */
  matches?: FindMatch[];
  /** 当前命中（高亮强度更高） */
  currentMatch?: FindMatch | null;
  /** 批量替换的目标位置（同词多处） */
  multiRanges?: TextRange[];
  placeholder?: string;
  ariaLabel: string;
}

/** 编辑器动作入口：工具栏按钮与快捷键走同一套逻辑 */
export interface CodeSurfaceHandle {
  runAction: (action: EditorAction) => boolean;
  /** 选中并滚动到指定行（跳转行使用） */
  focusLine: (line: number) => void;
  /** 取光标所在词在全文中出现的位置（批量替换使用） */
  wordSelectionAtCaret: () => WordSelection | null;
  /** 把命中滚动进可视区域（查找定位使用；不改动内容、历史与焦点） */
  revealRange: (start: number) => void;
  /** 用新文本替换内容（保留光标大致位置），并补记历史以便撤销 */
  applyText: (text: string) => void;
}

/** 光标在编辑区内的字符偏移；选区不在编辑区时返回 null */
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
 * 实测编辑区内某个字符的位置。
 * 覆盖层的括号高亮按像素绘制：编辑区里可能混有 CJK（双列宽）字符，
 * 按「列数 × 字符宽」换算会错位，因此这里用 DOM Range 直接量取。
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

/** 可编辑的语法高亮编辑器（CodeJar + Prism），含行号槽、行级覆盖层与快捷键总线 */
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
  /** 程序化聚焦期间抑制「焦点归还」（见 highlight 回调） */
  const suppressFocusRestoreRef = useRef(false);

  /**
   * 重绘回调（CodeJar 会在输入后 30ms 防抖调用，并在其后 `restore()` 选区）。
   * 注意：给 contenteditable 设置选区会把焦点抢回编辑区，因此当重绘发生时焦点在别处
   * （例如查找栏输入框），这里在重绘结束后把焦点还回去 —— 否则紧接着的 Enter
   * 会落进编辑区插入换行。`suppressFocusRestoreRef` 用于放过我们自己的程序化聚焦。
   */
  const highlight = useCallback((editor: HTMLElement) => {
    const code = editor.textContent ?? '';
    editor.innerHTML = highlightCode(code, prismRef.current);
    const suppressed = suppressFocusRestoreRef.current;
    const previous = document.activeElement;
    if (suppressed || !previous || previous === editor || !(previous instanceof HTMLElement))
      return;
    queueMicrotask(() => {
      // 仅在确实被抢走（编辑区拿到了焦点）且原元素仍在文档中时归还
      if (document.activeElement === editor && previous.isConnected) previous.focus();
    });
  }, []);

  /** 用新文本替换编辑区内容并恢复选区（同时补记历史，保证一次撤销可回退） */
  const applySelection = useCallback((next: EditorSelection) => {
    const jar = jarRef.current;
    const el = hostRef.current;
    if (!jar || !el) return;
    // 程序化编辑会主动把焦点交给编辑区，跳过重绘回调里的「焦点归还」
    suppressFocusRestoreRef.current = true;
    jar.updateCode(next.text, true);
    suppressFocusRestoreRef.current = false;
    // 取回焦点：工具栏按钮会抢走焦点，而 CodeJar 只在编辑器聚焦时记录历史
    el.focus();
    try {
      jar.restore({ start: next.selectionStart, end: next.selectionEnd, dir: '->' });
    } catch {
      /* 光标恢复失败不影响内容 */
    }
    // 补记编辑后的状态，使一次撤销回到编辑前（对齐 CodeJar 自身在粘贴 / 剪切时的做法）
    jar.recordHistory();
  }, []);

  /**
   * 把指定偏移滚动进可视区域（查找定位与括号跳转使用）。
   *
   * 刻意**不**抢焦点、也不改写原生选区：查找栏输入框持有焦点时，
   * 一旦把焦点移回编辑区，用户后续的 Enter 就会落进编辑区插入换行。
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

  /** 执行编辑器动作；返回 false 表示该动作需要工具层处理 */
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
        pos = null; // 无选区时 save 会抛错
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
          // 跳到光标所在括号的另一端（快捷键由编辑区派发，焦点本就在编辑区内）
          const target = selectionEnd <= pair.open ? pair.close : pair.open;
          el.focus();
          try {
            jar.restore({ start: target, end: target, dir: '->' });
          } catch {
            /* 光标恢复失败不影响内容 */
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

  /** 选中并滚动到指定行（跳转行使用） */
  const focusLine = useCallback(
    (line: number) => {
      const el = hostRef.current;
      if (!el) return;
      applySelection(selectLine(el.textContent ?? '', line));
    },
    [applySelection],
  );

  /** 取光标所在词在全文中出现的位置（批量替换使用） */
  const wordSelectionAtCaret = useCallback((): WordSelection | null => {
    const el = hostRef.current;
    if (!el) return null;
    return wordRanges(el.textContent ?? '', caretRef.current);
  }, []);

  /** 用新文本替换内容（尽量保留原光标位置），并补记历史以便一次撤销 */
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

  // 挂载 / 缩进单元变化时重建实例（CodeJar 的 tab 选项在创建时固定）
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

  // 快捷键：必须在捕获阶段解析 —— CodeJar 会抢占 Tab / 粘贴 / 撤销，且对 defaultPrevented 直接返回
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
      // 撤销 / 重做交给 CodeJar，但在事件派发结束后同步受控状态（否则预览与统计滞后）
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

  // 光标行跟踪（当前行高亮与后续的查找 / 折叠定位共用）：
  // 直接读 DOM 文本而非受控 value，避免输入当帧的滞后
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

  // 外部清空 / 导入 / 格式化 / 自动格式化 / 分享还原等受控更新
  // 聚焦时保存并恢复光标：避免自动格式化把光标弹回开头而打断输入
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
        pos = null; // 无选区时 save 会抛错，忽略即可
      }
    }
    jar.updateCode(value, false);
    if (pos) {
      try {
        jar.restore(pos);
      } catch {
        /* 光标恢复失败不影响内容 */
      }
    }
  }, [value]);

  // 语言切换后重新着色
  useEffect(() => {
    const jar = jarRef.current;
    if (!jar) return;
    jar.updateCode(jar.toString(), false);
  }, [prismKey]);

  // 可视区域跟踪：命中高亮只渲染可视行，避免长文本下堆出上千个覆盖层节点
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

  // 括号配对高亮：位置用 DOM Range 实测（按 `ch` 换算在含 CJK 的行上会错位）
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
  // 自动换行会让行号与视觉行错位，此时隐藏行号槽与行级覆盖层
  const showGutter = showLineNumbers && !wordWrap;
  const showLineOverlays = !wordWrap && value.length > 0;
  const gutterWidth = String(lines).length * 8 + 24;

  const visibleRange = useMemo(() => {
    // 尚未测到尺寸（首次渲染）时先给一小批，避免整篇渲染
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

  // 缩进引导线：按行前导空白的列数生成（列宽用 `ch`，等宽字体下与前导空格严格对齐）
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

  // 按行号排序：标记的 DOM 顺序即 Tab 焦点顺序，应与视觉顺序一致
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
          {/* 覆盖层：装饰节点一律 aria-hidden，只有折叠标记是可交互控件，故容器本身不加 aria-hidden */}
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
