import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useMindStore } from '../store';
import type { MindAlign, MindLayoutDirection, MindNodeShape, MindSide } from '../model/types';

export interface MindNodeData extends Record<string, unknown> {
  text: string;
  depth: number;
  color: string;
  fill: string;
  stroke: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: MindAlign;
  shape: MindNodeShape;
  collapsed: boolean;
  childCount: number;
  direction: MindLayoutDirection;
  side: MindSide;
  isRoot: boolean;
}

const HANDLE_CLS = '!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent';

/**
 * Frame per depth: deeper levels are lighter, the central topic is the heaviest.
 * Horizontal padding comes entirely from the layout metrics (PAD_X) so shape classes add none;
 * otherwise the usable text width would be narrower than the measured width and get ellipsised.
 */
const SHAPE_CLASS: Record<MindNodeShape, string> = {
  rounded: 'rounded-xl',
  pill: 'rounded-full',
  underline: 'rounded-none border-b-2 border-x-0 border-t-0 bg-transparent',
  rect: 'rounded-md',
  ellipse: 'rounded-[999px]',
};

function anchorsOf(direction: MindLayoutDirection, side: MindSide) {
  if (direction === 'down') {
    return { source: Position.Bottom, target: Position.Top, edge: 'bottom' as const };
  }
  return side === 'left'
    ? { source: Position.Left, target: Position.Right, edge: 'left' as const }
    : { source: Position.Right, target: Position.Left, edge: 'right' as const };
}

