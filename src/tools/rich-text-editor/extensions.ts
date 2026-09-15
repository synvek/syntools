import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';

/**
 * 编辑器扩展组合（技术设计 §8.3）：
 * StarterKit 已内置 Link / Underline（Tiptap v3），此处只补充其未覆盖的能力。
 * 本文件被 RichTextEditorTool 懒加载引用，因此 TipTap 不会进入首屏包。
 */
export function createExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      // 链接点击不跳转，交由工具栏编辑
      link: { openOnClick: false, autolink: true },
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    Image.configure({ allowBase64: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder }),
  ];
}
