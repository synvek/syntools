import { describe, expect, it } from 'vitest';
import { generateAll, generateUa, UA_PRESETS } from './core';

describe('generateUa', () => {
  it('为每个预设生成对应平台的 UA', () => {
    expect(generateUa('chrome-windows', () => 0.5)).toContain('Windows NT 10.0');
    expect(generateUa('chrome-windows', () => 0.5)).toContain('Chrome/');
    expect(generateUa('chrome-macos', () => 0.5)).toContain('Macintosh');
    expect(generateUa('chrome-android', () => 0.5)).toContain('Android');
    expect(generateUa('edge-windows', () => 0.5)).toContain('Edg/');
    expect(generateUa('firefox-windows', () => 0.5)).toContain('Firefox/');
    expect(generateUa('firefox-macos', () => 0.5)).toContain('Gecko/20100101');
    expect(generateUa('safari-macos', () => 0.5)).toContain('Version/');
    expect(generateUa('safari-ios', () => 0.5)).toContain('iPhone');
  });

  it('版本号随随机源变化', () => {
    const a = generateUa('chrome-windows', () => 0);
    const b = generateUa('chrome-windows', () => 0.99);
    expect(a).not.toBe(b);
  });

  it('generateAll 覆盖全部预设', () => {
    const all = generateAll(() => 0.42);
    expect(all).toHaveLength(UA_PRESETS.length);
    expect(all.map((x) => x.id)).toEqual(UA_PRESETS.map((p) => p.id));
    for (const item of all) expect(item.ua.length).toBeGreaterThan(20);
  });
});
