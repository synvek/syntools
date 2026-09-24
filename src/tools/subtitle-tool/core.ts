import type { ToolResult } from '@/core/types';

export type SubFormat = 'srt' | 'vtt';

export interface Cue {
  index: number;
  start: number;
  end: number;
  text: string;
}

const TIME_RE = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/;

function parseTimestamp(raw: string): number | null {
  const m = TIME_RE.exec(raw.trim());
  if (!m) return null;
  const [, hh, mm, ss, ms] = m;
  return Number(hh) * 3600000 + Number(mm) * 60000 + Number(ss) * 1000 + Number(ms.padEnd(3, '0'));
}

/** 将毫秒格式化为时间戳。srt 用逗号分隔毫秒，vtt 用点。 */
export function formatTimestamp(ms: number, format: SubFormat = 'srt'): string {
  const clamped = Math.max(0, Math.round(ms));
  const hh = Math.floor(clamped / 3600000);
  const mm = Math.floor((clamped % 3600000) / 60000);
  const ss = Math.floor((clamped % 60000) / 1000);
  const millis = clamped % 1000;
  const sep = format === 'srt' ? ',' : '.';
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${sep}${pad(millis, 3)}`;
}

function parseBlocks(text: string): { start: number; end: number; text: string }[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const blocks = normalized.split(/\n{2,}/);
  const cues: { start: number; end: number; text: string }[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) continue;
    // 找到包含 --> 的时间行
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx < 0) continue;
    const [startRaw, endRaw] = lines[timeIdx].split('-->');
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw ?? '');
    if (start === null || end === null) continue;
    const body = lines.slice(timeIdx + 1).join('\n');
    cues.push({ start, end, text: body });
  }
  return cues;
}

export function parseSrt(text: string): ToolResult<Cue[]> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  const raw = parseBlocks(text);
  if (raw.length === 0) return { ok: false, error: 'INVALID' };
  return { ok: true, value: raw.map((c, i) => ({ index: i + 1, ...c })) };
}

export function parseVtt(text: string): ToolResult<Cue[]> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  const withoutHeader = text.replace(/^\uFEFF?WEBVTT[^\n]*\n/, '');
  const raw = parseBlocks(withoutHeader);
  if (raw.length === 0) return { ok: false, error: 'INVALID' };
  return { ok: true, value: raw.map((c, i) => ({ index: i + 1, ...c })) };
}

/** 自动识别格式并解析。 */
export function parseSubtitle(text: string): ToolResult<{ format: SubFormat; cues: Cue[] }> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  const isVtt = /^\uFEFF?WEBVTT/.test(text.trimStart());
  const parsed = isVtt ? parseVtt(text) : parseSrt(text);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { format: isVtt ? 'vtt' : 'srt', cues: parsed.value } };
}

export function toSrt(cues: Cue[]): string {
  return cues
    .map(
      (c, i) =>
        `${i + 1}\n${formatTimestamp(c.start, 'srt')} --> ${formatTimestamp(c.end, 'srt')}\n${c.text}`,
    )
    .join('\n\n');
}

export function toVtt(cues: Cue[]): string {
  const body = cues
    .map(
      (c) => `${formatTimestamp(c.start, 'vtt')} --> ${formatTimestamp(c.end, 'vtt')}\n${c.text}`,
    )
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

/** 整体平移时间轴（offsetMs 可为负）。 */
export function shiftCues(cues: Cue[], offsetMs: number): Cue[] {
  return cues.map((c) => ({
    ...c,
    start: Math.max(0, c.start + offsetMs),
    end: Math.max(0, c.end + offsetMs),
  }));
}

export function convertSubtitle(text: string, target: SubFormat, offsetMs = 0): ToolResult<string> {
  const parsed = parseSubtitle(text);
  if (!parsed.ok) return parsed;
  const cues = offsetMs ? shiftCues(parsed.value.cues, offsetMs) : parsed.value.cues;
  return { ok: true, value: target === 'vtt' ? toVtt(cues) : toSrt(cues) };
}
