import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { SAMPLE_XML, SAMPLE_XSLT, transformXmlWithXslt } from './core';

/** XSLT：XML → HTML */
export default function XsltTransformTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        x: SAMPLE_XML,
        s: SAMPLE_XSLT,
      }),
    [],
  );
  const [xml, setXml] = useState(String(init.x || SAMPLE_XML));
  const [xslt, setXslt] = useState(String(init.s || SAMPLE_XSLT));

  const result = useMemo(() => transformXmlWithXslt(xml, xslt), [xml, xslt]);
  const output = result.ok ? result.value : '';

  const loadSample = () => {
    setXml(SAMPLE_XML);
    setXslt(SAMPLE_XSLT);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <button
          type="button"
          onClick={loadSample}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {t('tools.xsltTransform.sample')}
        </button>
        <ClearButton
          onClick={() => {
            setXml('');
            setXslt('');
          }}
          disabled={!xml && !xslt}
        />
        <ShareButton
          getState={() => ({
            x: xml.slice(0, 900),
            s: xslt.slice(0, 900),
          })}
        />
      </OptionBar>

      <div className="grid gap-4 lg:grid-cols-2">
        <IOTextArea
          label={t('tools.xsltTransform.xml')}
          value={xml}
          onChange={setXml}
          placeholder={t('tools.xsltTransform.xmlPlaceholder')}
          rows={12}
          actions={<CopyButton text={xml} />}
        />
        <IOTextArea
          label={t('tools.xsltTransform.xslt')}
          value={xslt}
          onChange={setXslt}
          placeholder={t('tools.xsltTransform.xsltPlaceholder')}
          rows={12}
          actions={<CopyButton text={xslt} />}
        />
      </div>

      {(xml.trim() || xslt.trim()) && !result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.xsltTransform.err.${result.error}`)}
        </p>
      )}

      {result.ok && (
        <div className="grid gap-4 lg:grid-cols-2">
          <IOTextArea
            label={t('tools.xsltTransform.output')}
            value={output}
            rows={10}
            readOnly
            actions={<CopyButton text={output} />}
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.xsltTransform.preview')}
            </span>
            <div
              className="min-h-[200px] overflow-auto rounded-md border border-gray-300 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              dangerouslySetInnerHTML={{ __html: output }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
