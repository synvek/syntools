import type { ToolId } from './model/types';

/**
 * 工具箱的**单一真相源**：分组、图标、文案键与展示用快捷键。
 *
 * 抽成纯数据模块的原因：工具箱（`ui/ToolPalette.tsx`）与快捷键一览（`ui/ShortcutHelp.tsx`）
 * 必须显示同一份映射，否则「角标写着 O 但按键没反应」这类不一致会悄悄回归
 * （历史问题：椭圆选区角标为 O，但 `interaction/keyboard.ts` 未绑定）。
 * 真正的按键绑定仍在 `interaction/keyboard.ts`，`toolset.test.ts` 会守住两边一致。
 *
 * **分组即工具箱的一行**：26 个工具平铺会让左侧栏超过 1000px 高（把整个工作区顶高、页面只能滚动），
 * 因此按「工具家族」压缩成 15 行、4 个大区 —— 每行只显示**当前工具**
 * （该组没选中过任何工具时显示 `primary`），同组其它工具收进角标浮层（与 Photoshop 的工具组一致）。
 * 高频工具（画笔 / 橡皮 / 仿制图章 / 文字 / 形状）各自独立成行，不再藏在角标里；
 * 行数超过工作区高度时由工具箱自己滚动（`ui/ToolPalette.tsx` 的 `max-h-full overflow-y-auto`）。
 */

export interface ToolDef {
  id: ToolId;
  icon: string;
  /** 完整 i18n 键名，可直接交给 `t()` */
  labelKey: string;
  /** 工具箱角标 / 快捷键一览中展示的按键（展示用，可能是 ⇧ 组合） */
  shortcut: string;
}

/**
 * 工具箱的**大区**：只有跨区时才画分隔线。
 *
 * 11 行若每行都画分隔线，左侧栏会多出约 50px（工作区下限就得跟着变高）；
 * 而按「选择 / 编辑 / 绘制 / 取样与形状」四区划分，既保留视觉分区又省下这段高度。
 * 同一区必须连续（否则会出现重复分隔线），由 `toolset.test.ts` 守住。
 */
export type ToolSection = 'select' | 'edit' | 'paint' | 'sample';

export interface ToolGroupDef {
  id: string;
  /** 所属大区：跨区时工具箱画一条分隔线 */
  section: ToolSection;
  /** 组内默认工具：该组尚无「当前工具」时按钮展示它 */
  primary: ToolId;
  items: ToolDef[];
}

