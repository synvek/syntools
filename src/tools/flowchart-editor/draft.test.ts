import { beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, readDraft, writeDraft } from './draft';
import { buildTemplateDoc } from './model/templates';
import { activePageOf, toDocV2 } from './model/migrate';

function draftKey(): string | undefined {
  return Object.keys(localStorage).find((k) => k.includes('flowchart-editor.draft'));
}

describe('本地草稿读写', () => {
  beforeEach(() => {
    clearDraft();
  });

  it('写入后可原样读回（write 的存储结构必须与 read 的解析一致）', () => {
    const doc = buildTemplateDoc('basic');
    expect(writeDraft(doc)).toBe(true);

    const restored = readDraft();
    expect(restored).not.toBeNull();
    const page = activePageOf(restored!)!;
    const src = activePageOf(doc)!;
    expect(page.nodes).toHaveLength(src.nodes.length);
    expect(page.edges).toHaveLength(src.edges.length);
    expect(page.nodes[0].data.label).toBe(src.nodes[0].data.label);
    expect(page.nodes[0].position).toEqual(src.nodes[0].position);
  });

  it('无草稿时返回 null', () => {
    expect(readDraft()).toBeNull();
  });

  it('空画布不保留草稿（清空后刷新不应恢复出内容）', () => {
    expect(writeDraft(toDocV2([], []))).toBe(false);
    expect(readDraft()).toBeNull();
  });

  it('覆盖写入后读到的是最新内容', () => {
    expect(writeDraft(buildTemplateDoc('basic'))).toBe(true);
    expect(writeDraft(buildTemplateDoc('bpmn'))).toBe(true);
    const page = activePageOf(readDraft()!)!;
    expect(page.nodes).toHaveLength(4);
    expect(page.nodes[0].data.kind).toBe('bpmnTask');
  });

  it('损坏的数据被安全忽略', () => {
    expect(writeDraft(buildTemplateDoc('basic'))).toBe(true);
    const key = draftKey();
    expect(key).toBeTruthy();
    localStorage.setItem(key!, '{"doc":');
    expect(readDraft()).toBeNull();
  });
});
