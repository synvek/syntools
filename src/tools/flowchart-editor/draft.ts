/**
 * Local draft (never leaves the browser): debounced write to localStorage after editing stops,
 * restored automatically after a reload. Reads and writes are wrapped in try/catch, degrading when over quota.
 *
 * Size strategy: images are inlined as dataURLs and can quickly blow up localStorage (~5MB).
 * So the size is estimated before writing; when over the limit the **image payload is dropped** and written again, reporting "degraded",
 * and the UI suggests saving a version with images via "export project file".
 */

import { DRAFT_SIZE_LIMIT, type FlowDoc, type FlowPage } from './model/types';
import { activePageOf, migrateDoc } from './model/migrate';

const DRAFT_KEY = 'syntools:flowchart-editor.draft.v1';

export interface DraftWriteResult {
  saved: boolean;
  /** Image payload dropped due to the size limit (the draft is still saved, but the images are incomplete) */
  droppedImages: boolean;
}

export function readDraft(): FlowDoc | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    // The stored shape is { doc, savedAt }, so doc must be extracted before validating
    const parsed = JSON.parse(raw) as { doc?: unknown; savedAt?: number } | null;
    if (!parsed || typeof parsed !== 'object' || !('doc' in parsed)) return null;
    // Legacy drafts are v1 ({nodes, edges}); they are migrated to v2 so no content is lost
    return migrateDoc(parsed.doc);
  } catch {
    return null;
  }
}

/** Strip the dataURL from every image node (keeping positions and other styles) */
function withoutImages(doc: FlowDoc): FlowDoc {
  const pages: FlowPage[] = doc.pages.map((page) => ({
    ...page,
    nodes: page.nodes.map((node) =>
      node.data.src ? { ...node, data: { ...node.data, src: undefined } } : node,
    ),
  }));
  return { ...doc, pages };
}

function payloadSize(payload: string): number {
  return payload.length;
}

export function writeDraft(doc: FlowDoc): DraftWriteResult {
  try {
    // Do not keep a draft for an empty canvas: after the user clears it, a reload should not restore content
    const page = activePageOf(doc);
    if (!page || page.nodes.length === 0) {
      localStorage.removeItem(DRAFT_KEY);
      return { saved: false, droppedImages: false };
    }

    const payload = (value: FlowDoc) => JSON.stringify({ doc: value, savedAt: Date.now() });
    let text = payload(doc);
    let droppedImages = false;
    if (payloadSize(text) > DRAFT_SIZE_LIMIT) {
      text = payload(withoutImages(doc));
      droppedImages = true;
      if (payloadSize(text) > DRAFT_SIZE_LIMIT) {
        // Still over the limit: give up writing, so an exception cannot permanently corrupt the draft
        localStorage.removeItem(DRAFT_KEY);
        return { saved: false, droppedImages };
      }
    }

    localStorage.setItem(DRAFT_KEY, text);
    return { saved: true, droppedImages };
  } catch {
    return { saved: false, droppedImages: false };
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore when localStorage is unavailable
  }
}
