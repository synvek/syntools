/**
 * Read-only renderers for every overlay object kind.
 *
 * The interactive wrapper lives in `OverlayLayer` (selection, drag, editing, opacity, rotation); this
 * module only answers "what does this object look like", so the same visuals can later be reused by
 * the annotations panel.
 *
 * Sizes: `scale` is CSS px per PDF point (zoom), `pageSize` is the page box in CSS px. SVG view boxes
 * use page pixels, so stroke widths match what `savePdf` will draw at 100%.
 */

import type {
  PdfImageObject,
  PdfInkObject,
  PdfMarkupObject,
  PdfNoteObject,
  PdfObject,
  PdfShapeObject,
  PdfStampObject,
  PdfTextObject,
} from '../model/types';

import { clampCrop, croppedSize } from '../io/imageCrop';
import { fittedBox } from '../io/imageScale';
import { textCss } from './textStyle';

export interface PagePixelSize {
  width: number;
  height: number;
}

interface ViewProps {
  object: PdfObject;
  scale: number;
  pageSize: PagePixelSize;
}

/** Pixel size of an object's frame, never zero (SVG view boxes reject 0) */
function frameSize(object: PdfObject, pageSize: PagePixelSize) {
  return {
    width: Math.max(1, object.rect.w * pageSize.width),
    height: Math.max(1, object.rect.h * pageSize.height),
  };
}

function TextObjectView({ object, scale }: { object: PdfTextObject; scale: number }) {
  return (
    <div
      style={textCss(object, scale)}
      className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
    >
      {object.text}
    </div>
  );
}

function ImageObjectView({
  object,
  pageSize,
}: {
  object: PdfImageObject;
  pageSize: PagePixelSize;
}) {
  if (!object.crop) {
    return (
      <img
        src={object.dataUrl}
        alt=""
        draggable={false}
        style={{ objectFit: object.fit }}
        className="h-full w-full select-none"
      />
    );
  }

  // Mirror `drawImageObject`: fit the *cropped* bitmap, then blow the image up by 1/crop so the
  // hidden part sits outside the clipping box. Same maths as savePdf, so WYSIWYG holds.
  const crop = clampCrop(object.crop);
  const frame = frameSize(object, pageSize);
  const natural = croppedSize({ width: object.naturalW, height: object.naturalH }, crop);
  const box = fittedBox(frame, natural, object.fit);
  const imageW = box.width / crop.w;
  const imageH = box.height / crop.h;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <img
        src={object.dataUrl}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          width: imageW,
          height: imageH,
          left: box.offsetX - crop.x * imageW,
          top: box.offsetY - crop.y * imageH,
        }}
      />
    </div>
  );
}

function StampObjectView({ object }: { object: PdfStampObject }) {
  return (
    <img
      src={object.dataUrl}
      alt=""
      draggable={false}
      className="h-full w-full select-none object-contain"
    />
  );
}

