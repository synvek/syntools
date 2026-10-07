import { beforeEach, describe, expect, it } from 'vitest';
import { useFlowStore } from './store';
import { absolutePositionOf } from './core';
import { buildTemplateDoc } from './model/templates';

describe('多页', () => {
  beforeEach(() => {
    useFlowStore.getState().load(null);
  });

  it('初始只有一页', () => {
    expect(useFlowStore.getState().pageOrder).toHaveLength(1);
    expect(useFlowStore.getState().nodes).toHaveLength(0);
  });

  it('新建页面会切换过去，原页内容不丢', () => {
    useFlowStore.getState().load(buildTemplateDoc('basic'));
    const first = useFlowStore.getState().activePageId;
    expect(useFlowStore.getState().nodes.length).toBeGreaterThan(0);

    useFlowStore.getState().addPage('第二页');
    expect(useFlowStore.getState().pageOrder).toHaveLength(2);
    expect(useFlowStore.getState().activePageId).not.toBe(first);
    expect(useFlowStore.getState().nodes).toHaveLength(0);

    useFlowStore.getState().switchPage(first);
    expect(useFlowStore.getState().nodes.length).toBeGreaterThan(0);
  });

  it('重命名页面', () => {
    useFlowStore.getState().addPage('B');
    const id = useFlowStore.getState().pageOrder[1].id;
    useFlowStore.getState().renamePage(id, 'B2');
    expect(useFlowStore.getState().pageOrder[1].name).toBe('B2');
    // 空名称不生效
    useFlowStore.getState().renamePage(id, '  ');
    expect(useFlowStore.getState().pageOrder[1].name).toBe('B2');
  });

  it('左右移动页面顺序', () => {
    useFlowStore.getState().addPage('B');
    const ids = useFlowStore.getState().pageOrder.map((p) => p.id);
    useFlowStore.getState().movePage(ids[1], -1);
    expect(useFlowStore.getState().pageOrder[0].id).toBe(ids[1]);
    useFlowStore.getState().movePage(ids[1], 1);
    expect(useFlowStore.getState().pageOrder[1].id).toBe(ids[1]);
  });

  it('删除当前页会切到相邻页，且至少保留一页', () => {
    useFlowStore.getState().addPage('X');
    useFlowStore.getState().removePage(useFlowStore.getState().activePageId);
    expect(useFlowStore.getState().pageOrder).toHaveLength(1);
    // 只剩一页时不允许删除
    useFlowStore.getState().removePage(useFlowStore.getState().activePageId);
    expect(useFlowStore.getState().pageOrder).toHaveLength(1);
  });

  it('导出的文档包含所有页并标记活动页', () => {
    useFlowStore.getState().load(buildTemplateDoc('basic'));
    useFlowStore.getState().addPage('第二页');
    const doc = useFlowStore.getState().getDoc();
    expect(doc.version).toBe(2);
    expect(doc.pages).toHaveLength(2);
    expect(doc.activePageId).toBe(useFlowStore.getState().activePageId);
  });
});

