import type { ToolResult } from '@/core/types';

export type TextLinesErrorCode = 'EMPTY';
export type TextLinesOp = 'sort-asc' | 'sort-desc' | 'unique' | 'reverse' | 'number' | 'trim-empty';

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

/** Line operations: sort / unique / reverse / number / trim empty */
export function processLines(input: string, op: TextLinesOp): ToolResult<string> {
  if (!input) return { ok: false, error: 'EMPTY' };
  let lines = splitLines(input);

  switch (op) {
    case 'sort-asc':
      lines = [...lines].sort((a, b) => a.localeCompare(b));
      break;
    case 'sort-desc':
      lines = [...lines].sort((a, b) => b.localeCompare(a));
      break;
    case 'unique': {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const line of lines) {
        if (seen.has(line)) continue;
        seen.add(line);
        out.push(line);
      }
      lines = out;
      break;
    }
    case 'reverse':
      lines = [...lines].reverse();
      break;
    case 'number':
      lines = lines.map((line, i) => `${i + 1}. ${line}`);
      break;
    case 'trim-empty':
      lines = lines.filter((line) => line.trim().length > 0);
      break;
    default:
      break;
  }

  return { ok: true, value: lines.join('\n') };
}
