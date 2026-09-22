import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import { useMindStore } from '../store';
import { childrenOf, visibleChildrenOf } from '../model/tree';
import type { MindDoc } from '../model/types';

interface Row {
  id: string;
  depth: number;
  text: string;
  hasChildren: boolean;
  collapsed: boolean;
}

function buildRows(doc: MindDoc): Row[] {
  const rows: Row[] = [];
  const walk = (id: string, depth: number) => {
    const rec = doc.nodes.find((n) => n.id === id);
    if (!rec) return;
    rows.push({
      id,
      depth,
      text: rec.text,
      hasChildren: childrenOf(doc.nodes, id).length > 0,
      collapsed: rec.collapsed === true,
    });
    for (const child of visibleChildrenOf(doc.nodes, id)) walk(child.id, depth + 1);
  };
  walk(doc.rootId, 0);
  return rows;
}

export function OutlinePanel() {
  const { t } = useTranslation();
  const { setCenter } = useReactFlow();
  const doc = useMindStore((s) => s.doc);
  const layout = useMindStore((s) => s.layout);
  const selectedId = useMindStore((s) => s.selectedId);
  const select = useMindStore((s) => s.select);
  const toggleCollapseAt = useMindStore((s) => s.toggleCollapseAt);

  const rows = useMemo(() => buildRows(doc), [doc]);
  const boxOf = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  /** 选中并把该节点居中显示 */
  const focus = (id: string) => {
    select(id);
    const box = boxOf.get(id);
    if (box) setCenter(box.x + box.width / 2, box.y + box.height / 2, { zoom: 1, duration: 260 });
  };

  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40">
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('tools.mindmap.outlineTitle')}
        </h2>
        <span className="text-[11px] text-gray-400">{rows.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`flex items-center gap-1 rounded-md px-1 py-[3px] text-[12px] transition-colors ${
              row.id === selectedId
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60'
            }`}
            style={{ paddingLeft: 4 + row.depth * 12 }}
          >
            {row.hasChildren ? (
              <button
                type="button"
                aria-label={row.collapsed ? t('tools.mindmap.expand') : t('tools.mindmap.collapse')}
                onClick={() => toggleCollapseAt(row.id)}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {row.collapsed ? '▸' : '▾'}
              </button>
            ) : (
              <span className="h-4 w-4 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => focus(row.id)}
              className="min-w-0 flex-1 truncate text-left"
              title={row.text}
            >
              {row.text || t('tools.mindmap.untitled')}
            </button>
          </div>
        ))}
      </div>

      <p className="border-t border-gray-200 pt-2 text-[11px] leading-relaxed text-gray-400 dark:border-gray-700 dark:text-gray-500">
        {t('tools.mindmap.outlineHint')}
      </p>
    </aside>
  );
}
