import { fitScene, PAGE_THUMB_SIZE } from '@/core/components/pageThumbnail';
import { sheetSceneOf } from './sheetScene';
import type { MindDoc } from './types';

export function SheetThumbnail({ doc }: { doc: MindDoc }) {
  const scene = sheetSceneOf(doc);
  if (!scene) return null;
  const { width, height } = PAGE_THUMB_SIZE;
  const { scale, x, y } = fitScene(scene);

  return (
    <svg
      data-testid="page-thumb"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
    >
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        {scene.edges.map((edge) => (
          <path
            key={edge.id}
            d={`M${edge.x1},${edge.y1} C${(edge.x1 + edge.x2) / 2},${edge.y1} ${
              (edge.x1 + edge.x2) / 2
            },${edge.y2} ${edge.x2},${edge.y2}`}
            fill="none"
            stroke={edge.color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        ))}
        {scene.nodes.map((node) => (
          <rect
            key={node.id}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            rx={node.depth === 0 ? 6 : 4}
            fill={node.color}
            fillOpacity={node.depth === 0 ? 1 : 0.18}
            stroke={node.color}
            strokeWidth={1.4}
          />
        ))}
      </g>
    </svg>
  );
}
