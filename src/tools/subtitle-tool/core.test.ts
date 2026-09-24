import { describe, expect, it } from 'vitest';
import { convertSubtitle, formatTimestamp, parseSubtitle, shiftCues, toSrt, toVtt } from './core';

const SRT = `1
00:00:01,000 --> 00:00:03,500
Hello world

2
00:00:04,000 --> 00:00:06,000
Second line
with two rows`;

describe('subtitle-tool 时间戳', () => {
  it('格式化 srt / vtt', () => {
    expect(formatTimestamp(3661500, 'srt')).toBe('01:01:01,500');
    expect(formatTimestamp(3661500, 'vtt')).toBe('01:01:01.500');
  });
});

describe('subtitle-tool 解析', () => {
  it('解析 SRT', () => {
    const r = parseSubtitle(SRT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.format).toBe('srt');
    expect(r.value.cues).toHaveLength(2);
    expect(r.value.cues[0]).toMatchObject({ start: 1000, end: 3500, text: 'Hello world' });
    expect(r.value.cues[1].text).toBe('Second line\nwith two rows');
  });

  it('空输入报错', () => {
    expect(parseSubtitle('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法内容报错', () => {
    const r = parseSubtitle('no timestamps here');
    expect(r.ok).toBe(false);
  });
});

describe('subtitle-tool 转换', () => {
  it('SRT → VTT', () => {
    const r = convertSubtitle(SRT, 'vtt');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.startsWith('WEBVTT')).toBe(true);
    expect(r.value).toContain('00:00:01.000 --> 00:00:03.500');
  });

  it('VTT → SRT 往返一致', () => {
    const vtt = toVtt([
      { index: 1, start: 1000, end: 2000, text: 'A' },
      { index: 2, start: 3000, end: 4000, text: 'B' },
    ]);
    const r = convertSubtitle(vtt, 'srt');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('00:00:01,000 --> 00:00:02,000');
    expect(r.value).toContain('00:00:03,000 --> 00:00:04,000');
  });

  it('时间轴平移', () => {
    const shifted = shiftCues([{ index: 1, start: 1000, end: 2000, text: 'x' }], 500);
    expect(shifted[0]).toMatchObject({ start: 1500, end: 2500 });
  });

  it('负向平移不小于 0', () => {
    const shifted = shiftCues([{ index: 1, start: 1000, end: 2000, text: 'x' }], -5000);
    expect(shifted[0]).toMatchObject({ start: 0, end: 0 });
  });

  it('toSrt 重新编号', () => {
    const out = toSrt([
      { index: 9, start: 0, end: 1000, text: 'a' },
      { index: 3, start: 1000, end: 2000, text: 'b' },
    ]);
    expect(out.startsWith('1\n')).toBe(true);
    expect(out).toContain('\n\n2\n');
  });
});
