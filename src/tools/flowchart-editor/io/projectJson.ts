/**
 * 项目文件（.flow.json）的保存与打开。
 * 读取时统一经 migrateDoc 归一，保证旧版文件与草稿都能打开。
 */

import { migrateDoc } from '../model/migrate';
import type { FlowDoc } from '../model/types';

export const PROJECT_FILE_EXT = 'flow.json';

export function toProjectJson(doc: FlowDoc): string {
  return JSON.stringify(doc, null, 2);
}

/** 解析项目文件；非法内容返回 null */
export function parseProjectJson(text: string): FlowDoc | null {
  try {
    const raw: unknown = JSON.parse(text);
    return migrateDoc(raw);
  } catch {
    return null;
  }
}