function InkObjectView({
  object,
  scale,
  pageSize,
}: {
  object: PdfInkObject;
  scale: number;
  pageSize: PagePixelSize;
}) {
  const { width, height } = frameSize(object, pageSize);
  const points = object.points
    .map((point) => `${(point.x * width).toFixed(2)},${(point.y * height).toFixed(2)}`)
    .join(' ');

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={object.color}
        strokeWidth={Math.max(1, object.width * scale)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MarkupObjectView({ object, scale }: { object: PdfMarkupObject; scale: number }) {
  // Quads are page-normalized; draw them relative to this object's frame
  const frame = object.rect;
  const relative = (value: number, origin: number, size: number) =>
    (value - origin) / Math.max(size, 1e-6);

  return (
    <svg width="100%" height="100%" aria-hidden="true">
      {object.quads.map((quad, index) => {
        const x = `${relative(quad.x, frame.x, frame.w) * 100}%`;
        const y = `${relative(quad.y, frame.y, frame.h) * 100}%`;
        const w = `${relative(quad.w, 0, frame.w) * 100}%`;
        const h = `${relative(quad.h, 0, frame.h) * 100}%`;

        if (object.type === 'highlight') {
          return (
            <rect key={index} x={x} y={y} width={w} height={h} fill={object.color} opacity={0.4} />
          );
        }

        const lineY = object.type === 'underline' ? `calc(${y} + ${h})` : `calc(${y} + ${h} / 2)`;
        return (
          <line
            key={index}
            x1={x}
            y1={lineY}
            x2={`calc(${x} + ${w})`}
            y2={lineY}
            stroke={object.color}
            strokeWidth={Math.max(1, 0.75 * scale)}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function arrowHead(width: number, height: number, strokeWidth: number): string {
  const angle = Math.atan2(height, width);
  const length = Math.max(6, strokeWidth * 4);
  const spread = Math.PI / 7;
  const end = { x: width, y: height };
  const left = {
    x: end.x - length * Math.cos(angle - spread),
    y: end.y - length * Math.sin(angle - spread),
  };
  const right = {
    x: end.x - length * Math.cos(angle + spread),
    y: end.y - length * Math.sin(angle + spread),
  };
  return `${end.x},${end.y} ${left.x.toFixed(2)},${left.y.toFixed(2)} ${right.x.toFixed(2)},${right.y.toFixed(2)}`;
}

function ShapeObjectView({
  object,
  scale,
  pageSize,
}: {
  object: PdfShapeObject;
  scale: number;
  pageSize: PagePixelSize;
}) {
  const { width, height } = frameSize(object, pageSize);
  const strokeWidth = Math.max(1, object.width * scale);
  const dash = object.dash?.length
    ? object.dash.map((value) => value * scale).join(' ')
    : undefined;
  const common = {
    fill: object.fill ?? 'none',
    stroke: object.stroke,
    strokeWidth,
    strokeDasharray: dash,
  };

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {object.type === 'rect' ? (
        <rect
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          width={Math.max(1, width - strokeWidth)}
          height={Math.max(1, height - strokeWidth)}
          rx={2}
          {...common}
        />
      ) : null}
      {object.type === 'ellipse' ? (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={Math.max(1, (width - strokeWidth) / 2)}
          ry={Math.max(1, (height - strokeWidth) / 2)}
          {...common}
        />
      ) : null}
      {object.type === 'line' || object.type === 'arrow' ? (
        <line x1={0} y1={0} x2={width} y2={height} {...common} />
      ) : null}
      {object.type === 'arrow' ? (
        <polyline
          points={arrowHead(width, height, strokeWidth)}
          fill="none"
          stroke={object.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function NoteObjectView({ object }: { object: PdfNoteObject }) {
  return (
    <div
      role="img"
      aria-label={object.body || object.icon}
      title={object.body || undefined}
      className="flex h-full w-full items-center justify-center rounded-sm bg-amber-200/90 text-amber-900 ring-1 ring-amber-500/60"
    >
      <svg viewBox="0 0 24 24" width="70%" height="70%" aria-hidden="true" fill="currentColor">
        <path d="M4 3h11l5 5v13H4z" opacity="0.25" />
        <path d="M15 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 12h10M7 16h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Dispatch on `kind`; the wrapper handles position, rotation, opacity and selection */
export function ObjectView({ object, scale, pageSize }: ViewProps) {
  switch (object.kind) {
    case 'text':
      return <TextObjectView object={object} scale={scale} />;
    case 'image':
      return <ImageObjectView object={object} pageSize={pageSize} />;
    case 'stamp':
    case 'signature':
      return <StampObjectView object={object} />;
    case 'ink':
      return <InkObjectView object={object} scale={scale} pageSize={pageSize} />;
    case 'markup':
      return <MarkupObjectView object={object} scale={scale} />;
    case 'shape':
      return <ShapeObjectView object={object} scale={scale} pageSize={pageSize} />;
    case 'note':
      return <NoteObjectView object={object} />;
    default:
      return null;
  }
}
