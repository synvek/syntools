/**
 * Mermaid flowchart 文本导出：便于粘贴到 Markdown / 文档 / GitHub。
 * 只导出结构（节点文本与连线），样式无法在 Mermaid 中表达。
 */

import { activePageOf } from '../model/migrate';
import type { FlowDoc, ShapeKind } from '../model/types';

/** 去掉 Mermaid 语法敏感字符，避免生成非法脚本 */
function safe(text: string): string {
  return (
    text
      .replace(/[[\]{}()|"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || ' '
  );
}

/** 形状 → Mermaid 文本包裹方式 */
function bodyOf(kind: ShapeKind, label: string): string {
  const text = safe(label);
  switch (kind) {
    case 'decision':
      return `{${text}}`;
    case 'startEnd':
      return `([${text}])`;
    case 'data':
      return `[/${text}/]`;
    case 'database':
      return `[(${text})]`;
    case 'document':
      return `[[${text}]]`;
    case 'rect':
    default:
      return `[${text}]`;
  }
}

export function toMermaid(doc: FlowDoc): string {
  const page = activePageOf(doc);
  if (!page || page.nodes.length === 0) return '';

  const lines = ['flowchart TD'];
  for (const node of page.nodes) {
    lines.push(`  ${node.id}${bodyOf(node.data.kind, node.data.label)}`);
  }
  for (const edge of page.edges) {
    const label = edge.label ? safe(edge.label) : '';
    const arrow = label ? `-->|${label}|` : '-->';
    lines.push(`  ${edge.source} ${arrow} ${edge.target}`);
  }
  return `${lines.join('\n')}\n`;
}
