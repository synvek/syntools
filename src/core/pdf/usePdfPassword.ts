import { useState } from 'react';
import { isPdfPasswordError, probePdfFile } from '@/core/pdf';

/** Encrypted-PDF password state: probed on file select, prompts on error. */
export function usePdfPassword() {
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  const resetPassword = () => {
    setPassword('');
    setNeedsPassword(false);
  };

  const onPdfSelected = async (file: File) => {
    setPassword('');
    const probe = await probePdfFile(file);
    setNeedsPassword(!probe.ok && probe.error === 'NEED_PASSWORD');
    return probe;
  };

  const notePdfError = (error: string) => {
    if (isPdfPasswordError(error)) setNeedsPassword(true);
  };

  return {
    password,
    setPassword,
    needsPassword,
    setNeedsPassword,
    resetPassword,
    onPdfSelected,
    notePdfError,
  };
}
