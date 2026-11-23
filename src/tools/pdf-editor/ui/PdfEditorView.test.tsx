import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import { createDoc } from '../model/doc';
import { registerPdfEditorStrings } from '../strings';
import { PdfEditorView } from './PdfEditorView';

// The view is deliberately dumb: it only knows keys, so the tool's copy has to be registered here
beforeAll(() => registerPdfEditorStrings(i18n));

function sampleDoc() {
  return createDoc({
    name: 'contract.pdf',
    source: {
      key: 'main',
      bytes: new Uint8Array([1]),
      pageCount: 1,
      encrypted: false,
      fingerprint: 'fp-view',
    },
    id: 'doc-view',
    now: 0,
  });
}

const baseProps = { tabs: [], onFile: () => {} };

describe('PdfEditorView 提示条', () => {
  it('可关闭的提示渲染关闭按钮，点击后回调', () => {
    const onDismissBanner = vi.fn();
    render(
      <PdfEditorView
        {...baseProps}
        doc={sampleDoc()}
        banner="已恢复上次编辑的内容"
        onDismissBanner={onDismissBanner}
      />,
    );

    expect(screen.getByTestId('pdf-banner')).toHaveTextContent('已恢复上次编辑的内容');
    const dismiss = screen.getByTestId('pdf-banner-dismiss');
    expect(dismiss).toHaveAccessibleName('关闭提示');

    fireEvent.click(dismiss);
    expect(onDismissBanner).toHaveBeenCalledTimes(1);
  });

  it('没有回调的提示（如格式刷状态）不给关闭按钮，避免点了没反应', () => {
    render(<PdfEditorView {...baseProps} doc={sampleDoc()} banner="格式刷：点击对象应用样式" />);

    expect(screen.getByTestId('pdf-banner')).toHaveTextContent('格式刷');
    expect(screen.queryByTestId('pdf-banner-dismiss')).toBeNull();
  });

  it('没有文档时不渲染提示条', () => {
    render(<PdfEditorView {...baseProps} doc={null} banner="已恢复上次编辑的内容" />);

    expect(screen.queryByTestId('pdf-banner')).toBeNull();
  });
});
