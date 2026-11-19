import { useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPageTextLines, textLineAt, type TextLine } from '@/core/pdf/textLines';

interface TextPatchLayerProps {
  pdfDoc: PDFDocumentProxy;
  /** 1-based page number inside the source file */
  pageNumber: number;
  /** `PdfPageState.id` the created patch belongs to */
  pageId: string;
  onPatch(pageId: string, line: TextLine): void;
}

/**
 * Transparent line layer for the text-patch tool (M3-1 + M3-2).
 *
 * Rendering decisions:
 * - only mounted while the tool is active and only for the page in view, so a 500-page document
 *   never pays for thousands of spans;
 * - hit-testing is geometric (`textLineAt`) instead of per-span listeners, so the DOM stays one div
 *   per line and a line with a rotated box still needs no transforms;
 * - the layer sits *above* the object overlay so a click can never start a selection drag.
 */
export function TextPatchLayer({ pdfDoc, pageNumber, pageId, onPatch }: TextPatchLayerProps) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<TextLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLines([]);
    setLoading(true);

    void getPageTextLines(pdfDoc, pageNumber)
      .then((next) => {
        if (cancelled) return;
        setLines(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLines([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const point = pointFromEvent(event);
    if (!point) return;
    const line = textLineAt(lines, point);
    if (!line) return;
    event.stopPropagation();
    onPatch(pageId, line);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = pointFromEvent(event);
    if (!point) {
      setHovered(null);
      return;
    }
    const line = textLineAt(lines, point);
    const index = line ? lines.indexOf(line) : null;
    setHovered((current) => (current === index ? current : index));
  };

  return (
    <div
      data-testid="pdf-text-layer"
      data-page-id={pageId}
      className="absolute inset-0 cursor-text"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHovered(null)}
    >
      {lines.map((line, index) => (
        <div
          key={`${line.rect.x}:${line.rect.y}:${index}`}
          data-testid="pdf-text-line"
          data-line-index={index}
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-[1px] ${
            hovered === index ? 'bg-[#b3261e]/10 ring-1 ring-[#b3261e]/50' : 'bg-transparent ring-0'
          }`}
          style={{
            left: `${line.rect.x * 100}%`,
            top: `${line.rect.y * 100}%`,
            width: `${line.rect.w * 100}%`,
            height: `${line.rect.h * 100}%`,
          }}
        />
      ))}

      <p
        className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-gray-500 dark:text-gray-400"
        role="status"
      >
        {loading
          ? t('common.loading')
          : lines.length === 0
            ? t('tools.pdfEditor.patchNoText')
            : t('tools.pdfEditor.patchLayerHint')}
      </p>
    </div>
  );
}
