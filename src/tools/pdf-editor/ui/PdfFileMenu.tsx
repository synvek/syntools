import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RibbonMenu } from '@/core/components/ribbon/RibbonMenu';
import { RIBBON_ICON_BUTTON } from '@/core/components/ribbon/ribbonTheme';
import { RibbonIcon } from '@/core/components/ribbon/ribbonIcons';
import type { RibbonMenuItem } from '@/core/components/ribbon/types';

interface PdfFileMenuProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  /** Open / insert / save / export commands, in that order */
  items: RibbonMenuItem[];
}

/**
 * Quick-access cluster left of the tabs: undone/redo, then the ⋯ file menu.
 *
 * Mirrors Office: the two most-used commands never hide behind a tab, and file-level import/export
 * lives in one predictable place. The ribbon renders this node before the tab list, so no shared
 * ribbon changes are needed.
 */
export function PdfFileMenu({ canUndo, canRedo, onUndo, onRedo, items }: PdfFileMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = t('tools.pdfEditor.fileMenuLabel');

  return (
    <div className="flex shrink-0 items-center gap-0.5" data-testid="pdf-quick-access">
      <button
        type="button"
        data-testid="pdf-qat-undo"
        aria-label={t('tools.pdfEditor.cmdUndo')}
        title={`${t('tools.pdfEditor.cmdUndo')} (⌘Z)`}
        disabled={!canUndo}
        onClick={onUndo}
        className={`${RIBBON_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <RibbonIcon name="undo" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        data-testid="pdf-qat-redo"
        aria-label={t('tools.pdfEditor.cmdRedo')}
        title={`${t('tools.pdfEditor.cmdRedo')} (⇧⌘Z)`}
        disabled={!canRedo}
        onClick={onRedo}
        className={`${RIBBON_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <RibbonIcon name="redo" className="h-3.5 w-3.5" />
      </button>

      <div className="relative flex items-center">
        <button
          type="button"
          data-testid="pdf-file-menu"
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={RIBBON_ICON_BUTTON}
        >
          <RibbonIcon name="more" className="h-4 w-4" />
        </button>
        {open ? (
          <RibbonMenu items={items} ariaLabel={label} onClose={() => setOpen(false)} />
        ) : null}
      </div>
    </div>
  );
}
