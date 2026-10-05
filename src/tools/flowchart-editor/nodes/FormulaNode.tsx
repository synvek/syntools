import { memo, useEffect, useState } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useFlowStore } from '../store';
import { FORMULA_NODE_SIZE, type FlowNodeData } from '../model/types';

/**
 * 公式节点：LaTeX 由 KaTeX 渲染成内联 HTML（矢量字形），
 * KaTeX 及其样式按需动态加载——只有真正使用公式节点时才进入该工具 chunk。
 */
function useKatexHtml(tex: string): string {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!tex.trim()) {
      setHtml('');
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const [{ default: katex }] = await Promise.all([
          import('katex'),
          import('katex/dist/katex.min.css'),
        ]);
        if (!alive) return;
        setHtml(
          katex.renderToString(tex, {
            throwOnError: false,
            displayMode: false,
            output: 'html',
          }),
        );
      } catch {
        if (alive) setHtml('');
      }
    })();
    return () => {
      alive = false;
    };
  }, [tex]);

  return html;
}

function FormulaNodeComponent({ data, selected, width, height }: NodeProps) {
  const d = data as FlowNodeData;
  const w = width ?? FORMULA_NODE_SIZE.width;
  const h = height ?? FORMULA_NODE_SIZE.height;
  const html = useKatexHtml(d.formula ?? '');
  const color = selected ? '#1D4ED8' : (d.style.textColor ?? d.style.stroke ?? '#0F172A');

  return (
    <div className="relative" style={{ width: w, height: h, cursor: 'grab' }}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded px-1"
        style={{ opacity: d.style.opacity ?? 1 }}
      >
        {html ? (
          <span
            data-testid="formula-content"
            className="pointer-events-none max-w-full overflow-hidden text-center"
            style={{ color, fontSize: d.style.fontSize ?? 16 }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <span className="pointer-events-none select-none font-mono text-[12px]" style={{ color }}>
            {d.formula || '\\LaTeX'}
          </span>
        )}
      </div>

      {d.label ? (
        <span
          className="pointer-events-none absolute inset-x-0 -bottom-5 truncate text-center text-[11px] leading-tight"
          style={{ color: d.style.textColor ?? '#334155' }}
        >
          {d.label}
        </span>
      ) : null}

      {selected ? (
        <NodeResizer
          minWidth={48}
          minHeight={32}
          onResizeStart={() => useFlowStore.getState().commit()}
        />
      ) : null}
    </div>
  );
}

export const FormulaNode = memo(FormulaNodeComponent);
