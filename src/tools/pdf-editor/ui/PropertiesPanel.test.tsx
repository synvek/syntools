import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import { createImageObject, createMarkupObject, createTextObject } from '../model/objects';
import { registerPdfEditorStrings } from '../strings';
import { PropertiesPanel } from './PropertiesPanel';

registerPdfEditorStrings(i18n);

const page = 'page-main-0';
const rect = { x: 0.1, y: 0.1, w: 0.3, h: 0.1 };

function noopProps() {
  return {
    onChangeText: vi.fn(),
    onChangeNoteBody: vi.fn(),
    onChangeColor: vi.fn(),
    onChangeWidth: vi.fn(),
    onChangeFit: vi.fn(),
    onOpacityChange: vi.fn(),
    onToggleLock: vi.fn(),
    onZOrder: vi.fn(),
    onDelete: vi.fn(),
  };
}

describe('PropertiesPanel 按类型切换字段', () => {
  it('文本框显示字号与文字颜色', () => {
    const props = noopProps();
    render(
      <PropertiesPanel object={createTextObject({ page, rect, text: 'Hi', id: 't' })} {...props} />,
    );

    expect(screen.getByTestId('pdf-property-font-size')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-property-color')).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-property-annotation-color')).toBeNull();
    expect(screen.queryByTestId('pdf-property-fit')).toBeNull();
  });

  it('标记对象只显示颜色，不显示线宽', () => {
    const props = noopProps();
    render(
      <PropertiesPanel
        object={createMarkupObject({ page, rect, type: 'highlight', quads: [rect], id: 'm' })}
        {...props}
      />,
    );

    const color = screen.getByTestId('pdf-property-annotation-color');
    fireEvent.change(color, { target: { value: '#00ff00' } });
    expect(props.onChangeColor).toHaveBeenCalledWith('#00ff00');

    expect(screen.queryByTestId('pdf-property-stroke-width')).toBeNull();
    expect(screen.queryByTestId('pdf-property-font-size')).toBeNull();
  });

  it('图片显示填充方式并可切换', () => {
    const props = noopProps();
    render(
      <PropertiesPanel
        object={createImageObject({
          page,
          rect,
          dataUrl: 'data:image/png;base64,AA',
          naturalW: 10,
          naturalH: 10,
          id: 'img',
        })}
        {...props}
      />,
    );

    fireEvent.change(screen.getByTestId('pdf-property-fit'), { target: { value: 'cover' } });
    expect(props.onChangeFit).toHaveBeenCalledWith('cover');
    expect(screen.queryByTestId('pdf-property-font-size')).toBeNull();
  });

  it('没有选中对象时显示提示', () => {
    render(<PropertiesPanel object={null} {...noopProps()} />);

    expect(screen.queryByTestId('pdf-property-opacity')).toBeNull();
    expect(screen.getByText('选中一个对象后可在此修改')).toBeInTheDocument();
  });
});
