import { beforeEach, describe, expect, it } from 'vitest';
import { useFlowStore } from './store';
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
