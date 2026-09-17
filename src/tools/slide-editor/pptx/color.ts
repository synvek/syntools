import { applyColorTransform, normalizeHex } from '../core';
import { attr, childOf, childrenOf, localNameOf, numAttr, type XmlNode } from './xml';

/**
 * DrawingML 颜色解析（ECMA-376 §20.1.2.3）：
 * srgbClr / schemeClr / prstClr / sysClr / scrgbClr / hslClr 六类取值，
 * 再叠加 lumMod / lumOff / shade / tint / alpha 修正。
 * schemeClr 需要查主题色板；解析不到时向下降级，绝不抛异常。
 */

export type Palette = Record<string, string>;

export interface ResolvedColor {
  color: string;
  alpha?: number;
}

const PRESET_COLORS: Record<string, string> = {
  aliceBlue: '#F0F8FF',
  antiqueWhite: '#FAEBD7',
  aqua: '#00FFFF',
  aquamarine: '#7FFFD4',
  azure: '#F0FFFF',
  beige: '#F5F5DC',
  bisque: '#FFE4C4',
  black: '#000000',
  blanchedAlmond: '#FFEBCD',
  blue: '#0000FF',
  blueViolet: '#8A2BE2',
  brown: '#A52A2A',
  burlyWood: '#DEB887',
  cadetBlue: '#5F9EA0',
  chartreuse: '#7FFF00',
  chocolate: '#D2691E',
  coral: '#FF7F50',
  cornflowerBlue: '#6495ED',
  cornsilk: '#FFF8DC',
  crimson: '#DC143C',
  cyan: '#00FFFF',
  darkBlue: '#00008B',
  darkCyan: '#008B8B',
  darkGray: '#A9A9A9',
  darkGreen: '#006400',
  darkKhaki: '#BDB76B',
  darkMagenta: '#8B008B',
  darkOliveGreen: '#556B2F',
  darkOrange: '#FF8C00',
  darkOrchid: '#9932CC',
  darkRed: '#8B0000',
  darkSalmon: '#E9967A',
  darkSeaGreen: '#8FBC8F',
  darkSlateBlue: '#483D8B',
  darkSlateGray: '#2F4F4F',
  darkTurquoise: '#00CED1',
  darkViolet: '#9400D3',
  deepPink: '#FF1493',
  deepSkyBlue: '#00BFFF',
  dimGray: '#696969',
  dodgerBlue: '#1E90FF',
  firebrick: '#B22222',
  floralWhite: '#FFFAF0',
  forestGreen: '#228B22',
  fuchsia: '#FF00FF',
  gainsboro: '#DCDCDC',
  ghostWhite: '#F8F8FF',
  gold: '#FFD700',
  goldenrod: '#DAA520',
  gray: '#808080',
  green: '#008000',
  greenYellow: '#ADFF2F',
  honeydew: '#F0FFF0',
  hotPink: '#FF69B4',
  indianRed: '#CD5C5C',
  indigo: '#4B0082',
  ivory: '#FFFFF0',
  khaki: '#F0E68C',
  lavender: '#E6E6FA',
  lavenderBlush: '#FFF0F5',
  lawnGreen: '#7CFC00',
  lemonChiffon: '#FFFACD',
  lightBlue: '#ADD8E6',
  lightCoral: '#F08080',
  lightCyan: '#E0FFFF',
  lightGoldenrodYellow: '#FAFAD2',
  lightGray: '#D3D3D3',
  lightGreen: '#90EE90',
  lightPink: '#FFB6C1',
  lightSalmon: '#FFA07A',
  lightSeaGreen: '#20B2AA',
  lightSkyBlue: '#87CEFA',
  lightSlateGray: '#778899',
  lightSteelBlue: '#B0C4DE',
  lightYellow: '#FFFFE0',
  lime: '#00FF00',
  limeGreen: '#32CD32',
  linen: '#FAF0E6',
  magenta: '#FF00FF',
  maroon: '#800000',
  mediumAquamarine: '#66CDAA',
  mediumBlue: '#0000CD',
  mediumOrchid: '#BA55D3',
  mediumPurple: '#9370DB',
  mediumSeaGreen: '#3CB371',
  mediumSlateBlue: '#7B68EE',
  mediumSpringGreen: '#00FA9A',
  mediumTurquoise: '#48D1CC',
  mediumVioletRed: '#C71585',
  midnightBlue: '#191970',
  mintCream: '#F5FFFA',
  mistyRose: '#FFE4E1',
  moccasin: '#FFE4B5',
  navajoWhite: '#FFDEAD',
  navy: '#000080',
  oldLace: '#FDF5E6',
  olive: '#808000',
  oliveDrab: '#6B8E23',
  orange: '#FFA500',
  orangeRed: '#FF4500',
  orchid: '#DA70D6',
  paleGoldenrod: '#EEE8AA',
  paleGreen: '#98FB98',
  paleTurquoise: '#AFEEEE',
  paleVioletRed: '#DB7093',
  papayaWhip: '#FFEFD5',
  peachPuff: '#FFDAB9',
  peru: '#CD853F',
  pink: '#FFC0CB',
  plum: '#DDA0DD',
  powderBlue: '#B0E0E6',
  purple: '#800080',
  red: '#FF0000',
  rosyBrown: '#BC8F8F',
  royalBlue: '#4169E1',
  saddleBrown: '#8B4513',
  salmon: '#FA8072',
  sandyBrown: '#F4A460',
  seaGreen: '#2E8B57',
  seaShell: '#FFF5EE',
  sienna: '#A0522D',
  silver: '#C0C0C0',
  skyBlue: '#87CEEB',
  slateBlue: '#6A5ACD',
  slateGray: '#708090',
  snow: '#FFFAFA',
  springGreen: '#00FF7F',
  steelBlue: '#4682B4',
  tan: '#D2B48C',
  teal: '#008080',
  thistle: '#D8BFD8',
  tomato: '#FF6347',
  turquoise: '#40E0D0',
  violet: '#EE82EE',
  wheat: '#F5DEB3',
  white: '#FFFFFF',
  whiteSmoke: '#F5F5F5',
  yellow: '#FFFF00',
  yellowGreen: '#9ACD32',
};

