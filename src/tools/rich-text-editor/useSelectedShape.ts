import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { findSelectedShape, shapeSpec, type DocShapeAttrs } from './shapeNode';

export interface SelectedShape {
  pos: number;
  attrs: DocShapeAttrs;
}

/**
 * 订阅"当前选中的形状"（面板与工具栏共用）。
 * 面板不持有文档副本：所有改动都写回节点属性，撤销/重做与 docx 导出读的是同一份数据。
 */
export function useSelectedShape(editor: Editor | null): SelectedShape | null {
  const [selected, setSelected] = useState<SelectedShape | null>(null);

  useEffect(() => {
    if (!editor) return;
    const refresh = () => {
      const found = findSelectedShape(editor.state);
      setSelected(found ? { pos: found.pos, attrs: shapeSpec(found.node.attrs) } : null);
    };
    refresh();
    editor.on('transaction', refresh);
    editor.on('selectionUpdate', refresh);
    return () => {
      editor.off('transaction', refresh);
      editor.off('selectionUpdate', refresh);
    };
  }, [editor]);

  return selected;
}

/** 把属性写回选中形状（统一入口，避免每处控件各写一遍 setNodeMarkup） */
export function applyShapeAttrs(editor: Editor, attrs: Partial<DocShapeAttrs>): void {
  const found = findSelectedShape(editor.state);
  if (!found) return;
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, ...attrs }),
  );
}
