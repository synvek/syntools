import type JSZipType from 'jszip';
import { resolvePartPath } from './xlsx-normalize';

/**
 * Native chart part preservation layer (import side).
 *
 * - Charts inserted in the app are generated as standard DrawingML by chartXml.ts;
 * - **native Excel charts already in an imported file** are not parsed: their parts are kept verbatim
 *   and written back on export, so an .xlsx with charts never loses them on an import/export round.
 *
 * Preserved scope: worksheet → drawing → chart → (chart-embedded) media, plus each .rels.
 * Drawings that only contain pictures are out of scope here (not preserved).
 */

export interface RawChartParts {
  version: 1;
  /** Path → base64 content */
  parts: Record<string, string>;
  /** Sheet name → that sheet's drawing part path (e.g. xl/drawings/drawing1.xml) */
  sheetDrawings: Record<string, string>;
  /** Original [Content_Types].xml: used on export to merge the entries for the preserved parts */
  contentTypes?: string;
}

export interface Relationship {
  id: string;
  type: string;
  target: string;
}

const RELATIONSHIP_TAG = /<Relationship\b[^>]*?\/?>/g;
// Note: these patterns match the relationship Type **attribute value** (without quotes), hence the trailing $
const DRAWING_REL = /relationships\/drawing$/;
const CHART_REL = /relationships\/chart$/;
/** 真·形状元素 `<xdr:sp>` / `<xdr:sp ...>`（别用 `includes('<xdr:sp')`，`xdr:spPr` 也会命中） */
const SHAPE_ELEMENT = /<xdr:sp[\s/>]/;

/** Directory of a part (with trailing slash): xl/worksheets/sheet1.xml → xl/worksheets/ */
export function dirOf(partPath: string): string {
  const index = partPath.lastIndexOf('/');
  return index < 0 ? '' : partPath.slice(0, index + 1);
}

/** A part's .rels path: xl/worksheets/sheet1.xml → xl/worksheets/_rels/sheet1.xml.rels */
export function relsPathFor(partPath: string): string {
  const dir = dirOf(partPath);
  return `${dir}_rels/${partPath.slice(dir.length)}.rels`;
}

/** The part a .rels belongs to: xl/drawings/_rels/drawing1.xml.rels → xl/drawings/drawing1.xml */
export function partOfRels(relsPath: string): string {
  const marker = '/_rels/';
  const index = relsPath.lastIndexOf(marker);
  // `_rels/.rels` is the package-level list: its targets are absolute, resolved from the root
  if (index < 0) return '';
  const dir = relsPath.slice(0, index + 1);
  return dir + relsPath.slice(index + marker.length).replace(/\.rels$/i, '');
}

/** `TargetMode="External"` / `mailto:` / `https:` — not package parts, nothing to check */
export function isExternalTarget(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target.trim());
}

/**
 * Resolve a relationship target to a part path, relative to its owner part.
 * Returns null for external targets (hyperlinks, `TargetMode="External"`).
 *
 * Some producers percent-encode names (`image%201.png`); the decoded form is preferred because the
 * zip entry is stored decoded. Both spellings are returned by callers that need an existence check.
 */
export function resolveRelTarget(ownerPart: string, target: string): string | null {
  if (!target || isExternalTarget(target)) return null;
  return resolvePartPath(target, dirOf(ownerPart));
}

/** Decode entities in XML attribute values (a sheet name may contain &amp; and friends) */
export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

/** Parse the relationship list in a .rels (only Id / Type / Target) */
export function parseRelationships(xml: string | null | undefined): Relationship[] {
  if (!xml) return [];
  const out: Relationship[] = [];
  for (const tag of xml.match(RELATIONSHIP_TAG) ?? []) {
    const id = /\bId="([^"]*)"/.exec(tag)?.[1];
    const type = /\bType="([^"]*)"/.exec(tag)?.[1];
    const target = /\bTarget="([^"]*)"/.exec(tag)?.[1];
    if (id && type && target) out.push({ id, type, target });
  }
  return out;
}

async function readText(zip: JSZipType, path: string): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async('string') : null;
}

async function readBase64(zip: JSZipType, path: string): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async('base64') : null;
}

/* ------------------------- 保留部件的引用闭包（技术债） ------------------------- */

