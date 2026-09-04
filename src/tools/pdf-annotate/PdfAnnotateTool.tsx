import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import {
  PDF_MAX_BYTES,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  usePdfPassword,
  downloadBytes,
  openPdfjsDoc,
  fileToBytes,
  renderPageToCanvas,
} from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import {
  ANNOTATE_TOOLS,
  annotatePdfFile,
  fromNorm,
  newDraftId,
  toNorm,
  type AnnotateDraft,
  type AnnotateKind,
  type Point,
} from './core';

const TOOL_ID = 'pdf-annotate';
const COLORS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#111827', '#ffffff'];

type Size = { width: number; height: number };

export default function PdfAnnotateTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [tool, setTool] = useState<AnnotateKind>('pen');
  const [color, setColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(16);
  const [drafts, setDrafts] = useState<AnnotateDraft[]>([]);
  const [preview, setPreview] = useState<AnnotateDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<Size>({ width: 0, height: 0 });
  const [displaySizes, setDisplaySizes] = useState<Size[]>([]);

  const pdfPwd = usePdfPassword();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const drawing = useRef(false);
  const startPt = useRef<Point | null>(null);
  const penPts = useRef<Point[]>([]);
  const previewRef = useRef<AnnotateDraft | null>(null);

  useEffect(() => () => { void docRef.current?.cleanup(); }, []);

  useEffect(() => {
    if (!doc) return;
    void (async () => {
      const r = await renderPageToCanvas(doc, page, scale);
      if (!r.ok || !canvasRef.current) return;
      const src = r.value;
      const canvas = canvasRef.current;
      canvas.width = src.width;
      canvas.height = src.height;
      canvas.style.width = `${src.width}px`;
      canvas.style.height = `${src.height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src, 0, 0);
      const size = { width: src.width, height: src.height };
      setDisplaySize(size);
      setDisplaySizes((prev) => {
        const next =
          prev.length === doc.numPages
            ? prev.slice()
            : Array.from({ length: doc.numPages }, () => ({ width: 0, height: 0 }));
        next[page - 1] = size;
        return next;
      });
    })();
  }, [doc, page, scale]);

  const clearDoc = async () => {
    if (docRef.current) await docRef.current.cleanup();
    docRef.current = null;
    setDoc(null);
  };

  const clear = () => {
    void clearDoc();
    setFile(null);
    setDrafts([]);
    setPreview(null);
    previewRef.current = null;
    setPage(1);
    setDisplaySizes([]);
    setError(null);
    setErrorCode(null);
    pdfPwd.resetPassword();
  };

  const openDoc = async (f: File, password?: string) => {
    await clearDoc();
    const bytes = await fileToBytes(f);
    const r = await openPdfjsDoc(bytes, { password });
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return false;
    }
    docRef.current = r.value;
    setDoc(r.value);
    setPage(1);
    setDrafts([]);
    setPreview(null);
    previewRef.current = null;
    setDisplaySizes(Array.from({ length: r.value.numPages }, () => ({ width: 0, height: 0 })));
    setError(null);
    setErrorCode(null);
    pdfPwd.setNeedsPassword(false);
    return true;
  };

  const onFile = async (f: File) => {
    setFile(f);
    setError(null);
    setErrorCode(null);
    const probe = await pdfPwd.onPdfSelected(f);
    if (!probe.ok) {
      if (probe.error === 'NEED_PASSWORD') return;
      setErrorCode(probe.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
      return;
    }
    await openDoc(f);
  };

  const unlock = async () => {
    if (!file || !pdfPwd.password) return;
    setBusy(true);
    await openDoc(file, pdfPwd.password);
    setBusy(false);
  };

  const pageDrafts = drafts.filter((d) => d.pageIndex === page - 1);

  /** 指针 → 归一化坐标 */
  const localNorm = (e: ReactPointerEvent): Point | null => {
    const el = overlayRef.current;
    if (!el || displaySize.width < 1) return null;
    const rect = el.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * displaySize.width;
    const py = ((e.clientY - rect.top) / rect.height) * displaySize.height;
    return toNorm(px, py, displaySize);
  };

  const updatePreview = (draft: AnnotateDraft | null) => {
    previewRef.current = draft;
    setPreview(draft);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!doc || displaySize.width < 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = localNorm(e);
    if (!p) return;
    startPt.current = p;

    if (tool === 'text') {
      const text = window.prompt(t('tools.pdf-annotate.textPrompt'), '');
      drawing.current = false;
      if (!text?.trim()) return;
      setDrafts((prev) => [
        ...prev,
        {
          id: newDraftId(),
          kind: 'text',
          pageIndex: page - 1,
          x: p.x,
          y: p.y,
          text: text.trim(),
          fontSize,
          color,
        },
      ]);
      return;
    }

    if (tool === 'pen') {
      penPts.current = [p];
      updatePreview({
        id: 'preview',
        kind: 'pen',
        pageIndex: page - 1,
        points: [p],
        color,
        strokeWidth,
      });
      return;
    }

    updatePreview(makeShapePreview(tool, p, p, color, strokeWidth, page - 1));
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current || !startPt.current) return;
    const p = localNorm(e);
    if (!p) return;
    if (tool === 'pen') {
      penPts.current = [...penPts.current, p];
      updatePreview({
        id: 'preview',
        kind: 'pen',
        pageIndex: page - 1,
        points: penPts.current.slice(),
        color,
        strokeWidth,
      });
      return;
    }
    updatePreview(makeShapePreview(tool, startPt.current, p, color, strokeWidth, page - 1));
  };

  const finishStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const draft = previewRef.current;
    updatePreview(null);
    startPt.current = null;
    const pts = penPts.current;
    penPts.current = [];

    if (tool === 'pen') {
      if (pts.length >= 2) {
        setDrafts((prev) => [
          ...prev,
          { id: newDraftId(), kind: 'pen', pageIndex: page - 1, points: pts, color, strokeWidth },
        ]);
      }
      return;
    }

    if (!draft || draft.kind === 'text' || draft.kind === 'pen') return;
    const normalized = normalizeShape(draft);
    if (normalized) setDrafts((prev) => [...prev, { ...normalized, id: newDraftId() }]);
  };

  const undo = () => setDrafts((prev) => prev.slice(0, -1));
  const clearPage = () => setDrafts((prev) => prev.filter((d) => d.pageIndex !== page - 1));

  const run = async () => {
    if (!file || drafts.length === 0) return;
    const displays = displaySizes.map((d, i) =>
      d && d.width > 0 ? d : i === page - 1 && displaySize.width > 0 ? displaySize : d,
    );
    for (let i = 0; i < displays.length; i++) {
      if ((!displays[i] || displays[i].width < 1) && drafts.some((d) => d.pageIndex === i)) {
        setError(t('tools.pdf-annotate.needVisitPage', { n: i + 1 }));
        return;
      }
    }
    setBusy(true);
    setError(null);
    setErrorCode(null);
    const r = await annotatePdfFile(file, drafts, displays, pdfPwd.password);
    setBusy(false);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'annotated.pdf');
  };

  const visible = preview ? [...pageDrafts, preview] : pageDrafts;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-annotate.hint')}</p>
      {!doc && (
        <>
          <FileDropZone
            accept=".pdf,application/pdf"
            maxBytes={PDF_MAX_BYTES}
            hint={t('tools.pdf-annotate.drop')}
            onFile={(f) => void onFile(f)}
          />
          {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <PdfPasswordField
                  value={pdfPwd.password}
                  onChange={pdfPwd.setPassword}
                  error={errorCode}
                  autoFocus
                />
              </div>
              <PdfRunButton
                label={busy ? t('common.loading') : t('pdf.unlock')}
                disabled={!file || !pdfPwd.password || busy}
                onClick={() => void unlock()}
              />
            </div>
          )}
        </>
      )}

      {doc && (
        <>
          <OptionBar>
            {ANNOTATE_TOOLS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTool(k)}
                className={`rounded border px-2 py-1 text-sm ${
                  tool === k
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {t(`tools.pdf-annotate.kinds.${k}`)}
              </button>
            ))}
          </OptionBar>

          <OptionBar>
            <div className="flex flex-wrap items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-blue-500' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <PdfField label={t('tools.pdf-annotate.stroke')}>
              <input
                className={pdfInputClass + ' w-20'}
                type="number"
                min={1}
                max={24}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value) || 2)}
              />
            </PdfField>
            {tool === 'text' && (
              <PdfField label={t('tools.pdf-annotate.fontSize')}>
                <input
                  className={pdfInputClass + ' w-20'}
                  type="number"
                  min={8}
                  max={72}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value) || 16)}
                />
              </PdfField>
            )}
            <PdfField label={t('tools.pdf-annotate.scale')}>
              <input
                className={pdfInputClass + ' w-24'}
                type="number"
                min={0.5}
                max={2.5}
                step={0.1}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value) || 1)}
              />
            </PdfField>
            <button type="button" className="rounded border px-2 py-1 text-sm" onClick={undo} disabled={drafts.length === 0}>
              {t('tools.pdf-annotate.undo')}
            </button>
            <button type="button" className="rounded border px-2 py-1 text-sm" onClick={clearPage}>
              {t('tools.pdf-annotate.clearPage')}
            </button>
          </OptionBar>

          <OptionBar>
            <button
              type="button"
              className="rounded border px-2 py-1 text-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('tools.pdf-annotate.prev')}
            </button>
            <span className="text-sm">
              {page} / {doc.numPages}
            </span>
            <button
              type="button"
              className="rounded border px-2 py-1 text-sm"
              disabled={page >= doc.numPages}
              onClick={() => setPage((p) => Math.min(doc.numPages, p + 1))}
            >
              {t('tools.pdf-annotate.next')}
            </button>
            <span className="text-xs text-gray-500">
              {t('tools.pdf-annotate.count', { n: drafts.length })}
            </span>
          </OptionBar>

          <div className="overflow-auto rounded border border-gray-200 bg-gray-100 p-2 dark:border-gray-700 dark:bg-gray-950">
            <div className="relative inline-block max-w-full">
              <canvas ref={canvasRef} className="block max-w-full" />
              <svg
                ref={overlayRef}
                className="absolute left-0 top-0 h-full w-full touch-none cursor-crosshair"
                viewBox={`0 0 ${Math.max(displaySize.width, 1)} ${Math.max(displaySize.height, 1)}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
              >
                {visible.map((d) => (
                  <DraftShape key={d.id} draft={d} display={displaySize} />
                ))}
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <PdfRunButton
              label={busy ? t('common.loading') : t('tools.pdf-annotate.run')}
              disabled={drafts.length === 0 || busy}
              onClick={() => void run()}
            />
            <ClearButton onClick={clear} />
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function makeShapePreview(
  tool: AnnotateKind,
  from: Point,
  to: Point,
  color: string,
  strokeWidth: number,
  pageIndex: number,
): AnnotateDraft | null {
  if (tool === 'pen' || tool === 'text') return null;
  if (tool === 'line') {
    return {
      id: 'preview',
      kind: 'line',
      pageIndex,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      color,
      strokeWidth,
    };
  }
  let width = to.x - from.x;
  let height = to.y - from.y;
  if (tool === 'circle') {
    const side = Math.max(Math.abs(width), Math.abs(height));
    width = Math.sign(width || 1) * side;
    height = Math.sign(height || 1) * side;
  }
  if (tool === 'ellipse' || tool === 'circle') {
    return {
      id: 'preview',
      kind: tool,
      pageIndex,
      x: from.x,
      y: from.y,
      width,
      height,
      color,
      strokeWidth,
    };
  }
  return {
    id: 'preview',
    kind: tool === 'highlight' ? 'highlight' : 'rect',
    pageIndex,
    x: from.x,
    y: from.y,
    width,
    height,
    color,
    strokeWidth,
  };
}

function normalizeShape(draft: AnnotateDraft): AnnotateDraft | null {
  if (draft.kind === 'pen' || draft.kind === 'text') return draft;
  if (draft.kind === 'line') {
    if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < 0.005) return null;
    return draft;
  }
  if (Math.abs(draft.width) < 0.005 && Math.abs(draft.height) < 0.005) return null;
  return draft;
}

function DraftShape({ draft, display }: { draft: AnnotateDraft; display: Size }) {
  const sw = 'strokeWidth' in draft ? draft.strokeWidth : 2;
  if (draft.kind === 'pen') {
    const d = draft.points
      .map((p, i) => {
        const s = fromNorm(p.x, p.y, display);
        return `${i === 0 ? 'M' : 'L'}${s.x} ${s.y}`;
      })
      .join(' ');
    return <path d={d} fill="none" stroke={draft.color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (draft.kind === 'line') {
    const a = fromNorm(draft.x1, draft.y1, display);
    const b = fromNorm(draft.x2, draft.y2, display);
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={draft.color} strokeWidth={sw} strokeLinecap="round" />;
  }
  if (draft.kind === 'text') {
    const p = fromNorm(draft.x, draft.y, display);
    return (
      <text x={p.x} y={p.y + draft.fontSize} fill={draft.color} fontSize={draft.fontSize} fontFamily="sans-serif">
        {draft.text}
      </text>
    );
  }
  if (draft.kind === 'ellipse' || draft.kind === 'circle') {
    const cx = fromNorm(draft.x + draft.width / 2, draft.y + draft.height / 2, display);
    const rx = Math.abs(draft.width / 2) * display.width;
    const ry = draft.kind === 'circle' ? rx : Math.abs(draft.height / 2) * display.height;
    return <ellipse cx={cx.x} cy={cx.y} rx={rx} ry={ry} fill="none" stroke={draft.color} strokeWidth={sw} />;
  }
  const x0 = Math.min(draft.x, draft.x + draft.width);
  const y0 = Math.min(draft.y, draft.y + draft.height);
  const tl = fromNorm(x0, y0, display);
  const w = Math.abs(draft.width) * display.width;
  const h = Math.abs(draft.height) * display.height;
  if (draft.kind === 'highlight') {
    return <rect x={tl.x} y={tl.y} width={w} height={h} fill={draft.color} opacity={0.35} />;
  }
  return <rect x={tl.x} y={tl.y} width={w} height={h} fill="none" stroke={draft.color} strokeWidth={sw} />;
}
