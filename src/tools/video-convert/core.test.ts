import { describe, expect, it } from 'vitest';
import { buildConvertOptions, formatDuration, outputFileName, type VideoConvertForm } from './core';

const base: VideoConvertForm = {
  target: 'mp4',
  quality: 'medium',
  width: null,
  trimStart: null,
  trimEnd: null,
};

describe('video-convert buildConvertOptions', () => {
  it('最小表单只含目标与质量', () => {
    const r = buildConvertOptions(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ target: 'mp4', quality: 'medium' });
  });

  it('包含缩放与裁剪', () => {
    const r = buildConvertOptions({ ...base, width: 1280, trimStart: 1.5, trimEnd: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.video).toEqual({ width: 1280 });
      expect(r.value.trim).toEqual({ start: 1.5, end: 5 });
    }
  });

  it('非法目标报错', () => {
    const r = buildConvertOptions({ ...base, target: 'mp3' as never });
    expect(r).toEqual({ ok: false, error: 'INVALID_TARGET' });
  });

  it('裁剪区间非法报错', () => {
    const r = buildConvertOptions({ ...base, trimStart: 5, trimEnd: 2 });
    expect(r).toEqual({ ok: false, error: 'INVALID_TRIM' });
  });

  it('宽度为 0 或负数被忽略', () => {
    const r = buildConvertOptions({ ...base, width: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.video).toBeUndefined();
  });
});

describe('video-convert 辅助函数', () => {
  it('formatDuration', () => {
    expect(formatDuration(83.4)).toBe('1:23.4');
    expect(formatDuration(0)).toBe('0:00.0');
    expect(formatDuration(Number.NaN)).toBe('--:--');
  });

  it('outputFileName 替换扩展名', () => {
    expect(outputFileName('clip.mov', 'webm')).toBe('clip.webm');
    expect(outputFileName('no-ext', 'mp4')).toBe('no-ext.mp4');
    expect(outputFileName('', 'mp4')).toBe('output.mp4');
  });
});
