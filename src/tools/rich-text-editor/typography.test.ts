import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_SIZE_PX,
  DEFAULT_LINE_HEIGHT,
  FONT_CANDIDATES,
  buildFontOptions,
  detectDefaultFontName,
  detectInstalledFonts,
  firstFontFamily,
  fontStackFor,
  isFontInstalled,
  matchFontOption,
  pxToHalfPoints,
  type FontCandidate,
} from './typography';

// 直接读取样式表，保证「默认字号/行距」文案与真实渲染值不会漂移
const css = readFileSync(resolve(process.cwd(), 'src/tools/rich-text-editor/editor.css'), 'utf8');

const ARIAL: FontCandidate = { name: 'Arial', fallback: 'sans-serif' };
const SONG: FontCandidate = { name: 'Songti SC', fallback: 'serif' };

describe('firstFontFamily（字体栈 → 具体字体名）', () => {
  it('跳过通用族关键字，取第一个具体字体', () => {
    expect(firstFontFamily('system-ui, sans-serif')).toBeNull();
    expect(firstFontFamily('"Arial", "Helvetica Neue", sans-serif')).toBe('Arial');
    expect(firstFontFamily('Georgia, "Times New Roman", serif')).toBe('Georgia');
    expect(firstFontFamily('"PingFang SC", sans-serif')).toBe('PingFang SC');
  });

  it('空值与纯关键字返回 null', () => {
    expect(firstFontFamily('')).toBeNull();
    expect(firstFontFamily(undefined)).toBeNull();
    expect(firstFontFamily('monospace')).toBeNull();
  });
});

describe('fontStackFor', () => {
  it('名称加引号并带兜底族（含空格/中文也安全）', () => {
    expect(fontStackFor(SONG)).toBe('"Songti SC", serif');
  });
});

describe('pxToHalfPoints（px → Word 半磅）', () => {
  it('按 1px = 0.75pt 换算为半磅值', () => {
    expect(pxToHalfPoints(16)).toBe(24);
    expect(pxToHalfPoints(15)).toBe(23);
    expect(pxToHalfPoints(24)).toBe(36);
  });

  it('非法值返回 null', () => {
    expect(pxToHalfPoints(0)).toBeNull();
    expect(pxToHalfPoints(Number.NaN)).toBeNull();
  });
});

describe('detectDefaultFontName', () => {
  it('按平台给出具体默认字体名', () => {
    expect(detectDefaultFontName('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel')).toBe(
      'PingFang SC',
    );
    expect(detectDefaultFontName('Mozilla/5.0 (Windows NT 10.0)', 'Win32')).toBe('Microsoft YaHei');
    expect(detectDefaultFontName('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64')).toBe(
      'Noto Sans CJK SC',
    );
  });
});

describe('isFontInstalled（canvas 宽度比对）', () => {
  it('与通用族宽度不同即视为已安装', () => {
    const probe = (font: string) => (font.includes('Arial') ? 120 : 100);
    expect(isFontInstalled('Arial', probe)).toBe(true);
  });

  it('宽度完全一致说明字体缺失（回退到通用族）', () => {
    const probe = () => 100;
    expect(isFontInstalled('Arial', probe)).toBe(false);
  });

  it('探测不可用时视为未安装', () => {
    expect(isFontInstalled('Arial', () => null)).toBe(false);
  });
});

describe('detectInstalledFonts', () => {
  it('探测不可用（无 canvas）时返回空数组，由调用方退回通用选项', () => {
    expect(detectInstalledFonts(() => null)).toEqual([]);
  });

  it('只保留已安装字体且维持候选顺序', () => {
    const probe = (font: string) => (font.includes('Arial') || font.includes('Songti') ? 120 : 100);
    const installed = detectInstalledFonts(probe, [ARIAL, SONG]);
    expect(installed.map((font) => font.name)).toEqual(['Arial', 'Songti SC']);
  });
});

describe('buildFontOptions', () => {
  it('首项为默认字体（显示具体字体名），其余为系统字体', () => {
    const options = buildFontOptions([ARIAL], 'Helvetica Neue', 'Helvetica Neue');
    expect(options[0]).toEqual({ value: '', label: 'Helvetica Neue' });
    expect(options[1]).toEqual({ value: '"Arial", sans-serif', label: 'Arial' });
  });

  it('默认字体已在候选列表中时去重，避免同名两项', () => {
    const options = buildFontOptions([ARIAL], 'Arial', 'Arial');
    expect(options.map((option) => option.label)).toEqual(['Arial']);
  });

  it('默认字体未安装时使用传入的通用文案', () => {
    const options = buildFontOptions([ARIAL], '默认字体', 'Noto Sans CJK SC');
    // 未安装的默认字体名不会被候选清单过滤掉，仍可按名称去重
    expect(options[0]).toEqual({ value: '', label: '默认字体' });
  });
});

describe('matchFontOption（旧文档的字体栈回填下拉）', () => {
  const options = buildFontOptions([ARIAL], 'PingFang SC', 'PingFang SC');

  it('完全相同的值直接命中', () => {
    expect(matchFontOption('"Arial", sans-serif', options)).toBe('"Arial", sans-serif');
  });

  it('旧版字体栈按具体字体名回填', () => {
    expect(matchFontOption('"Arial", "Helvetica Neue", sans-serif', options)).toBe(
      '"Arial", sans-serif',
    );
  });

  it('未设置或无法匹配时回到默认项', () => {
    expect(matchFontOption('', options)).toBe('');
    expect(matchFontOption('"Unknown Font", serif', options)).toBe('');
  });
});

describe('默认排版值与样式表保持一致', () => {
  it('候选字体清单无重复且均为具体字体名', () => {
    const names = FONT_CANDIDATES.map((font) => font.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('字号/行距默认值与 editor.css 的 .tiptap 声明一致', () => {
    const block = /\.rte-surface \.tiptap \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toContain(`font-size: ${DEFAULT_FONT_SIZE_PX}px`);
    expect(block).toContain(`line-height: ${DEFAULT_LINE_HEIGHT}`);
  });

  it('打印流与编辑器使用相同默认值（WYSIWYG 前提）', () => {
    // .rte-print-flow 有多个声明块（浮动图片定位等），取含字号声明的那一个
    const block =
      [...css.matchAll(/\.rte-print-flow \{([^}]*)\}/g)]
        .map((match) => match[1])
        .find((body) => body.includes('font-size')) ?? '';
    expect(block).toContain(`font-size: ${DEFAULT_FONT_SIZE_PX}px`);
    expect(block).toContain(`line-height: ${DEFAULT_LINE_HEIGHT}`);
  });
});
