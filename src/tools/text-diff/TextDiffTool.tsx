import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, OptionBar, SwapButton } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { useDeferredCompute } from '@/core/hooks/useDeferredCompute';
import {
  alignAnnotations,
  annotateDiffSides,
  sideStats,
  splitEditorLines,
  type AnnotatedLine,
  type SideLineType,
} from './core';

const SEG_BG: Record<SideLineType, string> = {
  same: '',
  added: 'rounded-sm bg-green-200/90 dark:bg-green-700/55',
  removed: 'rounded-sm bg-red-200/90 dark:bg-red-700/55',
};

const LINE_GUTTER: Record<SideLineType, string> = {
  same: 'text-gray-400 dark:text-gray-500',
  added: 'text-green-600 dark:text-green-400',
  removed: 'text-red-600 dark:text-red-400',
};

const EDITOR_STYLE = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  lineHeight: '1.5',
  tabSize: 2,
  padding: '8px 10px',
} as const;

interface DiffEditorPaneProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  actions?: ReactNode;
  annotations: AnnotatedLine[];
}

/** 带行号与行内差异高亮的可编辑面板（高亮层 + 透明 textarea 叠层） */
function DiffEditorPane({
  label,
  value,
  onChange,
  placeholder,
  actions,
  annotations,
}: DiffEditorPaneProps) {
  const { t } = useTranslation();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const bytes = useMemo(() => new TextEncoder().encode(value).length, [value]);

  const syncScroll = useCallback((e: UIEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = el.scrollTop;
      preRef.current.scrollLeft = el.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = el.scrollTop;
    }
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('io.stats', { chars: value.length, bytes })}
          </span>
          {actions}
        </div>
      </div>

      <div className="flex h-[28rem] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <div
          ref={gutterRef}
          aria-hidden
          className="shrink-0 overflow-hidden border-r border-gray-200 bg-gray-50 text-right dark:border-gray-700 dark:bg-gray-900/80"
          style={{ ...EDITOR_STYLE, paddingRight: 6, paddingLeft: 8, minWidth: '2.75rem' }}
        >
          {annotations.map((line, i) => (
            <div key={i} className={`select-none ${LINE_GUTTER[line.type]}`}>
              {i + 1}
            </div>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <pre
            ref={preRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre text-transparent"
            style={EDITOR_STYLE}
          >
            {annotations.map((line, i) => (
              <span key={i} className="block w-full">
                {line.segments.length === 0 || (line.segments.length === 1 && !line.segments[0].text) ? (
                  <span className={SEG_BG[line.type] || undefined}>{'\u00a0'}</span>
                ) : (
                  line.segments.map((seg, j) => (
                    <span key={j} className={SEG_BG[seg.type] || undefined}>
                      {seg.text || '\u00a0'}
                    </span>
                  ))
                )}
              </span>
            ))}
          </pre>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            placeholder={placeholder}
            spellCheck={false}
            aria-label={label}
            className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent text-gray-900 caret-gray-900 outline-none dark:text-gray-100 dark:caret-gray-100"
            style={EDITOR_STYLE}
          />
        </div>
      </div>
    </div>
  );
}

/** 在线文本比较：左右编辑器内行动态高亮 + 行号 */
export default function TextDiffTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ o: '', n: '', w: 0 }), []);
  const [oldText, setOldText] = useState(init.o);
  const [newText, setNewText] = useState(init.n);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(Number(init.w) === 1);

  const result = useDeferredCompute(
    `${ignoreWhitespace ? '1' : '0'}\u0000${oldText}\u0000${newText}`,
    (joined) => {
      const [flag, oldPart, newPart] = joined.split('\u0000');
      return annotateDiffSides(oldPart ?? '', newPart ?? '', {
        ignoreWhitespace: flag === '1',
      });
    },
    200,
  );

  const leftLines = useMemo(() => splitEditorLines(oldText), [oldText]);
  const rightLines = useMemo(() => splitEditorLines(newText), [newText]);

  const leftAnnotated = useMemo(
    () =>
      alignAnnotations(
        leftLines,
        result.ok ? result.value.left : undefined,
        'same',
      ),
    [leftLines, result],
  );
  const rightAnnotated = useMemo(
    () =>
      alignAnnotations(
        rightLines,
        result.ok ? result.value.right : undefined,
        'same',
      ),
    [rightLines, result],
  );

  const stats = result.ok ? sideStats(result.value) : { added: 0, removed: 0, same: 0 };
  const hasInput = oldText.length > 0 || newText.length > 0;
  const identical = result.ok && hasInput && stats.added === 0 && stats.removed === 0;

  const swap = () => {
    setOldText(newText);
    setNewText(oldText);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={ignoreWhitespace}
            onChange={(e) => setIgnoreWhitespace(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.textDiff.ignoreWhitespace')}
        </label>
        <SwapButton onSwap={swap} label={t('tools.textDiff.swapSides')} disabled={!hasInput} />
        <ShareButton
          getState={() => ({ o: oldText, n: newText, w: ignoreWhitespace ? 1 : 0 })}
        />
        {result.ok && hasInput && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {identical
              ? t('tools.textDiff.identical')
              : t('tools.textDiff.stats', {
                  added: stats.added,
                  removed: stats.removed,
                  same: stats.same,
                })}
          </span>
        )}
      </OptionBar>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.textDiff', result)}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <DiffEditorPane
          label={t('tools.textDiff.oldText')}
          value={oldText}
          onChange={setOldText}
          placeholder={t('tools.textDiff.oldText')}
          annotations={leftAnnotated}
          actions={<ClearButton onClick={() => setOldText('')} disabled={!oldText} />}
        />
        <DiffEditorPane
          label={t('tools.textDiff.newText')}
          value={newText}
          onChange={setNewText}
          placeholder={t('tools.textDiff.newText')}
          annotations={rightAnnotated}
          actions={<ClearButton onClick={() => setNewText('')} disabled={!newText} />}
        />
      </div>
    </div>
  );
}
