/**
 * 工具间轻量文本传递（F1）：经 sessionStorage，打开目标工具时自动灌入输入。
 * 仅用于短文本；大文件不走此路径。
 */

const HANDOFF_KEY = 'syntools:handoff.v1';
const HANDOFF_MAX = 200_000; // ~200KB

export interface HandoffPayload {
  targetId: string;
  text: string;
  /** 可选字段名提示（目标工具可读） */
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

/** 读取并清除；仅当 targetId 匹配时返回文本 */
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
