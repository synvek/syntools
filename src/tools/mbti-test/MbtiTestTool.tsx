import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import {
  MBTI_QUESTIONS,
  answeredCount,
  scoreMbti,
  type MbtiResult,
} from './core';
import { getMbtiQuestion, getMbtiTypeCopy } from './copy';

/** MBTI 在线性格测试 */
export default function MbtiTestTool() {
  const { t, i18n } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, 'a' | 'b'>>({});
  const [result, setResult] = useState<MbtiResult | null>(null);
  const [step, setStep] = useState(0);

  const done = answeredCount(answers);
  const total = MBTI_QUESTIONS.length;
  const current = MBTI_QUESTIONS[Math.min(step, total - 1)];
  const qCopy = getMbtiQuestion(i18n.language, current.id);

  const progress = useMemo(() => Math.round((done / total) * 100), [done, total]);

  const choose = (qid: string, choice: 'a' | 'b') => {
    setAnswers((prev) => ({ ...prev, [qid]: choice }));
    setResult(null);
    if (step < total - 1) setStep((s) => s + 1);
  };

  const submit = () => {
    const r = scoreMbti(answers);
    if (r.ok) setResult(r.value);
  };

  const reset = () => {
    setAnswers({});
    setResult(null);
    setStep(0);
  };

  if (result) {
    const typeCopy = getMbtiTypeCopy(i18n.language, result.type);
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.mbti.yourType')}</p>
          <p className="mt-2 font-mono text-4xl font-semibold tracking-widest text-gray-900 dark:text-gray-50">
            {result.type}
          </p>
          <p className="mt-2 text-lg font-medium text-gray-800 dark:text-gray-100">
            {typeCopy?.name}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600 dark:text-gray-300">
            {typeCopy?.desc}
          </p>
          <div className="mt-4 flex justify-center">
            <CopyButton text={result.type} />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {(['EI', 'SN', 'TF', 'JP'] as const).map((dim) => (
            <div
              key={dim}
              className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <div className="flex justify-between text-xs text-gray-500">
                <span>{t(`tools.mbti.dims.${dim}`)}</span>
                <span className="font-mono">{result.strengths[dim]}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded bg-blue-500"
                  style={{ width: `${result.strengths[dim]}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.mbti.disclaimer')}</p>

        <button
          type="button"
          onClick={reset}
          className="self-start rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
        >
          {t('tools.mbti.retake')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span>{t('tools.mbti.progress', { done, total })}</span>
        <span className="font-mono text-xs">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
        <div className="h-full rounded bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <p className="text-xs text-gray-400">
          {t('tools.mbti.questionIndex', { n: step + 1, total })}
        </p>
        <p className="mt-2 text-base font-medium text-gray-900 dark:text-gray-50">
          {qCopy?.text}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {current.options.map((opt) => {
            const selected = answers[current.id] === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => choose(current.id, opt.id)}
                className={`rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                  selected
                    ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500'
                }`}
              >
                {opt.id === 'a' ? qCopy?.a : qCopy?.b}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-600"
        >
          {t('tools.mbti.prev')}
        </button>
        <button
          type="button"
          disabled={step >= total - 1}
          onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-600"
        >
          {t('tools.mbti.next')}
        </button>
        <button
          type="button"
          disabled={done < total}
          onClick={submit}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {t('tools.mbti.submit')}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
        >
          {t('tools.mbti.reset')}
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.mbti.hint')}</p>
    </div>
  );
}
