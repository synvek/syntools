import { useState } from 'react';
import { isPdfPasswordError, probePdfFile } from '@/core/pdf';

/** 加密 PDF 密码状态：选文件时探测，出错时提示输入。 */
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
