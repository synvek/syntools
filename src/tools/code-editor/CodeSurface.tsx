import { useCallback, useEffect, useRef } from 'react';
import { CodeJar, type Position } from 'codejar';
import { highlightCode } from './prism';
import './editor.css';

interface CodeSurfaceProps {
  value: string;
  onChange: (value: string) => void;
  /** Prism 语法名，'none' 表示不高亮 */
  prismKey: string;
  /** 主题变量（--ce-*） */
  themeVars: Record<string, string>;
  /** Tab 键插入的缩进单元 */
  indentUnit: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  placeholder?: string;
  ariaLabel: string;
}

/** 可编辑的语法高亮编辑器（CodeJar + Prism），含行号槽 */
export function CodeSurface({
  value,
  onChange,
  prismKey,
  themeVars,
  indentUnit,
  showLineNumbers,
  wordWrap,
  placeholder,
  ariaLabel,
}: CodeSurfaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const jarRef = useRef<ReturnType<typeof CodeJar> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  const prismRef = useRef(prismKey);
  prismRef.current = prismKey;
  const indentRef = useRef(indentUnit);
  indentRef.current = indentUnit;

  const highlight = useCallback((editor: HTMLElement) => {
    const code = editor.textContent ?? '';
    editor.innerHTML = highlightCode(code, prismRef.current);
  }, []);

  // 挂载 / 缩进单元变化时重建实例（CodeJar 的 tab 选项在创建时固定）
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const jar = CodeJar(el, highlight, {
      tab: indentRef.current,
      addClosing: false,
      spellcheck: false,
      preserveIdent: true,
      catchTab: true,
    });
    jar.updateCode(valueRef.current, false);
    jar.onUpdate((code) => onChangeRef.current(code));
    jarRef.current = jar;
    return () => {
      jar.destroy();
      jarRef.current = null;
    };
  }, [highlight, indentUnit]);

  // 外部清空 / 导入 / 格式化 / 自动格式化 / 分享还原等受控更新
  // 聚焦时保存并恢复光标：避免自动格式化把光标弹回开头而打断输入
  useEffect(() => {
    const jar = jarRef.current;
    const el = hostRef.current;
    if (!jar || !el) return;
    if (jar.toString() === value) return;
    let pos: Position | null = null;
    if (document.activeElement === el) {
      try {
        pos = jar.save();
      } catch {
        pos = null; // 无选区时 save 会抛错，忽略即可
      }
    }
    jar.updateCode(value, false);
    if (pos) {
      try {
        jar.restore(pos);
      } catch {
        /* 光标恢复失败不影响内容 */
      }
    }
  }, [value]);

  // 语言切换后重新着色
  useEffect(() => {
    const jar = jarRef.current;
    if (!jar) return;
    jar.updateCode(jar.toString(), false);
  }, [prismKey]);

  const lines = value ? value.split('\n').length : 1;
  // 自动换行会让行号与视觉行错位，此时隐藏行号槽
  const showGutter = showLineNumbers && !wordWrap;
  const gutterWidth = String(lines).length * 8 + 24;

  return (
    <div
      className={`ce-code ${wordWrap ? 'ce-wrap' : ''}`}
      style={{ ...themeVars, ['--ce-gutter-w' as string]: showGutter ? `${gutterWidth}px` : '0px' }}
    >
      <div className="ce-scroll">
        {showGutter && (
          <div className="ce-gutter" aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
          </div>
        )}
        <div
          ref={hostRef}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          tabIndex={0}
          spellCheck={false}
          className="ce-surface"
        />
      </div>
      {!value && placeholder && <div className="ce-placeholder">{placeholder}</div>}
    </div>
  );
}
