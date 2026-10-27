import { docToScreen } from '../core';
import type { TextLayer } from '../model/types';

/**
 * Inline text editing: a transparent textarea over the canvas host whose position / font size follows the viewport zoom.
 * Same idea as slide-editor's `render/textEditor.ts`, trimmed to what the photo editor needs.
 */

export interface TextEditorInit {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: TextLayer['align'];
  bold: boolean;
  italic: boolean;
  lineHeight: number;
}

export interface TextEditorHandle {
  destroy: () => void;
}

export interface TextEditorOptions {
  host: HTMLElement;
  transform: { scale: number; x: number; y: number };
  /** Viewport size and view rotation: in-place layer editing must rotate with the canvas, or the input box drifts out of place */
  viewSize: { width: number; height: number };
  viewRotation: number;
  onCommit: (id: string, text: string) => void;
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
  const origin = docToScreen({ x: init.x, y: init.y }, transform, viewSize, viewRotation);
  Object.assign(area.style, {
    position: 'absolute',
    left: `${origin.x}px`,
    top: `${origin.y}px`,
    // Rotate about the top-left corner, matching the canvas content's rotation angle
    transform: viewRotation ? `rotate(${viewRotation}deg)` : '',
    transformOrigin: '0 0',
    width: `${Math.max(40, init.width * scale)}px`,
    minHeight: `${init.fontSize * init.lineHeight * scale}px`,
    fontSize: `${Math.max(8, init.fontSize * scale)}px`,
    fontFamily: `${init.fontFamily}, sans-serif`,
    fontWeight: init.bold ? '700' : '400',
    fontStyle: init.italic ? 'italic' : 'normal',
    lineHeight: `${init.lineHeight}`,
    textAlign: init.align,
    color: init.fill,
  });

  let finished = false;
  const finish = (commit: boolean) => {
    if (finished) return;
    finished = true;
    const value = area.value;
    area.remove();
    if (commit) onCommit(init.id, value);
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
  area.focus();
  area.select();
  return { destroy: () => finish(false) };
}
