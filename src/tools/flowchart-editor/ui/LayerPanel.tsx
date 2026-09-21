import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { moveNodeLayer, renameNode, toggleHidden, toggleLocked } from '../flowOps';

const iconBtn =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded text-[12px] text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700';

export function LayerPanel() {
  const { t } = useTranslation();
  const nodes = useFlowStore((s) => s.nodes);
  const selectedNodes = useFlowStore((s) => s.selectedNodes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // 数组越靠后层级越高，列表按「顶层在前」展示
  const items = [...nodes].reverse();

  if (items.length === 0) {
    return (
      <p className="p-3 text-center text-[12px] text-gray-400 dark:text-gray-500">
        {t('tools.flowchart.noLayer')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-1">
      {items.map((node) => {
        const isSelected = selectedNodes.includes(node.id);
        const locked = node.draggable === false;
        return (
          <div
            key={node.id}
            className={`flex items-center gap-0.5 rounded-md px-1 py-1 transition-colors ${
              isSelected ? 'bg-blue-50 dark:bg-blue-500/10' : ''
            }`}
          >
            <button
              type="button"
              className={iconBtn}
              title={t('tools.flowchart.toggleVisible')}
              onClick={() => toggleHidden([node.id])}
            >
              {node.hidden ? '◌' : '●'}
            </button>
            <button
              type="button"
              className={iconBtn}
              title={t('tools.flowchart.toggleLock')}
              onClick={() => toggleLocked([node.id])}
            >
              {locked ? '🔒' : '🔓'}
            </button>

            {editingId === node.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  renameNode(node.id, draft.trim() || node.data.label);
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renameNode(node.id, draft.trim() || node.data.label);
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 text-[12px] outline-none dark:bg-gray-900"
              />
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 truncate px-1 text-left text-[12px] text-gray-700 dark:text-gray-200"
                onClick={() =>
                  useFlowStore.setState((s) => ({
                    selectedNodes: [node.id],
                    selectedEdges: [],
                    nodes: s.nodes.map((n) => ({ ...n, selected: n.id === node.id })),
                  }))
                }
                onDoubleClick={() => {
                  setEditingId(node.id);
                  setDraft(node.data.label);
                }}
                title={t('tools.flowchart.renameHint')}
              >
                {node.data.label || t(`tools.flowchart.shape_${node.data.kind}`)}
              </button>
            )}

            <button
              type="button"
              className={iconBtn}
              title={t('tools.flowchart.layerForward')}
              onClick={() => moveNodeLayer(node.id, 'forward')}
            >
              ↑
            </button>
            <button
              type="button"
              className={iconBtn}
              title={t('tools.flowchart.layerBackward')}
              onClick={() => moveNodeLayer(node.id, 'backward')}
            >
              ↓
            </button>
          </div>
        );
      })}
    </div>
  );
}
