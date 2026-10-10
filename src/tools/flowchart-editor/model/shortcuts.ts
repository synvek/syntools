/**
 * 快捷键清单（单一数据源）。
 *
 * 帮助浮层与 `FlowchartTool` 的 keydown 逻辑共用本清单描述，
 * 避免「文档与实现漂移」。`keys` 为展示用文本（Mac 优先，标注 ⌘/Ctrl）。
 */

export interface ShortcutDef {
  /** 展示用键位（如 `⌘/Ctrl + Z`） */
  keys: string;
  /** i18n 键后缀（tools.flowchart.sc*） */
  labelKey: string;
}

export interface ShortcutGroup {
  /** i18n 键后缀（tools.flowchart.scGroup*） */
  titleKey: string;
  items: ShortcutDef[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: 'scGroupEdit',
    items: [
      { keys: '⌘/Ctrl + Z', labelKey: 'scUndo' },
      { keys: '⌘/Ctrl + ⇧ + Z', labelKey: 'scRedo' },
      { keys: '⌘/Ctrl + X / C / V', labelKey: 'scClipboard' },
      { keys: '⌘/Ctrl + D', labelKey: 'scDuplicate' },
      { keys: '⌘/Ctrl + A', labelKey: 'scSelectAll' },
      { keys: 'Delete / Backspace', labelKey: 'scDelete' },
      { keys: '⌘/Ctrl + S', labelKey: 'scSave' },
      { keys: 'Enter / ⇧ + Enter', labelKey: 'scTextNewline' },
      { keys: '⌘/Ctrl + Enter', labelKey: 'scTextCommit' },
    ],
  },
  {
    titleKey: 'scGroupArrange',
    items: [
      { keys: '⌘/Ctrl + R', labelKey: 'scRotateCw' },
      { keys: '⌘/Ctrl + ⇧ + R', labelKey: 'scRotateCcw' },
      { keys: '⌘/Ctrl + ⇧ + H', labelKey: 'scFlipH' },
      { keys: '⌘/Ctrl + ⇧ + J', labelKey: 'scFlipV' },
      { keys: '⌘/Ctrl + G / ⇧ + G', labelKey: 'scGroup' },
      { keys: '方向键 / ⇧ + 方向键', labelKey: 'scNudge' },
    ],
  },
  {
    titleKey: 'scGroupCanvas',
    items: [
      { keys: 'Tab', labelKey: 'scSpawnRight' },
      { keys: 'Enter', labelKey: 'scSpawnDown' },
      { keys: 'F2', labelKey: 'scRename' },
      { keys: 'Esc', labelKey: 'scDeselect' },
      { keys: '⌘/Ctrl + PageUp / PageDown', labelKey: 'scSwitchPage' },
      { keys: 'Space + 拖拽 / 中键拖拽', labelKey: 'scPan' },
      { keys: '⌘/Ctrl + 滚轮', labelKey: 'scZoom' },
      { keys: '拖拽调整顶点 / 旋转顶点', labelKey: 'scHandles' },
      { keys: '双击图形 / 连线', labelKey: 'scEditLabel' },
      { keys: 'F1', labelKey: 'scHelp' },
    ],
  },
];
