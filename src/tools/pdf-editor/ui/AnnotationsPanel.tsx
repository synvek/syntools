import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PdfObject, PdfPageState } from '../model/types';

interface AnnotationsPanelProps {
  /** Every object of the document; grouped and ordered here */
  objects: PdfObject[];
  /** Visible pages in output order — page number = index + 1 */
  pages: PdfPageState[];
  selectedIds: string[];
  /** Click an entry: the controller selects it and scrolls to its page */
  onSelect(object: PdfObject): void;
  onDelete(id: string): void;
}

const KIND_KEY: Record<PdfObject['kind'], string> = {
  text: 'kindText',
  image: 'kindImage',
  ink: 'kindInk',
  markup: 'kindMarkup',
  shape: 'kindShape',
  note: 'kindNote',
  stamp: 'kindStamp',
  signature: 'kindStamp',
};

/** What the row shows next to the kind badge */
function captionOf(object: PdfObject): string {
  if (object.kind === 'text') return object.text.trim() || '(空)';
  if (object.kind === 'note') return object.body.trim() || '(空)';
  return '';
}

/**
 * Right rail: one flat, searchable list of every annotation, grouped by page.
 *
 * The page view only shows one page at a time, so this is the only place where an annotation from
 * page 12 can be found without scrolling — hence click-to-navigate instead of click-to-select only.
 */
export function AnnotationsPanel({
  objects,
  pages,
  selectedIds,
  onSelect,
  onDelete,
}: AnnotationsPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const groups = useMemo(() => {
    return pages
      .map((page, index) => {
        const items = objects
          .filter((object) => object.page === page.id)
          .sort((left, right) => right.z - left.z)
          .filter((object) => {
            if (!needle) return true;
            const label = `${t(`tools.pdfEditor.${KIND_KEY[object.kind]}`)} ${captionOf(object)}`;
            return label.toLowerCase().includes(needle);
          });
        return { pageId: page.id, page: index + 1, items };
      })
      .filter((group) => group.items.length > 0);
  }, [objects, pages, needle, t]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div
      data-testid="pdf-annotations"
      className="flex max-h-full w-56 shrink-0 flex-col gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-800 dark:bg-gray-900"
    >
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {t('tools.pdfEditor.annotationsTitle')}
        <span className="ml-1 font-normal tabular-nums">({total})</span>
      </h3>

      <input
        type="search"
        value={query}
        placeholder={t('tools.pdfEditor.annotationsSearch')}
        aria-label={t('tools.pdfEditor.annotationsSearch')}
        data-testid="pdf-annotation-search"
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-800 outline-none focus:border-[#b3261e] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />

      {groups.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          {t('tools.pdfEditor.annotationsEmpty')}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.pageId} data-testid="pdf-annotation-group">
            <p className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {t('tools.pdfEditor.pageAria', { page: group.page })}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map((object) => {
                const selected = selectedIds.includes(object.id);
                return (
                  <li key={object.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid="pdf-annotation-item"
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => onSelect(object)}
                      className={`min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left ${
                        selected
                          ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'hover:bg-black/[0.04] dark:hover:bg-white/10'
                      }`}
                    >
                      <span className="text-gray-500 dark:text-gray-400">
                        {t(`tools.pdfEditor.${KIND_KEY[object.kind]}`)}
                      </span>
                      {captionOf(object) ? <span className="ml-1">{captionOf(object)}</span> : null}
                    </button>
                    <button
                      type="button"
                      aria-label={t('tools.pdfEditor.annotationDeleteAria')}
                      data-testid="pdf-annotation-delete"
                      onClick={() => onDelete(object.id)}
                      className="shrink-0 rounded px-1 text-gray-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
