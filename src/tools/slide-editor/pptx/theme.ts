import { createDefaultTheme } from '../model/factory';
import type { SlideTheme, ThemeFonts } from '../model/types';
import { resolveColorNode, type Palette } from './color';
import {
  attr,
  childOf,
  childrenOf,
  findFirst,
  localNameOf,
  numAttr,
  parseXml,
  type XmlNode,
} from './xml';

/**
 * theme1.xml 解析：色板（clrScheme）、字体方案（fontScheme）、格式方案（fmtScheme）。
 * 解析失败一律回落到内置默认主题，保证导入不中断。
 */

const SCHEME_KEYS = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
];

export function parseClrScheme(node: XmlNode | undefined, into: Palette): Palette {
  for (const entry of childrenOf(node)) {
    const key = localNameOf(entry);
    if (!SCHEME_KEYS.includes(key)) continue;
    const resolved = resolveColorNode(entry, into);
    if (resolved) into[key] = resolved.color;
  }
  return into;
}

function parseFonts(node: XmlNode | undefined): ThemeFonts {
  const pick = (tag: string) => attr(childOf(node, tag), 'typeface');
  return {
    latin: pick('latin') ?? 'Arial',
    ea: pick('ea'),
    cs: pick('cs'),
  };
}

export function parseTheme(text: string): SlideTheme {
  const fallback = createDefaultTheme();
  const root = parseXml(text);
  const themeNode = childrenOf(root[0]).find((node) => localNameOf(node) === 'theme') ?? root[0];
  const elements = childOf(themeNode, 'themeElements');
  const palette = parseClrScheme(childOf(elements, 'clrScheme'), { ...fallback.colors });
  const fontSchemeNode = childOf(elements, 'fontScheme');
  return {
    name: attr(themeNode, 'name') ?? fallback.name,
    colors: palette,
    majorFont: parseFonts(childOf(fontSchemeNode, 'majorFont')),
    minorFont: parseFonts(childOf(fontSchemeNode, 'minorFont')),
  };
}

/** p:bg → 背景色（渐变取首色，图片背景暂不支持） */
export function parseBackgroundColor(
  node: XmlNode | undefined,
  palette: Palette,
): string | undefined {
  const fill = childOf(node, 'bgPr') ?? childOf(node, 'bgRef') ?? childOf(node, 'bg');
  const target = fill ?? node;
  const clr = findFirst(target, 'solidFill') ?? findFirst(target, 'gradFill');
  if (!clr) return undefined;
  const stop = findFirst(clr, 'gs');
  return resolveColorNode(stop ?? clr, palette)?.color;
}

/** p:bg 内的图片回填 rel id（blipFill/blip r:embed） */
export function parseBackgroundBlip(node: XmlNode | undefined): string | undefined {
  const blip = findFirst(node, 'blip');
  return blip ? (attr(blip, 'embed') ?? attr(blip, 'link')) : undefined;
}

/** 颜色组定义：<a:fills><a:blipFill><a:blip r:embed="rId2"/></a:blipFill>... */
export function parseFillOverrideRef(node: XmlNode | undefined): string | undefined {
  const blip = findFirst(node, 'blip');
  return blip ? attr(blip, 'embed') : undefined;
}

/** 从 clrMap 读取「占位符 → 方案色」映射 */
export function parseClrMap(node: XmlNode | undefined): Palette {
  if (!node) return {};
  const map: Palette = {};
  for (const key of Object.keys(node[':@'] ?? {})) {
    const schemeKey = (node[':@'][key] as string | undefined)?.replace('@_', '');
    if (!schemeKey) continue;
    map[key.replace('@_', '')] = schemeKey;
  }
  return map;
}

/** <a:latin> 之类附加属性里的字号倍数（常见于 txPr 的 sz） */
export function readFontSize(node: XmlNode | undefined): number | undefined {
  const raw = numAttr(node, 'sz');
  return raw === undefined ? undefined : raw / 100;
}
