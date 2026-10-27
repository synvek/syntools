import { SHAPE_KINDS } from './core';
import type { ShapeKind, TextDirection, ToolId } from './model/types';
import { SHAPE_ICONS } from './shapeIcons';

/**
 * **Single source of truth** for the toolbox: groups, icons, label keys and display-only shortcuts.
 *
 * It is a pure data module because the toolbox (`ui/ToolPalette.tsx`) and the shortcut sheet
 * (`ui/ShortcutHelp.tsx`) must show the same mapping, or mismatches like "the badge says O but O does
 * nothing" creep back (a real bug once: the oval selection badge said O with no binding behind it).
 * The real bindings still live in `interaction/keyboard.ts`, and `toolset.test.ts` keeps both in sync.
 *
 * **A group is one toolbox row**: 26 flat tools would push the rail past 1000px (tall workspace, scrolling page),
 * so tool families compress into 15 rows across 4 sections, each row showing only the **current tool**
 * (`primary` when nothing in the group has been picked), with the rest in the badge flyout, as in Photoshop.
 * High-frequency tools (brush / eraser / clone stamp / text / shape) get their own row, out of the flyout;
 * when rows exceed the workspace height the rail scrolls itself (`max-h-full overflow-y-auto` in ToolPalette).
 */

export interface ToolDef {
  id: ToolId;
  icon: string;
  /** Full i18n key, ready to pass to `t()` */
  labelKey: string;
  /** Key shown on the toolbox badge / shortcut sheet (display only, possibly a ⇧ combination) */
  shortcut: string;
  /**
   * **Sub-kinds** of the same tool.
   *
   * - Six shapes share the single `shape` ToolId (`shapeKind` decides what gets drawn);
   * - horizontal / vertical text share the single `text` ToolId (`textDirection` decides the flow).
   * The toolbox shows them as grouped buttons with their own icons and names, hence the kinds.
   * `variantKind` on the group says which piece of state a variant writes to.
   */
  variant?: ShapeKind | TextDirection;
}

/**
 * Toolbox **sections**: a divider is drawn only when the section changes.
 *
 * A divider between all 11 rows would add ~50px to the rail (raising the workspace minimum);
 * splitting into select / edit / paint / sample-and-shape keeps the visual grouping without that height.
 * A section must stay contiguous (or dividers repeat), and `toolset.test.ts` enforces that.
 */
export type ToolSection = 'select' | 'edit' | 'paint' | 'sample';

