import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlowStore, type FlowNode } from '../store';
import { moveNodeLayer, renameNode, toggleHidden, toggleLocked } from '../flowOps';
import { isContainerKind } from '../model/types';

const iconBtn =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded text-[12px] text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700';

interface TreeRow {
  node: FlowNode;
  /** 0 = 顶层；1 = 容器内子节点 */
  depth: number;
  hasChildren: boolean;
}

/** 顶层在前（数组越靠后层级越高），容器行之后紧跟其子节点 */
function buildRows(nodes: FlowNode[], collapsed: ReadonlySet<string>): TreeRow[] {
  const tops = nodes.filter((n) => !n.parentId).reverse();
  const rows: TreeRow[] = [];
  for (const top of tops) {
    const kids = nodes.filter((n) => n.parentId === top.id).reverse();
    rows.push({ node: top, depth: 0, hasChildren: kids.length > 0 });
    if (kids.length > 0 && !collapsed.has(top.id)) {
      for (const kid of kids) rows.push({ node: kid, depth: 1, hasChildren: false });
    }
  }
  return rows;
}

export function LayerPanel() {
  const { t } = useTranslation();
  const nodes = useFlowStore((s) => s.nodes);
  const selectedNodes = useFlowStore((s) => s.selectedNodes);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragId = useRef<string | null>(null);
  const lastClicked = useRef<string | null>(null);

  const rows = useMemo(() => buildRows(nodes, collapsed), [nodes, collapsed]);

  const q = query.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    if (!q) return rows;
    return nodes
      .filter(
        (n) =>
          (n.data.label || '').toLowerCase().includes(q) ||
          t(`tools.flowchart.shape_${n.data.kind}`).toLowerCase().includes(q),
      )
      .map((n) => ({ node: n, depth: n.parentId ? 1 : 0, hasChildren: false }));
    // t 变化时重新计算（语言切换）
  }, [q, rows, nodes, t]);

  /** 选中：普通点击单选，Ctrl/⌘ 点击多选，Shift 点击按显示顺序范围选择 */
  const selectRow = (node: FlowNode, e: React.MouseEvent) => {
    const ids = visibleRows.map((r) => r.node.id);
    const state = useFlowStore.getState();
    let next: string[];
    if (e.shiftKey && lastClicked.current) {
      const a = ids.indexOf(lastClicked.current);
      const b = ids.indexOf(node.id);
      next = a < 0 || b < 0 ? [node.id] : ids.slice(Math.min(a, b), Math.max(a, b) + 1);
    } else if (e.metaKey || e.ctrlKey) {
      next = selectedNodes.includes(node.id)
        ? selectedNodes.filter((id) => id !== node.id)
        : [...selectedNodes, node.id];
      lastClicked.current = node.id;
    } else {
      next = [node.id];
      lastClicked.current = node.id;
    }
    const set = new Set(next);
    useFlowStore.setState({
      selectedNodes: next,
      selectedEdges: [],
      nodes: state.nodes.map((n) =>
        set.has(n.id) ? { ...n, selected: true } : { ...n, selected: false },
      ),
    });
  };

  /** 拖放：拖到容器行 → 归入该容器；拖到普通行 → 排序（或跟随该行的容器） */
  const dropOnRow = (target: FlowNode) => {
    const id = dragId.current;
    dragId.current = null;
    setDragging(false);
    if (!id || id === target.id) return;
    const st = useFlowStore.getState();
    const dragged = st.nodes.find((n) => n.id === id);
    if (!dragged) return;
    if (isContainerKind(target.data.kind)) {
      st.reparentNodeTo(id, target.id);
      return;
    }
    if (target.parentId && !dragged.parentId) {
      st.reparentNodeTo(id, target.parentId);
      return;
    }
    st.reorderNode(id, target.id);
  };

  if (nodes.length === 0) {
    return (
      <p className="p-3 text-center text-[12px] text-gray-400 dark:text-gray-500">
        {t('tools.flowchart.noLayer')}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1 p-1">
      <input
        data-testid="layer-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('tools.flowchart.searchLayer')}
        className="h-7 shrink-0 rounded-md border border-gray-200 bg-white px-2 text-[12px] text-gray-700 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {visibleRows.length === 0 ? (
          <p className="p-2 text-center text-[12px] text-gray-400 dark:text-gray-500">
            {t('tools.flowchart.noShape')}
          </p>
        ) : null}
        {visibleRows.map(({ node, depth, hasChildren }) => {
          const isSelected = selectedNodes.includes(node.id);
          const locked = node.draggable === false;
          const isContainer = isContainerKind(node.data.kind);
          return (
            <div
              key={node.id}
              data-testid="layer-row"
              data-node-id={node.id}
              draggable={!locked}
              onDragStart={(e) => {
                dragId.current = node.id;
                setDragging(true);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', node.id);
              }}
              onDragEnd={() => {
                dragId.current = null;
                setDragging(false);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                dropOnRow(node);
              }}
              onClick={(e) => selectRow(node, e)}
              className={`flex items-center gap-0.5 rounded-md px-1 py-1 transition-colors ${
                isSelected ? 'bg-blue-50 dark:bg-blue-500/10' : ''
              } ${dragging ? 'cursor-grabbing' : ''}`}
              style={{ marginLeft: depth * 12 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className={iconBtn}
                  title={t('tools.flowchart.toggleVisible')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(node.id)) next.delete(node.id);
                      else next.add(node.id);
                      return next;
                    });
                  }}
                >
                  {collapsed.has(node.id) ? '▸' : '▾'}
                </button>
              ) : (
                <span className="w-6 shrink-0" />
              )}

              <button
                type="button"
                className={iconBtn}
                title={t('tools.flowchart.toggleVisible')}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleHidden([node.id]);
                }}
              >
                {node.hidden ? '◌' : '●'}
              </button>
              <button
                type="button"
                className={iconBtn}
                title={t('tools.flowchart.toggleLock')}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLocked([node.id]);
                }}
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
                    // 阻止冒泡：提交后输入框卸载，避免全局快捷键误判为画布操作
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
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
                  onDoubleClick={() => {
                    setEditingId(node.id);
                    setDraft(node.data.label);
                  }}
                  title={t('tools.flowchart.renameHint')}
                >
                  {isContainer ? '▤ ' : ''}
                  {node.data.label || t(`tools.flowchart.shape_${node.data.kind}`)}
                </button>
              )}

              {node.parentId ? (
                <button
                  type="button"
                  className={iconBtn}
                  data-testid="layer-move-out"
                  title={t('tools.flowchart.moveOut')}
                  onClick={(e) => {
                    e.stopPropagation();
                    useFlowStore.getState().reparentNodeTo(node.id, undefined);
                  }}
                >
                  ⊟
                </button>
              ) : null}

              <button
                type="button"
                className={iconBtn}
                title={t('tools.flowchart.layerForward')}
                onClick={(e) => {
                  e.stopPropagation();
                  moveNodeLayer(node.id, 'forward');
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className={iconBtn}
                title={t('tools.flowchart.layerBackward')}
                onClick={(e) => {
                  e.stopPropagation();
                  moveNodeLayer(node.id, 'backward');
                }}
              >
                ↓
              </button>
            </div>
          );
        })}
      </div>

      {dragging ? (
        <div
          data-testid="layer-drop-root"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = dragId.current;
            dragId.current = null;
            setDragging(false);
            if (id) useFlowStore.getState().reparentNodeTo(id, undefined);
          }}
          className="shrink-0 rounded-md border border-dashed border-blue-400 bg-blue-50/60 px-2 py-1.5 text-center text-[11px] text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
        >
          {t('tools.flowchart.dropToRoot')}
        </div>
      ) : null}
    </div>
  );
}
