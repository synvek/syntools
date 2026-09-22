import { beforeEach, describe, expect, it } from 'vitest';
import { useMindStore } from './store';
import { buildMindTemplate } from './model/templates';

describe('脑图 store', () => {
  beforeEach(() => {
    useMindStore.getState().load(null);
  });

  it('初始状态只有中心主题且被选中', () => {
    const state = useMindStore.getState();
    expect(state.doc.nodes).toHaveLength(1);
    expect(state.selectedId).toBe(state.doc.rootId);
    expect(state.layout.nodes).toHaveLength(1);
  });

  it('Tab 建子主题：带默认英文文案并进入编辑态，节点与连线同步增加', () => {
    useMindStore.getState().addChildOf();
    const state = useMindStore.getState();
    expect(state.doc.nodes).toHaveLength(2);
    expect(state.layout.nodes).toHaveLength(2);
    expect(state.layout.edges).toHaveLength(1);
    expect(state.editingId).toBe(state.selectedId);
    const created = state.doc.nodes.find((n) => n.id === state.selectedId)!;
    expect(created.text).toBe('Subtopic');
  });

  it('Enter 建同级主题：中心主题下新增子主题，已有同级时新增 Topic', () => {
    useMindStore.getState().addSiblingOf();
    const state = useMindStore.getState();
    expect(state.doc.nodes).toHaveLength(2);
    expect(state.doc.nodes[1].parentId).toBe(state.doc.rootId);
    // 中心主题没有同级，退化为新增子主题（文案用同级的默认 Topic）
    expect(state.doc.nodes[1].text).toBe('Topic');

    useMindStore.getState().endEdit();
    useMindStore.getState().addSiblingOf();
    const after = useMindStore.getState();
    expect(after.doc.nodes).toHaveLength(3);
    expect(after.doc.nodes.find((n) => n.id === after.selectedId)?.text).toBe('Topic');
  });

  it('中心主题不可删除', () => {
    useMindStore.getState().select(useMindStore.getState().doc.rootId);
    useMindStore.getState().removeAt();
    expect(useMindStore.getState().doc.nodes).toHaveLength(1);
  });

  it('删除子主题后选中回到父级，且可撤销恢复', () => {
    useMindStore.getState().addChildOf();
    const childId = useMindStore.getState().selectedId!;
    useMindStore.getState().endEdit();
    useMindStore.getState().removeAt();
    expect(useMindStore.getState().doc.nodes).toHaveLength(1);
    expect(useMindStore.getState().selectedId).toBe(useMindStore.getState().doc.rootId);

    useMindStore.getState().undo();
    const restored = useMindStore.getState();
    expect(restored.doc.nodes).toHaveLength(2);
    expect(restored.doc.nodes.some((n) => n.id === childId)).toBe(true);
    useMindStore.getState().redo();
    expect(useMindStore.getState().doc.nodes).toHaveLength(1);
  });

  it('moveAt(null) 作用于当前选中项而非根节点', () => {
    const store = useMindStore.getState();
    store.addChildOf();
    store.endEdit();
    const first = useMindStore.getState().selectedId!;
    useMindStore.getState().addSiblingOf();
    useMindStore.getState().endEdit();
    const second = useMindStore.getState().selectedId!;
    expect(second).not.toBe(first);

    // 当前选中第二个子节点：上移应把它换到第一个之前
    useMindStore.getState().moveAt(null, -1);
    const kids = useMindStore
      .getState()
      .doc.nodes.filter((n) => n.parentId === useMindStore.getState().doc.rootId);
    expect(kids[0].id).toBe(second);
  });

  it('折叠后布局不再包含子树，展开后恢复', () => {
    useMindStore.getState().load(buildMindTemplate('project'));
    const before = useMindStore.getState().layout.nodes.length;
    useMindStore.getState().setAllCollapsed(true);
    expect(useMindStore.getState().layout.nodes.length).toBeLessThan(before);
    useMindStore.getState().setAllCollapsed(false);
    expect(useMindStore.getState().layout.nodes.length).toBe(before);
  });

  it('切换布局方向与主题会重算布局且不写入撤销栈之外的状态', () => {
    useMindStore.getState().load(buildMindTemplate('reading'));
    useMindStore.getState().setDirection('down');
    expect(useMindStore.getState().doc.direction).toBe('down');
    const root = useMindStore
      .getState()
      .layout.nodes.find((n) => n.id === useMindStore.getState().doc.rootId)!;
    const child = useMindStore.getState().layout.nodes.find((n) => n.depth === 1)!;
    expect(child.y).toBeGreaterThan(root.y);

    useMindStore.getState().setTheme('sunset');
    expect(useMindStore.getState().doc.themeId).toBe('sunset');
  });
});