const ALPHA_SCALE = 100000;

/** 读取 lumMod/lumOff/shade/tint/alpha 修正参数 */
function readTransform(node: XmlNode) {
  return {
    lumMod: numAttr(childOf(node, 'lumMod'), 'val'),
    lumOff: numAttr(childOf(node, 'lumOff'), 'val'),
    shade: numAttr(childOf(node, 'shade'), 'val'),
    tint: numAttr(childOf(node, 'tint'), 'val'),
    alphaRaw: numAttr(childOf(node, 'alpha'), 'val'),
  };
}

function hexFromScrgb(node: XmlNode): string | null {
  const to255 = (raw: string | undefined) => {
    const value = Number(raw ?? '');
    if (!Number.isFinite(value)) return 0;
    return Math.round(Math.min(1, Math.max(0, value / 100000)) * 255);
  };
  const [r, g, b] = [attr(node, 'r'), attr(node, 'g'), attr(node, 'b')];
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return normalizeHex(`#${toHex(to255(r))}${toHex(to255(g))}${toHex(to255(b))}`);
}

/** HSL → RGB（DrawingML hslClr，单位 1/60000 度 / 千分比） */
function hexFromHsl(node: XmlNode): string | null {
  const hue = numAttr(node, 'hue') ?? 0;
  const sat = (numAttr(node, 'sat') ?? 0) / 100000;
  const lum = (numAttr(node, 'lum') ?? 0) / 100000;
  const h = ((hue / 60000) % 360) / 360;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const hp = h * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = lum - c / 2;
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return normalizeHex(`#${rgb.map(toHex).join('')}`);
}

