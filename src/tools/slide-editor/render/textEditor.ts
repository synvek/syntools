import type { RunStyle, TextBody } from '../model/types';
import { applyStyleRange, bodyToText, queryStyleRange, replaceBodyText } from '../model/text';

/**
 * Inline text editing: Konva has no DOM input, so a textarea is overlaid above the canvas and
 * aligned precisely to the text box area using page coordinates and the view scale.
 *
 * Rich-text preservation strategy: a `draft` text body is maintained while editing;
 * every input maps the new text back onto the run-level model with a common-prefix/suffix diff,
 * recomputing only the changed span and keeping other runs' styles and paragraph props (including spaceBefore/spaceAfter/indent).
 * The toolbar's B/I/U/S act on the textarea's current selection and map back to runs for selection-level styling.
 */

/** Text box editable in place: text elements and "shapes with text" both satisfy this minimal contract */
export interface EditableTextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  body: TextBody;
}

export interface TextEditorHandle {
  destroy: () => void;
  focus: () => void;
}

/** Toolbar button labels (bold/italic/underline/strike), injected by the caller for i18n */
export interface TextEditorLabels {
  bold: string;
  italic: string;
  underline: string;
  strike: string;
}

export interface TextEditorHost {
  /** Relatively positioned container (same size and level as the canvas) */
  host: HTMLDivElement;
  transform: { scale: number; x: number; y: number };
  onCommit: (id: string, body: TextBody) => void;
  labels?: TextEditorLabels;
  /**
   * Called when the overlay is destroyed (Esc cancel, blur without changes, etc. never reach onCommit).
   * The host uses it to restore the static text it hid during editing, so the text doesn't vanish for good.
   */
  onClose?: () => void;
}

const DEFAULT_SIZE = 18;
const BAR_HEIGHT = 28;

type StyleFlag = 'bold' | 'italic' | 'underline' | 'strike';

const FLAGS: { flag: StyleFlag; glyph: string; css: Partial<CSSStyleDeclaration> }[] = [
  { flag: 'bold', glyph: 'B', css: { fontWeight: '700' } },
  { flag: 'italic', glyph: 'I', css: { fontStyle: 'italic' } },
  { flag: 'underline', glyph: 'U', css: { textDecoration: 'underline' } },
  { flag: 'strike', glyph: 'S', css: { textDecoration: 'line-through' } },
];

function cloneBody(body: TextBody): TextBody {
  return JSON.parse(JSON.stringify(body)) as TextBody;
}

