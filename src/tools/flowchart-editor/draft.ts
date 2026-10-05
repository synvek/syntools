/**
 * 本地草稿（不离开浏览器）：停止编辑后防抖写入 localStorage，
 * 刷新后自动恢复。读写均 try/catch 容错，超限时降级处理。
 *
 * 体积策略：图片以 dataURL 内联，可能迅速撑爆 localStorage（约 5MB）。
 * 因此写入前先估算体积，超限时**丢弃图片内容**再写一次，并回报「已降级」，
 * 由 UI 提示用户改用「导出项目文件」保存含图片的版本。
 */

import { DRAFT_SIZE_LIMIT, type FlowDoc, type FlowPage } from './model/types';
import { activePageOf, migrateDoc } from './model/migrate';

const DRAFT_KEY = 'syntools:flowchart-editor.draft.v1';

export interface DraftWriteResult {
  saved: boolean;
  /** 因超限丢弃了图片内容（草稿仍已保存，但图片不完整） */
  droppedImages: boolean;
}

export function readDraft(): FlowDoc | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    // 存储结构是 { doc, savedAt }，必须取出 doc 再校验
    const parsed = JSON.parse(raw) as { doc?: unknown; savedAt?: number } | null;
    if (!parsed || typeof parsed !== 'object' || !('doc' in parsed)) return null;
    // 旧草稿是 v1（{nodes, edges}），迁移后统一为 v2，保证内容不丢
    return migrateDoc(parsed.doc);
  } catch {
    return null;
  }
}

/** 去掉所有图片节点的 dataURL（保留节点位置与其它样式） */
function withoutImages(doc: FlowDoc): FlowDoc {
  const pages: FlowPage[] = doc.pages.map((page) => ({
    ...page,
    nodes: page.nodes.map((node) =>
      node.data.src ? { ...node, data: { ...node.data, src: undefined } } : node,
    ),
  }));
  return { ...doc, pages };
}

function payloadSize(payload: string): number {
  return payload.length;
}

export function writeDraft(doc: FlowDoc): DraftWriteResult {
  try {
    // 空画布不保留草稿：用户主动清空后刷新不应再恢复出内容
    const page = activePageOf(doc);
    if (!page || page.nodes.length === 0) {
      localStorage.removeItem(DRAFT_KEY);
      return { saved: false, droppedImages: false };
    }

    const payload = (value: FlowDoc) => JSON.stringify({ doc: value, savedAt: Date.now() });
    let text = payload(doc);
    let droppedImages = false;
    if (payloadSize(text) > DRAFT_SIZE_LIMIT) {
      text = payload(withoutImages(doc));
      droppedImages = true;
      if (payloadSize(text) > DRAFT_SIZE_LIMIT) {
        // 仍未通过：放弃写入，避免抛异常导致草稿永久损坏
        localStorage.removeItem(DRAFT_KEY);
        return { saved: false, droppedImages };
      }
    }

    localStorage.setItem(DRAFT_KEY, text);
    return { saved: true, droppedImages };
  } catch {
    return { saved: false, droppedImages: false };
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // localStorage 不可用时忽略
  }
}
