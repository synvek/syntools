import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { estimateStrength, type StrengthIssue, type StrengthLabel } from './core';

const SCORE_COLORS = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
const LABELS: StrengthLabel[] = ['very_weak', 'weak', 'fair', 'strong', 'very_strong'];

const CHECK_KEYS: {
  key: 'hasLower' | 'hasUpper' | 'hasDigit' | 'hasSymbol' | 'length';
  i18n: string;
}[] = [
  { key: 'hasLower', i18n: 'lower' },
  { key: 'hasUpper', i18n: 'upper' },
  { key: 'hasDigit', i18n: 'digit' },
  { key: 'hasSymbol', i18n: 'symbol' },
];

const ISSUE_LABELS: Record<StrengthIssue, string> = {
  too_short: 'too_short',
  no_lower: 'no_lower',
  no_upper: 'no_upper',
  no_digit: 'no_digit',
  no_symbol: 'no_symbol',
  sequential: 'sequential',
  repeated: 'repeated',
  common: 'common',
};

export default function PasswordStrengthTool() {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);

  const report = useMemo(() => estimateStrength(value), [value]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <input
          type={reveal ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('tools.password-strength.placeholder')}
          aria-label={t('tools.password-strength.input')}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={t('tools.password-strength.toggleReveal')}
          className="rounded-md border border-gray-300 px-2 py-2 text-gray-600 dark:border-gray-700 dark:text-gray-300"
        >
          <Icon name={reveal ? 'view-off' : 'view'} className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {LABELS.map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full ${i <= report.score ? SCORE_COLORS[report.score] : 'bg-gray-200 dark:bg-gray-700'}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={`font-medium ${SCORE_COLORS[report.score].replace('bg-', 'text-')}`}>
            {t(`tools.password-strength.labels.${LABELS[report.score]}`)}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {t('tools.password-strength.entropy', { bits: report.entropy })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {CHECK_KEYS.map(({ key, i18n }) => (
          <div key={key} className="flex items-center gap-2">
            <Icon
              name={report[key] ? 'check' : 'close'}
              className={`h-4 w-4 ${report[key] ? 'text-green-500' : 'text-gray-400'}`}
            />
            <span>{t(`tools.password-strength.checks.${i18n}`)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Icon
            name={report.length >= 12 ? 'check' : report.length >= 8 ? 'check' : 'close'}
            className={`h-4 w-4 ${report.length >= 8 ? 'text-green-500' : 'text-gray-400'}`}
          />
          <span>{t('tools.password-strength.checks.length12', { length: report.length })}</span>
        </div>
      </div>

      {report.issues.length > 0 && (
        <ul className="list-inside list-disc space-y-1 text-sm text-amber-600 dark:text-amber-400">
          {report.issues.map((issue) => (
            <li key={issue}>{t(`tools.password-strength.issues.${ISSUE_LABELS[issue]}`)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
