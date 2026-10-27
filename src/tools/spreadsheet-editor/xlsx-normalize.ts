/**
 * xlsx compatibility layer: normalises comment relationships written by other producers
 * (openpyxl / WPS / LibreOffice, …) into the form exceljs understands.
 *
 * Background: exceljs collects comments only via the entry-name patterns
 * `/xl\/(comments\d+)[.]xml/` and `/xl\/drawings\/(vmlDrawing\d+)[.]vml/`, and during the
 * reconcile phase looks them up by the literal relationship Target
 * (`options.comments[rel.Target]`). openpyxl instead writes `xl/comments/comment1.xml` with an
 * absolute Target (`/xl/comments/comment1.xml`), so neither side matches, exceljs throws a
 * TypeError, and **a perfectly valid file with comments fails to import entirely**.
 *
 * So these relationships are rewritten before exceljs sees them (renaming the parts to where it
 * expects them). Content is untouched — only paths are normalised; files that need no change are
 * returned as-is to avoid a needless re-compression.
 */
import type JSZipType from 'jszip';

const RELS_PATH = /^xl\/worksheets\/_rels\/[^/]+\.rels$/;
const RELATIONSHIP_TAG = /<Relationship\b[^>]*?\/?>/g;
const TARGET_ATTR = /\bTarget="([^"]*)"/;

/** Relationship kind: match on the local name only, tolerating any namespace prefix */
function relationshipKind(tag: string): 'comments' | 'vmlDrawing' | null {
  if (/relationships\/comments"/.test(tag)) return 'comments';
  if (/relationships\/vmlDrawing"/.test(tag)) return 'vmlDrawing';
  return null;
}

/** Resolve a relationship Target to an in-archive path (absolute or relative) */
export function resolvePartPath(target: string, baseDir: string): string | null {
  const raw = target.trim();
  if (!raw) return null;
  if (raw.startsWith('/')) return raw.replace(/^\/+/, '');
  const segments = `${baseDir}${raw}`.split('/');
  const stack: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  return stack.join('/');
}

async function loadZip(buffer: ArrayBuffer): Promise<JSZipType | null> {
  try {
    const JSZip = (await import('jszip')).default;
    return await JSZip.loadAsync(buffer);
  } catch {
    // Not a valid zip: let exceljs raise the error and return the input untouched here
    return null;
  }
}

const TEXT_ELEMENT = /<text>([\s\S]*?)<\/text>/g;

/**
 * Normalise comment bodies: wrap a `<t>` sitting directly under `<text>` in an `<r>`.
 * exceljs only parses the run form; otherwise texts comes back empty and the comment body is lost.
 */
export function wrapCommentTextRuns(xml: string): string {
  return xml.replace(TEXT_ELEMENT, (whole, inner: string) => {
    if (/<r[\s>]/.test(inner)) return whole; // already in run form
    if (!/<t[\s>]/.test(inner)) return whole; // no text node
    return `<text><r>${inner}</r></text>`;
  });
}

/**
 * Normalise the archive; returns the original buffer when nothing needs changing or anything fails.
 * Only affects the relationship paths and body structure of comments and their VML drawing parts.
 */
export async function normalizeXlsxArchive(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await loadZip(buffer);
  if (!zip) return buffer;

  const relsNames = Object.keys(zip.files).filter((name) => RELS_PATH.test(name));
  if (relsNames.length === 0) return buffer;

  let counter = 0;
  let changed = false;

  for (const relsName of relsNames) {
    const relsFile = zip.file(relsName);
    if (!relsFile) continue;
    const original = await relsFile.async('string');
    const baseDir = relsName.replace(/_rels\/[^/]+\.rels$/, '');
    const moves: { from: string; to: string }[] = [];

    const rewritten = original.replace(RELATIONSHIP_TAG, (tag) => {
      const kind = relationshipKind(tag);
      if (!kind) return tag;
      const targetMatch = TARGET_ATTR.exec(tag);
      if (!targetMatch) return tag;
      const part = resolvePartPath(targetMatch[1], baseDir);
      if (!part) return tag;

      // If already where exceljs expects it, only fix the Target; otherwise rename it into place (stepping around numbers already taken)
      const expectedPart =
        kind === 'comments' ? /^xl\/comments\d+\.xml$/ : /^xl\/drawings\/vmlDrawing\d+\.vml$/;
      let nextPart = part;
      if (!expectedPart.test(part)) {
        let index = counter + 1;
        nextPart =
          kind === 'comments' ? `xl/comments${index}.xml` : `xl/drawings/vmlDrawing${index}.vml`;
        while (zip.file(nextPart)) {
          index += 1;
          nextPart =
            kind === 'comments' ? `xl/comments${index}.xml` : `xl/drawings/vmlDrawing${index}.vml`;
        }
        counter = index;
      }

      const expectedTarget = `../${nextPart.startsWith('xl/') ? nextPart.slice(3) : nextPart}`;
      if (nextPart !== part) moves.push({ from: part, to: nextPart });
      if (targetMatch[1] === expectedTarget) return tag;
      return tag.replace(targetMatch[0], `Target="${expectedTarget}"`);
    });

    if (rewritten !== original) {
      zip.file(relsName, rewritten);
      changed = true;
    }
    for (const move of moves) {
      const source = zip.file(move.from);
      if (!source) continue;
      zip.file(move.to, await source.async('uint8array'));
      zip.remove(move.from);
    }
  }

  // Comment bodies: openpyxl and friends write <text><t>…</t></text>, while exceljs only parses the
  // run form <text><r><t>…</t></r></text> — anything else yields empty text
  for (const name of Object.keys(zip.files)) {
    if (!/^xl\/comments\d+\.xml$/.test(name)) continue;
    const file = zip.file(name);
    if (!file) continue;
    const original = await file.async('string');
    const rewritten = wrapCommentTextRuns(original);
    if (rewritten !== original) {
      zip.file(name, rewritten);
      changed = true;
    }
  }

  if (!changed) return buffer;
  try {
    return await zip.generateAsync({ type: 'arraybuffer' });
  } catch {
    return buffer;
  }
}
