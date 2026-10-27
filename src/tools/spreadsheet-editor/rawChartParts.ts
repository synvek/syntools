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
const IMAGE_REL = /relationships\/image$/;

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
    // Keep only drawings that really contain charts (picture-only drawings are out of scope)
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

      // A chart may embed pictures (e.g. data-point images); keep them too
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
