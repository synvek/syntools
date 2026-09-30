/**
 * 编辑器快捷键总线：把键盘事件解析为「编辑器动作」，与具体实现解耦。
 *
 * 为什么单独成模块：
 * - CodeJar 自己会抢占 Tab / 粘贴 / 撤销等按键，且对 `event.defaultPrevented` 直接返回，
 *   因此快捷键必须在**捕获阶段**先解析（见 CodeSurface 的 keydown 监听）；
 * - `matchShortcut` 只依赖一个最小事件对象，可在 jsdom 下单测，不依赖真实键盘。
 *
 * 绑定参照 CodePen 的 Editor Commands（`⌘F` / `⌘/` / `⌘⇧F` / `⌘[` / `⌘]` 等），
 * `primary` 表示 macOS 的 ⌘、其它平台的 Ctrl。
 */

export type EditorAction =
  | 'toggleLineComment'
  | 'toggleBlockComment'
  | 'moveLineUp'
  | 'moveLineDown'
  | 'copyLineUp'
  | 'copyLineDown'
  | 'deleteLine'
  | 'transposeLine'
  | 'indent'
  | 'outdent'
  | 'format'
  | 'gotoLine'
  | 'find'
  | 'findReplace'
  | 'findNext'
  | 'findPrev'
  | 'jumpToBracket'
  | 'selectAllOccurrences';

export interface KeyChord {
  /** `KeyboardEvent.key`（小写比较） */
  key: string;
  /** ⌘（macOS）/ Ctrl（其它平台） */
  primary?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface EditorKeyEvent {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export interface EditorBinding {
  action: EditorAction;
  chord: KeyChord;
}

/** 标点键在按住 Option（macOS 会产出 ÷ 之类的字符）时回退用 `KeyboardEvent.code` 匹配 */
const KEY_TO_CODE: Record<string, string> = {
  '/': 'Slash',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
};

export const EDITOR_BINDINGS: readonly EditorBinding[] = [
  { action: 'find', chord: { key: 'f', primary: true } },
  { action: 'findReplace', chord: { key: 'f', primary: true, alt: true } },
  { action: 'findNext', chord: { key: 'g', primary: true } },
  { action: 'findPrev', chord: { key: 'g', primary: true, shift: true } },
  { action: 'toggleLineComment', chord: { key: '/', primary: true } },
  { action: 'toggleBlockComment', chord: { key: '/', primary: true, alt: true } },
  { action: 'moveLineUp', chord: { key: 'ArrowUp', alt: true } },
  { action: 'moveLineDown', chord: { key: 'ArrowDown', alt: true } },
  { action: 'copyLineUp', chord: { key: 'ArrowUp', alt: true, shift: true } },
  { action: 'copyLineDown', chord: { key: 'ArrowDown', alt: true, shift: true } },
  { action: 'deleteLine', chord: { key: 'k', primary: true, shift: true } },
  { action: 'transposeLine', chord: { key: 'ArrowUp', primary: true, alt: true } },
  { action: 'indent', chord: { key: ']', primary: true } },
  { action: 'outdent', chord: { key: '[', primary: true } },
  { action: 'outdent', chord: { key: 'Tab', shift: true } },
  { action: 'jumpToBracket', chord: { key: '\\', primary: true, shift: true } },
  { action: 'selectAllOccurrences', chord: { key: 'l', primary: true, shift: true } },
  { action: 'format', chord: { key: 'f', primary: true, shift: true } },
  { action: 'gotoLine', chord: { key: 'l', primary: true } },
];

/** 是否为 macOS / iOS（决定主修饰键是 ⌘ 还是 Ctrl） */
export function detectMac(
  nav: { platform?: string; userAgent?: string } | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator,
): boolean {
  if (!nav) return false;
  return /Mac|iPhone|iPad|iPod/.test(`${nav.platform ?? ''} ${nav.userAgent ?? ''}`);
}

function keyMatches(event: EditorKeyEvent, chord: KeyChord): boolean {
  const expected = chord.key.toLowerCase();
  if (event.key.toLowerCase() === expected) return true;
  const code = KEY_TO_CODE[expected];
  return Boolean(code && event.code === code);
}

export interface MatchOptions {
  bindings?: readonly EditorBinding[];
  mac?: boolean;
}

/** 事件 → 动作；无匹配返回 null。修饰键必须精确匹配，避免误吞浏览器快捷键 */
export function matchShortcut(
  event: EditorKeyEvent,
  options: MatchOptions = {},
): EditorAction | null {
  const mac = options.mac ?? detectMac();
  const primary = mac ? event.metaKey : event.ctrlKey;
  const secondary = mac ? event.ctrlKey : event.metaKey;
  // 非主修饰键（macOS 上的 Ctrl、其它平台的 ⌘）不参与匹配
  if (secondary) return null;

  for (const binding of options.bindings ?? EDITOR_BINDINGS) {
    const { chord } = binding;
    if (Boolean(chord.primary) !== primary) continue;
    if (Boolean(chord.shift) !== event.shiftKey) continue;
    if (Boolean(chord.alt) !== event.altKey) continue;
    if (!keyMatches(event, chord)) continue;
    return binding.action;
  }
  return null;
}

/** 撤销 / 重做（交给 CodeJar 内部处理，但需要在派发结束后同步受控状态） */
export function isUndoRedo(event: EditorKeyEvent, mac = detectMac()): boolean {
  const primary = mac ? event.metaKey : event.ctrlKey;
  if (!primary || event.altKey) return false;
  const key = event.key.toLowerCase();
  return key === 'z' || key === 'y';
}

/**
 * 快捷键的可读提示（用于工具栏 `title` 与帮助文案）。
 * 只做展示，不参与匹配。
 */
export function formatChord(chord: KeyChord, mac: boolean): string {
  const parts: string[] = [];
  if (chord.primary) parts.push(mac ? '⌘' : 'Ctrl');
  if (chord.alt) parts.push(mac ? '⌥' : 'Alt');
  if (chord.shift) parts.push(mac ? '⇧' : 'Shift');
  const key = chord.key.length === 1 ? chord.key.toUpperCase() : chord.key;
  parts.push(key);
  return mac ? parts.join('') : parts.join('+');
}

/** 取某动作的首个绑定（用于展示提示） */
export function chordOf(
  action: EditorAction,
  bindings: readonly EditorBinding[] = EDITOR_BINDINGS,
): KeyChord | null {
  return bindings.find((binding) => binding.action === action)?.chord ?? null;
}
