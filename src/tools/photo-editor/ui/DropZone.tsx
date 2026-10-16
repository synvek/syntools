import { useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';

/**
 * 画布级拖放导入：拖入图片即新建图层、拖入 `.photo.json` 即载入工程。
 *
 * 只负责「事件收集 + 视觉反馈 + 取第一个文件」，文件校验与载入仍走既有导入流程
 * （`checkImageFile` / `checkProjectFile`），避免出现第二套校验规则。
 * 用 drag 计数抵消子元素间的 enter/leave 抖动（拖过画布内部元素时不会闪烁）。
 */
export function DropZone({
  onFile,
  children,
  testId,
}: {
  onFile: (file: File) => void;
  children: ReactNode;
  testId?: string;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  const hasFiles = (event: DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  return (
    <div
      data-testid={testId}
      className="relative"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setActive(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        // 必须阻止默认行为，否则浏览器不会派发 drop
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setActive(false);
        const file = event.dataTransfer?.files?.[0];
        if (file) onFile(file);
      }}
    >
      {children}
      {active ? (
        <div
          data-testid="photo-drop-overlay"
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/85 text-sm font-medium text-blue-700 dark:border-blue-500 dark:bg-blue-950/75 dark:text-blue-200"
        >
          <Icon name="upload" className="h-6 w-6" />
          <span>{t('tools.photo.dropHint')}</span>
        </div>
      ) : null}
    </div>
  );
}
