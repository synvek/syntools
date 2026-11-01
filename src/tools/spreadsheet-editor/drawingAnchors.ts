import type { RawChartParts } from './rawChartParts';

/**
 * 从"导入后原样保留的 drawing"里摘掉已经转成站内配置的 anchor。
 *
 * 背景：drawing 里的 anchor 有三类来源（chart / shape / picture），它们各自会被翻译成
 * `ChartConfig` / `SheetShapeConfig` / `SheetImageConfig`，导出时**重新生成**。如果保留的
 * drawing 里那份 anchor 还在，同一张图/形状/图片就会被写两次（一次来自保留 part、一次来自 config），
 * Excel 里表现为叠了一层、且删除其中一个另一个还在。
 *
 * 只按 cNvPr id 精确摘除：解析失败的对象（没认出来）不会被上报，因而原样保留 —— 宁可多留，
 * 不静默丢内容。
 */

const ANCHOR_PATTERN = /<xdr:(oneCellAnchor|twoCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g;

/** anchor 块里的 `cNvPr@id`（chart 的 graphicFrame 里同样是 `cNvPr`） */
function anchorId(block: string): string | null {
  return /<xdr:cNvPr[^>]*\bid="([^"]+)"/.exec(block)?.[1] ?? null;
}

/** 删掉 id 落在 `ids` 里的 anchor；返回 `null` 表示这份 drawing 已经没有 anchor 了 */
export function stripAnchorsByIds(drawingXml: string, ids: ReadonlySet<string>): string | null {
  if (ids.size === 0) return drawingXml;
  const stripped = drawingXml.replace(ANCHOR_PATTERN, (block) => {
    const id = anchorId(block);
    return id && ids.has(id) ? '' : block;
  });
  const stillHasAnchor = /<xdr:(oneCellAnchor|twoCellAnchor|absoluteAnchor)\b/.test(stripped);
  return stillHasAnchor ? stripped : null;
}

export interface ConvertedAnchors {
  /** sheet 名 → 已转换的 anchor cNvPr id */
  bySheet: Record<string, Set<string>>;
}

export function createConvertedAnchors(): ConvertedAnchors & {
  add: (sheetName: string, anchorId: string) => void;
} {
  const bySheet: Record<string, Set<string>> = {};
  return {
    bySheet,
    add(sheetName, anchorId) {
      (bySheet[sheetName] ??= new Set()).add(anchorId);
    },
  };
}

function decodeBase64(value: string): string | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * 把"已转换"的 anchor 从保留的 parts 里摘掉。drawing 摘空时连 part 与 sheetDrawings 条目一起删 ——
 * 导出侧只在有内容时才插 `<drawing/>`，留下空 drawing 会变成指向空气的引用。
 */
export function pruneConvertedAnchors(
  raw: RawChartParts | null,
  converted: ConvertedAnchors,
): RawChartParts | null {
  if (!raw) return null;
  if (Object.keys(converted.bySheet).length === 0) return raw;

  const parts = { ...raw.parts };
  const sheetDrawings = { ...raw.sheetDrawings };

  for (const [sheetName, drawingPath] of Object.entries(raw.sheetDrawings)) {
    const ids = converted.bySheet[sheetName];
    if (!ids || ids.size === 0) continue;
    const encoded = parts[drawingPath];
    const xml = encoded ? decodeBase64(encoded) : null;
    if (xml === null) continue;
    const stripped = stripAnchorsByIds(xml, ids);
    if (stripped === null) {
      delete parts[drawingPath];
      delete sheetDrawings[sheetName];
      continue;
    }
    parts[drawingPath] = encodeBase64(stripped);
  }

  if (Object.keys(sheetDrawings).length === 0 || Object.keys(parts).length === 0) return null;
  return { ...raw, parts, sheetDrawings };
}
