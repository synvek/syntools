import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { useMindStore } from '../store';
import { defaultShapeOf, defaultStyleOf, themeOf } from '../model/themes';
import { childrenOf } from '../model/tree';
import { MindNode, type MindNodeData } from '../nodes/MindNode';
import { MindEdge } from '../nodes/MindEdge';

const nodeTypes = { mind: MindNode };
const edgeTypes = { mind: MindEdge };
const defaultEdgeOptions = { type: 'mind' };

type MindFlowNode = Node<MindNodeData>;

const MindInner = forwardRef<HTMLDivElement>(function MindInner(_props, ref) {
  const doc = useMindStore((s) => s.doc);
  const layout = useMindStore((s) => s.layout);
  const selectedId = useMindStore((s) => s.selectedId);
  const select = useMindStore((s) => s.select);
  const reparentAt = useMindStore((s) => s.reparentAt);
  const { getIntersectingNodes } = useReactFlow();

  const theme = themeOf(doc.themeId);
  const recById = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc.nodes]);

  const derived = useMemo<MindFlowNode[]>(
    () =>
      layout.nodes.map((l) => {
        const rec = recById.get(l.id);
        const base = defaultStyleOf(theme, l.depth, l.color);
        const style = { ...base, ...(rec?.style ?? {}) };
        const childCount = rec ? childrenOf(doc.nodes, rec.id).length : 0;
        const data: MindNodeData = {
          text: rec?.text ?? '',
          depth: l.depth,
          color: l.color,
          fill: style.fill,
          stroke: style.stroke,
          textColor: style.textColor,
          fontSize: style.fontSize,
          bold: style.bold,
          italic: style.italic,
          align: style.align,
          shape: rec?.shape ?? defaultShapeOf(theme, l.depth),
          collapsed: rec?.collapsed === true,
          childCount,
          direction: doc.direction,
          side: l.side,
          isRoot: l.depth === 0,
        };
        return {
          id: l.id,
          type: 'mind',
          position: { x: l.x, y: l.y },
          width: l.width,
          height: l.height,
          selected: l.id === selectedId,
          data,
        };
      }),
    [layout, recById, doc.nodes, doc.direction, theme, selectedId],
  );

  const derivedEdges = useMemo<Edge[]>(() => {
    const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
    return layout.edges.map((e) => {
      const fromRoot = nodeById.get(e.source)?.depth === 0;
      const width = fromRoot ? theme.lineWidth : Math.max(1.5, theme.lineWidth - 1);
      // 端点锚点按「布局方向 + 分支所在侧」选择，左右分布时左侧分支从左边引出
      const side = nodeById.get(e.target)?.side ?? 'right';
      const down = doc.direction === 'down';
      const sourceHandle = down ? 'out-b' : side === 'left' ? 'out-l' : 'out-r';
      const targetHandle = down ? 'in-t' : side === 'left' ? 'in-r' : 'in-l';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle,
        targetHandle,
        type: 'mind',
        data: { color: e.color, width },
      };
    });
  }, [layout, doc.direction, theme]);

  // 拖拽期间本地保存位置，松手后由布局结果复位（或改挂父节点后重排）
  const [nodes, setNodes] = useState<MindFlowNode[]>(derived);
  useEffect(() => {
    setNodes(derived);
  }, [derived]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns) as MindFlowNode[]),
    [],
  );

  /** 是否刚发生过拖拽：拖完的 click 不应进入编辑态 */
  const draggedRef = useRef(false);

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      draggedRef.current = true;
      const hits = getIntersectingNodes({ id: node.id }).filter((n) => n.id !== node.id);
      const target = hits[0];
      if (target) {
        reparentAt(node.id, target.id);
        return;
      }
      setNodes(derived);
    },
    [getIntersectingNodes, reparentAt, derived],
  );

  /**
   * 单击已选中的节点直接进入文本编辑：
   * 「再点一次」即可改名，慢速双击（两次单击间隔超过系统双击阈值）同样生效。
   */
  const onNodeClick = useCallback(
    (_event: unknown, node: Node) => {
      if (draggedRef.current) {
        draggedRef.current = false;
        select(node.id);
        return;
      }
      const state = useMindStore.getState();
      if (state.selectedId === node.id) {
        state.beginEdit(node.id);
        return;
      }
      select(node.id);
    },
    [select],
  );

  return (
    <div ref={ref} className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={derivedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        // 由 React Flow 在节点层派发双击：节点内任意位置（含留白）双击都能进入文本编辑
        onNodeDoubleClick={(_, node) => useMindStore.getState().beginEdit(node.id)}
        onPaneClick={() => select(null)}
        onNodeDragStart={() => {
          draggedRef.current = true;
        }}
        onNodeDragStop={onNodeDragStop}
        // 绘图工具习惯：左键拖出选框，中键/右键平移画布
        selectionOnDrag
        panOnDrag={[1, 2]}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomOnPinch
        // 双击节点用于进入文本编辑，避免同时触发画布缩放
        zoomOnDoubleClick={false}
        multiSelectionKeyCode={null}
        minZoom={0.2}
        maxZoom={2.5}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-50 dark:bg-gray-950"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.data as MindNodeData)?.color ?? '#cbd5e1'}
          className="!bottom-2 !right-2 !h-24 !w-36 rounded-md border border-gray-200 bg-white/90 dark:border-gray-700 dark:bg-gray-900/90"
        />
      </ReactFlow>
    </div>
  );
});

export function MindCanvas(props: { containerRef?: React.Ref<HTMLDivElement> }) {
  return <MindInner ref={props.containerRef} />;
}
