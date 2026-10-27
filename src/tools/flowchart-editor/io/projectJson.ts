/**
 * Saving and opening project files (.flow.json).
 * Reads always go through migrateDoc normalization, so legacy files and drafts both open.
 */

import { migrateDoc } from '../model/migrate';
import type { FlowDoc } from '../model/types';

export const PROJECT_FILE_EXT = 'flow.json';

export function toProjectJson(doc: FlowDoc): string {
  return JSON.stringify(doc, null, 2);
}

/** Parse a project file; returns null for invalid content */
export function parseProjectJson(text: string): FlowDoc | null {
  try {
    const raw: unknown = JSON.parse(text);
    return migrateDoc(raw);
  } catch {
    return null;
  }
}
