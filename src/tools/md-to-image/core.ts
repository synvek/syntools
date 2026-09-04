import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { ToolResult } from '@/core/types';

/**
 * Markdown 转图片：解析 + 消毒，以及导出卡片样式选项。
 */

export type MdToImageError =
  | 'EMPTY'
  | 'PARSE'
  | 'INVALID_COLOR'
  | 'INVALID_SIZE'
  | 'INVALID_FONT';

export interface MdToImageOptions {
  gfm: boolean;
  breaks: boolean;
}

export type MdFontId = 'sans' | 'serif' | 'mono' | 'song' | 'hei';

export interface MdCardStyle {
  background: string;
  color: string;
  font: MdFontId;
  fontSize: number;
  width: number;
  padding: number;
  lineHeight: number;
}

export const MD_FONTS: { id: MdFontId; stack: string }[] = [
  {
    id: 'sans',
    stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif',
  },
  {
    id: 'serif',
    stack: 'ui-serif, Georgia, "Noto Serif SC", "Songti SC", "SimSun", serif',
  },
  {
    id: 'mono',
    stack: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Noto Sans Mono CJK SC", monospace',
  },
  {
    id: 'song',
    stack: '"Songti SC", "STSong", "SimSun", "Noto Serif SC", serif',
  },
  {
    id: 'hei',
    stack: '"Heiti SC", "STHeiti", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  },
];

export const FONT_MAP = Object.fromEntries(MD_FONTS.map((f) => [f.id, f.stack])) as Record<
  MdFontId,
  string
>;

export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 28;
export const MIN_WIDTH = 320;
export const MAX_WIDTH = 1200;
export const MIN_PADDING = 8;
export const MAX_PADDING = 80;
export const MIN_LINE_HEIGHT = 1.2;
export const MAX_LINE_HEIGHT = 2.2;

export const DEFAULT_MD_OPTIONS: MdToImageOptions = { gfm: true, breaks: false };

export const DEFAULT_CARD_STYLE: MdCardStyle = {
  background: '#ffffff',
  color: '#111827',
  font: 'sans',
  fontSize: 15,
  width: 640,
  padding: 32,
  lineHeight: 1.7,
};

export const DEFAULT_MARKDOWN = `# Hello SynTools

Write **Markdown** and export as PNG.

- Lists work
- \`code\` too

> Quote block
`;

/** 归一化为 #RRGGBB */
export function normalizeHexColor(input: string): string | null {
  const raw = input.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(raw);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(raw);
  if (full) return `#${full[1]}`.toLowerCase();
  return null;
}

export function isMdFontId(v: string): v is MdFontId {
  return MD_FONTS.some((f) => f.id === v);
}

export function resolveCardStyle(partial: Partial<MdCardStyle> = {}): ToolResult<MdCardStyle> {
  const background = normalizeHexColor(partial.background ?? DEFAULT_CARD_STYLE.background);
  const color = normalizeHexColor(partial.color ?? DEFAULT_CARD_STYLE.color);
  if (!background || !color) return { ok: false, error: 'INVALID_COLOR' };

  const font = partial.font ?? DEFAULT_CARD_STYLE.font;
  if (!isMdFontId(font)) return { ok: false, error: 'INVALID_FONT' };

  const fontSize = Math.round(Number(partial.fontSize ?? DEFAULT_CARD_STYLE.fontSize));
  const width = Math.round(Number(partial.width ?? DEFAULT_CARD_STYLE.width));
  const padding = Math.round(Number(partial.padding ?? DEFAULT_CARD_STYLE.padding));
  const lineHeight = Number(partial.lineHeight ?? DEFAULT_CARD_STYLE.lineHeight);

  if (
    !Number.isFinite(fontSize) ||
    fontSize < MIN_FONT_SIZE ||
    fontSize > MAX_FONT_SIZE ||
    !Number.isFinite(width) ||
    width < MIN_WIDTH ||
    width > MAX_WIDTH ||
    !Number.isFinite(padding) ||
    padding < MIN_PADDING ||
    padding > MAX_PADDING ||
    !Number.isFinite(lineHeight) ||
    lineHeight < MIN_LINE_HEIGHT ||
    lineHeight > MAX_LINE_HEIGHT
  ) {
    return { ok: false, error: 'INVALID_SIZE' };
  }

  return {
    ok: true,
    value: {
      background,
      color,
      font,
      fontSize,
      width,
      padding,
      lineHeight: Math.round(lineHeight * 100) / 100,
    },
  };
}

/** 导出卡片内联样式（不受全局 dark 主题影响） */
export type CardCssProperties = {
  background: string;
  color: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  width: string;
  minWidth: string;
  maxWidth: string;
  padding: string;
  boxSizing: 'border-box';
};

export function toCardCss(style: MdCardStyle): CardCssProperties {
  const w = `${style.width}px`;
  return {
    background: style.background,
    color: style.color,
    fontFamily: FONT_MAP[style.font],
    fontSize: `${style.fontSize}px`,
    lineHeight: String(style.lineHeight),
    // 固定宽度，避免被预览栏 max-width:100% / 网格压缩导致「宽度无效」
    width: w,
    minWidth: w,
    maxWidth: w,
    padding: `${style.padding}px`,
    boxSizing: 'border-box',
  };
}

/** Markdown → 消毒后的 HTML */
export function prepareMarkdownHtml(
  text: string,
  options: MdToImageOptions = DEFAULT_MD_OPTIONS,
): ToolResult<string> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  try {
    const html = marked.parse(text, {
      async: false,
      gfm: options.gfm,
      breaks: options.breaks,
    });
    return { ok: true, value: DOMPurify.sanitize(String(html)) };
  } catch {
    return { ok: false, error: 'PARSE' };
  }
}
