import Konva from 'konva';
import type { CommentAnchor, CommentThread } from '../../../core/comments/model';

/**
 * Canvas markers for comment threads (P1-2).
 *
 * Numbered dots live in the content layer (page coordinates) so they pan/zoom with the slide.
 * Resolved threads are grey, the active thread is blue, the rest amber. Anchors whose target
 * element is gone are skipped here and listed as orphaned in the panel.
 */
const ANCHOR_NAME = 'commentAnchor';

export function clearCommentAnchors(layer: Konva.Layer): void {
  for (const node of layer.find(`.${ANCHOR_NAME}`)) node.destroy();
}

/** Layer-space point of an anchor, or null when its target no longer exists */
export function resolveAnchorPoint(
  layer: Konva.Layer,
  anchor: CommentAnchor,
): { x: number; y: number } | null {
  if (anchor.kind === 'page') return { x: anchor.x, y: anchor.y };
  if (anchor.kind !== 'element') return null;
  const node = layer.findOne<Konva.Node>(`#${anchor.elementId}`);
  if (!node) return null;
  // Client rect keeps rotation/flip in account; `relativeTo` brings it back to page coordinates
  const box = node.getClientRect({ relativeTo: layer });
  if (box.width <= 0 || box.height <= 0) return null;
  return { x: box.x + box.width * anchor.dx, y: box.y + box.height * anchor.dy };
}

export function renderCommentAnchors(
  layer: Konva.Layer,
  threads: CommentThread[],
  activeId: string | null,
  onSelect: (id: string) => void,
): void {
  clearCommentAnchors(layer);
  const scale = Math.max(0.2, layer.scaleX());
  const radius = 9 / scale;
  const strokeWidth = 1.5 / scale;

  for (const thread of threads) {
    const point = resolveAnchorPoint(layer, thread.anchor);
    if (!point) continue;
    const active = thread.id === activeId;
    const fill = thread.resolved ? '#9CA3AF' : active ? '#2563EB' : '#F59E0B';
    const index = threads.indexOf(thread) + 1;

    const marker = new Konva.Group({ x: point.x, y: point.y, name: ANCHOR_NAME });
    marker.add(
      new Konva.Circle({
        radius,
        fill,
        stroke: '#FFFFFF',
        strokeWidth,
        shadowColor: '#0F172A',
        shadowOpacity: 0.25,
        shadowBlur: 4 / scale,
        shadowOffset: { x: 0, y: 1 / scale },
        name: ANCHOR_NAME,
      }),
    );
    marker.add(
      new Konva.Text({
        text: String(index),
        fontSize: 10 / scale,
        fontFamily: 'Arial',
        fontStyle: 'bold',
        fill: '#FFFFFF',
        width: radius * 2,
        height: radius * 2,
        align: 'center',
        verticalAlign: 'middle',
        offsetX: radius,
        offsetY: radius,
        listening: false,
      }),
    );

    // Keep the click away from element selection / marquee handling below
    marker.on('mousedown touchstart', (event) => {
      event.cancelBubble = true;
    });
    marker.on('click tap', (event) => {
      event.cancelBubble = true;
      onSelect(thread.id);
    });
    layer.add(marker);
  }
  layer.batchDraw();
}
