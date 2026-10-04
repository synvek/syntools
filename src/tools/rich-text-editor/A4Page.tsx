import { createPortal } from 'react-dom';
import type { CSSProperties, Ref } from 'react';
import { watermarkCssVars, type WatermarkConfig } from './pageSetup';

interface PrintLayerProps {
  /** 已消毒的文档 HTML */
  html: string;
  flowRef: Ref<HTMLDivElement>;
  /** 文字水印（null 表示无水印）：打印时以 fixed 定位重复出现在每一页 */
  watermark?: WatermarkConfig | null;
}

/**
 * A4 打印/导出层（技术设计 §7.3）：
 * - 屏幕：渲染到 body 的屏幕外容器（仍需参与布局以便量测高度）；
 * - 打印：@media print 仅保留该容器，交给浏览器自动分页；
 * - 快照：按同一容器量测块级边界后分页截图。
 * 打印与截图因此共用完全一致的版式。
 */
export function PrintLayer({ html, flowRef, watermark }: PrintLayerProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="rte-print-root" aria-hidden="true">
      {/* 水印放在打印流之外：fixed 定位在打印时会在每一页重复出现 */}
      {watermark && watermark.text.trim() ? (
        <div className="rte-print-watermark" style={watermarkCssVars(watermark) as CSSProperties}>
          <span>{watermark.text}</span>
        </div>
      ) : null}
      <div className="rte-print-flow" ref={flowRef} dangerouslySetInnerHTML={{ __html: html }} />
    </div>,
    document.body,
  );
}
