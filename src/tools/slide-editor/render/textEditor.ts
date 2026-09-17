import type { Paragraph, TextBody } from '../model/types';

/**
 * 行内文本编辑：Konva 本身没有 DOM 输入能力，
 * 因此在画布上方叠加一层 textarea，按页面坐标与缩放精确对齐到文本框区域，
 * 编辑结束时把纯文本按「每行一段」写回模型（保留首个 run 的样式）。
 */

/** 可被就地编辑的文本框：文本框元素与「带文字的形状」都满足这个最小契约 */
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

export interface TextEditorHost {
  /** 相对定位的容器（与画布同尺寸同级） */
  host: HTMLDivElement;
  transform: { scale: number; x: number; y: number };
  onCommit: (id: string, body: TextBody) => void;
}

const DEFAULT_SIZE = 18;

export function openTextEditor(
  element: EditableTextBox,
  { host, transform, onCommit }: TextEditorHost,
): TextEditorHandle {
  const style = element.body.paragraphs[0]?.runs[0]?.style;
  const margins = element.body.margins ?? { left: 9, top: 5, right: 9, bottom: 5 };
  const size = (style?.size ?? DEFAULT_SIZE) * transform.scale;
  const align = element.body.paragraphs[0]?.align ?? 'left';

  const initial = element.body.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
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
    background: 'rgba(255,255,255,0.96)',
    color: style?.color ?? '#0F172A',
    fontFamily: style?.font || 'Arial, Helvetica, sans-serif',
    fontSize: `${size}px`,
    fontWeight: style?.bold ? '600' : '400',
    fontStyle: style?.italic ? 'italic' : 'normal',
    lineHeight: `${Math.round(size * 1.35)}px`,
    textAlign: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
    zIndex: '20',
  } satisfies Partial<CSSStyleDeclaration>);

  let cancelled = false;
  let disposed = false;

  const commit = () => {
    if (cancelled || disposed) return;
    const text = area.value;
    if (text === initial) return;
    const lines = text.split('\n');
    const paragraphs: Paragraph[] = lines.map((line, index) => ({
      runs: [{ text: line, style: style ? { ...style } : undefined }],
      align: element.body.paragraphs[index]?.align ?? element.body.paragraphs[0]?.align,
      lineSpacing: element.body.paragraphs[0]?.lineSpacing,
      bullet: element.body.paragraphs[index]?.bullet ?? element.body.paragraphs[0]?.bullet,
    }));
    const body: TextBody = { ...element.body, paragraphs };
    onCommit(element.id, body);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    area.remove();
  };

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

  host.appendChild(area);
  requestAnimationFrame(() => area.focus());

  return {
    destroy: () => {
      cancelled = true;
      dispose();
    },
    focus: () => area.focus(),
  };
}
