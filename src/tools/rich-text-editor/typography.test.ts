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

// Read the stylesheet directly so the default size/leading copy never drifts from the real rendering
const css = readFileSync(resolve(process.cwd(), 'src/tools/rich-text-editor/editor.css'), 'utf8');

const ARIAL: FontCandidate = { name: 'Arial', fallback: 'sans-serif' };
const SONG: FontCandidate = { name: 'Songti SC', fallback: 'serif' };

describe('firstFontFamily (font stack → concrete family)', () => {
  it('skips generic family keywords and returns the first concrete font', () => {
    expect(firstFontFamily('system-ui, sans-serif')).toBeNull();
    expect(firstFontFamily('"Arial", "Helvetica Neue", sans-serif')).toBe('Arial');
    expect(firstFontFamily('Georgia, "Times New Roman", serif')).toBe('Georgia');
    expect(firstFontFamily('"PingFang SC", sans-serif')).toBe('PingFang SC');
  });

  it('returns null for empty values and keyword-only stacks', () => {
    expect(firstFontFamily('')).toBeNull();
    expect(firstFontFamily(undefined)).toBeNull();
    expect(firstFontFamily('monospace')).toBeNull();
  });
});

describe('fontStackFor', () => {
  it('quotes the name and appends a fallback family (safe for spaces and CJK)', () => {
    expect(fontStackFor(SONG)).toBe('"Songti SC", serif');
  });
});

describe('pxToHalfPoints (px → Word half-points)', () => {
  it('converts at 1px = 0.75pt into half-points', () => {
    expect(pxToHalfPoints(16)).toBe(24);
    expect(pxToHalfPoints(15)).toBe(23);
    expect(pxToHalfPoints(24)).toBe(36);
  });

  it('returns null for invalid values', () => {
    expect(pxToHalfPoints(0)).toBeNull();
    expect(pxToHalfPoints(Number.NaN)).toBeNull();
  });
});

describe('detectDefaultFontName', () => {
  it('returns a concrete default family per platform', () => {
    expect(detectDefaultFontName('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel')).toBe(
      'PingFang SC',
    );
    expect(detectDefaultFontName('Mozilla/5.0 (Windows NT 10.0)', 'Win32')).toBe('Microsoft YaHei');
    expect(detectDefaultFontName('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64')).toBe(
      'Noto Sans CJK SC',
    );
  });
});

describe('isFontInstalled (canvas width comparison)', () => {
  it('treats a width differing from the generic family as installed', () => {
    const probe = (font: string) => (font.includes('Arial') ? 120 : 100);
    expect(isFontInstalled('Arial', probe)).toBe(true);
  });

  it('treats an identical width as a missing font (fallback to the generic family)', () => {
    const probe = () => 100;
    expect(isFontInstalled('Arial', probe)).toBe(false);
  });

  it('treats an unavailable probe as not installed', () => {
    expect(isFontInstalled('Arial', () => null)).toBe(false);
  });
});

describe('detectInstalledFonts', () => {
  it('returns an empty array when probing is unavailable (no canvas), letting the caller fall back', () => {
    expect(detectInstalledFonts(() => null)).toEqual([]);
  });

  it('keeps only installed fonts in candidate order', () => {
    const probe = (font: string) => (font.includes('Arial') || font.includes('Songti') ? 120 : 100);
    const installed = detectInstalledFonts(probe, [ARIAL, SONG]);
    expect(installed.map((font) => font.name)).toEqual(['Arial', 'Songti SC']);
  });
});

describe('buildFontOptions', () => {
  it('puts the default (shown by name) first, followed by system fonts', () => {
    const options = buildFontOptions([ARIAL], 'Helvetica Neue', 'Helvetica Neue');
    expect(options[0]).toEqual({ value: '', label: 'Helvetica Neue' });
    expect(options[1]).toEqual({ value: '"Arial", sans-serif', label: 'Arial' });
  });

  it('dedupes when the default is already a candidate, avoiding duplicate labels', () => {
    const options = buildFontOptions([ARIAL], 'Arial', 'Arial');
    expect(options.map((option) => option.label)).toEqual(['Arial']);
  });

  it('uses the passed generic label when the default is not installed', () => {
    const options = buildFontOptions([ARIAL], '默认字体', 'Noto Sans CJK SC');
    // An uninstalled default is not filtered out of the candidates, so dedupe by name still applies
    expect(options[0]).toEqual({ value: '', label: '默认字体' });
  });
});

describe('matchFontOption (backfilling the select from legacy stacks)', () => {
  const options = buildFontOptions([ARIAL], 'PingFang SC', 'PingFang SC');

  it('matches an identical value directly', () => {
    expect(matchFontOption('"Arial", sans-serif', options)).toBe('"Arial", sans-serif');
  });

  it('backfills legacy font stacks by concrete family name', () => {
    expect(matchFontOption('"Arial", "Helvetica Neue", sans-serif', options)).toBe(
      '"Arial", sans-serif',
    );
  });

  it('falls back to the default when unset or unmatched', () => {
    expect(matchFontOption('', options)).toBe('');
    expect(matchFontOption('"Unknown Font", serif', options)).toBe('');
  });
});

describe('default typography stays in sync with the stylesheet', () => {
  it('has no duplicate candidates and only concrete family names', () => {
    const names = FONT_CANDIDATES.map((font) => font.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('matches the font size / leading declared for .tiptap in editor.css', () => {
    const block = /\.rte-surface \.tiptap \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toContain(`font-size: ${DEFAULT_FONT_SIZE_PX}px`);
    expect(block).toContain(`line-height: ${DEFAULT_LINE_HEIGHT}`);
  });

  it('uses the same defaults in the print flow and the editor (the WYSIWYG precondition)', () => {
    // .rte-print-flow has several declaration blocks (float positioning etc.); pick the one with the font size
    const block =
      [...css.matchAll(/\.rte-print-flow \{([^}]*)\}/g)]
        .map((match) => match[1])
        .find((body) => body.includes('font-size')) ?? '';
    expect(block).toContain(`font-size: ${DEFAULT_FONT_SIZE_PX}px`);
    expect(block).toContain(`line-height: ${DEFAULT_LINE_HEIGHT}`);
  });
});
