import { useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';

/**
 * Canvas-level drag-and-drop import: dropping an image creates a layer, dropping a `.photo.json` loads a project.
 *
 * Only handles event collection + visual feedback + picking the first file; validation and loading still go through
 * the existing import flow (`checkImageFile` / `checkProjectFile`), so there is never a second set of validation rules.
 * A drag counter cancels enter/leave jitter between children (no flicker when passing over inner canvas elements).
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
        // The default must be prevented, otherwise the browser never fires drop
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
