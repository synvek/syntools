import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { isContainerKind } from '../model/types';

/** Duration of the hit highlight (ms) */
const HIGHLIGHT_MS = 1400;

/**
 * Full-graph search: filter and locate by node text (including container titles).
 *
 * Clicking a result selects that node and asks the parent to center the viewport;
 * a one-shot CSS class provides the brief highlight, avoiding a new store state just for it.
 */
export function SearchPanel({ onLocate }: { onLocate: (nodeId: string) => void }) {
  const { t } = useTranslation();
  const nodes = useFlowStore((s) => s.nodes);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    const withLabel = nodes.filter((n) => typeof n.data.label === 'string' && n.data.label);
    if (!q) return withLabel.slice(0, 50);
    return withLabel.filter((n) => n.data.label.toLowerCase().includes(q)).slice(0, 100);
  }, [nodes, q]);

  const locate = (id: string) => {
    // Select + briefly highlight (add the class directly on the DOM; the parent centers the viewport)
    useFlowStore.setState((s) => ({
      selectedNodes: [id],
      selectedEdges: [],
      nodes: s.nodes.map((n) =>
        n.selected === (n.id === id) ? n : { ...n, selected: n.id === id },
      ),
      edges: s.edges.some((e) => e.selected)
        ? s.edges.map((e) => (e.selected ? { ...e, selected: false } : e))
        : s.edges,
    }));
    onLocate(id);
    const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    if (el) {
      el.classList.add('flow-node-highlight');
      window.setTimeout(() => el.classList.remove('flow-node-highlight'), HIGHLIGHT_MS);
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 p-1">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('tools.flowchart.searchNodes')}
      </h2>
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('tools.flowchart.searchNodesPlaceholder')}
        data-testid="flowchart-node-search"
        className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none placeholder:text-gray-400 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />

      {results.length === 0 ? (
        <p className="mt-2 text-center text-[12px] text-gray-400 dark:text-gray-500">
          {t('tools.flowchart.searchNoResult')}
        </p>
      ) : (
        <ul
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
          data-testid="flowchart-node-search-results"
        >
          {results.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                data-testid="flowchart-node-search-item"
                onClick={() => locate(n.id)}
                className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left text-[12px] text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:text-gray-200 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10"
              >
                <span className="truncate">{n.data.label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                  {isContainerKind(n.data.kind)
                    ? t('tools.flowchart.container')
                    : t(`tools.flowchart.shape_${n.data.kind}`)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
