import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PdfTool } from '../model/annotate';
import { createShapeObject, createTextObject } from '../model/objects';
import type { NormRect, PdfObject } from '../model/types';
import { OverlayLayer } from './OverlayLayer';

/** Page box used for the hit-testing math (jsdom has no layout) */
const PAGE_ID = 'page-main-0';

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
function Harness({ initial, tool }: { initial?: PdfObject[]; tool?: PdfTool }) {
  const [objects, setObjects] = useState<PdfObject[]>(initial ?? []);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      <OverlayLayer
        objects={objects}
        page={PAGE_ID}
        scale={1}
        selectedIds={selected}
        editingId={editing}
        tool={tool}
        onSelect={setSelected}
        onStartEdit={(id) => {
          setSelected([id]);
          setEditing(id);
        }}
        onEndEdit={() => {
          setEditing(null);
          setObjects((previous) =>
            previous.filter((object) => object.kind !== 'text' || object.text.trim().length > 0),
          );
        }}
        onCreate={(rect: NormRect) => {
          const object = createTextObject({ page: PAGE_ID, rect, text: '', z: 1 });
          setObjects((previous) => [...previous, object]);
          setSelected([object.id]);
          return object.id;
        }}
        onTextChange={(id, text) =>
          setObjects((previous) =>
            previous.map((object) =>
              object.id === id && object.kind === 'text' ? { ...object, text } : object,
            ),
          )
        }
        onMove={(updates) =>
          setObjects((previous) =>
            previous.map((object) => {
              const update = updates.find((candidate) => candidate.id === object.id);
              return update ? { ...object, rect: update.rect } : object;
            }),
          )
        }
        onResize={(id, rect) =>
          setObjects((previous) =>
            previous.map((object) => (object.id === id ? { ...object, rect } : object)),
          )
        }
        onRotate={(id, rotation) =>
          setObjects((previous) =>
            previous.map((object) => (object.id === id ? { ...object, rotation } : object)),
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
  /** jsdom 没有 PointerEvent：用同名 MouseEvent 才能带上 clientX / clientY */
  const drag = (type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number) =>
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });

  /** 文本框像形状一样拖出来，松开后自动进入编辑 */
  const dragOutTextBox = () => {
    const overlay = screen.getByTestId('pdf-overlay');
    fireEvent(overlay, drag('pointerdown', 120, 160));
    fireEvent(overlay, drag('pointermove', 320, 260));
    fireEvent(overlay, drag('pointerup', 320, 260));
  };

  it('文本框工具拖出矩形后自动进入编辑', () => {
    render(<Harness tool="text" />);

    const overlay = screen.getByTestId('pdf-overlay');
    fireEvent(overlay, drag('pointerdown', 120, 160));
    // 拖动过程中有虚线预览，而不是点一下凭空出现
    expect(screen.getByTestId('pdf-annotation-preview')).toBeInTheDocument();
    fireEvent(overlay, drag('pointermove', 320, 260));
    fireEvent(overlay, drag('pointerup', 320, 260));

    expect(screen.getByTestId('pdf-text-input')).toHaveFocus();
    const box = screen.getByTestId('pdf-text-object');
    expect(box).toHaveAttribute('data-editing', 'true');
    expect(box).toHaveAttribute('data-selected', 'true');
  });

  it('输入后失焦提交为文本对象', () => {
    render(<Harness tool="text" />);
    dragOutTextBox();

    fireEvent.change(screen.getByTestId('pdf-text-input'), { target: { value: 'Hello' } });
    fireEvent.blur(screen.getByTestId('pdf-text-input'));

    expect(screen.queryByTestId('pdf-text-input')).toBeNull();
    expect(screen.getByTestId('pdf-text-object')).toHaveTextContent('Hello');
    expect(screen.getByTestId('pdf-text-object')).toHaveAttribute('data-editing', 'false');
  });

  it('空白内容失焦后丢弃对象', () => {
    render(<Harness tool="text" />);
    dragOutTextBox();
    fireEvent.blur(screen.getByTestId('pdf-text-input'));

    expect(screen.queryByTestId('pdf-text-object')).toBeNull();
  });

  it('双击已有文本框重新进入编辑', () => {
    const object = createTextObject({
      page: PAGE_ID,
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 },
      text: 'Existing',
      z: 1,
      id: 'obj-edit',
    });
    render(<Harness initial={[object]} />);

    fireEvent.doubleClick(screen.getByTestId('pdf-text-object'), { clientX: 90, clientY: 140 });

    expect(screen.getByTestId('pdf-text-input')).toHaveFocus();
    expect(screen.getByTestId('pdf-text-object')).toHaveAttribute('data-editing', 'true');
  });

  it('文本框工具下连按两次也能进入编辑（不依赖浏览器 dblclick）', () => {
    const object = createTextObject({
      page: PAGE_ID,
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 },
      text: 'One',
      z: 1,
      id: 'obj-press',
    });
    render(<Harness initial={[object]} tool="text" />);

    const box = screen.getByTestId('pdf-text-object');
    fireEvent(box, drag('pointerdown', 90, 140));
    fireEvent(box, drag('pointerdown', 92, 142));

    expect(screen.getByTestId('pdf-text-input')).toHaveFocus();
    expect(box).toHaveAttribute('data-editing', 'true');
  });

  it('两次按下间隔过久时只选中，不进入编辑', () => {
    const object = createTextObject({
      page: PAGE_ID,
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 },
      text: 'One',
      z: 1,
      id: 'obj-slow',
    });
    render(<Harness initial={[object]} />);

    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    const box = screen.getByTestId('pdf-text-object');
    fireEvent(box, drag('pointerdown', 90, 140));

    now.mockReturnValue(2_000);
    fireEvent(box, drag('pointerdown', 92, 142));

    expect(screen.queryByTestId('pdf-text-input')).toBeNull();
    expect(box).toHaveAttribute('data-selected', 'true');
  });

  it('双击空白不再创建文本框', () => {
    render(<Harness />);

    fireEvent.doubleClick(screen.getByTestId('pdf-overlay'), { clientX: 300, clientY: 400 });

    expect(screen.queryByTestId('pdf-text-object')).toBeNull();
  });

  it('点击已有文本框只选中，不进入编辑', () => {
    const object = createTextObject({
      page: PAGE_ID,
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
      page: 'page-main-1',
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 },
      text: 'page 2',
      z: 1,
      id: 'obj-2',
    });
    render(<Harness initial={[onOtherPage]} />);

    expect(screen.queryByTestId('pdf-text-object')).toBeNull();
  });

  /**
   * 抓手工具与选择工具的区别：抓手不在页面上做任何编辑动作，按下事件必须冒泡到滚动容器，
   * 否则指针落在对象上时"平移"会和"选择"表现一致（拖动对象而不是平移画布）。
   */
  it('抓手模式：按下对象既不选中也不移动', () => {
    const object = createTextObject({
      page: PAGE_ID,
      rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 },
      text: 'Existing',
      z: 1,
      id: 'obj-hand',
    });
    render(<Harness initial={[object]} tool="hand" />);

    fireEvent.pointerDown(screen.getByTestId('pdf-text-object'), {
      clientX: 60,
      clientY: 100,
      button: 0,
    });

    expect(screen.getByTestId('pdf-text-object')).toHaveAttribute('data-selected', 'false');
    expect(screen.queryByTestId('pdf-selection-frame')).toBeNull();
  });

  it('抓手模式：双击空白不创建文本框', () => {
    render(<Harness tool="hand" />);

    fireEvent.doubleClick(screen.getByTestId('pdf-overlay'), { clientX: 300, clientY: 400 });

    expect(screen.queryByTestId('pdf-text-input')).toBeNull();
    expect(screen.queryByTestId('pdf-text-object')).toBeNull();
  });
});

