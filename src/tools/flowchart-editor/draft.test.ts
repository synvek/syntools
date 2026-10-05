import { beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, readDraft, writeDraft } from './draft';
import { buildTemplateDoc } from './model/templates';
import { activePageOf, toDocV2 } from './model/migrate';
import { defaultData, imageData } from './core';
import { DRAFT_SIZE_LIMIT, type FlowDoc } from './model/types';

function draftKey(): string | undefined {
  return Object.keys(localStorage).find((k) => k.includes('flowchart-editor.draft'));
}

/** 构造一张体积巨大的图片节点（base64 字符数超过草稿上限） */
function hugeImageDoc(): FlowDoc {
  const src = `data:image/png;base64,${'A'.repeat(DRAFT_SIZE_LIMIT)}`;
  return toDocV2(
    [
      {
        id: 'img',
        type: 'image',
        position: { x: 0, y: 0 },
        width: 200,
        height: 200,
        data: imageData(src, 'huge'),
      },
      { id: 'a', type: 'shape', position: { x: 0, y: 300 }, data: defaultData('rect', 'A') },
    ],
    [],
  );
}

describe('本地草稿读写', () => {
  beforeEach(() => {
    clearDraft();
  });

  it('写入后可原样读回（write 的存储结构必须与 read 的解析一致）', () => {
    const doc = buildTemplateDoc('basic');
    const result = writeDraft(doc);
    expect(result.saved).toBe(true);
    expect(result.droppedImages).toBe(false);

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
    expect(writeDraft(toDocV2([], [])).saved).toBe(false);
    expect(readDraft()).toBeNull();
  });

  it('覆盖写入后读到的是最新内容', () => {
    expect(writeDraft(buildTemplateDoc('basic')).saved).toBe(true);
    expect(writeDraft(buildTemplateDoc('bpmn')).saved).toBe(true);
    const page = activePageOf(readDraft()!)!;
    expect(page.nodes).toHaveLength(4);
    expect(page.nodes[0].data.kind).toBe('bpmnTask');
  });

  it('损坏的数据被安全忽略', () => {
    expect(writeDraft(buildTemplateDoc('basic')).saved).toBe(true);
    const key = draftKey();
    expect(key).toBeTruthy();
    localStorage.setItem(key!, '{"doc":');
    expect(readDraft()).toBeNull();
  });

  it('图片节点会随草稿一起保存', () => {
    const doc = toDocV2(
      [
        {
          id: 'img',
          type: 'image',
          position: { x: 0, y: 0 },
          width: 120,
          height: 80,
          data: imageData('data:image/png;base64,AAAA', 'pic'),
        },
      ],
      [],
    );
    const result = writeDraft(doc);
    expect(result.saved).toBe(true);
    expect(activePageOf(readDraft()!)!.nodes[0].data.src).toBe('data:image/png;base64,AAAA');
  });

  it('体积超限时降级为「不含图片」的草稿并回报 droppedImages', () => {
    const result = writeDraft(hugeImageDoc());
    expect(result.droppedImages).toBe(true);
    expect(result.saved).toBe(true);
    const page = activePageOf(readDraft()!)!;
    // 图片内容被丢弃，但节点与其它内容仍在
    expect(page.nodes.find((n) => n.id === 'img')?.data.src).toBeUndefined();
    expect(page.nodes.find((n) => n.id === 'a')?.data.label).toBe('A');
  });
});
