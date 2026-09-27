/**
 * 字体与排版默认值（纯逻辑 + 可注入的浏览器能力探测，便于单测）。
 *
 * 设计前提：本工具完全本地渲染、字体不随文档分发，因此字体菜单只列出
 * 「当前系统实际安装」的字体，而不是一份写死的清单——否则用户选了却看不到效果。
 */

/** 正文默认字号（px），必须与 editor.css 中 .rte-surface .tiptap 的 font-size 一致 */
export const DEFAULT_FONT_SIZE_PX = 15;
/** 正文默认行高，必须与 editor.css 中 .rte-surface .tiptap 的 line-height 一致 */
export const DEFAULT_LINE_HEIGHT = 1.8;

/** 可选字号（px）：不含默认值本身，默认值单独作为首项展示 */
export const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72] as const;
/** 可选行高：不含默认值本身 */
export const LINE_HEIGHT_OPTIONS = [1, 1.15, 1.5, 1.75, 2, 2.5, 3] as const;

/** CSS 通用字体族与关键字：不构成「具体字体名」 */
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
  '-apple-system',
  'blinkmacsystemfont',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

/** 候选字体：name 为具体字体名，fallback 为该字体缺失时退回的通用族 */
export interface FontCandidate {
  name: string;
  fallback: 'sans-serif' | 'serif' | 'monospace' | 'cursive';
}

/** 候选字体清单（按「中文正文 → 西文无衬线 → 衬线 → 等宽 → 手写/装饰」排序） */
export const FONT_CANDIDATES: readonly FontCandidate[] = [
  // 中文字体（macOS / Windows / Linux 常见内置）
  { name: 'PingFang SC', fallback: 'sans-serif' },
  { name: 'PingFang TC', fallback: 'sans-serif' },
  { name: 'Hiragino Sans GB', fallback: 'sans-serif' },
  { name: 'Heiti SC', fallback: 'sans-serif' },
  { name: 'Microsoft YaHei', fallback: 'sans-serif' },
  { name: 'Microsoft JhengHei', fallback: 'sans-serif' },
  { name: 'SimHei', fallback: 'sans-serif' },
  { name: 'DengXian', fallback: 'sans-serif' },
  { name: 'Noto Sans CJK SC', fallback: 'sans-serif' },
  { name: 'Source Han Sans SC', fallback: 'sans-serif' },
  { name: 'WenQuanYi Micro Hei', fallback: 'sans-serif' },
  { name: 'Songti SC', fallback: 'serif' },
  { name: 'STSong', fallback: 'serif' },
  { name: 'SimSun', fallback: 'serif' },
  { name: 'NSimSun', fallback: 'serif' },
  { name: 'Noto Serif CJK SC', fallback: 'serif' },
  { name: 'Source Han Serif SC', fallback: 'serif' },
  { name: 'Kaiti SC', fallback: 'serif' },
  { name: 'KaiTi', fallback: 'serif' },
  { name: 'STKaiti', fallback: 'serif' },
  { name: 'STFangsong', fallback: 'serif' },
  { name: 'FangSong', fallback: 'serif' },
  { name: 'Yuanti SC', fallback: 'sans-serif' },
  { name: 'Lantinghei SC', fallback: 'sans-serif' },
  // 西文无衬线
  { name: 'Arial', fallback: 'sans-serif' },
  { name: 'Helvetica', fallback: 'sans-serif' },
  { name: 'Helvetica Neue', fallback: 'sans-serif' },
  { name: 'Verdana', fallback: 'sans-serif' },
  { name: 'Tahoma', fallback: 'sans-serif' },
  { name: 'Trebuchet MS', fallback: 'sans-serif' },
  { name: 'Segoe UI', fallback: 'sans-serif' },
  { name: 'Calibri', fallback: 'sans-serif' },
  { name: 'Century Gothic', fallback: 'sans-serif' },
  { name: 'Futura', fallback: 'sans-serif' },
  { name: 'Avenir Next', fallback: 'sans-serif' },
  { name: 'Optima', fallback: 'sans-serif' },
  { name: 'Gill Sans', fallback: 'sans-serif' },
  { name: 'Franklin Gothic Medium', fallback: 'sans-serif' },
  { name: 'Lucida Grande', fallback: 'sans-serif' },
  { name: 'Ubuntu', fallback: 'sans-serif' },
  { name: 'Cantarell', fallback: 'sans-serif' },
  { name: 'DejaVu Sans', fallback: 'sans-serif' },
  { name: 'Liberation Sans', fallback: 'sans-serif' },
  { name: 'Noto Sans', fallback: 'sans-serif' },
  // 衬线
  { name: 'Times New Roman', fallback: 'serif' },
  { name: 'Georgia', fallback: 'serif' },
  { name: 'Cambria', fallback: 'serif' },
  { name: 'Garamond', fallback: 'serif' },
  { name: 'Palatino', fallback: 'serif' },
  { name: 'Palatino Linotype', fallback: 'serif' },
  { name: 'Book Antiqua', fallback: 'serif' },
  { name: 'Baskerville', fallback: 'serif' },
  { name: 'Didot', fallback: 'serif' },
  { name: 'Constantia', fallback: 'serif' },
  { name: 'Charter', fallback: 'serif' },
  { name: 'Iowan Old Style', fallback: 'serif' },
  { name: 'Rockwell', fallback: 'serif' },
  { name: 'DejaVu Serif', fallback: 'serif' },
  { name: 'Liberation Serif', fallback: 'serif' },
  { name: 'Noto Serif', fallback: 'serif' },
  // 等宽
  { name: 'Menlo', fallback: 'monospace' },
  { name: 'Monaco', fallback: 'monospace' },
  { name: 'SF Mono', fallback: 'monospace' },
  { name: 'Consolas', fallback: 'monospace' },
  { name: 'Courier New', fallback: 'monospace' },
  { name: 'Courier', fallback: 'monospace' },
  { name: 'Lucida Console', fallback: 'monospace' },
  { name: 'Andale Mono', fallback: 'monospace' },
  { name: 'JetBrains Mono', fallback: 'monospace' },
  { name: 'Fira Code', fallback: 'monospace' },
  { name: 'DejaVu Sans Mono', fallback: 'monospace' },
  { name: 'Liberation Mono', fallback: 'monospace' },
  { name: 'Noto Sans Mono', fallback: 'monospace' },
  // 手写 / 装饰
  { name: 'Chalkboard SE', fallback: 'cursive' },
  { name: 'Marker Felt', fallback: 'cursive' },
  { name: 'Comic Sans MS', fallback: 'cursive' },
  { name: 'Brush Script MT', fallback: 'cursive' },
  { name: 'Snell Roundhand', fallback: 'cursive' },
  { name: 'Impact', fallback: 'sans-serif' },
];

