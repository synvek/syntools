import type { ToolMeta } from '@/core/types';
import { tools, toolMap } from '@/core/registry';

const DEFAULT_LIMIT = 6;

/** Resolve related tools: prefer relatedIds, top up from the same category */
export function resolveRelatedTools(tool: ToolMeta, limit = DEFAULT_LIMIT): ToolMeta[] {
  const seen = new Set<string>([tool.id]);
  const out: ToolMeta[] = [];

  for (const id of tool.relatedIds ?? []) {
    const t = toolMap.get(id);
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
      if (out.length >= limit) return out;
    }
  }

  const sameCategory = tools
    .filter((t) => t.category === tool.category && !seen.has(t.id))
    .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));

  for (const t of sameCategory) {
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}