/** 路径的规范形式：producer 常把空格 / 中文百分号编码，但 zip 条目是解码后的名字 */
function canonicalPartPath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function decodeBase64Text(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

/**
 * 引用闭包（import 侧）：把"被保留部件引用到、且源包里确实存在"的内部部件一并收进来。
 *
 * 为什么必须有这一步：保留 drawing 时搬的是 XML 原文，而它的 `.rels` 里可能挂着
 * `../media/image5.png`——一张我们**没有**建成工具图片的图（EMF、图表内嵌图、形状填充图）。
 * 只搬 XML 不搬媒体，导出的文件里就有一条指向不存在部件的 `r:embed`：Excel 打开时会报
 * "发现不可读取的内容"或直接显示空图。8 份外部样本导出后逐份核对 `.rels` 曾确认"当前无断链"，
 * 但那只是样本恰好没踩到，代码里没有任何约束——这一步把约束做成机制。
 *
 * 走法是"从已保留的部件出发，反复补它自己的 `.rels` 与被引用的部件"，直到不再增长：
 * drawing → chart → chart 的内嵌图。`TargetMode="External"`（超链接）与源包里本来就缺的引用
 * 一律跳过——后者不是我们能修的，交给导出侧的断链报告。
 */
async function collectReferencedParts(
  zip: JSZipType,
  parts: Record<string, string>,
): Promise<void> {
  const seen = new Set(Object.keys(parts));
  const queue = new Set<string>();
  for (const path of seen)
    queue.add(path.toLowerCase().endsWith('.rels') ? path : relsPathFor(path));

  const visited = new Set<string>();
  while (queue.size > 0) {
    const [relsPath] = queue;
    queue.delete(relsPath);
    if (visited.has(relsPath)) continue;
    visited.add(relsPath);

    const owner = partOfRels(relsPath);
    // 包级 `_rels/.rels` 不保留；owner 都没保留的关系也不带进来（否则会凭空多出引用）
    if (owner === '' || !seen.has(owner)) continue;

    const xml = await readText(zip, relsPath);
    if (xml === null) continue;
    if (!seen.has(relsPath)) {
      const base64 = await readBase64(zip, relsPath);
      if (base64 === null) continue;
      parts[relsPath] = base64;
      seen.add(relsPath);
    }

    for (const rel of parseRelationships(xml)) {
      const target = resolveRelTarget(owner, rel.target);
      if (!target) continue;
      if (!seen.has(target)) {
        const base64 = await readBase64(zip, target);
        if (base64 === null) continue;
        parts[target] = base64;
        seen.add(target);
      }
      queue.add(relsPathFor(target));
    }
  }
}

export interface DanglingReference {
  /** 出问题的 .rels 部件路径 */
  rels: string;
  /** 被引用但没有出现在保留集合里的部件路径 */
  target: string;
}

/**
 * 保留集合里的断链（导出侧报告 / 测试门禁用）。
 *
 * 正常情况下 `collectReferencedParts` 已保证闭包成立，这里返回空数组；
 * 有值只可能来自**旧草稿**——`syntoolsRawParts` 是随快照落盘的，修复前存下的那份可能本来就不闭包。
 * 这种文件写出去会让 Excel 报"不可读取的内容"，所以导出前必须让用户看见，而不是静默产出。
 */
export function danglingPartReferences(parts: Record<string, string>): DanglingReference[] {
  const kept = new Set(Object.keys(parts).map(canonicalPartPath));
  const out: DanglingReference[] = [];
  for (const [path, base64] of Object.entries(parts)) {
    if (!path.toLowerCase().endsWith('.rels')) continue;
    const owner = partOfRels(path);
    for (const rel of parseRelationships(decodeBase64Text(base64))) {
      const target = resolveRelTarget(owner, rel.target);
      if (!target || kept.has(canonicalPartPath(target))) continue;
      out.push({ rels: path, target });
    }
  }
  return out;
}

/** Sheet name → sheet part path (resolved through workbook.xml and its rels, never guessed from names) */
export async function resolveSheetParts(zip: JSZipType): Promise<Record<string, string>> {
  const workbook = await readText(zip, 'xl/workbook.xml');
  const rels = await readText(zip, 'xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) return {};
  const byId = new Map(parseRelationships(rels).map((item) => [item.id, item.target]));
  const out: Record<string, string> = {};
  for (const tag of workbook.match(/<sheet\b[^>]*?\/?>/g) ?? []) {
    const name = /\bname="([^"]*)"/.exec(tag)?.[1];
    const rid = /\br:id="([^"]*)"/.exec(tag)?.[1];
    if (!name || !rid) continue;
    const target = byId.get(rid);
    if (!target) continue;
    const path = resolvePartPath(target, 'xl/');
    if (path) out[decodeXmlEntities(name)] = path;
  }
  return out;
}

