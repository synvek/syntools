import type { TextLayer } from '../model/types';

/**
 * 文字就地编辑：在画布容器上叠一个透明 textarea，位置 / 字号随视口缩放同步。
 * 与 slide-editor 的 `render/textEditor.ts` 同一思路，但只保留照片编辑器需要的精简能力。
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
  onCommit: (id: string, text: string) => void;
  onCancel?: () => void;
}

export function openTextEditor(init: TextEditorInit, options: TextEditorOptions): TextEditorHandle {
  const { host, transform, onCommit } = options;
  const area = document.createElement('textarea');
  area.value = init.text;
  area.spellcheck = false;
  area.setAttribute('aria-label', 'photo text editor');
  area.dataset.testid = 'photo-text-editor';
  area.className = 'photo-text-editor';
  const scale = transform.scale || 1;
  Object.assign(area.style, {
    position: 'absolute',
    left: `${init.x * scale + transform.x}px`,
    top: `${init.y * scale + transform.y}px`,
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