describe('批量编辑与微移', () => {
  beforeEach(() => {
    useFlowStore.getState().load(buildTemplateDoc('basic'));
  });

  it('selectAll 选中全部节点与连线', () => {
    const st = useFlowStore.getState();
    const nodeCount = st.nodes.length;
    const edgeCount = st.edges.length;
    st.selectAll();
    expect(useFlowStore.getState().selectedNodes).toHaveLength(nodeCount);
    expect(useFlowStore.getState().selectedEdges).toHaveLength(edgeCount);
  });

  it('nudgeSelected 按位移移动选中节点（锁定节点除外）', () => {
    const st = useFlowStore.getState();
    const target = st.nodes[0];
    useFlowStore.setState({ selectedNodes: [target.id] });
    useFlowStore.getState().nudgeSelected(5, -3);
    const moved = useFlowStore.getState().nodes.find((n) => n.id === target.id)!;
    expect(moved.position).toEqual({ x: target.position.x + 5, y: target.position.y - 3 });
  });

  it('patchSelected 批量写入样式（一次撤销即可整体回退）', () => {
    const st = useFlowStore.getState();
    const ids = st.nodes.slice(0, 2).map((n) => n.id);
    const before = ids.map((id) => st.nodes.find((n) => n.id === id)!.data.style.fill);
    useFlowStore.setState({ selectedNodes: ids });

    st.patchSelected({ style: { fill: '#abcdef' } }, true);
    for (const id of ids) {
      expect(useFlowStore.getState().nodes.find((n) => n.id === id)!.data.style.fill).toBe(
        '#abcdef',
      );
    }

    // 一次 undo 把两个节点一起还原（批量改动只产生一条历史记录）
    useFlowStore.getState().undo();
    ids.forEach((id, i) => {
      expect(useFlowStore.getState().nodes.find((n) => n.id === id)!.data.style.fill).toBe(
        before[i],
      );
    });
  });

  it('撤销/重做：删除节点后可完整恢复（含层级顺序）', () => {
    const ids = useFlowStore.getState().nodes.map((n) => n.id);
    useFlowStore.setState({ selectedNodes: [ids[1]] });
    useFlowStore.getState().removeSelected();
    expect(useFlowStore.getState().nodes.some((n) => n.id === ids[1])).toBe(false);

    useFlowStore.getState().undo();
    expect(useFlowStore.getState().nodes.map((n) => n.id)).toEqual(ids);

    useFlowStore.getState().redo();
    expect(useFlowStore.getState().nodes.some((n) => n.id === ids[1])).toBe(false);
  });

  it('历史记录只包含变更条目（结构 diff，而非整图快照）', () => {
    const st = useFlowStore.getState();
    const first = st.nodes[0].id;
    useFlowStore.setState({ selectedNodes: [first] });
    st.patchSelected({ style: { fill: '#123456' } }, true);

    // 第二次改动触发上一条变更的结算
    useFlowStore.setState({ selectedNodes: [st.nodes[1].id] });
    useFlowStore.getState().patchSelected({ style: { fill: '#654321' } }, true);

    const past = useFlowStore.getState().past;
    expect(past).toHaveLength(1);
    expect(past[0].nodes).toHaveLength(1);
    expect(past[0].nodes[0].id).toBe(first);
    expect(past[0].edges).toHaveLength(0);
    expect(past[0].nodes[0].before).toBeDefined();
    expect(past[0].nodes[0].after).toBeDefined();
  });

  it('网格吸附设置可读写', () => {
    expect(useFlowStore.getState().gridEnabled).toBe(true);
    useFlowStore.getState().setGridEnabled(false);
    useFlowStore.getState().setGridSize(20);
    expect(useFlowStore.getState().gridEnabled).toBe(false);
    expect(useFlowStore.getState().gridSize).toBe(20);
    // 复原，避免影响其它用例
    useFlowStore.getState().setGridEnabled(true);
    useFlowStore.getState().setGridSize(10);
  });
});

describe('选择清空与形状切换', () => {
  beforeEach(() => {
    useFlowStore.getState().load(buildTemplateDoc('basic'));
  });

  it('clearSelection 清空节点与连线的选中态', () => {
    useFlowStore.getState().selectAll();
    expect(useFlowStore.getState().selectedNodes.length).toBeGreaterThan(0);
    expect(useFlowStore.getState().selectedEdges.length).toBeGreaterThan(0);

    useFlowStore.getState().clearSelection();
    const st = useFlowStore.getState();
    expect(st.selectedNodes).toEqual([]);
    expect(st.selectedEdges).toEqual([]);
    expect(st.nodes.every((n) => !n.selected)).toBe(true);
    expect(st.edges.every((e) => !e.selected)).toBe(true);
  });

  it('changeNodeKind 仅替换图形与尺寸，保留文本与用户样式', () => {
    const target = useFlowStore.getState().nodes[0];
    useFlowStore.setState({ selectedNodes: [target.id] });
    useFlowStore
      .getState()
      .patchSelected({ label: '我的步骤', style: { fill: '#abcdef', fontSize: 20 } }, true);

    const nextKind = target.data.kind === 'rect' ? 'ellipse' : 'rect';
    useFlowStore.getState().changeNodeKind(target.id, nextKind);

    const changed = useFlowStore.getState().nodes.find((n) => n.id === target.id)!;
    expect(changed.data.kind).toBe(nextKind);
    expect(changed.data.label).toBe('我的步骤');
    expect(changed.data.style.fill).toBe('#abcdef');
    expect(changed.data.style.fontSize).toBe(20);

    // 换形状可撤销回原图形
    useFlowStore.getState().undo();
    expect(useFlowStore.getState().nodes.find((n) => n.id === target.id)!.data.kind).toBe(
      target.data.kind,
    );
  });
});

