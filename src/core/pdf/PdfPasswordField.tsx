import { useTranslation } from 'react-i18next';
import { PdfField, pdfInputClass } from '@/core/pdf/ui';

/** 加密 PDF 密码输入；在 NEED_PASSWORD / WRONG_PASSWORD 时展示。 */
export function PdfPasswordField({
  value,
  onChange,
  error,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  /** 当前错误码，用于切换文案 */
  error?: string | null;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const wrong = error === 'WRONG_PASSWORD';

  return (
    <div className="flex flex-col gap-1">
      <PdfField label={t('pdf.password')}>
        <input
          className={pdfInputClass}
          type="password"
          autoComplete="current-password"
          autoFocus={autoFocus}
          value={value}
          placeholder={t('pdf.passwordPlaceholder')}
          onChange={(e) => onChange(e.target.value)}
        />
      </PdfField>
      <p
        className={`text-xs ${wrong ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}
      >
        {wrong ? t('pdf.errors.WRONG_PASSWORD') : t('pdf.passwordHint')}
      </p>
    </div>
  );
}
