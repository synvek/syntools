import { createPortal } from 'react-dom';

interface PrintLayerProps {
  /** 已消毒的文档 HTML */
  html: string;
  flowRef: React.Ref<HTMLDivElement>;
}

/**
 * A4 打印/导出层（技术设计 §7.3）：
 * - 屏幕：渲染到 body 的屏幕外容器（仍需参与布局以便量测高度）；
 * - 打印：@media print 仅保留该容器，交给浏览器自动分页；
 * - 快照：按同一容器量测块级边界后分页截图。
 * 打印与截图因此共用完全一致的版式。
 */
export function PrintLayer({ html, flowRef }: PrintLayerProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="rte-print-root" aria-hidden="true">
      <div className="rte-print-flow" ref={flowRef} dangerouslySetInnerHTML={{ __html: html }} />
    </div>,
    document.body,
  );
}
