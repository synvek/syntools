/**
 * Markdown outline ⇄ mind map.
 * Export: `# / ## / ###` heading levels (up to 6 levels deep).
 * Import: accepts both heading levels and `-` list indentation.
 */

import { createId } from '../model/tree';
import { DEFAULT_THEME_ID } from '../model/themes';
import type { MindDoc, MindNodeRec } from '../model/types';

const MAX_LEVEL = 6;

/** Export as a Markdown outline */
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

/** Parse one line: returns its depth and text, or null when it is not an outline line */
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
  // Plain lines (no marker) become first-level branches, so raw outline text can be pasted as-is
  const plain = line.trim();
  return plain ? { depth: 1, text: plain } : null;
}

/** Build a mind map from a Markdown outline; returns null when there is no usable content */
export function fromMarkdown(text: string): MindDoc | null {
  const parsed: ParsedLine[] = [];
  let inFence = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    // Skip everything inside fenced code blocks wholesale
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
  // Stack of (depth, id) pairs, used to find each new node's parent
  const stack: Array<{ depth: number; id: string }> = [];
  let rootId = '';

  for (const item of parsed) {
    const id = createId();
    while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) stack.pop();
    // The first node becomes the central topic: promote it to the root when its depth is too shallow
    // The first node is the central topic; every later node hangs under it at minimum, guaranteeing one root
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
