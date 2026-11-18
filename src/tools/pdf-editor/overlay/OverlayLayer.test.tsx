import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTextObject } from '../model/objects';
import type { NormRect, PdfObject } from '../model/types';
import { OverlayLayer } from './OverlayLayer';

/** Page box used for the hit-testing math (jsdom has no layout) */
const PAGE_BOX = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 600,
  bottom: 800,
  width: 600,
  height: 800,
  toJSON: () => ({}),
} as DOMRect;

/**
 * Minimal controller mirroring what `PdfEditorTool` does, so the layer's contract (controlled
 * selection/editing, empty boxes discarded) is exercised rather than assumed.
 */
function Harness({ initial }: { initial?: PdfObject[] }) {
  const [objects, setObjects] = useState<PdfObject[]>(initial ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      <OverlayLayer
        objects={objects}
        page={0}
        scale={1}
        selectedId={selected}
        editingId={editing}
        onSelect={setSelected}
        onStartEdit={(id) => {
          setSelected(id);
          setEditing(id);
        }}
        onEndEdit={() => {
          setEditing(null);
          setObjects((previous) =>
            previous.filter((object) => object.kind !== 'text' || object.text.trim().length > 0),
          );
        }}
        onCreate={(rect: NormRect) => {
          const object = createTextObject({ page: 0, rect, text: '', z: 1 });
          setObjects((previous) => [...previous, object]);
          setSelected(object.id);
          return object.id;
        }}
        onTextChange={(id, text) =>
          setObjects((previous) =>
            previous.map((object) =>
              object.id === id && object.kind === 'text' ? { ...object, text } : object,
            ),
          )
        }
        onMove={(id, rect) =>
          setObjects((previous) =>
            previous.map((object) => (object.id === id ? { ...object, rect } : object)),
          )
        }
      />
    </div>
  );
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(PAGE_BOX);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OverlayLayer', () => {
  it('双击空白处创建文本框并进入编辑', () => {
    render(<Harness />);

    fireEvent.doubleClick(screen.getByTestId('pdf-overlay'), { clientX: 300, clientY: 400 });

    const input = screen.getByTestId('pdf-text-input');
    expect(input).toHaveFocus();
    const box = screen.getByTestId('pdf-text-object');
    expect(box).toHaveAttribute('data-editing', 'true');
    expect(box).toHaveAttribute('data-selected', 'true');
  });

  it('输入后失焦提交为文本对象', () => {
    render(<Harness />);
    fireEvent.doubleClick(screen.getByTestId('pdf-overlay'), { clientX: 300, clientY: 400 });

    fireEvent.change(screen.getByTestId('pdf-text-input'), { target: { value: 'Hello' } });
    fireEvent.blur(screen.getByTestId('pdf-text-input'));

    expect(screen.queryByTestId('pdf-text-input')).toBeNull();
    expect(screen.getByTestId('pdf-text-object')).toHaveTextContent('Hello');
    expect(screen.getByTestId('pdf-text-object')).toHaveAttribute('data-editing', 'false');
  });

  it('空白内容失焦后丢弃对象', () => {
    render(<Harness />);
    fireEvent.doubleClick(screen.getByTestId('pdf-overlay'), { clientX: 100, clientY: 100 });
    fireEvent.blur(screen.getByTestId('pdf-text-input'));

    expect(screen.queryByTestId('pdf-text-object')).toBeNull();
  });

  it('点击已有文本框只选中，不进入编辑', () => {
    const object = createTextObject({
      page: 0,
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 },
      text: 'Existing',
      z: 1,
      id: 'obj-1',
    });
    render(<Harness initial={[object]} />);

    fireEvent.pointerDown(screen.getByTestId('pdf-text-object'), {
      clientX: 60,
      clientY: 100,
      button: 0,
    });

    expect(screen.getByTestId('pdf-text-object')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('pdf-text-object')).toHaveAttribute('data-editing', 'false');
  });

  it('只渲染属于当前页的对象', () => {
    const onOtherPage = createTextObject({
      page: 1,
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 },
      text: 'page 2',
      z: 1,
      id: 'obj-2',
    });
    render(<Harness initial={[onOtherPage]} />);

    expect(screen.queryByTestId('pdf-text-object')).toBeNull();
  });
});
