import { beforeEach, describe, expect, it } from 'vitest';
import { useFlowStore } from './store';
import { buildTemplateDoc } from './model/templates';
import {
  alignSelected,
  applyTheme,
  copyNodeStyle,
  groupSelected,
  layerOp,
  pasteNodeStyle,
  toggleHidden,
  toggleLocked,
  ungroupSelected,
} from './flowOps';

function selectNodes(ids: string[]) {
  useFlowStore.setState({ selectedNodes: ids, selectedEdges: [] });
}

describe('主题 / 样式预设', () => {
  beforeEach(() => {
    useFlowStore.getState().load(buildTemplateDoc('basic'));
  });

  it('应用到整图：节点与连线样式同时生效', () => {
    applyTheme('dark', 'all');
    const state = useFlowStore.getState();
    for (const node of state.nodes) {
      expect(node.data.style.fill).toBe('#1E293B');
    }
    for (const edge of state.edges) {
      expect((edge.data as { style?: { stroke: string } }).style?.stroke).toBe('#CBD5E1');
    }
  });

  it('应用到选中：只影响选中的元素，且一次撤销可回退', () => {
    const before = useFlowStore.getState().nodes.map((n) => n.data.style.fill);
    const target = useFlowStore.getState().nodes[0].id;
    selectNodes([target]);

    applyTheme('minimal', 'selection');
    const state = useFlowStore.getState();
    expect(state.nodes[0].data.style.fill).toBe('#FFFFFF');
    expect(state.nodes[1].data.style.fill).toBe(before[1]);

    useFlowStore.getState().undo();
    expect(useFlowStore.getState().nodes[0].data.style.fill).toBe(before[0]);
  });

  it('未选中元素时应用范围=选中不产生任何改动', () => {
    useFlowStore.setState({ selectedNodes: [], selectedEdges: [] });
    applyTheme('dark', 'selection');
    expect(useFlowStore.getState().past).toHaveLength(0);
  });
});

describe('格式刷', () => {
  beforeEach(() => {
    useFlowStore.getState().load(buildTemplateDoc('basic'));
  });

  it('复制样式后粘贴到其它节点', () => {
    const [first, second] = useFlowStore.getState().nodes;
    selectNodes([first.id]);
    useFlowStore.getState().patchSelected({ style: { fill: '#111111', italic: true } }, true);
    expect(copyNodeStyle()).toBe(true);

    selectNodes([second.id]);
    pasteNodeStyle();
    const target = useFlowStore.getState().nodes.find((n) => n.id === second.id)!;
    expect(target.data.style.fill).toBe('#111111');
    expect(target.data.style.italic).toBe(true);
  });

  it('未复制样式时粘贴无副作用；未选中节点时复制失败', () => {
    useFlowStore.setState({ styleBrush: null, selectedNodes: [] });
    pasteNodeStyle();
    expect(useFlowStore.getState().past).toHaveLength(0);
    expect(copyNodeStyle()).toBe(false);
  });
});

describe('编组与图层', () => {
  beforeEach(() => {
    useFlowStore.getState().load(buildTemplateDoc('basic'));
  });

  it('编组后子节点挂在新容器下，解组后回到顶层', () => {
    const ids = useFlowStore
      .getState()
      .nodes.slice(0, 2)
      .map((n) => n.id);
    selectNodes(ids);
    groupSelected();

    const group = useFlowStore.getState().nodes.find((n) => n.data.kind === 'group')!;
    expect(group).toBeDefined();
    for (const id of ids) {
      expect(useFlowStore.getState().nodes.find((n) => n.id === id)!.parentId).toBe(group.id);
    }

    selectNodes([group.id]);
    ungroupSelected();
    for (const id of ids) {
      expect(useFlowStore.getState().nodes.find((n) => n.id === id)!.parentId ?? null).toBeNull();
    }
  });

  it('对齐 / 层级 / 隐藏 / 锁定 都是可撤销的单步操作', () => {
    const ids = useFlowStore.getState().nodes.map((n) => n.id);
    selectNodes(ids);
    alignSelected('left');
    layerOp('front');
    toggleHidden([ids[0]]);
    toggleLocked([ids[1]]);

    const state = useFlowStore.getState();
    expect(state.nodes.find((n) => n.id === ids[0])!.hidden).toBe(true);
    expect(state.nodes.find((n) => n.id === ids[1])!.draggable).toBe(false);

    useFlowStore.getState().undo();
    expect(useFlowStore.getState().nodes.find((n) => n.id === ids[1])!.draggable).not.toBe(false);
  });
});
