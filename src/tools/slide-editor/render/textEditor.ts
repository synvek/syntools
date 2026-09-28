import type { RunStyle, TextBody } from '../model/types';
import { applyStyleRange, bodyToText, queryStyleRange, replaceBodyText } from '../model/text';

/**
 * 行内文本编辑：Konva 本身没有 DOM 输入能力，
 * 因此在画布上方叠加一层 textarea，按页面坐标与缩放精确对齐到文本框区域。
 *
 * 富文本保留策略：编辑期间维护一份 `draft` 文本体，
 * 每次输入都用「公共前缀 / 公共后缀 diff」把新文本映射回 run 级模型，
 * 只重算真正被改动的区间，其余 run 的样式与段落属性（含 spaceBefore/spaceAfter/indent）原样保留。
 * 工具栏的 B/I/U/S 作用于 textarea 当前选区，映射回 run 实现选区级样式。
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

/** 工具栏按钮文案（粗体/斜体/下划线/删除线），由调用方注入以便走 i18n */
export interface TextEditorLabels {
  bold: string;
  italic: string;
  underline: string;
  strike: string;
}

export interface TextEditorHost {
  /** 相对定位的容器（与画布同尺寸同级） */
  host: HTMLDivElement;
  transform: { scale: number; x: number; y: number };
  onCommit: (id: string, body: TextBody) => void;
  labels?: TextEditorLabels;
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
  { host, transform, onCommit, labels }: TextEditorHost,
): TextEditorHandle {
  const style = element.body.paragraphs[0]?.runs[0]?.style;
  const margins = element.body.margins ?? { left: 9, top: 5, right: 9, bottom: 5 };
  const size = (style?.size ?? DEFAULT_SIZE) * transform.scale;
  const align = element.body.paragraphs[0]?.align ?? 'left';

  /** 编辑期间的文本体草稿：样式与段落属性的唯一来源 */
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

  /* ------------------------- 选区级样式工具栏 ------------------------- */

  const bar = document.createElement('div');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'text format');
  const left = transform.x + element.x * transform.scale;
  const topAbove = transform.y + element.y * transform.scale - BAR_HEIGHT - 4;
  Object.assign(bar.style, {
    position: 'absolute',
    left: `${left}px`,
    // 上方空间不足时挂到文本框下方，避免被画布顶部裁掉
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
    // 关键：阻止默认行为以保留 textarea 的焦点与选区，否则点击按钮会先触发 blur 提交
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
    // 无选区时无从判断作用范围，保持不动（与 PowerPoint 一致）
    if (end <= start) return;
    syncDraft();
    const current = queryStyleRange(draft, start, end);
    const patch: Partial<RunStyle> = { [flag]: !current[flag] };
    draft = applyStyleRange(draft, start, end, patch);
    dirty = true;
    refreshStates();
    area.focus();
  }

  /* ------------------------------ 生命周期 ------------------------------ */

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
    // 默认全选，方便直接套用样式或整体替换
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