export const TOOL_GROUPS: ToolGroupDef[] = [
  {
    id: 'move',
    section: 'select',
    primary: 'move',
    items: [
      { id: 'move', icon: 'cursor', labelKey: 'tools.photo.toolMove', shortcut: 'V' },
      {
        id: 'transform',
        icon: 'actualSize',
        labelKey: 'tools.photo.toolTransform',
        shortcut: '⌘T',
      },
    ],
  },
  {
    id: 'marquee',
    section: 'select',
    primary: 'rectSelect',
    items: [
      {
        id: 'rectSelect',
        icon: 'imageFrame',
        labelKey: 'tools.photo.toolRectSelect',
        shortcut: 'M',
      },
      {
        id: 'ellipseSelect',
        icon: 'hsv-cmyk',
        labelKey: 'tools.photo.toolEllipseSelect',
        shortcut: 'O',
      },
    ],
  },
  {
    id: 'lasso',
    section: 'select',
    primary: 'lasso',
    items: [
      { id: 'lasso', icon: 'lasso', labelKey: 'tools.photo.toolLasso', shortcut: 'L' },
      { id: 'wand', icon: 'star', labelKey: 'tools.photo.toolWand', shortcut: 'W' },
      { id: 'quickSelect', icon: 'lasso', labelKey: 'tools.photo.toolQuickSelect', shortcut: 'A' },
    ],
  },
  {
    id: 'crop',
    section: 'edit',
    primary: 'crop',
    items: [{ id: 'crop', icon: 'imageCrop', labelKey: 'tools.photo.toolCrop', shortcut: 'C' }],
  },
  // 画笔与橡皮互为替代工具，但使用频率都很高：各自独立成行，少一次角标展开
  {
    id: 'brush',
    section: 'paint',
    primary: 'brush',
    items: [{ id: 'brush', icon: 'brush', labelKey: 'tools.photo.toolBrush', shortcut: 'B' }],
  },
  {
    id: 'eraser',
    section: 'paint',
    primary: 'eraser',
    items: [{ id: 'eraser', icon: 'eraser', labelKey: 'tools.photo.toolEraser', shortcut: 'E' }],
  },
  {
    id: 'fill',
    section: 'paint',
    primary: 'fill',
    items: [
      { id: 'fill', icon: 'bucket', labelKey: 'tools.photo.toolFill', shortcut: '⇧G' },
      { id: 'gradient', icon: 'gradient', labelKey: 'tools.photo.toolGradient', shortcut: 'G' },
    ],
  },
  {
    id: 'retouch',
    section: 'paint',
    primary: 'dodge',
    items: [
      { id: 'dodge', icon: 'dodge', labelKey: 'tools.photo.toolDodge', shortcut: '⇧O' },
      { id: 'burn', icon: 'burn', labelKey: 'tools.photo.toolBurn', shortcut: '⇧O' },
      { id: 'sponge', icon: 'sponge', labelKey: 'tools.photo.toolSponge', shortcut: '⇧O' },
    ],
  },
  // 仿制图章取样逻辑与修复类工具差异较大，单独成行
  {
    id: 'clone',
    section: 'paint',
    primary: 'cloneStamp',
    items: [
      { id: 'cloneStamp', icon: 'clone', labelKey: 'tools.photo.toolCloneStamp', shortcut: 'S' },
    ],
  },
  // 修复画笔 / 污点修复共用「取周边像素修补」的交互，合成一组（⇧J 循环）
  {
    id: 'heal',
    section: 'paint',
    primary: 'healing',
    items: [
      { id: 'healing', icon: 'healing', labelKey: 'tools.photo.toolHealing', shortcut: 'J' },
      { id: 'spotHeal', icon: 'spotHeal', labelKey: 'tools.photo.toolSpotHeal', shortcut: '⇧J' },
    ],
  },
  {
    id: 'blur',
    section: 'paint',
    primary: 'smudge',
    items: [
      { id: 'smudge', icon: 'smudge', labelKey: 'tools.photo.toolSmudge', shortcut: 'R' },
      { id: 'blurBrush', icon: 'blurBrush', labelKey: 'tools.photo.toolBlurBrush', shortcut: '⇧R' },
      {
        id: 'sharpenBrush',
        icon: 'sharpenBrush',
        labelKey: 'tools.photo.toolSharpenBrush',
        shortcut: '⇧R',
      },
    ],
  },
  {
    id: 'sample',
    section: 'sample',
    primary: 'eyedropper',
    items: [
      {
        id: 'eyedropper',
        icon: 'eyedropper',
        labelKey: 'tools.photo.toolEyedropper',
        shortcut: 'I',
      },
      { id: 'sampler', icon: 'sampler', labelKey: 'tools.photo.toolSampler', shortcut: '⇧I' },
    ],
  },
  // 文字与形状是两类对象（文本层 / 形状层），各自独立成行
  {
    id: 'text',
    section: 'sample',
    primary: 'text',
    items: [{ id: 'text', icon: 'text', labelKey: 'tools.photo.toolText', shortcut: 'T' }],
  },
  {
    id: 'shape',
    section: 'sample',
    primary: 'shape',
    items: [{ id: 'shape', icon: 'shapes', labelKey: 'tools.photo.toolShape', shortcut: 'U' }],
  },
  {
    id: 'nav',
    section: 'sample',
    primary: 'hand',
    items: [{ id: 'hand', icon: 'hand', labelKey: 'tools.photo.toolHand', shortcut: 'H' }],
  },
];

/** 展平的工具列表（工具箱顺序），供快捷键一览等场景使用 */
export const ALL_TOOLS: ToolDef[] = TOOL_GROUPS.flatMap((group) => group.items);

/** 工具 → 所属组（工具箱按组高亮 / 定位用） */
export function groupOfTool(tool: ToolId): ToolGroupDef | undefined {
  return TOOL_GROUPS.find((group) => group.items.some((item) => item.id === tool));
}

/**
 * 组内当前应展示的工具。
 *
 * 规则与 Photoshop 一致：**该组已有当前工具就用它**（用户切换过就记住），否则退回 `primary`。
 * 这样「先用画笔、再切到橡皮」之后，这一行始终停在用户最近用过的那个上，而不是弹回默认。
 */
export function displayToolOf(group: ToolGroupDef, current: ToolId): ToolDef {
  return (
    group.items.find((item) => item.id === current) ??
    group.items.find((item) => item.id === group.primary) ??
    group.items[0]
  );
}
