import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { markOnboardingSeen } from './onboardingStorage';

/** 引导步骤（i18n 键后缀） */
const STEPS = [
  'onboardingStepPalette',
  'onboardingStepConnect',
  'onboardingStepArrange',
  'onboardingStepExport',
] as const;

/**
 * 首启引导：轻量分步提示核心操作，可跳过；关闭后写入已读标记，不再自动弹出。
 * 也可从空状态或快捷键帮助中再次打开。
 */
export function Onboarding({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const last = index >= STEPS.length - 1;

  const finish = () => {
    markOnboardingSeen();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label={t('tools.flowchart.onboardingTitle')}
      data-testid="flowchart-onboarding"
      className="fixed bottom-4 right-4 z-40 w-[320px] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-gray-800 dark:text-gray-100">
          {t('tools.flowchart.onboardingTitle')}
        </h2>
        <button
          type="button"
          data-testid="onboarding-close"
          aria-label={t('tools.flowchart.onboardingSkip')}
          onClick={finish}
          className="-mr-1 -mt-1 rounded p-1 text-[13px] leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      <p
        data-testid="onboarding-step"
        className="mt-1.5 min-h-[48px] text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300"
      >
        {t(`tools.flowchart.${STEPS[index]}`)}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {index + 1} / {STEPS.length}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="onboarding-skip"
            onClick={finish}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-[12px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('tools.flowchart.onboardingSkip')}
          </button>
          <button
            type="button"
            data-testid="onboarding-next"
            onClick={() => (last ? finish() : setIndex(index + 1))}
            className="rounded-md bg-blue-600 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            {last ? t('tools.flowchart.onboardingDone') : t('tools.flowchart.onboardingNext')}
          </button>
        </div>
      </div>
    </div>
  );
}
