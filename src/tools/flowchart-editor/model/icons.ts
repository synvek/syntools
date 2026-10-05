/**
 * 内置图标库（内联 SVG path，24×24 视图框，描边走 currentColor）。
 *
 * 不引入任何图标依赖：图标随工具 chunk 一起加载，节点渲染只用 path，
 * 因此导出 SVG/PNG 与画布完全一致。
 */

export type IconGroup = 'general' | 'office' | 'tech' | 'people';

export interface IconDef {
  id: string;
  group: IconGroup;
  /** 一组 path d 指令（统一 24×24 视图框、无填充、描边 currentColor） */
  paths: string[];
}

export const ICON_GROUPS: IconGroup[] = ['general', 'office', 'tech', 'people'];

function circle(cx: number, cy: number, r: number): string {
  return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
}

export const ICONS: IconDef[] = [
  // 通用
  {
    id: 'star',
    group: 'general',
    paths: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.2L12 17.1l-5.4 2.9 1-6.2L3.2 9.5l6.1-.9L12 3'],
  },
  { id: 'check', group: 'general', paths: ['M4 12.5l5 5L20 6.5'] },
  { id: 'cross', group: 'general', paths: ['M6 6l12 12M18 6L6 18'] },
  {
    id: 'heart',
    group: 'general',
    paths: ['M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 7.4a3.9 3.9 0 0 1 7 3.2C19 15.4 12 20 12 20z'],
  },
  {
    id: 'bell',
    group: 'general',
    paths: ['M6 16v-5a6 6 0 1 1 12 0v5l1.5 2.5h-15z', 'M10 20.5a2 2 0 0 0 4 0'],
  },
  { id: 'flag', group: 'general', paths: ['M6 3v18', 'M6 4.5h11l-2 4 2 4H6'] },
  { id: 'tag', group: 'general', paths: ['M12 3l9 9-9 9-9-9 9-9z', circle(12, 12, 2)] },
  { id: 'bookmark', group: 'general', paths: ['M7 3h10v18l-5-4-5 4V3z'] },
  { id: 'clock', group: 'general', paths: [circle(12, 12, 8), 'M12 8v5l3 2'] },
  { id: 'placeholder', group: 'general', paths: ['M4 5h16v14H4z', 'M4 15l4-4 4 4 3-3 5 5'] },

  // 文档与办公
  { id: 'file', group: 'office', paths: ['M7 3h7l5 5v13H7z', 'M14 3v5h5'] },
  { id: 'folder', group: 'office', paths: ['M3 6h6l2 2h10v11H3z'] },
  { id: 'document', group: 'office', paths: ['M6 3h8l4 4v14H6z', 'M9 12h6', 'M9 16h6'] },
  { id: 'mail', group: 'office', paths: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'] },
  { id: 'clipboard', group: 'office', paths: ['M9 4h6v3H9z', 'M7 6h10v14H7z'] },
  { id: 'calendar', group: 'office', paths: ['M4 5h16v15H4z', 'M4 9.5h16', 'M9 3v4', 'M15 3v4'] },
  { id: 'chart', group: 'office', paths: ['M2 20h20', 'M5 20V11', 'M11 20V5', 'M17 20v-6'] },
  { id: 'table', group: 'office', paths: ['M3 5h18v14H3z', 'M3 10h18', 'M9 5v14', 'M15 5v14'] },
  {
    id: 'link',
    group: 'office',
    paths: ['M9 12h6', 'M8 8H6a4 4 0 0 0 0 8h2', 'M16 8h2a4 4 0 0 1 0 8h-2'],
  },

  // 设备与技术
  {
    id: 'cloud',
    group: 'tech',
    paths: ['M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z'],
  },
  {
    id: 'database',
    group: 'tech',
    paths: [
      circle(12, 6, 5),
      'M7 6v12c0 1.7 2.2 3 5 3s5-1.3 5-3V6',
      'M7 12c0 1.7 2.2 3 5 3s5-1.3 5-3',
    ],
  },
  {
    id: 'server',
    group: 'tech',
    paths: ['M4 5h16v6H4z', 'M4 13h16v6H4z', 'M8 8h.01', 'M8 16h.01'],
  },
  { id: 'shield', group: 'tech', paths: ['M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z'] },
  { id: 'lock', group: 'tech', paths: ['M6 11h12v9H6z', 'M9 11V8a3 3 0 0 1 6 0v3'] },
  {
    id: 'key',
    group: 'tech',
    paths: [circle(8, 8, 3), 'M10 10l8 8', 'M15.5 15.5l2-2', 'M18.5 18.5l2-2'],
  },
  {
    id: 'gear',
    group: 'tech',
    paths: [
      circle(12, 12, 3),
      'M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8',
    ],
  },
  {
    id: 'cpu',
    group: 'tech',
    paths: ['M6 6h12v12H6z', 'M10 10h4v4h-4z', 'M12 3v3M12 18v3M3 12h3M18 12h3'],
  },
  {
    id: 'wifi',
    group: 'tech',
    paths: ['M5 11a10 10 0 0 1 14 0', 'M8 14.5a6 6 0 0 1 8 0', circle(12, 18, 1)],
  },
  { id: 'code', group: 'tech', paths: ['M9 7l-5 5 5 5', 'M15 7l5 5-5 5'] },

  // 人物与协作
  { id: 'user', group: 'people', paths: [circle(12, 8, 4), 'M4 21c0-4 3.6-6 8-6s8 2 8 6'] },
  {
    id: 'users',
    group: 'people',
    paths: [circle(9, 8, 3.5), 'M2 21c0-3.4 3.1-5 7-5s7 1.6 7 5', 'M16 5.5a3 3 0 0 1 0 6'],
  },
  {
    id: 'team',
    group: 'people',
    paths: ['M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M6 20c0-3 2.7-5 6-5s6 2 6 5', 'M4 6h3M4 9h3'],
  },
  { id: 'chat', group: 'people', paths: ['M4 5h16v11H9l-5 4z'] },
  { id: 'approve', group: 'people', paths: [circle(12, 12, 8), 'M8.5 12.5l2.5 2.5 4.5-5'] },
];

const ICON_MAP = new Map(ICONS.map((icon) => [icon.id, icon] as const));

export function iconDefOf(id: string | undefined): IconDef | undefined {
  return id ? ICON_MAP.get(id) : undefined;
}

export function iconsOfGroup(group: IconGroup): IconDef[] {
  return ICONS.filter((icon) => icon.group === group);
}
