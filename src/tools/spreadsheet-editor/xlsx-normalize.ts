/**
 * xlsx 兼容层：把不同写入器（openpyxl / WPS / LibreOffice 等）的批注关系
 * 归一为 exceljs 能识别的形式。
 *
 * 背景：exceljs 只按条目名正则 `/xl\/(comments\d+)[.]xml/` 与
 * `/xl\/drawings\/(vmlDrawing\d+)[.]vml/` 收集批注，并在 reconcile 阶段
 * 以关系 Target 的字面量去查表（`options.comments[rel.Target]`）。
 * 而 openpyxl 写的是 `xl/comments/comment1.xml` 加绝对路径 Target
 * （`/xl/comments/comment1.xml`），两者都对不上，于是抛 TypeError，
 * 导致**含批注的合法文件整个导入失败**。
 *
 * 这里在交给 exceljs 之前重写这类关系（并把部件重命名到它期望的位置），
 * 内容不变，仅路径归一；不改动的文件原样返回，避免无谓的重压缩开销。
 */
import type JSZipType from 'jszip';

const RELS_PATH = /^xl\/worksheets\/_rels\/[^/]+\.rels$/;
const RELATIONSHIP_TAG = /<Relationship\b[^>]*?\/?>/g;
const TARGET_ATTR = /\bTarget="([^"]*)"/;

/** 关系类型判定：只看本地名，兼容不同命名空间前缀写法 */
function relationshipKind(tag: string): 'comments' | 'vmlDrawing' | null {
  if (/relationships\/comments"/.test(tag)) return 'comments';
  if (/relationships\/vmlDrawing"/.test(tag)) return 'vmlDrawing';
  return null;
}

/** 把关系 Target 解析为归档内路径（支持绝对路径与相对路径） */
export function resolvePartPath(target: string, baseDir: string): string | null {
  const raw = target.trim();
  if (!raw) return null;
  if (raw.startsWith('/')) return raw.replace(/^\/+/, '');
  const segments = `${baseDir}${raw}`.split('/');
  const stack: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  return stack.join('/');
}

async function loadZip(buffer: ArrayBuffer): Promise<JSZipType | null> {
  try {
    const JSZip = (await import('jszip')).default;
    return await JSZip.loadAsync(buffer);
  } catch {
    // 不是合法 zip：交给 exceljs 去报错，这里保持原样
    return null;
  }
}

const TEXT_ELEMENT = /<text>([\s\S]*?)<\/text>/g;

/**
 * 批注正文归一：把直接写在 `<text>` 下的 `<t>` 包一层 `<r>`。
 * exceljs 的批注解析只处理 run 形式，否则读出的 texts 为空、批注文本丢失。
 */
export function wrapCommentTextRuns(xml: string): string {
  return xml.replace(TEXT_ELEMENT, (whole, inner: string) => {
    if (/<r[\s>]/.test(inner)) return whole; // 已是 run 形式
    if (!/<t[\s>]/.test(inner)) return whole; // 没有文本节点
    return `<text><r>${inner}</r></text>`;
  });
}

/**
 * 归一化归档；无需改动或任何异常时返回原始 buffer。
 * 仅影响批注（comments）与其 VML 绘制部件的关系路径与正文结构。
 */
export async function normalizeXlsxArchive(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await loadZip(buffer);
  if (!zip) return buffer;

  const relsNames = Object.keys(zip.files).filter((name) => RELS_PATH.test(name));
  if (relsNames.length === 0) return buffer;

  let counter = 0;
  let changed = false;

  for (const relsName of relsNames) {
    const relsFile = zip.file(relsName);
    if (!relsFile) continue;
    const original = await relsFile.async('string');
    const baseDir = relsName.replace(/_rels\/[^/]+\.rels$/, '');
    const moves: { from: string; to: string }[] = [];

    const rewritten = original.replace(RELATIONSHIP_TAG, (tag) => {
      const kind = relationshipKind(tag);
      if (!kind) return tag;
      const targetMatch = TARGET_ATTR.exec(tag);
      if (!targetMatch) return tag;
      const part = resolvePartPath(targetMatch[1], baseDir);
      if (!part) return tag;

      // 已在 exceljs 期望位置则只校正 Target；否则改名到期望位置（避让已占用的编号）
      const expectedPart =
        kind === 'comments' ? /^xl\/comments\d+\.xml$/ : /^xl\/drawings\/vmlDrawing\d+\.vml$/;
      let nextPart = part;
      if (!expectedPart.test(part)) {
        let index = counter + 1;
        nextPart =
          kind === 'comments' ? `xl/comments${index}.xml` : `xl/drawings/vmlDrawing${index}.vml`;
        while (zip.file(nextPart)) {
          index += 1;
          nextPart =
            kind === 'comments' ? `xl/comments${index}.xml` : `xl/drawings/vmlDrawing${index}.vml`;
        }
        counter = index;
      }

      const expectedTarget = `../${nextPart.startsWith('xl/') ? nextPart.slice(3) : nextPart}`;
      if (nextPart !== part) moves.push({ from: part, to: nextPart });
      if (targetMatch[1] === expectedTarget) return tag;
      return tag.replace(targetMatch[0], `Target="${expectedTarget}"`);
    });

    if (rewritten !== original) {
      zip.file(relsName, rewritten);
      changed = true;
    }
    for (const move of moves) {
      const source = zip.file(move.from);
      if (!source) continue;
      zip.file(move.to, await source.async('uint8array'));
      zip.remove(move.from);
    }
  }

  // 批注正文：openpyxl 等写的是 <text><t>…</t></text>，
  // 而 exceljs 的批注解析只认 <text><r><t>…</t></r></text>（run 形式），否则文本为空
  for (const name of Object.keys(zip.files)) {
    if (!/^xl\/comments\d+\.xml$/.test(name)) continue;
    const file = zip.file(name);
    if (!file) continue;
    const original = await file.async('string');
    const rewritten = wrapCommentTextRuns(original);
    if (rewritten !== original) {
      zip.file(name, rewritten);
      changed = true;
    }
  }

  if (!changed) return buffer;
  try {
    return await zip.generateAsync({ type: 'arraybuffer' });
  } catch {
    return buffer;
  }
}
