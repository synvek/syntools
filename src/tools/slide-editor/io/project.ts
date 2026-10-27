import JSZip from 'jszip';
import type { ToolResult } from '@/core/types';
import { extensionForMime } from '../model/media';
import { migrateDoc } from '../model/migrate';
import type { MediaAsset, SlideDoc } from '../model/types';

/**
 * Project file (.sld): JSON + raw image bytes packed into a zip.
 *
 * Why it's needed: until now the only reliable persistence was "export pptx" and localStorage drafts,
 * and drafts over 3MB **drop the image bytes**, so images come back blank.
 * A project file carries images verbatim and avoids OOXML's fidelity loss, a truly lossless intermediate form.
 */

/**
 * Project file format version.
 *
 * v2 = Fill backgrounds + chart/formula/icon elements + run-level extras.
 * Old v1 files are still readable (`payload.version <= PROJECT_VERSION` passes),
 * and are upgraded to the current schema via `migrateDoc()` so fields like background aren't lost.
 */
export const PROJECT_VERSION = 2;
export const PROJECT_FORMAT = 'syntools-slide';
export const PROJECT_EXTENSION = 'sld';
const PROJECT_ENTRY = 'project.json';

export type ProjectErrorCode = 'EMPTY' | 'NOT_PROJECT' | 'PROJECT_VERSION' | 'IMPORT_FAILED';

interface ProjectPayload {
  format: string;
  version: number;
  doc: SlideDoc;
  /** mediaId → path inside the zip (media without bytes is omitted) */
  mediaFiles: Record<string, string>;
}

/** Strip runtime state and large fields: bytes become their own binary entries, url is never stored */
function stripDoc(doc: SlideDoc): {
  clean: SlideDoc;
  files: Record<string, string>;
  entries: { name: string; bytes: Uint8Array }[];
} {
  const files: Record<string, string> = {};
  const entries: { name: string; bytes: Uint8Array }[] = [];
  const media: Record<string, MediaAsset> = {};
  for (const [id, asset] of Object.entries(doc.media)) {
    media[id] = { id: asset.id, mime: asset.mime, width: asset.width, height: asset.height };
    if (!asset.bytes) continue;
    const name = `${id}.${extensionForMime(asset.mime)}`;
    files[id] = name;
    entries.push({ name, bytes: asset.bytes });
  }
  return { clean: { ...doc, media }, files, entries };
}

export async function saveProject(doc: SlideDoc): Promise<ToolResult<Uint8Array>> {
  try {
    const { clean, files, entries } = stripDoc(doc);
    const zip = new JSZip();
    const payload: ProjectPayload = {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      doc: clean,
      mediaFiles: files,
    };
    zip.file(PROJECT_ENTRY, JSON.stringify(payload));
    for (const entry of entries) zip.file(`media/${entry.name}`, entry.bytes);
    const buffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return { ok: true, value: new Uint8Array(buffer) };
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}

export async function openProject(file: File): Promise<ToolResult<SlideDoc>> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file(PROJECT_ENTRY);
    if (!entry) return { ok: false, error: 'NOT_PROJECT' };
    const payload = JSON.parse(await entry.async('string')) as ProjectPayload;
    if (payload.format !== PROJECT_FORMAT) return { ok: false, error: 'NOT_PROJECT' };
    if (payload.version > PROJECT_VERSION) return { ok: false, error: 'PROJECT_VERSION' };

    const media: Record<string, MediaAsset> = {};
    for (const [id, asset] of Object.entries(payload.doc.media ?? {})) {
      const name = payload.mediaFiles?.[id];
      const bytes = name ? await zip.file(`media/${name}`)?.async('uint8array') : undefined;
      media[id] = { ...asset, bytes: bytes ?? undefined };
    }
    // Old project versions (v1) are upgraded to the current schema here: background string→Fill, new optional fields filled in
    const doc: SlideDoc = migrateDoc({ ...payload.doc, media });
    if (!doc.slides || doc.slides.length === 0) return { ok: false, error: 'EMPTY' };
    return { ok: true, value: doc };
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}