/**
 * Collect the parts related to "native charts" in the archive; returns null when there are none.
 * Only walks paths and reads raw content — chart semantics are never parsed.
 */
export async function collectRawChartParts(zip: JSZipType): Promise<RawChartParts | null> {
  const sheetParts = await resolveSheetParts(zip);
  const parts: Record<string, string> = {};
  const sheetDrawings: Record<string, string> = {};

  for (const [sheetName, sheetPath] of Object.entries(sheetParts)) {
    const sheetRels = parseRelationships(await readText(zip, relsPathFor(sheetPath)));
    const drawingRel = sheetRels.find((item) => DRAWING_REL.test(item.type));
    if (!drawingRel) continue;
    const drawingPath = resolvePartPath(drawingRel.target, dirOf(sheetPath));
    if (!drawingPath || !zip.file(drawingPath)) continue;

    const drawingRelsPath = relsPathFor(drawingPath);
    const drawingRels = parseRelationships(await readText(zip, drawingRelsPath));
    const chartRels = drawingRels.filter((item) => CHART_REL.test(item.type));
    // A drawing is worth keeping when it holds a chart **or** a shape (`xdr:sp`). Shapes used to be
    // dropped here, which silently deleted every shape of an imported file on the next export.
    const drawingXml = await readText(zip, drawingPath);
    /**
     * 必须是"形状锚点"，不能是 `includes('<xdr:sp')`：`xdr:pic` 内部就有 `xdr:spPr`，
     * 子串匹配会把**每个纯图片 drawing** 都判成"有形状"，于是图片被原样保留、又被重新写一遍
     * （图翻倍），并且保留的那份还引用着我们没保留的 `xl/media`（导出后是断链）。
     */
    const hasShapes = Boolean(drawingXml && SHAPE_ELEMENT.test(drawingXml));
    // Picture-only drawings stay out of scope
    if (chartRels.length === 0 && !hasShapes) continue;

    sheetDrawings[sheetName] = drawingPath;
    parts[drawingPath] = (await readBase64(zip, drawingPath)) as string;
    const drawingRelsContent = await readBase64(zip, drawingRelsPath);
    if (drawingRelsContent !== null) parts[drawingRelsPath] = drawingRelsContent;

    // Chart parts are pulled in by the closure below (drawing .rels → chart → chart .rels → media),
    // which also covers the pictures a chart may embed as data-point fills.
    for (const rel of chartRels) {
      const chartPath = resolvePartPath(rel.target, dirOf(drawingPath));
      if (!chartPath) continue;
      const chartContent = await readBase64(zip, chartPath);
      if (chartContent !== null) parts[chartPath] = chartContent;
    }
  }

  if (Object.keys(parts).length === 0) return null;
  // 引用闭包：形状 / 图表所在的 drawing 里可能还有我们没建模的图片（EMF、图形填充），
  // 它们必须连同 xl/media 一起搬走，否则导出后是一条断链
  await collectReferencedParts(zip, parts);
  return {
    version: 1,
    parts,
    sheetDrawings,
    contentTypes: (await readText(zip, '[Content_Types].xml')) ?? undefined,
  };
}

/** Pick the entries of the original [Content_Types].xml that concern the given parts (merged on export) */
export function relevantContentTypeEntries(
  originalXml: string | undefined,
  partPaths: readonly string[],
): string[] {
  if (!originalXml) return [];
  const wanted = new Set(partPaths.map((path) => `/${path}`));
  const extensions = new Set(
    partPaths.map((path) => path.slice(path.lastIndexOf('.') + 1).toLowerCase()).filter(Boolean),
  );
  const out: string[] = [];
  for (const tag of originalXml.match(/<(?:Override|Default)\b[^>]*?\/?>/g) ?? []) {
    const partName = /\bPartName="([^"]*)"/.exec(tag)?.[1];
    if (partName) {
      if (wanted.has(partName)) out.push(tag);
      continue;
    }
    const extension = /\bExtension="([^"]*)"/.exec(tag)?.[1];
    if (!extension) continue;
    const normalized = extension.toLowerCase();
    // exceljs writes the Defaults for xml / rels itself; only add the ones it would miss (e.g. image extensions)
    if (normalized === 'xml' || normalized === 'rels') continue;
    if (extensions.has(normalized)) out.push(tag);
  }
  return out;
}