describe('getDoc 序列化记忆化', () => {
  beforeEach(() => {
    useFlowStore.getState().load(buildTemplateDoc('basic'));
  });

  it('未编辑时复用同一活动页记录，编辑后反映最新内容', () => {
    const doc1 = useFlowStore.getState().getDoc();
    const doc2 = useFlowStore.getState().getDoc();
    expect(doc2.pages[0].nodes).toBe(doc1.pages[0].nodes);

    useFlowStore.getState().addNode('rect', { x: 0, y: 0 });
    const doc3 = useFlowStore.getState().getDoc();
    expect(doc3.pages[0].nodes).toHaveLength(doc1.pages[0].nodes.length + 1);
  });
});

describe('几何编辑与折点吸附', () => {
  beforeEach(() => {
    useFlowStore.getState().load(buildTemplateDoc('swimlane'));
    useFlowStore.getState().setGridEnabled(true);
    useFlowStore.getState().setGridSize(10);
  });

  it('setNodeGeometry 写入绝对坐标与尺寸，且一次撤销可回退', () => {
    useFlowStore.getState().addNode('rect', { x: 900, y: 900 });
    const id = useFlowStore.getState().selectedNodes[0];
    const absOf = (nodeId: string) => {
      const nodes = useFlowStore.getState().nodes;
      const byId = new Map(nodes.map((n) => [n.id, n] as const));
      return absolutePositionOf(byId.get(nodeId)!, byId);
    };

    useFlowStore.getState().setNodeGeometry([id], { x: 123, y: 45, width: 300, height: 120 });
    const changed = useFlowStore.getState().nodes.find((n) => n.id === id)!;
    expect(absOf(id)).toEqual({ x: 123, y: 45 });
    expect(changed.width).toBe(300);
    expect(changed.height).toBe(120);

    useFlowStore.getState().undo();
    expect(absOf(id)).toEqual({ x: 900, y: 900 });
  });

  it('子节点按画布绝对坐标换算为相对坐标', () => {
    const st = useFlowStore.getState();
    const child = st.nodes.find((n) => n.parentId)!;
    const byId = new Map(st.nodes.map((n) => [n.id, n] as const));
    const abs = absolutePositionOf(child, byId);

    useFlowStore.getState().setNodeGeometry([child.id], { x: abs.x + 60, y: abs.y + 30 });
    const next = useFlowStore.getState().nodes.find((n) => n.id === child.id)!;
    const nextById = new Map(useFlowStore.getState().nodes.map((n) => [n.id, n] as const));
    const nextAbs = absolutePositionOf(next, nextById);
    expect(nextAbs.x).toBeCloseTo(abs.x + 60);
    expect(nextAbs.y).toBeCloseTo(abs.y + 30);
  });

  it('尺寸不小于下限（普通节点）', () => {
    useFlowStore.getState().addNode('rect', { x: 900, y: 900 });
    const id = useFlowStore.getState().selectedNodes[0];
    useFlowStore.getState().setNodeGeometry([id], { width: 1, height: 1 });
    const changed = useFlowStore.getState().nodes.find((n) => n.id === id)!;
    expect(changed.width).toBe(48);
    expect(changed.height).toBe(32);
  });

  it('setEdgeWaypoints 在网格吸附开启时对齐到网格', () => {
    const st = useFlowStore.getState();
    useFlowStore.getState().setEdgeWaypoints(st.edges[0].id, [
      { x: 13, y: 27 },
      { x: 108, y: 92 },
    ]);
    const edge = useFlowStore.getState().edges[0];
    const waypoints = (edge.data as { waypoints?: Array<{ x: number; y: number }> }).waypoints;
    expect(waypoints).toEqual([
      { x: 10, y: 30 },
      { x: 110, y: 90 },
    ]);
  });

  it('网格吸附关闭时折点仅取整', () => {
    useFlowStore.getState().setGridEnabled(false);
    const st = useFlowStore.getState();
    useFlowStore.getState().setEdgeWaypoints(st.edges[0].id, [{ x: 13.4, y: 27.6 }]);
    const edge = useFlowStore.getState().edges[0];
    const waypoints = (edge.data as { waypoints?: Array<{ x: number; y: number }> }).waypoints;
    expect(waypoints).toEqual([{ x: 13, y: 28 }]);
  });
});