/** 从 CSS 字体栈中取第一个「具体字体名」（跳过 system-ui / sans-serif 等关键字） */
export function firstFontFamily(stack: string | null | undefined): string | null {
  if (!stack) return null;
  for (const raw of stack.split(',')) {
    const name = raw
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim();
    if (!name) continue;
    if (GENERIC_FAMILIES.has(name.toLowerCase())) continue;
    return name;
  }
  return null;
}

/** 具体字体名 + 兜底族 → CSS font-family 值（名称一律加引号，含空格/中文都安全） */
export function fontStackFor(candidate: FontCandidate): string {
  return `"${candidate.name}", ${candidate.fallback}`;
}

/** px → Word 半磅值（1px = 0.75pt，半磅 = pt × 2） */
export function pxToHalfPoints(px: number): number | null {
  if (!Number.isFinite(px) || px <= 0) return null;
  return Math.round(px * 1.5);
}

/** 平台默认正文字体名（未显式设置 fontFamily 时实际生效的字体） */
export function detectDefaultFontName(userAgent: string, platform = ''): string {
  const hint = `${platform} ${userAgent}`;
  if (/mac|iphone|ipad/i.test(hint)) return 'PingFang SC';
  if (/win/i.test(hint)) return 'Microsoft YaHei';
  return 'Noto Sans CJK SC';
}

/** 字体探测函数：给定 CSS font 简写返回测量宽度，不可用时返回 null */
export type FontProbe = (font: string) => number | null;

const PROBE_SAMPLE = 'mmmmmmmmmmlliWW漢字';
const PROBE_FALLBACKS = ['monospace', 'serif', 'sans-serif'] as const;

/** 浏览器 canvas 字体测量探针（同一字号下比较宽度差异） */
export function createSystemFontProbe(): FontProbe {
  if (typeof document === 'undefined') return () => null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => null;
  return (font: string) => {
    ctx.font = font;
    return ctx.measureText(PROBE_SAMPLE).width;
  };
}

/**
 * 判断字体是否真实安装：与三个通用族逐一比对，只要有一个宽度不同即视为已安装。
 * 若字体缺失，浏览器会完全回退到通用族，宽度与基准一致。
 */
export function isFontInstalled(name: string, probe: FontProbe): boolean {
  return PROBE_FALLBACKS.some((fallback) => {
    const base = probe(`72px ${fallback}`);
    const test = probe(`72px "${name}", ${fallback}`);
    if (base === null || test === null) return false;
    return Math.abs(test - base) > 0.01;
  });
}

/** 探测系统已安装的候选字体（保持候选清单顺序）；探测不可用时返回空数组 */
export function detectInstalledFonts(
  probe: FontProbe,
  candidates: readonly FontCandidate[] = FONT_CANDIDATES,
): FontCandidate[] {
  if (probe(`72px sans-serif`) === null) return [];
  return candidates.filter((candidate) => isFontInstalled(candidate.name, probe));
}

/**
 * 构建字体下拉选项：
 * 首项为「文档默认字体」（显示具体字体名，未安装时由调用方传入通用文案），
 * 其后为系统已安装的具体字体（与首项重名时去重）。
 */
export function buildFontOptions(
  available: readonly FontCandidate[],
  defaultLabel: string,
  excludeName = '',
): { value: string; label: string }[] {
  const options = [{ value: '', label: defaultLabel }];
  const seen = new Set<string>([(excludeName || defaultLabel).toLowerCase()]);
  available.forEach((candidate) => {
    const key = candidate.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ value: fontStackFor(candidate), label: candidate.name });
  });
  return options;
}

/** 已设置的字体系列（可能是旧版字体栈）→ 下拉可匹配的选项值 */
export function matchFontOption(
  stack: string | null | undefined,
  options: readonly { value: string; label: string }[],
): string {
  if (!stack) return '';
  const exact = options.find((option) => option.value === stack);
  if (exact) return exact.value;
  const name = firstFontFamily(stack);
  if (!name) return '';
  const lower = name.toLowerCase();
  const byName = options.find((option) => option.label.toLowerCase() === lower);
  return byName ? byName.value : '';
}
