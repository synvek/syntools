import { useTranslation } from 'react-i18next';
import { applyMarkdownAction, type MarkdownAction } from './editor';

/** CodeJar 实例上需要的最小接口（避免把编辑器实现泄漏到工具栏） */
export interface MarkdownJarLike {
  toString: () => string;
  save: () => { start: number; end: number; dir?: '->' | '<-' };
  restore: (pos: { start: number; end: number; dir?: '->' | '<-' }) => void;
  updateCode: (code: string, callOnUpdate?: boolean) => void;
  recordHistory: () => void;
}

interface MarkdownToolbarProps {
  getJar: () => MarkdownJarLike | null;
}

const ACTIONS: { id: MarkdownAction; label: string; tipKey: string }[] = [
  { id: 'bold', label: 'B', tipKey: 'tools.markdown.toolbar.bold' },
  { id: 'italic', label: 'I', tipKey: 'tools.markdown.toolbar.italic' },
  { id: 'strike', label: 'S', tipKey: 'tools.markdown.toolbar.strike' },
  { id: 'h1', label: 'H1', tipKey: 'tools.markdown.toolbar.h1' },
  { id: 'h2', label: 'H2', tipKey: 'tools.markdown.toolbar.h2' },
  { id: 'h3', label: 'H3', tipKey: 'tools.markdown.toolbar.h3' },
  { id: 'h4', label: 'H4', tipKey: 'tools.markdown.toolbar.h4' },
  { id: 'h5', label: 'H5', tipKey: 'tools.markdown.toolbar.h5' },
  { id: 'h6', label: 'H6', tipKey: 'tools.markdown.toolbar.h6' },
  { id: 'quote', label: '>', tipKey: 'tools.markdown.toolbar.quote' },
  { id: 'code', label: '`', tipKey: 'tools.markdown.toolbar.code' },
  { id: 'codeBlock', label: '```', tipKey: 'tools.markdown.toolbar.codeBlock' },
  { id: 'link', label: '[]', tipKey: 'tools.markdown.toolbar.link' },
  { id: 'image', label: '![]', tipKey: 'tools.markdown.toolbar.image' },
  { id: 'ul', label: '•', tipKey: 'tools.markdown.toolbar.ul' },
  { id: 'ol', label: '1.', tipKey: 'tools.markdown.toolbar.ol' },
  { id: 'hr', label: '—', tipKey: 'tools.markdown.toolbar.hr' },
  { id: 'table', label: 'tbl', tipKey: 'tools.markdown.toolbar.table' },
];

/** 在 CodeJar 上应用 Markdown 动作并精确恢复选区 */
export function runMarkdownAction(jar: MarkdownJarLike, action: MarkdownAction): boolean {
  const pos = jar.save();
  const result = applyMarkdownAction(jar.toString(), pos.start, pos.end, action);
  jar.updateCode(result.text);
  jar.restore({ start: result.selectionStart, end: result.selectionEnd, dir: '->' });
  jar.recordHistory();
  return true;
}

/** Markdown 快捷工具栏：点击按钮对选区应用语法 */
export function MarkdownToolbar({ getJar }: MarkdownToolbarProps) {
  const { t } = useTranslation();

  const run = (action: MarkdownAction) => {
    const jar = getJar();
    if (!jar) return;
    runMarkdownAction(jar, action);
  };

  return (
    <div
      role="toolbar"
      aria-label={t('tools.markdown.toolbar.aria')}
      className="flex flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60"
    >
      {ACTIONS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={t(item.tipKey)}
          aria-label={t(item.tipKey)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(item.id)}
          className="inline-flex h-7 min-w-7 items-center justify-center rounded px-1.5 font-mono text-xs font-semibold text-gray-700 hover:bg-white hover:text-blue-600 dark:text-gray-200 dark:hover:bg-gray-900 dark:hover:text-blue-400"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
