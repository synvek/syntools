/**
 * Lightweight text handoff between tools (F1): via sessionStorage, auto-filled when the target opens.
 * Short text only; large files never take this path.
 */

const HANDOFF_KEY = 'syntools:handoff.v1';
const HANDOFF_MAX = 200_000; // ~200KB

export interface HandoffPayload {
  targetId: string;
  text: string;
  /** Optional field-name hint (the target tool can read it) */
  field?: string;
}

export function writeHandoff(payload: HandoffPayload): boolean {
  if (!payload.text || payload.text.length > HANDOFF_MAX) return false;
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Read and clear; returns the text only when targetId matches */
export function consumeHandoff(toolId: string): string | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HANDOFF_KEY);
    const parsed = JSON.parse(raw) as HandoffPayload;
    if (parsed?.targetId !== toolId || typeof parsed.text !== 'string') return null;
    return parsed.text;
  } catch {
    return null;
  }
}