describe('图层面板拖放', () => {
  beforeEach(() => {
    useFlowStore.getState().load(buildTemplateDoc('swimlane'));
  });

  it('reparentNodeTo 把顶层节点放进泳道并夹进容器内部', () => {
    const lane = useFlowStore.getState().nodes.find((n) => n.data.kind === 'swimlane')!;
    useFlowStore.getState().addNode('rect', { x: 3000, y: 3000 });
    const added = useFlowStore.getState().selectedNodes[0];

    useFlowStore.getState().reparentNodeTo(added, lane.id);
    const moved = useFlowStore.getState().nodes.find((n) => n.id === added)!;
    expect(moved.parentId).toBe(lane.id);
    expect(moved.position.x).toBeGreaterThanOrEqual(0);
    expect(moved.position.y).toBeGreaterThanOrEqual(0);
  });

  it('reparentNodeTo(id, undefined) 移出容器并保留画布绝对位置', () => {
    const child = useFlowStore.getState().nodes.find((n) => n.parentId)!;
    useFlowStore.getState().reparentNodeTo(child.id, undefined);
    const moved = useFlowStore.getState().nodes.find((n) => n.id === child.id)!;
    expect(moved.parentId ?? null).toBeNull();
  });

  it('容器不能被放进另一个容器', () => {
    const lane = useFlowStore.getState().nodes.find((n) => n.data.kind === 'swimlane')!;
    useFlowStore.getState().addNode('swimlane', { x: 3000, y: 3000 });
    const added = useFlowStore.getState().selectedNodes[0];
    useFlowStore.getState().reparentNodeTo(added, lane.id);
    expect(useFlowStore.getState().nodes.find((n) => n.id === added)!.parentId ?? null).toBeNull();
  });

  it('reorderNode 调整顺序且容器仍排在子节点之前', () => {
    const ids = useFlowStore.getState().nodes.map((n) => n.id);
    const lakeId = ids[0];
    const lastId = ids[ids.length - 1];
    useFlowStore.getState().reorderNode(lakeId, lastId);
    const after = useFlowStore.getState().nodes;
    const childIndexes = after.map((n, i) => (n.parentId ? i : -1)).filter((i) => i >= 0);
    expect(Math.min(...childIndexes)).toBeGreaterThan(
      after.findIndex((n) => n.data.kind === 'swimlane'),
    );
  });
});

describe('版本快照', () => {
  beforeEach(() => {
    useFlowStore.getState().load(null);
    // 快照是全局会话态，测试之间需显式清空以保证隔离
    useFlowStore.setState({ snapshots: [] });
  });

  it('保存快照后可回滚', () => {
    useFlowStore.getState().load(buildTemplateDoc('basic'));
    const before = useFlowStore.getState().nodes.length;
    useFlowStore.getState().saveSnapshot('v1');

    // 改动画布后回滚
    useFlowStore.getState().clear();
    expect(useFlowStore.getState().nodes).toHaveLength(0);

    const snap = useFlowStore.getState().snapshots[0];
    expect(snap.name).toBe('v1');
    useFlowStore.getState().restoreSnapshot(snap.id);
    expect(useFlowStore.getState().nodes).toHaveLength(before);
  });

  it('删除快照', () => {
    useFlowStore.getState().saveSnapshot('a');
    useFlowStore.getState().saveSnapshot('b');
    expect(useFlowStore.getState().snapshots).toHaveLength(2);
    useFlowStore.getState().deleteSnapshot(useFlowStore.getState().snapshots[0].id);
    expect(useFlowStore.getState().snapshots).toHaveLength(1);
  });
});