export interface ToolGroupDef {
  id: string;
  /** Owning section: the toolbox draws a divider when it changes */
  section: ToolSection;
  /** Default tool of the group: shown while the group has no current tool */
  primary: ToolId;
  /** Group-level label (the overall name for groups with sub-kinds, e.g. "Shape"); else primary's */
  labelKey?: string;
  /**
   * Which state sub-kinds write to: shapes set `shapeKind`, text sets `textDirection`.
   * Absent for groups without sub-kinds.
   */
  variantKind?: 'shape' | 'text';
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
  // Lasso family: freehand / polygonal / magnetic (⇧L cycles), matching PS's L group
  {
    id: 'lasso',
    section: 'select',
    primary: 'lasso',
    items: [
      { id: 'lasso', icon: 'lasso', labelKey: 'tools.photo.toolLasso', shortcut: 'L' },
      {
        id: 'polyLasso',
        icon: 'lassoPolygon',
        labelKey: 'tools.photo.toolPolyLasso',
        shortcut: '⇧L',
      },
      {
        id: 'magneticLasso',
        icon: 'lassoMagnetic',
        labelKey: 'tools.photo.toolMagneticLasso',
        shortcut: '⇧L',
      },
    ],
  },
  // Magic wand and quick selection both "expand by color / similarity", so they share a group (W)
  {
    id: 'wand',
    section: 'select',
    primary: 'wand',
    items: [
      { id: 'wand', icon: 'magicWand', labelKey: 'tools.photo.toolWand', shortcut: 'W' },
      {
        id: 'quickSelect',
        icon: 'quickSelect',
        labelKey: 'tools.photo.toolQuickSelect',
        shortcut: 'A',
      },
    ],
  },
  {
    id: 'crop',
    section: 'edit',
    primary: 'crop',
    items: [{ id: 'crop', icon: 'imageCrop', labelKey: 'tools.photo.toolCrop', shortcut: 'C' }],
  },
  // Brush and eraser replace each other but are both very common: separate rows save a flyout click
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
  // The clone stamp samples quite differently from the healing tools, so it gets its own row
  {
    id: 'clone',
    section: 'paint',
    primary: 'cloneStamp',
    items: [
      { id: 'cloneStamp', icon: 'clone', labelKey: 'tools.photo.toolCloneStamp', shortcut: 'S' },
    ],
  },
  // Healing brush / spot healing share "patch with nearby pixels", so they form one group (⇧J cycles)
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
  // Text and shapes are different objects (text layer / shape layer), each with its own row.
  // Text has two flows (horizontal / vertical) sharing the `text` tool; the badge flyout switches them.
  {
    id: 'text',
    section: 'sample',
    primary: 'text',
    variantKind: 'text',
    items: [
      {
        id: 'text',
        variant: 'horizontal',
        icon: 'text',
        labelKey: 'tools.photo.toolText',
        shortcut: 'T',
      },
      {
        id: 'text',
        variant: 'vertical',
        icon: 'textVertical',
        labelKey: 'tools.photo.toolTextVertical',
        shortcut: 'T',
      },
    ],
  },
  {
    id: 'shape',
    section: 'sample',
    primary: 'shape',
    labelKey: 'tools.photo.toolShape',
    variantKind: 'shape',
    // Shapes present as one tool with six kinds: the row's icon follows the current kind,
    // and the flyout picks a specific shape (the badge sits on the rail; options hold width / color).
    items: SHAPE_KINDS.map((kind) => ({
      id: 'shape' as ToolId,
      variant: kind,
      icon: SHAPE_ICONS[kind],
      labelKey: `tools.photo.shape.${kind}`,
      shortcut: 'U',
    })),
  },
  {
    id: 'nav',
    section: 'sample',
    primary: 'hand',
    items: [{ id: 'hand', icon: 'hand', labelKey: 'tools.photo.toolHand', shortcut: 'H' }],
  },
];

/**
 * Flattened tool list (toolbox order), for the shortcut sheet and similar consumers.
 *
 * Groups with sub-kinds (shapes) keep **one entry**: "U = shape" is enough in the shortcut sheet,
 * and six rows of "rect U / oval U…" would only stretch the panel.
 */
export const ALL_TOOLS: ToolDef[] = TOOL_GROUPS.flatMap((group) => {
  const base = group.items.find((item) => item.id === group.primary) ?? group.items[0];
  if (!group.items.some((item) => item.variant)) return group.items;
  return [{ ...base, variant: undefined, labelKey: group.labelKey ?? base.labelKey }];
});

/** Tool → its group (used by the toolbox for highlighting / lookup) */
export function groupOfTool(tool: ToolId): ToolGroupDef | undefined {
  return TOOL_GROUPS.find((group) => group.items.some((item) => item.id === tool));
}

/**
 * The tool a group should show right now.
 *
 * Photoshop's rule: **use the group's current tool if there is one** (remembered once the user switches),
 * otherwise fall back to `primary`, so the row sticks to the user's last pick instead of snapping back.
 *
 * `variant` handles sub-kinds (shapes / text flow): with several entries for one ToolId, the matching
 * kind wins, so the row's icon and name follow the shape being drawn or the text flow in use.
 */
export function displayToolOf(
  group: ToolGroupDef,
  current: ToolId,
  variant?: ShapeKind | TextDirection,
): ToolDef {
  const candidates = group.items.filter((item) => item.id === current);
  if (candidates.length > 0) {
    return candidates.find((item) => item.variant === variant) ?? candidates[0];
  }
  return group.items.find((item) => item.id === group.primary) ?? group.items[0];
}
