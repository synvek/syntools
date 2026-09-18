import { beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, readDraft, writeDraft } from './draft';
import { buildTemplate } from './core';

function draftKey(): string | undefined {
  return Object.keys(localStorage).find((k) => k.includes('flowchart-editor.draft'));
}

describe('本地草稿读写', () => {
  beforeEach(() => {
    clearDraft();
  });

  it('写入后可原样读回（write 的存储结构必须与 read 的解析一致）', () => {
    const doc = buildTemplate('basic');
    expect(writeDraft(doc)).toBe(true);

    const restored = readDraft();
    expect(restored).not.toBeNull();
    expect(restored!.nodes).toHaveLength(doc.nodes.length);
    expect(restored!.edges).toHaveLength(doc.edges.length);
    expect(restored!.nodes[0].data.label).toBe(doc.nodes[0].data.label);
    expect(restored!.nodes[0].position).toEqual(doc.nodes[0].position);
  });

  it('无草稿时返回 null', () => {
    expect(readDraft()).toBeNull();
  });

  it('空画布不保留草稿（清空后刷新不应恢复出内容）', () => {
    expect(writeDraft({ version: 1, nodes: [], edges: [] })).toBe(false);
    expect(readDraft()).toBeNull();
  });

  it('覆盖写入后读到的是最新内容', () => {
    expect(writeDraft(buildTemplate('basic'))).toBe(true);
    expect(writeDraft(buildTemplate('bpmn'))).toBe(true);
    const restored = readDraft();
    expect(restored!.nodes).toHaveLength(4);
    expect(restored!.nodes[0].data.kind).toBe('bpmnTask');
  });

  it('损坏的数据被安全忽略', () => {
    expect(writeDraft(buildTemplate('basic'))).toBe(true);
    const key = draftKey();
    expect(key).toBeTruthy();
    localStorage.setItem(key!, '{"doc":');
    expect(readDraft()).toBeNull();
  });
});
