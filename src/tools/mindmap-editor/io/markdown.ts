/**
 * Markdown 大纲 ⇄ 脑图。
 * 导出：`# / ## / ###` 标题层级（最深 6 级）。
 * 导入：同时支持标题层级与 `-` 列表缩进两种写法。
 */

import { createId } from '../model/tree';
import { DEFAULT_THEME_ID } from '../model/themes';
import type { MindDoc, MindNodeRec } from '../model/types';

const MAX_LEVEL = 6;

/** 导出为 Markdown 大纲 */
export function toMarkdown(doc: MindDoc): string {
  const lines: string[] = [];
  const walk = (id: string, depth: number) => {
    const rec = doc.nodes.find((n) => n.id === id);
    if (!rec) return;
    const level = Math.min(depth + 1, MAX_LEVEL);
    lines.push(`${'#'.repeat(level)} ${rec.text}`.trimEnd());
    for (const child of doc.nodes.filter((n) => n.parentId === id)) walk(child.id, depth + 1);
  };
  walk(doc.rootId, 0);
  return `${lines.join('\n')}\n`;
}

interface ParsedLine {
  depth: number;
  text: string;
}

/** 解析单行：返回层级与文本，非大纲行返回 null */
function parseLine(line: string): ParsedLine | null {
  const heading = /^(#{1,6})\s+(.*)$/.exec(line);
  if (heading) {
    const text = heading[2].trim();
    return text ? { depth: heading[1].length - 1, text } : null;
  }
  const item = /^(\s*)[-*+]\s+(.*)$/.exec(line);
  if (item) {
    const text = item[2].trim();
    const indent = item[1].replace(/\t/g, '  ').length;
    return text ? { depth: Math.floor(indent / 2) + 1, text } : null;
  }
  // 纯文本行（无标记）视为一级分支，便于直接粘贴大纲文本
  const plain = line.trim();
  return plain ? { depth: 1, text: plain } : null;
}

/** 从 Markdown 大纲构建脑图；无有效内容时返回 null */
export function fromMarkdown(text: string): MindDoc | null {
  const parsed: ParsedLine[] = [];
  let inFence = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    // 代码块围栏内的内容整体跳过
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!line.trim()) continue;
    const hit = parseLine(line);
    if (hit) parsed.push(hit);
  }
  if (parsed.length === 0) return null;

  const nodes: MindNodeRec[] = [];
  // 栈中保存 (depth, id)，用于为新节点找父级
  const stack: Array<{ depth: number; id: string }> = [];
  let rootId = '';

  for (const item of parsed) {
    const id = createId();
    while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) stack.pop();
    // 首个节点即中心主题：层级不足时强制提升为根
    // 第一个节点即中心主题；其后所有节点至少挂在中心主题下，保证单根
    let parentId = stack.length > 0 ? stack[stack.length - 1].id : null;
    if (!parentId && rootId) parentId = rootId;
    if (!parentId) rootId = id;
    nodes.push({ id, parentId, text: item.text, collapsed: false });
    stack.push({ depth: item.depth, id });
  }

  if (!rootId) return null;
  return {
    version: 1,
    rootId,
    nodes,
    direction: 'right',
    themeId: DEFAULT_THEME_ID,
  };
}