export function openTextEditor(
  element: EditableTextBox,
  { host, transform, onCommit, labels, onClose }: TextEditorHost,
): TextEditorHandle {
  const style = element.body.paragraphs[0]?.runs[0]?.style;
  const margins = element.body.margins ?? { left: 9, top: 5, right: 9, bottom: 5 };
  const size = (style?.size ?? DEFAULT_SIZE) * transform.scale;
  const align = element.body.paragraphs[0]?.align ?? 'left';

  /** Text body draft during editing: the single source of truth for styles and paragraph props */
  let draft = cloneBody(element.body);
  let dirty = false;

  const initial = bodyToText(element.body);
  const area = document.createElement('textarea');
  area.value = initial;
  area.spellcheck = false;
  area.setAttribute('aria-label', 'edit text');
  Object.assign(area.style, {
    position: 'absolute',
    left: `${transform.x + element.x * transform.scale}px`,
    top: `${transform.y + element.y * transform.scale}px`,
    width: `${element.width * transform.scale}px`,
    height: `${element.height * transform.scale}px`,
    margin: '0',
    padding: `${margins.top * transform.scale}px ${margins.right * transform.scale}px ${margins.bottom * transform.scale}px ${margins.left * transform.scale}px`,
    border: '2px solid #2563EB',
    borderRadius: '2px',
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    // Background must be transparent: this is a DOM layer above the canvas, and a fill would also cover
    // the elements layered above it, making the edited element look like it jumped to the top (and back after editing).
    // The element's fill/border is drawn by the canvas; the textarea renders the text alone (the caller hides the static text).
    background: 'transparent',
    color: style?.color ?? '#0F172A',
    fontFamily: style?.font || 'Arial, Helvetica, sans-serif',
    fontSize: `${size}px`,
    fontWeight: style?.bold ? '600' : '400',
    fontStyle: style?.italic ? 'italic' : 'normal',
    lineHeight: `${Math.round(size * 1.35)}px`,
    textAlign: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
    zIndex: '20',
  } satisfies Partial<CSSStyleDeclaration>);

  /* ------------------------- Selection-level style toolbar ------------------------- */

  const bar = document.createElement('div');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'text format');
  const left = transform.x + element.x * transform.scale;
  const topAbove = transform.y + element.y * transform.scale - BAR_HEIGHT - 4;
  Object.assign(bar.style, {
    position: 'absolute',
    left: `${left}px`,
    // When there is no room above, attach below the text box so the canvas top doesn't clip it
    top: `${topAbove >= 0 ? topAbove : transform.y + element.y * transform.scale + element.height * transform.scale + 4}px`,
    display: 'flex',
    gap: '2px',
    padding: '2px',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    background: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(15,23,42,0.18)',
    zIndex: '21',
  } satisfies Partial<CSSStyleDeclaration>);

  const buttons = new Map<StyleFlag, HTMLButtonElement>();
  for (const item of FLAGS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.glyph;
    const label =
      item.flag === 'bold'
        ? labels?.bold
        : item.flag === 'italic'
          ? labels?.italic
          : item.flag === 'underline'
            ? labels?.underline
            : labels?.strike;
    if (label) {
      button.title = label;
      button.setAttribute('aria-label', label);
    }
    Object.assign(button.style, {
      width: '24px',
      height: '22px',
      border: 'none',
      borderRadius: '4px',
      background: 'transparent',
      color: '#334155',
      cursor: 'pointer',
      fontSize: '12px',
      lineHeight: '1',
      ...item.css,
    } satisfies Partial<CSSStyleDeclaration>);
    // Key: prevent default to keep the textarea's focus and selection, otherwise clicking a button blurs and commits first
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => toggleStyle(item.flag));
    buttons.set(item.flag, button);
    bar.appendChild(button);
  }

  function syncDraft(): void {
    draft = replaceBodyText(draft, area.value);
  }

  function refreshStates(): void {
    syncDraft();
    const state = queryStyleRange(draft, area.selectionStart, area.selectionEnd);
    for (const [flag, button] of buttons) {
      button.style.background = state[flag] ? '#DBEAFE' : 'transparent';
      button.style.color = state[flag] ? '#1D4ED8' : '#334155';
    }
  }

  function toggleStyle(flag: StyleFlag): void {
    const start = area.selectionStart;
    const end = area.selectionEnd;
    // No selection means no scope to act on, so leave it unchanged (matching PowerPoint)
    if (end <= start) return;
    syncDraft();
    const current = queryStyleRange(draft, start, end);
    const patch: Partial<RunStyle> = { [flag]: !current[flag] };
    draft = applyStyleRange(draft, start, end, patch);
    dirty = true;
    refreshStates();
    area.focus();
  }

  /* ------------------------------ Lifecycle ------------------------------ */

  let cancelled = false;
  let disposed = false;

  const commit = () => {
    if (cancelled || disposed) return;
    if (!dirty) return;
    syncDraft();
    onCommit(element.id, draft);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    area.remove();
    bar.remove();
    onClose?.();
  };

  area.addEventListener('input', () => {
    dirty = true;
    syncDraft();
  });
  area.addEventListener('select', refreshStates);
  area.addEventListener('keyup', refreshStates);
  area.addEventListener('mouseup', refreshStates);
  area.addEventListener('blur', () => {
    commit();
    dispose();
  });
  area.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelled = true;
      dispose();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      area.blur();
    }
  });

  host.appendChild(bar);
  host.appendChild(area);
  requestAnimationFrame(() => {
    area.focus();
    // Select all by default, so styles or a full replacement apply right away
    area.select();
    refreshStates();
  });

  return {
    destroy: () => {
      cancelled = true;
      dispose();
    },
    focus: () => area.focus(),
  };
}
