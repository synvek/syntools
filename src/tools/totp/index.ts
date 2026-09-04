import type { ToolMeta } from '@/core/types';

export const totpTool: ToolMeta = {
  id: 'totp',
  name: 'TOTP 动态口令',
  description: 'RFC 6238 TOTP：生成 / 校验，6/8 位，剩余秒数',
  category: 'crypto',
  keywords: ["totp","otp","2fa","authenticator","动态口令","验证码"],
  icon: 'clock',
  component: () => import('./TotpTool'),
  weight: 5,
};
