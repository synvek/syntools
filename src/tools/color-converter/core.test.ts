import { describe, expect, it } from 'vitest';
import {
  COLOR_FORMATS,
  formatColor,
  hslToRgb,
  parseColor,
  rgbToHex,
  rgbToHsl,
  type RgbColor,
} from './core';

const ok = (input: string): RgbColor => {
  const result = parseColor(input);
  expect(result.ok).toBe(true);
  return result.ok ? result.value : { r: 0, g: 0, b: 0 };
};

describe('parseColor', () => {
  it('HEX：3/6 位与大小写', () => {
    expect(ok('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(ok('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(ok(' #1a2b3c ')).toEqual({ r: 26, g: 43, b: 60 });
  });

  it('HEX：带 alpha 的 4/8 位忽略透明度', () => {
    expect(ok('#f008')).toEqual({ r: 255, g: 0, b: 0 });
    expect(ok('#ff000080')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('rgb()/rgba()：逗号与空格分隔、alpha 忽略、百分比通道', () => {
    expect(ok('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 });
    expect(ok('rgba(0 128 255 / 0.5)')).toEqual({ r: 0, g: 128, b: 255 });
    expect(ok('rgb(100%, 0%, 0%)')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('hsl()/hsla()：标准值与负角度归一化', () => {
    expect(ok('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 });
    expect(ok('hsl(120, 100%, 50%)')).toEqual({ r: 0, g: 255, b: 0 });
    expect(ok('hsl(-120 100% 50%)')).toEqual({ r: 0, g: 0, b: 255 });
    expect(ok('hsla(240, 100%, 50%, 0.3)')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('通道超范围被钳制', () => {
    expect(ok('rgb(300, -20, 128)')).toEqual({ r: 255, g: 0, b: 128 });
  });

  it('空输入返回 EMPTY', () => {
    expect(parseColor('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseColor('   ')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法输入返回 INVALID', () => {
    expect(parseColor('#gg0000')).toEqual({ ok: false, error: 'INVALID' });
    expect(parseColor('#12345')).toEqual({ ok: false, error: 'INVALID' });
    expect(parseColor('rgb(255, 0)')).toEqual({ ok: false, error: 'INVALID' });
    expect(parseColor('rgb(255, 0, 0, 1, 2)')).toEqual({ ok: false, error: 'INVALID' });
    expect(parseColor('hsl(0, 100%, abc%)')).toEqual({ ok: false, error: 'INVALID' });
    expect(parseColor('red')).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('rgbToHex', () => {
  it('标准转换（小写、补零）', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(rgbToHex({ r: 26, g: 43, b: 60 })).toBe('#1a2b3c');
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  });

  it('越界与非整数被钳制并四舍五入', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 127.6 })).toBe('#ff0080');
  });
});

describe('rgbToHsl / hslToRgb', () => {
  it('基色转换', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
    expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(hslToRgb({ h: 240, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('灰阶：饱和度为 0', () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, l: 50 });
    expect(hslToRgb({ h: 200, s: 0, l: 50 })).toEqual({ r: 128, g: 128, b: 128 });
    expect(hslToRgb({ h: 0, s: 0, l: 100 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('角度归一化：h 超范围等价取模', () => {
    expect(hslToRgb({ h: 360, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hslToRgb({ h: -120, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('HEX → HSL → RGB → HEX 往返一致（HSL 取整无损的颜色集）', () => {
    const exact = [
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#00ffff',
      '#808080',
      '#ffcc00',
      '#ffffff',
      '#000000',
    ];
    for (const hex of exact) {
      const rgb = ok(hex);
      const back = hslToRgb(rgbToHsl(rgb));
      expect(rgbToHex(back)).toBe(hex);
    }
  });
});

describe('formatColor', () => {
  const color: RgbColor = { r: 255, g: 0, b: 0 };

  it('三种格式输出', () => {
    expect(formatColor(color, 'hex')).toBe('#ff0000');
    expect(formatColor(color, 'rgb')).toBe('rgb(255, 0, 0)');
    expect(formatColor(color, 'hsl')).toBe('hsl(0, 100%, 50%)');
  });

  it('格式白名单', () => {
    expect(COLOR_FORMATS).toEqual(['hex', 'rgb', 'hsl']);
  });
});
