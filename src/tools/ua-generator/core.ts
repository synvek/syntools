export type UaKind =
  | 'chrome-windows'
  | 'chrome-macos'
  | 'chrome-android'
  | 'edge-windows'
  | 'firefox-windows'
  | 'firefox-macos'
  | 'safari-macos'
  | 'safari-ios';

export interface UaPreset {
  id: UaKind;
  label: string;
}

export const UA_PRESETS: UaPreset[] = [
  { id: 'chrome-windows', label: 'Chrome / Windows' },
  { id: 'chrome-macos', label: 'Chrome / macOS' },
  { id: 'chrome-android', label: 'Chrome / Android' },
  { id: 'edge-windows', label: 'Edge / Windows' },
  { id: 'firefox-windows', label: 'Firefox / Windows' },
  { id: 'firefox-macos', label: 'Firefox / macOS' },
  { id: 'safari-macos', label: 'Safari / macOS' },
  { id: 'safari-ios', label: 'Safari / iOS' },
];

const pick = <T>(list: T[], rand: () => number): T => list[Math.floor(rand() * list.length)];

const between = (min: number, max: number, rand: () => number): number =>
  min + Math.floor(rand() * (max - min + 1));

const MACOS_VERSIONS = ['10_15_7', '11_6_8', '12_7_6', '13_6_7', '14_6_1', '15_1'];
const IOS_VERSIONS = ['16_6', '17_0', '17_5', '18_0', '18_1'];
const ANDROID_VERSIONS = ['11', '12', '13', '14'];
const ANDROID_DEVICES = ['Pixel 7', 'SM-S918B', 'Redmi Note 12', 'moto g84', 'V2312DA'];

/** 生成指定平台组合的 User-Agent（rand 可注入以便测试） */
export function generateUa(kind: UaKind, rand: () => number = Math.random): string {
  const chromeMajor = between(118, 131, rand);
  const chromeBuild = between(0, 5900, rand);
  const chromePatch = between(60, 190, rand);
  const chrome = `${chromeMajor}.0.${chromeBuild}.${chromePatch}`;

  switch (kind) {
    case 'chrome-windows':
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`;
    case 'chrome-macos':
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${pick(MACOS_VERSIONS, rand)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`;
    case 'chrome-android':
      return `Mozilla/5.0 (Linux; Android ${pick(ANDROID_VERSIONS, rand)}; ${pick(ANDROID_DEVICES, rand)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Mobile Safari/537.36`;
    case 'edge-windows':
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36 Edg/${chromeMajor}.0.${chromeBuild}.${chromePatch}`;
    case 'firefox-windows':
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${between(115, 132, rand)}.0) Gecko/20100101 Firefox/${between(115, 132, rand)}.0`;
    case 'firefox-macos':
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${pick(MACOS_VERSIONS, rand)}; rv:${between(115, 132, rand)}.0) Gecko/20100101 Firefox/${between(115, 132, rand)}.0`;
    case 'safari-macos':
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${pick(MACOS_VERSIONS, rand)}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${between(16, 18, rand)}.${between(0, 6, rand)} Safari/605.1.15`;
    case 'safari-ios':
      return `Mozilla/5.0 (iPhone; CPU iPhone OS ${pick(IOS_VERSIONS, rand)} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${between(16, 18, rand)}.${between(0, 6, rand)} Mobile/15E148 Safari/604.1`;
  }
}

/** 一次性生成所有预设组合 */
export function generateAll(rand: () => number = Math.random): Array<{ id: UaKind; ua: string }> {
  return UA_PRESETS.map((preset) => ({ id: preset.id, ua: generateUa(preset.id, rand) }));
}
