import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { GRID_SIZE } from '../core';
import { useBoardPointer } from '../interaction';
import { TEXT_FONT_FAMILY, clearStage, drawOps } from '../render';
import { useBoardStore } from '../store';

/**
 * Canvas stage: CSS background layer + content canvas + text input overlay.
 *
 * The background (solid / grid / transparent checkerboard) is entirely CSS: it saves a canvas
 * layer and keeps the canvas itself transparent, which lets the eraser do real erasure with
 * `destination-out`. Zooming only changes the stage's CSS size while the canvas pixel resolution
 * stays fixed, and pointer coordinates are mapped via `getBoundingClientRect`, so strokes land
 * precisely at any zoom.
 */
export default function BoardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const pointer = useBoardPointer(canvasRef);

  const scene = useBoardStore((s) => s.scene);
  const tool = useBoardStore((s) => s.tool);
  const textSize = useBoardStore((s) => s.textSize);
  const brushColor = useBoardStore((s) => s.brush.color);
  const zoom = useBoardStore((s) => s.zoom);
  const collapsed = useBoardStore((s) => s.collapsed);
  const details = useBoardStore((s) => s.details);
  const applyFitSize = useBoardStore((s) => s.applyFitSize);
  const setViewScale = useBoardStore((s) => s.setViewScale);

  const [available, setAvailable] = useState(0);
  const [editor, setEditor] = useState<{ x: number; y: number; value: string } | null>(null);

  // `fit` follows the container width (never upscales, so small canvases are not stretched); numbers are fixed scales
  const scale = available > 0 ? (zoom === 'fit' ? Math.min(1, available / scene.width) : zoom) : 0;
  const overflowing = available > 0 && scene.width * scale > available + 1;

  // The leaner the toolbar, the taller the canvas: collapsing it or closing settings gives space back
  const stageHeightClass = collapsed ? 'max-h-[88vh]' : details ? 'max-h-[64vh]' : 'max-h-[78vh]';

  // The zoom control lives in the toolbar; the scale is measured here and written back
  useEffect(() => {
    if (scale > 0) setViewScale(scale);
  }, [scale, setViewScale]);

  /** Full repaint: called when size / DPR / history change */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const current = useBoardStore.getState().scene;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(current.width * dpr));
    canvas.height = Math.max(1, Math.round(current.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clearStage(ctx);
    drawOps(ctx, current);
  }, []);

  useEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (width > 0) setAvailable(width);
    });
    observer.observe(node);
    if (node.clientWidth > 0) setAvailable(Math.floor(node.clientWidth));
    return () => observer.disconnect();
  }, []);

  // Fit preset: sync the canvas size to the available width (no history entry)
  useEffect(() => {
    if (available > 0) applyFitSize(available);
  }, [available, applyFitSize]);

  // A new scene identity means commit / undo / redo / clear / resize / pan: repaint everything so
  // what is on screen matches the export exactly (during a stroke only the snapshot is previewed).
  useEffect(() => {
    if (scale > 0) render();
  }, [scene, scale, render]);

  const backgroundStyle = useMemo(() => {
    const { kind, color } = scene.background;
    if (kind === 'grid') {
      const size = Math.max(6, GRID_SIZE * scale);
      return {
        backgroundColor: color,
        backgroundImage:
          'linear-gradient(to right, rgba(100, 116, 139, 0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(100, 116, 139, 0.28) 1px, transparent 1px)',
        backgroundSize: `${size}px ${size}px`,
      };
    }
    if (kind === 'transparent') {
      return {
        backgroundColor: '#ffffff',
        backgroundImage:
          'linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%), linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
      };
    }
    return { backgroundColor: color };
  }, [scene.background, scale]);

  const cancelledRef = useRef(false);

  const commitText = () => {
    if (!editor) return;
    const { x, y, value } = editor;
    setEditor(null);
    // Esc cancels: set the flag before closing the input, so the following blur does not commit
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const text = value.trim();
    if (!text) return;
    const state = useBoardStore.getState();
    state.addOp({
      kind: 'text',
      x,
      y,
      text,
      size: state.textSize,
      color: state.brush.color,
      opacity: state.brush.opacity,
    });
    // addOp does not repaint the stage (intermediate stroke states never do), so repaint here
    render();
  };

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (useBoardStore.getState().tool !== 'text') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const current = useBoardStore.getState().scene;
    cancelledRef.current = false;
    setEditor({
      x: ((e.clientX - rect.left) / rect.width) * current.width,
      y: ((e.clientY - rect.top) / rect.height) * current.height,
      value: '',
    });
  };

  const cursorClass =
    tool === 'text'
      ? 'cursor-text'
      : tool === 'move'
        ? 'cursor-move'
        : tool === 'picker'
          ? 'cursor-copy'
          : 'cursor-crosshair';

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-slate-100 transition-colors duration-150 dark:border-gray-700 dark:bg-gray-950">
      <div className={`${stageHeightClass} overflow-auto`}>
        <div
          ref={measureRef}
          className={`flex w-full items-center p-2 ${overflowing ? 'justify-start' : 'justify-center'}`}
        >
          {/* No size transition: animating the size would desync pointer coordinates from the canvas */}
          <div
            className="relative ring-1 ring-black/5 dark:ring-white/10"
            style={{ ...backgroundStyle, width: scene.width * scale, height: scene.height * scale }}
          >
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 h-full w-full touch-none select-none ${cursorClass}`}
              onClick={handleClick}
              {...pointer}
            />
            {editor ? (
              <textarea
                autoFocus
                rows={1}
                value={editor.value}
                onChange={(e) => setEditor({ ...editor, value: e.target.value })}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelledRef.current = true;
                    setEditor(null);
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitText();
                  }
                }}
                className="absolute z-10 resize-none overflow-hidden rounded border border-blue-400 bg-white/70 p-0 outline-none transition-colors duration-150 dark:bg-gray-900/70"
                style={{
                  left: editor.x * scale,
                  top: editor.y * scale,
                  width: '14em',
                  height: 1.25 * textSize * scale,
                  fontSize: textSize * scale,
                  lineHeight: 1.25,
                  color: brushColor,
                  fontFamily: TEXT_FONT_FAMILY,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
