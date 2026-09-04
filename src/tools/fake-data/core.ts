import type { ToolResult } from '@/core/types';

export type FakeDataErrorCode = 'EMPTY' | 'INVALID_COUNT';
export type FakeKind = 'name' | 'email' | 'uuid' | 'lorem';
export type FakeLocale = 'zh' | 'en';

const MIN = 1;
const MAX = 50;

const ZH_SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴'];
const ZH_GIVEN = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明'];
const EN_FIRST = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack'];
const EN_LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
const LOREM_EN = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
];
const LOREM_ZH = [
  '天地玄黄，宇宙洪荒。日月盈昃，辰宿列张。',
  '寒来暑往，秋收冬藏。闰余成岁，律吕调阳。',
  '云腾致雨，露结为霜。金生丽水，玉出昆冈。',
  '剑号巨阙，珠称夜光。果珍李柰，菜重芥姜。',
  '海咸河淡，鳞潜羽翔。龙师火帝，鸟官人皇。',
];

function randInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(arr.length)];
}

function randomUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function oneItem(kind: FakeKind, locale: FakeLocale): string {
  if (kind === 'uuid') return randomUuid();
  if (kind === 'name') {
    if (locale === 'zh') return `${pick(ZH_SURNAMES)}${pick(ZH_GIVEN)}${pick(ZH_GIVEN)}`;
    return `${pick(EN_FIRST)} ${pick(EN_LAST)}`;
  }
  if (kind === 'email') {
    const local =
      locale === 'zh'
        ? `user${randInt(9999)}`
        : `${pick(EN_FIRST).toLowerCase()}.${pick(EN_LAST).toLowerCase()}${randInt(99)}`;
    return `${local}@example.com`;
  }
  // lorem paragraph
  const pool = locale === 'zh' ? LOREM_ZH : LOREM_EN;
  const count = 2 + randInt(3);
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) parts.push(pick(pool));
  return parts.join(locale === 'zh' ? '' : ' ');
}

/** Generate fake name/email/uuid/lorem; count 1–50 */
export function generateFakeData(
  kind: FakeKind,
  count: number,
  locale: FakeLocale,
): ToolResult<string> {
  if (!Number.isFinite(count) || !Number.isInteger(count)) {
    return { ok: false, error: 'INVALID_COUNT' };
  }
  if (count < MIN || count > MAX) return { ok: false, error: 'INVALID_COUNT' };
  const lines: string[] = [];
  for (let i = 0; i < count; i += 1) lines.push(oneItem(kind, locale));
  return { ok: true, value: lines.join('\n') };
}

export { MIN as FAKE_MIN, MAX as FAKE_MAX };