/** 解析任意「颜色容器」节点（srgbClr / schemeClr / …）为 RGB + alpha */
export function resolveColorNode(
  node: XmlNode | undefined,
  palette: Palette,
): ResolvedColor | undefined {
  if (!node) return undefined;
  for (const childItem of childrenOf(node)) {
    const kind = localNameOf(childItem);
    const transform = readTransform(childItem);
    let base: string | undefined | null;
    if (kind === 'srgbClr') base = normalizeHex(attr(childItem, 'val'));
    else if (kind === 'schemeClr') {
      const key = attr(childItem, 'val') ?? 'dk1';
      base = palette[key] ?? palette.phClr ?? undefined;
    } else if (kind === 'sysClr') {
      base = normalizeHex(attr(childItem, 'lastClr')) ?? normalizeHex('#000000');
    } else if (kind === 'prstClr') {
      base = PRESET_COLORS[attr(childItem, 'val') ?? ''] ?? undefined;
    } else if (kind === 'scrgbClr') base = hexFromScrgb(childItem);
    else if (kind === 'hslClr') base = hexFromHsl(childItem);
    if (base) {
      const color = applyColorTransform(base, transform);
      const alpha =
        transform.alphaRaw === undefined
          ? undefined
          : Math.min(1, transform.alphaRaw / ALPHA_SCALE);
      return { color, alpha };
    }
  }
  return undefined;
}

/** 解析填充节点（solidFill / gradFill / noFill / blipFill） */
export interface ParsedFill {
  type: 'none' | 'solid' | 'gradient';
  color?: string;
  alpha?: number;
  stops?: { offset: number; color: string }[];
  angle?: number;
}

export function parseShapeFill(node: XmlNode | undefined, palette: Palette): ParsedFill {
  if (!node) return { type: 'none' };
  for (const childItem of childrenOf(node)) {
    const kind = localNameOf(childItem);
    if (kind === 'noFill') return { type: 'none' };
    if (kind === 'solidFill') {
      const resolved = resolveColorNode(childItem, palette);
      if (resolved) return { type: 'solid', color: resolved.color, alpha: resolved.alpha };
      return { type: 'none' };
    }
    if (kind === 'gradFill') {
      const stops: { offset: number; color: string }[] = [];
      for (const stopNode of childrenOf(childItem)) {
        if (localNameOf(stopNode) !== 'gs') continue;
        const pos = numAttr(stopNode, 'pos') ?? 0;
        const resolved = resolveColorNode(stopNode, palette);
        if (resolved)
          stops.push({ offset: Math.min(1, Math.max(0, pos / 100000)), color: resolved.color });
      }
      const lin = childOf(childItem, 'lin');
      const angle = numAttr(lin, 'ang');
      if (stops.length >= 2) {
        return { type: 'gradient', stops, angle: angle === undefined ? undefined : angle / 60000 };
      }
      if (stops.length === 1) return { type: 'solid', ...stops[0] };
    }
  }
  return { type: 'none' };
}

/** 解析描边节点（a:ln） */
export interface ParsedStroke {
  color: string;
  width: number;
  dash?: number[];
}

export function parseStroke(node: XmlNode | undefined, palette: Palette): ParsedStroke | undefined {
  if (!node) return undefined;
  // DrawingML 线宽单位为 EMU（12700 EMU = 1pt），换算到画布 px（96dpi）
  const widthEmu = numAttr(node, 'w') ?? 12700;
  const widthPx = (widthEmu / 12700) * (96 / 72);
  const fill = childrenNamedFirst(node, ['solidFill', 'gradFill', 'noFill']);
  if (!fill || localNameOf(fill) === 'noFill') return undefined;
  const resolved = resolveColorNode(fill, palette);
  const dashNode = childrenOf(node).find((item) => localNameOf(item) === 'prstDash');
  const dashKey = dashNode ? attr(dashNode, 'val') : undefined;
  return {
    color: resolved?.color ?? '#000000',
    width: Math.max(0.5, Math.round(widthPx * 100) / 100),
    dash: dashKey ? DASH_PATTERNS[dashKey] : undefined,
  };
}

function childrenNamedFirst(node: XmlNode, tags: string[]): XmlNode | undefined {
  return childrenOf(node).find((item) => tags.includes(localNameOf(item)));
}

const DASH_PATTERNS: Record<string, number[]> = {
  dash: [8, 4],
  dashDot: [8, 4, 2, 4],
  dot: [2, 3],
  lgDash: [16, 6],
  lgDashDot: [16, 6, 2, 6],
  lgDashDotDot: [16, 6, 2, 6, 2, 6],
  sysDash: [4, 3],
  sysDashDot: [4, 3, 2, 3],
  sysDot: [2, 2],
};
