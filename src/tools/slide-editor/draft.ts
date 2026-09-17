import type { MediaAsset, SlideDoc } from './model/types';

/**
 * 本地草稿（不离开浏览器）：
 * 图片以 base64 内联，但总量超过 DRAFT_MEDIA_LIMIT 时丢弃字节，
 * 保证 localStorage 不被撑爆（恢复时这类图片显示为空白占位）。
 */

const DRAFT_KEY = 'syntools:slide-editor.draft.v1';
const DRAFT_MEDIA_LIMIT = 3 * 1024 * 1024; // 3MB

export interface SlideDraft {
  doc: SlideDoc;
  savedAt: number;
}

type StoredMedia = Omit<MediaAsset, 'bytes'> & { data?: string };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function serialize(doc: SlideDoc): string {
  const total = Object.values(doc.media).reduce(
    (sum, asset) => sum + (asset.bytes?.length ?? 0),
    0,
  );
  const keepBytes = total <= DRAFT_MEDIA_LIMIT;
  const media: Record<string, StoredMedia> = {};
  for (const [id, asset] of Object.entries(doc.media)) {
    const entry: StoredMedia = {
      id: asset.id,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
    };
    if (keepBytes && asset.bytes) entry.data = bytesToBase64(asset.bytes);
    media[id] = entry;
  }
  return JSON.stringify({ doc: { ...doc, media }, savedAt: Date.now() });
}

function restore(raw: string): SlideDraft | null {
  const parsed = JSON.parse(raw) as SlideDraft & {
    doc: SlideDoc & { media: Record<string, StoredMedia> };
  };
  const doc = parsed.doc;
  if (!doc?.slides || !Array.isArray(doc.slides)) return null;
  const media: Record<string, MediaAsset> = {};
  for (const [id, entry] of Object.entries(doc.media ?? {})) {
    media[id] = {
      id: entry.id,
      mime: entry.mime,
      width: entry.width,
      height: entry.height,
      bytes: entry.data ? base64ToBytes(entry.data) : undefined,
    };
  }
  return { doc: { ...doc, media }, savedAt: parsed.savedAt ?? Date.now() };
}

export function readDraft(): SlideDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return restore(raw);
  } catch {
    return null;
  }
}

export function writeDraft(doc: SlideDoc): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, serialize(doc));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // localStorage 不可用时忽略
  }
}
