/**
 * pdfjs proxies for every byte source of a document.
 *
 * The model has allowed pages from more than one PDF since M2-0 (`PdfPageState.sourceKey`), and
 * `savePdf` has always copied each page from its own bytes. Rendering lagged behind: the viewport and
 * the thumbnail rail were handed the *main* proxy only, so an inserted page showed whatever page sat
 * at the same index in the opened file. This module closes that gap.
 *
 * Ownership: `usePdfDocument` owns the main proxy (it also owns the password retry); this hook owns
 * the attachments and destroys them when they leave `doc.attachments`, so undoing an insertion does
 * not leak a worker-backed document.
 */

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openPdfjsDoc } from '@/core/pdf/render';
import type { PdfPageState, PdfSource } from '../model/types';

/** `source.key` → pdfjs proxy. Keys line up with `PdfPageState.sourceKey` */
export type SourceDocs = Record<string, PDFDocumentProxy>;

/**
 * Proxy that can render `page`.
 *
 * `fallback` keeps older callers working (tests that only mount the main document): when no map is
 * supplied, main-source pages still resolve. Blank pages own no proxy at all.
 */
export function docForPage(
  docs: SourceDocs | undefined,
  page: PdfPageState,
  fallback?: PDFDocumentProxy | null,
): PDFDocumentProxy | undefined {
  if (page.blank) return undefined;
  if (docs) return docs[page.sourceKey];
  return page.sourceKey === 'main' ? (fallback ?? undefined) : undefined;
}

/** Stable identity of a byte source; a new file inserted under the same key must be re-opened */
function sourceSignature(source: PdfSource): string {
  return `${source.key}|${source.fingerprint}|${source.bytes.byteLength}`;
}

function destroyDoc(doc: PDFDocumentProxy | undefined): void {
  const destroyable = doc as (PDFDocumentProxy & { destroy?: () => Promise<void> }) | undefined;
  if (!destroyable?.destroy) return;
  void destroyable.destroy().catch(() => undefined);
}

/**
 * Open (and keep) one pdfjs proxy per attachment.
 *
 * Sequential on purpose: a document normally holds one or two attachments, and opening them in
 * parallel only competes with the main document for the worker pool during the first paint.
 * Failures are silent — the page falls back to its placeholder, exactly like a page whose bytes were
 * dropped by the quota guard.
 */
export function useAttachmentDocs(attachments: PdfSource[]): SourceDocs {
  const registry = useRef(new Map<string, { signature: string; doc: PDFDocumentProxy }>());
  const signatureRef = useRef('');
  const [docs, setDocs] = useState<SourceDocs>({});

  const signature = attachments.map(sourceSignature).join('~');

  useEffect(() => {
    // `attachments` identity changes on every undo/redo snapshot; the signature is what matters
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;

    let cancelled = false;
    const wanted = new Map(attachments.map((source) => [source.key, sourceSignature(source)]));

    for (const [key, entry] of [...registry.current]) {
      if (wanted.get(key) === entry.signature) continue;
      destroyDoc(entry.doc);
      registry.current.delete(key);
    }

    const publish = () => {
      if (cancelled) return;
      setDocs(
        Object.fromEntries([...registry.current.entries()].map(([key, entry]) => [key, entry.doc])),
      );
    };
    publish();

    void (async () => {
      let changed = false;
      for (const source of attachments) {
        if (cancelled) return;
        if (registry.current.get(source.key)?.signature === sourceSignature(source)) continue;

        const previous = registry.current.get(source.key);
        if (previous) destroyDoc(previous.doc);
        registry.current.delete(source.key);

        const result = await openPdfjsDoc(source.bytes);
        if (cancelled) {
          if (result.ok) destroyDoc(result.value);
          return;
        }
        if (!result.ok) continue;
        registry.current.set(source.key, {
          signature: sourceSignature(source),
          doc: result.value,
        });
        changed = true;
      }
      if (changed) publish();
    })();

    return () => {
      cancelled = true;
    };
  }, [attachments, signature]);

  // Tear down every attachment proxy with the editor
  useEffect(
    () => () => {
      for (const entry of registry.current.values()) destroyDoc(entry.doc);
      registry.current.clear();
    },
    [],
  );

  return docs;
}