/**
 * Gesture tests assert the callback contract directly: the layer reports normalized rects, and the
 * controller decides how to merge them into history.
 */
describe('OverlayLayer 手势与多选', () => {
  /**
   * jsdom has no `PointerEvent`, so `fireEvent.pointerDown` degrades to a bare `Event` and drops
   * `clientX` / `button`. React only reads the DOM fields, so a bubbling MouseEvent under the same
   * type name exercises the real handlers.
   */
  function pointer(
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    init: MouseEventInit = {},
  ): MouseEvent {
    return new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  }

  const baseProps = {
    page: PAGE_ID,
    scale: 1,
    selectedIds: [] as string[],
    editingId: null,
    onSelect: () => {},
    onStartEdit: () => {},
    onEndEdit: () => {},
    onCreate: () => null,
    onTextChange: () => {},
    onMove: () => {},
    onResize: () => {},
    onRotate: () => {},
  };

  it('拖动多选对象：一次 pointermove 上报全部被选对象的位移', () => {
    const first = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.2, y: 0.2, w: 0.1, h: 0.1 },
      type: 'rect',
      id: 'a',
      z: 1,
    });
    const second = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
      type: 'ellipse',
      id: 'b',
      z: 2,
    });
    const onMove = vi.fn();

    render(
      <OverlayLayer
        {...baseProps}
        objects={[first, second]}
        selectedIds={['a', 'b']}
        onMove={onMove}
      />,
    );

    const [node] = screen.getAllByTestId('pdf-object');
    fireEvent(node, pointer('pointerdown', { clientX: 150, clientY: 200, button: 0 }));
    fireEvent(node, pointer('pointermove', { clientX: 210, clientY: 280 }));

    expect(onMove).toHaveBeenCalledTimes(1);
    const updates = onMove.mock.calls[0][0] as Array<{ id: string; rect: NormRect }>;
    expect(updates.map((update) => update.id)).toEqual(['a', 'b']);
    expect(updates[0].rect.x).toBeCloseTo(0.3, 6);
    expect(updates[0].rect.y).toBeCloseTo(0.3, 6);
    expect(updates[0].rect.w).toBeCloseTo(0.1, 6);
    expect(updates[1].rect.x).toBeCloseTo(0.6, 6);
    expect(updates[1].rect.y).toBeCloseTo(0.6, 6);
  });

  it('Shift 点击追加选择，再次 Shift 点击从选择中移除', () => {
    const first = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.2, y: 0.2, w: 0.1, h: 0.1 },
      type: 'rect',
      id: 'a',
    });
    const second = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
      type: 'rect',
      id: 'b',
    });
    const onSelect = vi.fn();
    const { rerender } = render(
      <OverlayLayer
        {...baseProps}
        objects={[first, second]}
        selectedIds={['a']}
        onSelect={onSelect}
      />,
    );

    const [, secondNode] = screen.getAllByTestId('pdf-object');
    fireEvent(secondNode, pointer('pointerdown', { clientX: 330, clientY: 440, shiftKey: true }));
    expect(onSelect).toHaveBeenCalledWith(['a', 'b']);

    onSelect.mockClear();
    rerender(
      <OverlayLayer
        {...baseProps}
        objects={[first, second]}
        selectedIds={['a', 'b']}
        onSelect={onSelect}
      />,
    );
    fireEvent(secondNode, pointer('pointerdown', { clientX: 330, clientY: 440, shiftKey: true }));
    expect(onSelect).toHaveBeenCalledWith(['a']);
  });

  it('拖动缩放手柄上报新的 rect', () => {
    const object = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 },
      type: 'rect',
      id: 'a',
    });
    const onResize = vi.fn();
    const { container } = render(
      <OverlayLayer {...baseProps} objects={[object]} selectedIds={['a']} onResize={onResize} />,
    );

    const handle = container.querySelector('[data-handle="e"]');
    expect(handle).not.toBeNull();
    fireEvent(handle as Element, pointer('pointerdown', { clientX: 240, clientY: 240, button: 0 }));
    fireEvent(
      screen.getByTestId('pdf-overlay'),
      pointer('pointermove', { clientX: 300, clientY: 240 }),
    );

    expect(onResize).toHaveBeenCalledWith('a', { x: 0.2, y: 0.2, w: 0.3, h: 0.2 });
  });

  it('旋转默认吸附 15°，按住 Shift 自由旋转', () => {
    const object = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 },
      type: 'rect',
      id: 'a',
    });
    // Center is (180, 240) px; the pointer starts straight above it (0°) and ends at ~50°.
    // jsdom reports a 0×0 page box, so the layer falls back to pageAspect = 1.
    const start = { clientX: 180, clientY: 200, button: 0 };
    const end = { clientX: 270, clientY: 139 };

    const snapped = vi.fn();
    const first = render(
      <OverlayLayer {...baseProps} objects={[object]} selectedIds={['a']} onRotate={snapped} />,
    );
    fireEvent(
      first.container.querySelector('[data-handle="rotate"]') as Element,
      pointer('pointerdown', start),
    );
    fireEvent(screen.getByTestId('pdf-overlay'), pointer('pointermove', end));
    expect(snapped).toHaveBeenCalledWith('a', 45);
    first.unmount();

    const free = vi.fn();
    const second = render(
      <OverlayLayer {...baseProps} objects={[object]} selectedIds={['a']} onRotate={free} />,
    );
    fireEvent(
      second.container.querySelector('[data-handle="rotate"]') as Element,
      pointer('pointerdown', start),
    );
    fireEvent(
      screen.getByTestId('pdf-overlay'),
      pointer('pointermove', { ...end, shiftKey: true }),
    );
    expect(free.mock.calls[0][1]).toBeCloseTo(50, 0);
  });

  it('Shift 框选按 z 降序回传命中对象', () => {
    const near = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      type: 'rect',
      id: 'near',
      z: 1,
    });
    const middle = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 },
      type: 'rect',
      id: 'middle',
      z: 2,
    });
    const outside = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.8, y: 0.1, w: 0.1, h: 0.1 },
      type: 'rect',
      id: 'outside',
      z: 3,
    });
    const onSelect = vi.fn();

    render(
      <OverlayLayer
        {...baseProps}
        objects={[near, middle, outside]}
        selectedIds={[]}
        onSelect={onSelect}
      />,
    );

    const root = screen.getByTestId('pdf-overlay');
    fireEvent(root, pointer('pointerdown', { clientX: 0, clientY: 0, shiftKey: true }));
    fireEvent(root, pointer('pointermove', { clientX: 450, clientY: 600 }));
    expect(screen.getByTestId('pdf-marquee')).toBeInTheDocument();
    fireEvent(root, pointer('pointerup', { clientX: 450, clientY: 600 }));

    expect(onSelect).toHaveBeenCalledWith(['middle', 'near']);
  });

  it('点击空白处清空选择', () => {
    const onSelect = vi.fn();
    render(<OverlayLayer {...baseProps} objects={[]} selectedIds={['a']} onSelect={onSelect} />);

    fireEvent(
      screen.getByTestId('pdf-overlay'),
      pointer('pointerdown', { clientX: 5, clientY: 5 }),
    );

    expect(onSelect).toHaveBeenCalledWith([]);
  });
});

