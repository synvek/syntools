import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createNoteObject, createShapeObject, createTextObject } from '../model/objects';
import type { PdfObject, PdfPageState } from '../model/types';
import { i18n } from '@/core/i18n';
import { registerPdfEditorStrings } from '../strings';

registerPdfEditorStrings(i18n);
import { AnnotationsPanel } from './AnnotationsPanel';

function page(id: string, sourceIndex: number): PdfPageState {
  return { id, sourceKey: 'main', sourceIndex, rotation: 0 };
}

const pages = [page('p1', 0), page('p2', 1)];

function fixtures(): PdfObject[] {
  return [
    createTextObject({
      page: 'p1',
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 },
      text: 'Hello PDF',
      z: 1,
      id: 'text-1',
    }),
    createShapeObject({
      page: 'p1',
      rect: { x: 0.2, y: 0.4, w: 0.2, h: 0.1 },
      type: 'rect',
      z: 2,
      id: 'shape-1',
    }),
    createNoteObject({
      page: 'p2',
      rect: { x: 0.5, y: 0.5, w: 0.04, h: 0.04 },
      body: 'Check totals',
      z: 1,
      id: 'note-1',
    }),
  ];
}

function renderPanel(overrides: Partial<Parameters<typeof AnnotationsPanel>[0]> = {}) {
  const onSelect = vi.fn();
  const onDelete = vi.fn();
  render(
    <AnnotationsPanel
      objects={fixtures()}
      pages={pages}
      selectedIds={[]}
      onSelect={onSelect}
      onDelete={onDelete}
      {...overrides}
    />,
  );
  return { onSelect, onDelete };
}

describe('AnnotationsPanel', () => {
  it('按页分组，页内按 z 降序', () => {
    renderPanel();

    const groups = screen.getAllByTestId('pdf-annotation-group');
    expect(groups).toHaveLength(2);

    const first = within(groups[0]).getAllByTestId('pdf-annotation-item');
    expect(first).toHaveLength(2);
    // z=2 的形状画在文本之上，列表也按这个顺序
    expect(first[0]).toHaveTextContent('形状');
    expect(first[1]).toHaveTextContent('Hello PDF');

    const second = within(groups[1]).getAllByTestId('pdf-annotation-item');
    expect(second[0]).toHaveTextContent('Check totals');
  });

  it('搜索按类型与正文过滤', () => {
    renderPanel();

    fireEvent.change(screen.getByTestId('pdf-annotation-search'), { target: { value: 'totals' } });
    expect(screen.getAllByTestId('pdf-annotation-group')).toHaveLength(1);
    expect(screen.getAllByTestId('pdf-annotation-item')).toHaveLength(1);

    fireEvent.change(screen.getByTestId('pdf-annotation-search'), { target: { value: '形状' } });
    expect(screen.getAllByTestId('pdf-annotation-item')).toHaveLength(1);
    expect(screen.getByTestId('pdf-annotation-item')).toHaveTextContent('形状');
  });

  it('点击条目回传对象，删除回传 id', () => {
    const { onSelect, onDelete } = renderPanel();

    fireEvent.click(screen.getAllByTestId('pdf-annotation-item')[1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    const selected = onSelect.mock.calls[0][0] as PdfObject;
    expect(selected.id).toBe('text-1');
    expect(selected.page).toBe('p1');

    fireEvent.click(screen.getAllByTestId('pdf-annotation-delete')[0]);
    expect(onDelete).toHaveBeenCalledWith('shape-1');
  });

  it('没有注释时显示空态', () => {
    renderPanel({ objects: [] });

    expect(screen.queryByTestId('pdf-annotation-group')).toBeNull();
    expect(screen.getByText('本页没有注释')).toBeInTheDocument();
  });

  it('选中项带 aria-current', () => {
    renderPanel({ selectedIds: ['note-1'] });

    const item = screen
      .getAllByTestId('pdf-annotation-item')
      .find((node) => node.textContent?.includes('Check totals'));
    expect(item).toHaveAttribute('aria-current', 'true');
  });
});
