import { i18n } from '@/core/i18n';
import { tools } from '@/core/registry';
import type { ToolMeta } from '@/core/types';
import { getToolMeta } from '@/core/i18n/helpers';

/** Weighted score: exact name > name prefix > name contains > keyword prefix > keyword contains > description (tech design §7.3) */
function score(tool: ToolMeta, q: string): number {
  const { name, description } = getToolMeta(tool);
  const nameLower = name.toLowerCase();
  if (nameLower === q) return 100;
  if (nameLower.startsWith(q)) return 80;
  if (nameLower.includes(q)) return 60;
  const keywords = tool.keywords.map((k) => k.toLowerCase());
  if (keywords.some((k) => k.startsWith(q))) return 40;
  if (keywords.some((k) => k.includes(q))) return 30;
  if (description.toLowerCase().includes(q)) return 10;
  return 0;
}

/** In-memory index search over the registry; an empty query returns every tool */
export function searchTools(query: string): ToolMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...tools];
  return tools
    .map((tool) => ({ tool, score: score(tool, q) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        getToolMeta(a.tool).name.localeCompare(getToolMeta(b.tool).name, i18n.language),
    )
    .map((x) => x.tool);
}
