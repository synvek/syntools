import { fitScene, PAGE_THUMB_SIZE } from '@/core/components/pageThumbnail';
import { pageSceneOf } from './pageScene';
import type { FlowPage } from './types';

export function PageThumbnail({ page }: { page: FlowPage }) {
  const scene = pageSceneOf(page);
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
          <line
            key={edge.id}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray={edge.dashed ? '4 3' : undefined}
          />
        ))}
        {scene.nodes.map((node) => {
          const common = {
            fill: node.fill,
            stroke: node.stroke,
            strokeWidth: 1.5,
          };
          if (node.shape === 'ellipse') {
            return (
              <ellipse
                key={node.id}
                cx={node.x + node.width / 2}
                cy={node.y + node.height / 2}
                rx={node.width / 2}
                ry={node.height / 2}
                {...common}
              />
            );
          }
          if (node.shape === 'diamond') {
            const cx = node.x + node.width / 2;
            const cy = node.y + node.height / 2;
            return (
              <polygon
                key={node.id}
                points={`${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}`}
                {...common}
              />
            );
          }
          return (
            <rect
              key={node.id}
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx={3}
              {...common}
            />
          );
        })}
      </g>
    </svg>
  );
}
