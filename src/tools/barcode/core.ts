import type { ToolResult } from '@/core/types';

export type BarcodeType = 'code39' | 'code128' | 'ean13';

export const BARCODE_TYPES: { value: BarcodeType; label: string }[] = [
  { value: 'code39', label: 'Code 39' },
  { value: 'code128', label: 'Code 128' },
  { value: 'ean13', label: 'EAN-13' },
];

export interface Bar {
  /** 模块宽度（1–4） */
  w: number;
  black: boolean;
}

// ---------- Code 39 ----------
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};
const CODE39_WIDE = 3;

function encodeCode39(text: string): ToolResult<Bar[]> {
  const chars = text.toUpperCase().split('');
  const invalid = chars.find((c) => !(c in CODE39));
  if (invalid !== undefined) return { ok: false, error: 'INVALID_CHARS' };
  const bars: Bar[] = [];
  const pushChar = (ch: string) => {
    const pattern = CODE39[ch];
    for (let i = 0; i < pattern.length; i += 1) {
      bars.push({ w: pattern[i] === 'w' ? CODE39_WIDE : 1, black: i % 2 === 0 });
    }
  };
  pushChar('*');
  for (const c of chars) {
    bars.push({ w: 1, black: false }); // 字间窄间隙
    pushChar(c);
  }
  bars.push({ w: 1, black: false });
  pushChar('*');
  return { ok: true, value: bars };
}

// ---------- Code 128 (Code Set B) ----------
const CODE128 = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];
const CODE128_START_B = 104;
const CODE128_STOP = 106;

function appendCode128Pattern(bars: Bar[], value: number) {
  const pattern = CODE128[value];
  for (let i = 0; i < pattern.length; i += 1) {
    bars.push({ w: Number(pattern[i]), black: i % 2 === 0 });
  }
}

function encodeCode128(text: string): ToolResult<Bar[]> {
  const values: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 127) return { ok: false, error: 'INVALID_CHARS' };
    values.push(code - 32);
  }
  const bars: Bar[] = [];
  appendCode128Pattern(bars, CODE128_START_B);
  let checksum = CODE128_START_B;
  values.forEach((v, i) => {
    appendCode128Pattern(bars, v);
    checksum += v * (i + 1);
  });
  appendCode128Pattern(bars, checksum % 103);
  appendCode128Pattern(bars, CODE128_STOP);
  return { ok: true, value: bars };
}

// ---------- EAN-13 ----------
const EAN_L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const EAN_G = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];
const EAN_R = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];
const EAN_PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

/** 计算 EAN-13 校验位（输入前 12 位数字）。 */
export function ean13CheckDigit(digits12: string): number | null {
  if (!/^\d{12}$/.test(digits12)) return null;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

function modulesToBars(modules: string): Bar[] {
  const bars: Bar[] = [];
  let i = 0;
  while (i < modules.length) {
    const black = modules[i] === '1';
    let run = 1;
    while (i + run < modules.length && (modules[i + run] === '1') === black) run += 1;
    bars.push({ w: run, black });
    i += run;
  }
  return bars;
}

function encodeEan13(input: string): ToolResult<{ bars: Bar[]; text: string }> {
  let digits = input.replace(/[\s-]/g, '');
  if (!/^\d{12,13}$/.test(digits)) return { ok: false, error: 'INVALID_CHARS' };
  if (digits.length === 12) digits += String(ean13CheckDigit(digits));
  const check = ean13CheckDigit(digits.slice(0, 12));
  if (check === null || Number(digits[12]) !== check)
    return { ok: false, error: 'INVALID_CHECKSUM' };

  const first = Number(digits[0]);
  const parity = EAN_PARITY[first];
  let modules = '101'; // 起始符
  for (let i = 0; i < 6; i += 1) {
    const d = Number(digits[i + 1]);
    modules += parity[i] === 'L' ? EAN_L[d] : EAN_G[d];
  }
  modules += '01010'; // 中间符
  for (let i = 0; i < 6; i += 1) modules += EAN_R[Number(digits[i + 7])];
  modules += '101'; // 结束符
  return { ok: true, value: { bars: modulesToBars(modules), text: digits } };
}

export interface BarcodeOptions {
  moduleWidth?: number;
  height?: number;
  quietZone?: number;
}

function renderSvg(bars: Bar[], text: string, options: BarcodeOptions): string {
  const moduleWidth = Math.max(1, Math.round(options.moduleWidth ?? 2));
  const height = Math.max(20, Math.round(options.height ?? 80));
  const quiet = options.quietZone ?? 10;
  const totalModules = bars.reduce((sum, b) => sum + b.w, 0) + quiet * 2;
  const width = totalModules * moduleWidth;
  const textHeight = text ? 20 : 0;

  let x = quiet * moduleWidth;
  const rects: string[] = [];
  for (const bar of bars) {
    if (bar.black) {
      rects.push(
        `<rect x="${x}" y="0" width="${bar.w * moduleWidth}" height="${height}" fill="#000" />`,
      );
    }
    x += bar.w * moduleWidth;
  }

  const label = text
    ? `<text x="${width / 2}" y="${height + 16}" text-anchor="middle" font-family="monospace" font-size="14" fill="#000">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + textHeight}" viewBox="0 0 ${width} ${height + textHeight}"><rect width="100%" height="100%" fill="#fff" />${rects.join('')}${label}</svg>`;
}

/** 生成条码 SVG。 */
export function generateBarcode(
  type: BarcodeType,
  text: string,
  options: BarcodeOptions = {},
): ToolResult<string> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };

  if (type === 'ean13') {
    const r = encodeEan13(text);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, value: renderSvg(r.value.bars, r.value.text, options) };
  }
  if (type === 'code39') {
    const r = encodeCode39(text);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, value: renderSvg(r.value, text.toUpperCase(), options) };
  }
  const r = encodeCode128(text);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, value: renderSvg(r.value, text, options) };
}
