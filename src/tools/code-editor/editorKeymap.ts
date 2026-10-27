/**
 * Editor shortcut bus: turns keyboard events into "editor actions", decoupled from any implementation.
 *
 * Why a separate module:
 * - CodeJar claims Tab / paste / undo itself and returns early on `event.defaultPrevented`, so
 *   shortcuts must be parsed during the **capture phase** (see the keydown listener in CodeSurface);
 * - `matchShortcut` only needs a minimal event object, so it unit-tests under jsdom with no real keyboard.
 *
 * Bindings follow CodePen's Editor Commands (`⌘F` / `⌘/` / `⌘⇧F` / `⌘[` / `⌘]` etc.);
 * `primary` means ⌘ on macOS and Ctrl elsewhere.
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
  /** `KeyboardEvent.key` (compared lowercase) */
  key: string;
  /** ⌘ (macOS) / Ctrl (other platforms) */
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

/** For punctuation keys held with Option (macOS emits characters like ÷), fall back to `KeyboardEvent.code` */
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

/** Whether this is macOS / iOS (decides whether the primary modifier is ⌘ or Ctrl) */
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

/** Event → action; null when nothing matches. Modifiers must match exactly so browser shortcuts are not swallowed */
export function matchShortcut(
  event: EditorKeyEvent,
  options: MatchOptions = {},
): EditorAction | null {
  const mac = options.mac ?? detectMac();
  const primary = mac ? event.metaKey : event.ctrlKey;
  const secondary = mac ? event.ctrlKey : event.metaKey;
  // The secondary modifier (Ctrl on macOS, ⌘ elsewhere) never participates in matching
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

/** Undo / redo (handled inside CodeJar, but controlled state must be synced after dispatch) */
export function isUndoRedo(event: EditorKeyEvent, mac = detectMac()): boolean {
  const primary = mac ? event.metaKey : event.ctrlKey;
  if (!primary || event.altKey) return false;
  const key = event.key.toLowerCase();
  return key === 'z' || key === 'y';
}

/**
 * Human-readable shortcut hint (for toolbar `title` attributes and help copy).
 * Display only; never used for matching.
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

/** First binding of an action (for displaying a hint) */
export function chordOf(
  action: EditorAction,
  bindings: readonly EditorBinding[] = EDITOR_BINDINGS,
): KeyChord | null {
  return bindings.find((binding) => binding.action === action)?.chord ?? null;
}
