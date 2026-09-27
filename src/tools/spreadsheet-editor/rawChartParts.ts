import type JSZipType from 'jszip';
import { resolvePartPath } from './xlsx-normalize';

/**
 * 原生图表部件保留层（导入侧）。
 *
 * - 站内自己插入的图表由 chartXml.ts 生成标准 DrawingML；
 * - **导入文件里原有的 Excel 原生图表**不做解析，按原始部件原样保留，
 *   导出时回填，避免「带图表的 .xlsx 导入再导出、图表静默消失」。
 *
 * 保留范围：工作表 → drawing → chart →（图表内嵌）media，以及各自的 .rels。
 * 纯图片的 drawing 不在本轮范围（不保留）。
 */

export interface RawChartParts {
  version: 1;
  /** 路径 → base64 内容 */
  parts: Record<string, string>;
  /** 工作表名 → 该表的 drawing 部件路径（如 xl/drawings/drawing1.xml） */
  sheetDrawings: Record<string, string>;
  /** 原始 [Content_Types].xml：导出时用于合并与保留部件相关的条目 */
  contentTypes?: string;
}

export interface Relationship {
  id: string;
  type: string;
  target: string;
}

const RELATIONSHIP_TAG = /<Relationship\b[^>]*?\/?>/g;
// 注意：这些正则匹配的是关系的 Type **属性值**（不含引号），因此以 $ 结尾
const DRAWING_REL = /relationships\/drawing$/;
const CHART_REL = /relationships\/chart$/;
const IMAGE_REL = /relationships\/image$/;

/** 部件所在目录（含末尾斜杠）：xl/worksheets/sheet1.xml → xl/worksheets/ */
export function dirOf(partPath: string): string {
  const index = partPath.lastIndexOf('/');
  return index < 0 ? '' : partPath.slice(0, index + 1);
}

/** 部件的 .rels 路径：xl/worksheets/sheet1.xml → xl/worksheets/_rels/sheet1.xml.rels */
export function relsPathFor(partPath: string): string {
  const dir = dirOf(partPath);
  return `${dir}_rels/${partPath.slice(dir.length)}.rels`;
}

/** XML 属性值里的实体解码（工作表名可能含 &amp; 等） */
export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

/** 解析 .rels 中的关系列表（只看 Id / Type / Target） */
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

/** 工作表名 → 工作表部件路径（经 workbook.xml + 其 rels 解析，不靠命名猜测） */
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
 * 收集归档内与「原生图表」相关的部件；没有图表时返回 null。
 * 只做路径遍历与原文读取，不解析图表语义。
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
    // 仅保留确实含图表的 drawing（纯图片 drawing 暂不处理）
    if (chartRels.length === 0) continue;

    sheetDrawings[sheetName] = drawingPath;
    parts[drawingPath] = (await readBase64(zip, drawingPath)) as string;
    const drawingRelsContent = await readBase64(zip, drawingRelsPath);
    if (drawingRelsContent !== null) parts[drawingRelsPath] = drawingRelsContent;

    for (const rel of chartRels) {
      const chartPath = resolvePartPath(rel.target, dirOf(drawingPath));
      if (!chartPath) continue;
      const chartContent = await readBase64(zip, chartPath);
      if (chartContent !== null) parts[chartPath] = chartContent;

      // 图表可能内嵌图片（如数据点图片），一并保留
      const chartRelsPath = relsPathFor(chartPath);
      const chartRelsXml = await readText(zip, chartRelsPath);
      if (chartRelsXml === null) continue;
      const imageRels = parseRelationships(chartRelsXml).filter((item) =>
        IMAGE_REL.test(item.type),
      );
      if (imageRels.length === 0) continue;
      parts[chartRelsPath] = (await readBase64(zip, chartRelsPath)) as string;
      for (const imageRel of imageRels) {
        const mediaPath = resolvePartPath(imageRel.target, dirOf(chartPath));
        if (!mediaPath) continue;
        const media = await readBase64(zip, mediaPath);
        if (media !== null) parts[mediaPath] = media;
      }
    }
  }

  if (Object.keys(parts).length === 0) return null;
  return {
    version: 1,
    parts,
    sheetDrawings,
    contentTypes: (await readText(zip, '[Content_Types].xml')) ?? undefined,
  };
}

/** 从原始 [Content_Types].xml 中挑出与给定部件相关的条目（用于导出时合并） */
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
    // xml / rels 的 Default 由 exceljs 负责写，这里只补它不会写的（如图片扩展名）
    if (normalized === 'xml' || normalized === 'rels') continue;
    if (extensions.has(normalized)) out.push(tag);
  }
  return out;
}
