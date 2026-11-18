import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createImageObject,
  createInkObject,
  createMarkupObject,
  createNoteObject,
  createShapeObject,
  createStampObject,
  createTextObject,
} from '../model/objects';
import { OverlayLayer } from './OverlayLayer';
import { ObjectView } from './objectViews';

const PAGE_ID = 'page-main-0';
const PAGE_SIZE = { width: 600, height: 800 };
const rect = { x: 0.2, y: 0.2, w: 0.3, h: 0.2 };

describe('ObjectView', () => {
  it('文本按 pt×scale 渲染字号并保留换行', () => {
    const object = createTextObject({
      page: PAGE_ID,
      rect,
      text: 'Hello\nworld',
      style: { fontSize: 12 },
    });
    const { container } = render(<ObjectView object={object} scale={2} pageSize={PAGE_SIZE} />);

    const node = container.firstElementChild as HTMLElement;
    expect(node.textContent).toBe('Hello\nworld');
    expect(node.style.fontSize).toBe('24px');
    expect(node.className).toContain('whitespace-pre-wrap');
  });

  it('图片使用 object-fit 并禁用拖拽', () => {
    const object = createImageObject({
      page: PAGE_ID,
      rect,
      dataUrl: 'data:image/png;base64,AAAA',
      naturalW: 100,
      naturalH: 80,
      fit: 'cover',
    });
    const { container } = render(<ObjectView object={object} scale={1} pageSize={PAGE_SIZE} />);
    const image = container.querySelector('img');

    expect(image).not.toBeNull();
    expect(image?.getAttribute('draggable')).toBe('false');
    expect(image?.style.objectFit).toBe('cover');
  });

  it('画笔输出 SVG polyline，线宽随缩放变化', () => {
    const object = createInkObject({
      page: PAGE_ID,
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.3, y: 0.3 },
      ],
      width: 2,
    });
    const { container } = render(<ObjectView object={object} scale={2} pageSize={PAGE_SIZE} />);
    const polyline = container.querySelector('polyline');

    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute('points')?.split(' ')).toHaveLength(2);
    expect(Number(polyline?.getAttribute('stroke-width'))).toBe(4);
    expect(polyline?.getAttribute('stroke-linecap')).toBe('round');
  });

  it('高亮画矩形，下划线画横线', () => {
    const quads = [{ x: 0.2, y: 0.2, w: 0.3, h: 0.02 }];
    const highlight = createMarkupObject({ page: PAGE_ID, type: 'highlight', quads });
    const underline = createMarkupObject({ page: PAGE_ID, type: 'underline', quads });

    const first = render(<ObjectView object={highlight} scale={1} pageSize={PAGE_SIZE} />);
    expect(first.container.querySelectorAll('rect')).toHaveLength(1);
    expect(first.container.querySelector('rect')?.getAttribute('fill')).toBe('#fde047');
    first.unmount();

    const second = render(<ObjectView object={underline} scale={1} pageSize={PAGE_SIZE} />);
    expect(second.container.querySelector('line')).not.toBeNull();
    expect(second.container.querySelector('rect')).toBeNull();
  });

  it('形状按类型输出 rect / ellipse / line + 箭头', () => {
    const rectangle = createShapeObject({ page: PAGE_ID, rect, type: 'rect' });
    const first = render(<ObjectView object={rectangle} scale={1} pageSize={PAGE_SIZE} />);
    expect(first.container.querySelector('rect')).not.toBeNull();
    first.unmount();

    const ellipse = createShapeObject({ page: PAGE_ID, rect, type: 'ellipse' });
    const second = render(<ObjectView object={ellipse} scale={1} pageSize={PAGE_SIZE} />);
    expect(second.container.querySelector('ellipse')).not.toBeNull();
    second.unmount();

    const arrow = createShapeObject({ page: PAGE_ID, rect, type: 'arrow' });
    const third = render(<ObjectView object={arrow} scale={1} pageSize={PAGE_SIZE} />);
    expect(third.container.querySelector('line')).not.toBeNull();
    const head = third.container.querySelector('polyline');
    expect(head?.getAttribute('points')?.split(' ')).toHaveLength(3);
  });

  it('图章与便签可访问', () => {
    const stamp = createStampObject({
      page: PAGE_ID,
      rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
      dataUrl: 'data:image/png;base64,AAAA',
      naturalW: 200,
      naturalH: 80,
      kind: 'signature',
    });
    const first = render(<ObjectView object={stamp} scale={1} pageSize={PAGE_SIZE} />);
    expect(first.container.querySelector('img')).not.toBeNull();
    first.unmount();

    const note = createNoteObject({
      page: PAGE_ID,
      rect: { x: 0.5, y: 0.5, w: 0.03, h: 0.03 },
      body: '检查合同',
    });
    render(<ObjectView object={note} scale={1} pageSize={PAGE_SIZE} />);
    expect(screen.getByRole('img', { name: '检查合同' })).toBeInTheDocument();
  });
});