describe('OverlayLayer 注释工具', () => {
  function pointer(
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    init: MouseEventInit = {},
  ): MouseEvent {
    return new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  }

  const baseProps = {
    page: PAGE_ID,
    scale: 1,
    selectedIds: [] as string[],
    editingId: null,
    onSelect: () => {},
    onStartEdit: () => {},
    onEndEdit: () => {},
    onCreate: () => null,
    onTextChange: () => {},
    onMove: () => {},
    onResize: () => {},
    onRotate: () => {},
  };

  const overlay = () => screen.getByTestId('pdf-overlay');

  const existing = () =>
    createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 },
      type: 'rect',
      id: 'existing',
    });

  it('高亮拖动结束后请求创建 markup', () => {
    const onAnnotate = vi.fn();
    render(<OverlayLayer {...baseProps} objects={[]} tool="highlight" onAnnotate={onAnnotate} />);

    fireEvent(overlay(), pointer('pointerdown', { clientX: 120, clientY: 400 }));
    expect(screen.getByTestId('pdf-annotation-preview')).toBeInTheDocument();
    fireEvent(overlay(), pointer('pointermove', { clientX: 300, clientY: 460 }));
    fireEvent(overlay(), pointer('pointerup', { clientX: 300, clientY: 460 }));

    expect(onAnnotate).toHaveBeenCalledTimes(1);
    const request = onAnnotate.mock.calls[0][0] as { kind: string; type: string; rect: NormRect };
    expect(request.kind).toBe('markup');
    expect(request.type).toBe('highlight');
    expect(request.rect.x).toBeCloseTo(0.2, 6);
    expect(request.rect.y).toBeCloseTo(0.5, 6);
    expect(request.rect.w).toBeCloseTo(0.3, 6);
    expect(request.rect.h).toBeCloseTo(0.075, 6);
    expect(screen.queryByTestId('pdf-annotation-preview')).toBeNull();
  });

  it('形状工具把拖动矩形交给控制器', () => {
    const onAnnotate = vi.fn();
    render(<OverlayLayer {...baseProps} objects={[]} tool="ellipse" onAnnotate={onAnnotate} />);

    fireEvent(overlay(), pointer('pointerdown', { clientX: 120, clientY: 160 }));
    fireEvent(overlay(), pointer('pointermove', { clientX: 240, clientY: 320 }));
    fireEvent(overlay(), pointer('pointerup', { clientX: 240, clientY: 320 }));

    const request = onAnnotate.mock.calls[0][0] as { kind: string; type: string; rect: NormRect };
    expect(request.kind).toBe('shape');
    expect(request.type).toBe('ellipse');
    expect(request.rect.x).toBeCloseTo(0.2, 6);
    expect(request.rect.w).toBeCloseTo(0.2, 6);
  });

  it('橡皮按下后拖动可以连续擦除，同一次按压不重复擦同一个对象', () => {
    const onErase = vi.fn();
    const first = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      type: 'rect',
      id: 'first',
    });
    const second = createShapeObject({
      page: PAGE_ID,
      rect: { x: 0.6, y: 0.6, w: 0.2, h: 0.2 },
      type: 'rect',
      id: 'second',
    });
    render(
      <OverlayLayer {...baseProps} objects={[first, second]} tool="eraser" onErase={onErase} />,
    );

    // 按下点先擦掉指针下的对象
    fireEvent(overlay(), pointer('pointerdown', { clientX: 120, clientY: 120 }));
    expect(onErase).toHaveBeenLastCalledWith('first');

    // 继续拖动擦掉经过的第二个对象
    fireEvent(overlay(), pointer('pointermove', { clientX: 400, clientY: 500 }));
    expect(onErase).toHaveBeenLastCalledWith('second');

    // 拖回第一个对象不重复上报
    fireEvent(overlay(), pointer('pointermove', { clientX: 120, clientY: 120 }));
    fireEvent(overlay(), pointer('pointerup', { clientX: 120, clientY: 120 }));

    expect(onErase).toHaveBeenCalledTimes(2);
  });

  it('画笔按采样点简化后上报折线', () => {
    const onAnnotate = vi.fn();
    render(<OverlayLayer {...baseProps} objects={[]} tool="ink" onAnnotate={onAnnotate} />);

    fireEvent(overlay(), pointer('pointerdown', { clientX: 60, clientY: 80 }));
    fireEvent(overlay(), pointer('pointermove', { clientX: 120, clientY: 160 }));
    fireEvent(overlay(), pointer('pointermove', { clientX: 180, clientY: 240 }));
    fireEvent(overlay(), pointer('pointerup', { clientX: 240, clientY: 320 }));

    const request = onAnnotate.mock.calls[0][0] as {
      kind: string;
      points: Array<{ x: number; y: number }>;
      rect: NormRect;
    };
    expect(request.kind).toBe('ink');
    // 共线采样被 Douglas-Peucker 压成首尾两点
    expect(request.points).toHaveLength(2);
    expect(request.points[0].x).toBeCloseTo(0.1, 6);
    expect(request.points[1].y).toBeCloseTo(0.4, 6);
    // 外接框覆盖按下点到抬起点
    expect(request.rect.w).toBeCloseTo(0.3, 6);
  });

  it('点一下放置便签，不进入拖动', () => {
    const onAnnotate = vi.fn();
    render(<OverlayLayer {...baseProps} objects={[]} tool="note" onAnnotate={onAnnotate} />);

    fireEvent(overlay(), pointer('pointerdown', { clientX: 300, clientY: 400 }));

    expect(onAnnotate).toHaveBeenCalledWith({ kind: 'note', point: { x: 0.5, y: 0.5 } });
  });

  it('橡皮点掉命中的对象，锁定对象不受影响', () => {
    const onErase = vi.fn();
    const { unmount } = render(
      <OverlayLayer {...baseProps} objects={[existing()]} tool="eraser" onErase={onErase} />,
    );

    fireEvent(overlay(), pointer('pointerdown', { clientX: 180, clientY: 240 }));
    expect(onErase).toHaveBeenCalledWith('existing');

    unmount();
    onErase.mockClear();
    render(
      <OverlayLayer
        {...baseProps}
        objects={[{ ...existing(), locked: true }]}
        tool="eraser"
        onErase={onErase}
      />,
    );
    fireEvent(overlay(), pointer('pointerdown', { clientX: 180, clientY: 240 }));
    expect(onErase).not.toHaveBeenCalled();
  });

  it('注释工具下按在对象上不会选中，也不会拖动', () => {
    const onSelect = vi.fn();
    const onMove = vi.fn();
    const onAnnotate = vi.fn();
    render(
      <OverlayLayer
        {...baseProps}
        objects={[existing()]}
        selectedIds={['existing']}
        tool="underline"
        onSelect={onSelect}
        onMove={onMove}
        onAnnotate={onAnnotate}
      />,
    );

    const node = screen.getByTestId('pdf-object');
    fireEvent(node, pointer('pointerdown', { clientX: 180, clientY: 240 }));
    fireEvent(node, pointer('pointermove', { clientX: 300, clientY: 300 }));
    fireEvent(node, pointer('pointerup', { clientX: 300, clientY: 300 }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    expect(onAnnotate).toHaveBeenCalledTimes(1);
  });

  it('过小的拖动不创建对象', () => {
    const onAnnotate = vi.fn();
    render(<OverlayLayer {...baseProps} objects={[]} tool="rect" onAnnotate={onAnnotate} />);

    fireEvent(overlay(), pointer('pointerdown', { clientX: 100, clientY: 100 }));
    fireEvent(overlay(), pointer('pointerup', { clientX: 101, clientY: 101 }));

    expect(onAnnotate).not.toHaveBeenCalled();
  });
});
