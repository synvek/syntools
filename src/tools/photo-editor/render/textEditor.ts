import { docToScreen } from '../core';
import type { TextLayer } from '../model/types';

/**
 * Inline text editing: a transparent textarea over the canvas host whose position / font size follows the viewport zoom.
 * Same idea as slide-editor's `render/textEditor.ts`, trimmed to what the photo editor needs.
 *
 * The editor is **resizable** (bottom-right grip). Horizontal text commits the resized width as the wrap width;
 * vertical text commits the resized height as the column length, so the box the user drags really is the text box.
 */

export interface TextEditorInit {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: TextLayer['align'];
  bold: boolean;
  italic: boolean;
  lineHeight: number;
  /** Vertical layers are edited in a wider box, since their column width alone is too narrow to type in */
  direction?: TextLayer['direction'];
}

export interface TextEditorHandle {
  destroy: () => void;
}

/** Box size chosen by the user (document units); horizontal uses width, vertical uses height */
export interface TextEditorSize {
  width?: number;
  height?: number;
}

export interface TextEditorOptions {
  host: HTMLElement;
  transform: { scale: number; x: number; y: number };
  /** Viewport size and view rotation: in-place layer editing must rotate with the canvas, or the input box drifts out of place */
  viewSize: { width: number; height: number };
  viewRotation: number;
  onCommit: (id: string, text: string, size?: TextEditorSize) => void;
  onCancel?: () => void;
}

export function openTextEditor(init: TextEditorInit, options: TextEditorOptions): TextEditorHandle {
  const { host, transform, viewSize, viewRotation, onCommit } = options;
  const area = document.createElement('textarea');
  area.value = init.text;
  area.spellcheck = false;
  area.setAttribute('aria-label', 'photo text editor');
  area.dataset.testid = 'photo-text-editor';
  area.className = 'photo-text-editor';
  const scale = transform.scale || 1;
  const isVertical = init.direction === 'vertical';
  const origin = docToScreen({ x: init.x, y: init.y }, transform, viewSize, viewRotation);
  // Horizontal: match the wrap width. Vertical: the layer box is one column wide, so open a workable editor instead
  const editorWidth = isVertical
    ? Math.max(220, init.width * scale)
    : Math.max(40, init.width * scale);
  const minHeight = Math.max(init.fontSize * init.lineHeight * scale, 8);
  const editorHeight = Math.min(320, Math.max(140, init.height * scale));

  Object.assign(area.style, {
    position: 'absolute',
    left: `${origin.x}px`,
    top: `${origin.y}px`,
    // Rotate about the top-left corner, matching the canvas content's rotation angle
    transform: viewRotation ? `rotate(${viewRotation}deg)` : '',
    transformOrigin: '0 0',
    width: `${editorWidth}px`,
    ...(isVertical
      ? { height: `${editorHeight}px`, overflow: 'auto' }
      : { minHeight: `${minHeight}px`, overflow: 'hidden' }),
    // The native corner grip persists the box size on commit (see `finish`)
    resize: 'both',
    fontSize: `${Math.max(8, init.fontSize * scale)}px`,
    fontFamily: `${init.fontFamily}, sans-serif`,
    fontWeight: init.bold ? '700' : '400',
    fontStyle: init.italic ? 'italic' : 'normal',
    lineHeight: `${init.lineHeight}`,
    textAlign: init.align,
    color: init.fill,
  });

  let finished = false;
  /** Set when the user starts dragging the resize grip; from then on autosize must not fight the manual size */
  let userResized = false;
  area.addEventListener('pointerdown', (event) => {
    const rect = area.getBoundingClientRect();
    if (rect.right - event.clientX <= 20 && rect.bottom - event.clientY <= 20) userResized = true;
  });

  const finish = (commit: boolean) => {
    if (finished) return;
    finished = true;
    const value = area.value;
    // Only a user-driven resize changes the text box; the default size or autosize must not overwrite it
    const size: TextEditorSize | undefined =
      commit && userResized
        ? isVertical
          ? { height: Math.max(1, Math.round(area.clientHeight / scale)) }
          : { width: Math.max(1, Math.round(area.clientWidth / scale)) }
        : undefined;
    area.remove();
    if (commit) onCommit(init.id, value, size);
    else options.onCancel?.();
  };

  area.addEventListener('blur', () => finish(true));
  area.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      finish(true);
    }
    event.stopPropagation();
  });

  host.appendChild(area);
  // Horizontal multi-line: grow with the content; vertical uses a fixed (resizable) box with scrolling
  const autosize = () => {
    if (isVertical || userResized) return;
    area.style.height = 'auto';
    area.style.height = `${Math.max(minHeight, area.scrollHeight)}px`;
  };
  area.addEventListener('input', autosize);
  autosize();
  area.focus();
  area.select();
  return { destroy: () => finish(false) };
}