describe('OverlayLayer 多类型', () => {
  /** jsdom has no layout; the page box is what the pointer math divides by */
  const pageBox = {
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

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(pageBox);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const noop = {
    onSelect: vi.fn(),
    onStartEdit: vi.fn(),
    onEndEdit: vi.fn(),
    onCreate: vi.fn(() => null),
    onTextChange: vi.fn(),
    onMove: vi.fn(),
    onResize: vi.fn(),
    onRotate: vi.fn(),
  };

  const makeObjects = () => [
    createShapeObject({ page: PAGE_ID, rect, type: 'rect', z: 2, id: 'shape-1' }),
    createInkObject({
      page: PAGE_ID,
      points: [
        { x: 0.4, y: 0.4 },
        { x: 0.5, y: 0.5 },
      ],
      z: 1,
      id: 'ink-1',
    }),
    createImageObject({
      page: PAGE_ID,
      rect: { x: 0.6, y: 0.6, w: 0.2, h: 0.2 },
      dataUrl: 'data:image/png;base64,AAAA',
      naturalW: 10,
      naturalH: 10,
      z: 3,
      id: 'image-1',
    }),
  ];

  it('按 z 升序渲染所有类型并带 data-kind', () => {
    render(
      <OverlayLayer
        objects={makeObjects()}
        page={PAGE_ID}
        scale={1}
        selectedIds={[]}
        editingId={null}
        {...noop}
      />,
    );

    const kinds = screen.getAllByTestId('pdf-object').map((element) => element.dataset.kind);
    expect(kinds).toEqual(['ink', 'shape', 'image']);
  });

  it('旋转写入 transform，锁定对象不拖动', () => {
    const shape = createShapeObject({ page: PAGE_ID, rect, type: 'rect', rotation: 30 });
    const locked = createImageObject({
      page: PAGE_ID,
      rect: { x: 0.6, y: 0.6, w: 0.2, h: 0.2 },
      dataUrl: 'data:image/png;base64,AAAA',
      naturalW: 10,
      naturalH: 10,
      locked: true,
      id: 'locked-1',
    });

    render(
      <OverlayLayer
        objects={[shape, locked]}
        page={PAGE_ID}
        scale={1}
        selectedIds={[]}
        editingId={null}
        {...noop}
      />,
    );

    const [shapeNode, lockedNode] = screen.getAllByTestId('pdf-object');
    expect(shapeNode.style.transform).toBe('rotate(30deg)');
    expect(lockedNode.dataset.locked).toBe('true');

    fireEvent.pointerDown(lockedNode, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(lockedNode, { clientX: 80, clientY: 90 });
    expect(noop.onMove).not.toHaveBeenCalled();
    expect(noop.onSelect).toHaveBeenCalledWith(['locked-1']);
  });
});
