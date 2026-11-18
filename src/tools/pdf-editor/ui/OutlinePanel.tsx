import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadOutline } from '../render/outline';
import type { OutlineEntry } from '../render/outline';

function OutlineNode({
  entry,
  depth,
  onSelect,
}: {
  entry: OutlineEntry;
  depth: number;
  onSelect(page: number): void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const hasChildren = entry.items.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined} className="min-w-0">
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={
              open ? t('tools.pdfEditor.outlineCollapse') : t('tools.pdfEditor.outlineExpand')
            }
            onClick={() => setOpen((value) => !value)}
            className="h-4 w-4 shrink-0 text-[10px] text-gray-400"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          data-testid="pdf-outline-item"
          disabled={entry.page == null}
          onClick={() => entry.page != null && onSelect(entry.page)}
          className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-xs text-gray-700 hover:bg-black/[0.05] disabled:opacity-50 dark:text-gray-200 dark:hover:bg-white/10"
          title={entry.title}
        >
          {entry.title}
        </button>
      </div>
      {hasChildren && open ? (
        <ul role="group" className="flex flex-col">
          {entry.items.map((child, index) => (
            <OutlineNode
              key={`${child.title}-${index}`}
              entry={child}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Right/left panel: bookmark tree; keeps a readable empty state instead of disappearing */
export function OutlinePanel({
  pdfDoc,
  onSelect,
}: {
  pdfDoc: PDFDocumentProxy;
  onSelect(page: number): void;
}) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<OutlineEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadOutline(pdfDoc);
      if (!cancelled) setEntries(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  return (
    <div
      data-testid="pdf-outline"
      className="flex max-h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
    >
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {t('tools.pdfEditor.outlineTitle')}
      </h3>
      {entries && entries.length === 0 ? (
        <p className="px-1 py-2 text-xs text-gray-500 dark:text-gray-400">
          {t('tools.pdfEditor.outlineEmpty')}
        </p>
      ) : null}
      {entries && entries.length > 0 ? (
        <ul role="tree" aria-label={t('tools.pdfEditor.outlineTitle')} className="flex flex-col">
          {entries.map((entry, index) => (
            <OutlineNode
              key={`${entry.title}-${index}`}
              entry={entry}
              depth={0}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