function MindNodeComponent({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const d = data as MindNodeData;
  const editing = useMindStore((s) => s.editingId === id);
  const setText = useMindStore((s) => s.setText);
  const endEdit = useMindStore((s) => s.endEdit);
  const addChildOf = useMindStore((s) => s.addChildOf);
  const addSiblingOf = useMindStore((s) => s.addSiblingOf);
  const outdentAt = useMindStore((s) => s.outdentAt);
  const toggleCollapseAt = useMindStore((s) => s.toggleCollapseAt);
  const [draft, setDraft] = useState(d.text);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Text at the moment editing started (avoids rewriting the draft and re-selecting on every keystroke) */
  const textOnEdit = useRef(d.text);
  textOnEdit.current = d.text;
  /** Text to roll back to when Esc cancels editing */
  const originalText = useRef(d.text);

  // Sync the draft and select-all only when this node enters or leaves edit mode:
  // depending on d.text would re-run select() on every keystroke, and the next input would wipe the existing content.
  useEffect(() => {
    if (!editing) return;
    originalText.current = textOnEdit.current;
    setDraft(textOnEdit.current);
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const anchors = anchorsOf(d.direction, d.side);
  const isUnderline = d.shape === 'underline';
  const hasChildren = d.childCount > 0;

  return (
    // Double-click-to-edit is handled centrally by onNodeDoubleClick on the canvas (anywhere inside the node works)
    <div
      className="mind-node group/mind relative flex items-center justify-center"
      style={{ width: '100%', height: '100%' }}
    >
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden transition-all duration-150 ${SHAPE_CLASS[d.shape]} ${
          selected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
        } ${d.isRoot ? 'shadow-lg' : d.depth === 1 ? 'shadow-sm' : ''}`}
        style={{
          background: isUnderline ? 'transparent' : d.fill,
          borderColor: d.stroke,
          borderStyle: 'solid',
          // The underline shape keeps only the bottom edge (2px); other shapes get thinner strokes with depth.
          // Note: do not use borderWidth here — it would override Tailwind's border-b-2 and the underline would disappear.
          ...(isUnderline
            ? {
                borderTopWidth: 0,
                borderRightWidth: 0,
                borderBottomWidth: 2,
                borderLeftWidth: 0,
              }
            : { borderWidth: d.isRoot ? 0 : Math.max(1.5, 3 - d.depth * 0.5) }),
          boxShadow: isUnderline ? undefined : selected ? `0 0 0 3px ${d.color}33` : undefined,
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setText(id, e.target.value);
            }}
            onBlur={() => endEdit()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                endEdit();
                addSiblingOf(id);
              } else if (e.key === 'Tab') {
                e.preventDefault();
                endEdit();
                if (e.shiftKey) outdentAt(id);
                else addChildOf(id);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                // Cancel editing: roll back to the text from before edit mode
                setText(id, originalText.current);
                endEdit();
              }
            }}
            className="nodrag nopan h-full w-full bg-transparent px-2 text-center outline-none"
            style={{
              color: d.textColor,
              fontSize: d.fontSize,
              fontWeight: d.bold ? 700 : 400,
              fontStyle: d.italic ? 'italic' : 'normal',
              textAlign: d.align,
            }}
          />
        ) : (
          <span
            className="w-full truncate px-2 leading-tight"
            style={{
              color: d.textColor,
              fontSize: d.fontSize,
              fontWeight: d.bold ? 700 : 400,
              fontStyle: d.italic ? 'italic' : 'normal',
              textAlign: d.align,
            }}
            title={d.text}
          >
            {d.text || ' '}
          </span>
        )}
      </div>

      {/* 折叠 / 展开：显示被折叠的子节点数 */}
      {hasChildren ? (
        <button
          type="button"
          aria-label={d.collapsed ? t('tools.mindmap.expand') : t('tools.mindmap.collapse')}
          title={d.collapsed ? t('tools.mindmap.expand') : t('tools.mindmap.collapse')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapseAt(id);
          }}
          className={`mind-badge nodrag nopan absolute flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold transition-opacity ${
            anchors.edge === 'bottom' ? 'left-1/2 top-full -translate-x-1/2' : ''
          } ${anchors.edge === 'right' ? 'left-full top-1/2 -translate-y-1/2' : ''} ${
            anchors.edge === 'left' ? 'right-full top-1/2 -translate-y-1/2' : ''
          } ${d.collapsed || selected ? 'opacity-100' : 'opacity-0 group-hover/mind:opacity-100'}`}
          style={{
            marginLeft: anchors.edge === 'right' ? 4 : undefined,
            marginRight: anchors.edge === 'left' ? 4 : undefined,
            marginTop: anchors.edge === 'bottom' ? 4 : undefined,
            background: d.color,
            borderColor: d.color,
            color: '#ffffff',
          }}
        >
          {d.collapsed ? d.childCount : '−'}
        </button>
      ) : null}

      {/* 快速添加子节点 */}
      <button
        type="button"
        aria-label={t('tools.mindmap.addChild')}
        title={t('tools.mindmap.addChild')}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          addChildOf(id);
        }}
        className={`mind-add nodrag nopan absolute flex h-4 w-4 items-center justify-center rounded-full border text-[11px] leading-none opacity-0 transition-opacity group-hover/mind:opacity-100 ${
          anchors.edge === 'bottom' ? 'left-1/2 top-full -translate-x-1/2' : ''
        } ${anchors.edge === 'right' ? 'left-full top-1/2 -translate-y-1/2' : ''} ${
          anchors.edge === 'left' ? 'right-full top-1/2 -translate-y-1/2' : ''
        }`}
        style={{
          marginLeft: anchors.edge === 'right' ? (hasChildren ? 24 : 4) : undefined,
          marginRight: anchors.edge === 'left' ? (hasChildren ? 24 : 4) : undefined,
          marginTop: anchors.edge === 'bottom' ? (hasChildren ? 24 : 4) : undefined,
          background: '#ffffff',
          borderColor: d.color,
          color: d.color,
        }}
      >
        ＋
      </button>

      {/*
        连线锚点：仅作为连线端点，视觉不可见。
        六个方向全部提供，画布按「布局方向 + 分支所在侧」挑选对应 id，
        这样左右分布布局下，左侧分支的连线才会从中心主题的左边引出。
      */}
      <Handle id="in-l" type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="in-r" type="target" position={Position.Right} className={HANDLE_CLS} />
      <Handle id="in-t" type="target" position={Position.Top} className={HANDLE_CLS} />
      <Handle id="out-r" type="source" position={Position.Right} className={HANDLE_CLS} />
      <Handle id="out-l" type="source" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="out-b" type="source" position={Position.Bottom} className={HANDLE_CLS} />
    </div>
  );
}

export const MindNode = memo(MindNodeComponent);
