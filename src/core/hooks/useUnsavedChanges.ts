import { useEffect } from 'react';

/**
 * Native "you have unsaved changes" prompt.
 *
 * Registers `beforeunload` only while the document is dirty and removes it as soon as it is saved,
 * so a clean editor closes without a browser dialog. Browsers ignore the custom message text and
 * show their own copy; `message` is still passed for older engines.
 *
 * Route changes are deliberately not guarded here: the editor is a standalone page and
 * `react-router`'s `useBlocker` needs a data router (risk recorded in the plan, M2).
 */
export function useUnsavedChanges(dirty: boolean, message?: string): void {
  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy Chrome/Edge need `returnValue` set to show the dialog
      event.returnValue = message ?? '';
      return message ?? '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, message]);
}
