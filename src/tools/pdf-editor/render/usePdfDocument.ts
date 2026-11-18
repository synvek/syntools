import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { fileToBytes } from '@/core/pdf/load';
import { openPdfjsDoc } from '@/core/pdf/render';
import { PDF_MAX_BYTES, isPdfFile, type PdfError } from '@/core/pdf/types';
import type { PdfSource } from '../model/types';

export type PdfOpenStatus = 'idle' | 'opening' | 'need-password' | 'ready' | 'error';

export interface PdfDocumentController {
  status: PdfOpenStatus;
  pdfDoc: PDFDocumentProxy | null;
  source: PdfSource | null;
  name: string | null;
  /** Last failure code; `null` while a password is simply awaited */
  error: PdfError | null;
  password: string;
  needsPassword: boolean;
  busy: boolean;
  openFile(file: File): Promise<void>;
  /** Re-open bytes that did not come from a file picker (restored draft); false on failure */
  openBytes(name: string, bytes: Uint8Array, fingerprint: string): Promise<boolean>;
  unlock(): Promise<void>;
  setPassword(value: string): void;
  close(): void;
}

interface PendingFile {
  file: File;
  bytes: Uint8Array;
}

/** `destroy()` is the only call that releases a pdfjs worker; ignore failures on teardown */
function destroyDoc(doc: PDFDocumentProxy | null | undefined): void {
  if (!doc) return;
  void doc.destroy().catch(() => undefined);
}

function fingerprintOf(doc: PDFDocumentProxy, file: File): string {
  const fromFile = doc.fingerprints?.[0];
  if (fromFile) return fromFile;
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** Fallback identity when the pdfjs fingerprint is missing (e.g. bytes restored from a draft) */
function fingerprintFor(doc: PDFDocumentProxy, name: string): string {
  return doc.fingerprints?.[0] ?? `${name}:restored`;
}

/**
 * Open pipeline for the editor: validate → read bytes → pdfjs open → password retry → source model.
 *
 * Deliberately not built on `usePdfPassword`: its `onPdfSelected` clears the field before every
 * probe, which would wipe what the user just typed on a retry. The field state is owned here and
 * only cleared on a successful open or an explicit close.
 *
 * Races: every open increments a request id; results from a superseded request are dropped, and the
 * previous `PDFDocumentProxy` is only destroyed after the new one has opened successfully.
 */
export function usePdfDocument(): PdfDocumentController {
  const [status, setStatus] = useState<PdfOpenStatus>('idle');
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [source, setSource] = useState<PdfSource | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<PdfError | null>(null);
  const [password, setPassword] = useState('');

  const docRef = useRef<PDFDocumentProxy | null>(null);
  const pendingRef = useRef<PendingFile | null>(null);
  const requestRef = useRef(0);

  useEffect(
    () => () => {
      destroyDoc(docRef.current);
      docRef.current = null;
    },
    [],
  );

  const commit = useCallback(
    (
      doc: PDFDocumentProxy,
      meta: {
        name: string;
        fingerprint: string;
        bytes: Uint8Array;
        encrypted: boolean;
        password?: string;
      },
    ) => {
      destroyDoc(docRef.current);
      docRef.current = doc;
      pendingRef.current = null;

      setPdfDoc(doc);
      setSource({
        bytes: meta.bytes,
        pageCount: doc.numPages,
        encrypted: meta.encrypted,
        // Needed to load the same bytes with pdf-lib when saving; memory only
        password: meta.password?.trim() ? meta.password : undefined,
        fingerprint: meta.fingerprint || fingerprintFor(doc, meta.name),
      });
      setName(meta.name);
      setStatus('ready');
      setError(null);
      setPassword('');
    },
    [],
  );

  const close = useCallback(() => {
    requestRef.current += 1;
    destroyDoc(docRef.current);
    docRef.current = null;
    pendingRef.current = null;

    setPdfDoc(null);
    setSource(null);
    setName(null);
    setStatus('idle');
    setError(null);
    setPassword('');
  }, []);

  const openFile = useCallback(
    async (file: File) => {
      const request = (requestRef.current += 1);
      setError(null);
      setPassword('');

      if (!isPdfFile(file)) {
        setName(file.name);
        setError('NOT_PDF');
        setStatus('error');
        return;
      }
      if (file.size > PDF_MAX_BYTES) {
        setName(file.name);
        setError('TOO_LARGE');
        setStatus('error');
        return;
      }

      setStatus('opening');
      const bytes = await fileToBytes(file);
      if (request !== requestRef.current) return;

      pendingRef.current = { file, bytes };
      const result = await openPdfjsDoc(bytes);
      if (request !== requestRef.current) return;

      if (!result.ok) {
        if (result.error === 'NEED_PASSWORD') {
          setName(file.name);
          setError(null);
          setStatus('need-password');
          return;
        }
        setName(file.name);
        setError(result.error as PdfError);
        setStatus('error');
        return;
      }

      commit(result.value, {
        name: file.name,
        fingerprint: fingerprintOf(result.value, file),
        bytes,
        encrypted: false,
      });
    },
    [commit],
  );

  /**
   * Open bytes that did not come from a picker (draft restore).
   *
   * The fingerprint is supplied by the draft: recomputing it from the bytes can differ from the
   * value the record was stored under, which would make the draft impossible to find again.
   */
  const openBytes = useCallback(
    async (name: string, bytes: Uint8Array, fingerprint: string): Promise<boolean> => {
      const request = (requestRef.current += 1);
      setError(null);
      setPassword('');
      setStatus('opening');

      const result = await openPdfjsDoc(bytes);
      if (request !== requestRef.current) return false;

      if (!result.ok) {
        setName(name);
        setError((result.error === 'NEED_PASSWORD' ? 'LOAD_FAILED' : result.error) as PdfError);
        setStatus('error');
        return false;
      }

      commit(result.value, { name, fingerprint, bytes, encrypted: false });
      return true;
    },
    [commit],
  );

  const unlock = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending || !password.trim()) return;

    const request = requestRef.current;
    setStatus('opening');
    setError(null);

    const result = await openPdfjsDoc(pending.bytes, { password });
    if (request !== requestRef.current) return;

    if (!result.ok) {
      if (result.error === 'WRONG_PASSWORD' || result.error === 'NEED_PASSWORD') {
        // Keep the typed password so the user can correct it instead of retyping
        setError('WRONG_PASSWORD');
        setStatus('need-password');
        return;
      }
      setError(result.error as PdfError);
      setStatus('error');
      return;
    }

    commit(result.value, {
      name: pending.file.name,
      fingerprint: fingerprintOf(result.value, pending.file),
      bytes: pending.bytes,
      encrypted: true,
      password,
    });
  }, [commit, password]);

  return {
    status,
    pdfDoc,
    source,
    name,
    error,
    password,
    needsPassword: status === 'need-password',
    busy: status === 'opening',
    openFile,
    openBytes,
    unlock,
    setPassword,
    close,
  };
}
