import type { PromptItem } from '../types';
import { PROMPT_CATEGORIES } from './categories';
import { validatePromptData } from './validate';

import { PROMPTS as WRITING_PROMPTS } from './prompts/writing';
import { PROMPTS as CODING_PROMPTS } from './prompts/coding';
import { PROMPTS as TRANSLATE_PROMPTS } from './prompts/translate';
import { PROMPTS as MARKETING_PROMPTS } from './prompts/marketing';
import { PROMPTS as LEARNING_PROMPTS } from './prompts/learning';
import { PROMPTS as CAREER_PROMPTS } from './prompts/career';
import { PROMPTS as BUSINESS_PROMPTS } from './prompts/business';
import { PROMPTS as SALES_PROMPTS } from './prompts/sales';
import { PROMPTS as CUSTOMER_PROMPTS } from './prompts/customer';
import { PROMPTS as PRODUCT_PROMPTS } from './prompts/product';
import { PROMPTS as OPERATIONS_PROMPTS } from './prompts/operations';
import { PROMPTS as DESIGN_PROMPTS } from './prompts/design';
import { PROMPTS as IMAGE_PROMPTS } from './prompts/image';
import { PROMPTS as VIDEO_PROMPTS } from './prompts/video';
import { PROMPTS as SOCIAL_PROMPTS } from './prompts/social';
import { PROMPTS as EMAIL_PROMPTS } from './prompts/email';
import { PROMPTS as PRODUCTIVITY_PROMPTS } from './prompts/productivity';
import { PROMPTS as EDUCATION_PROMPTS } from './prompts/education';
import { PROMPTS as RESEARCH_PROMPTS } from './prompts/research';
import { PROMPTS as DATA_PROMPTS } from './prompts/data';
import { PROMPTS as FINANCE_PROMPTS } from './prompts/finance';
import { PROMPTS as LEGAL_PROMPTS } from './prompts/legal';
import { PROMPTS as HEALTH_PROMPTS } from './prompts/health';
import { PROMPTS as THINKING_PROMPTS } from './prompts/thinking';
import { PROMPTS as SUMMARIZE_PROMPTS } from './prompts/summarize';
import { PROMPTS as REVIEW_PROMPTS } from './prompts/review';
import { PROMPTS as ROLEPLAY_PROMPTS } from './prompts/roleplay';
import { PROMPTS as META_PROMPTS } from './prompts/meta';

export { PROMPT_CATEGORIES };
export type { PromptCategoryId } from './categories';
export { validatePromptData } from './validate';

/** All prompts, concatenated in category-list order */
export const PROMPTS: PromptItem[] = [
  ...WRITING_PROMPTS,
  ...CODING_PROMPTS,
  ...TRANSLATE_PROMPTS,
  ...MARKETING_PROMPTS,
  ...LEARNING_PROMPTS,
  ...CAREER_PROMPTS,
  ...BUSINESS_PROMPTS,
  ...SALES_PROMPTS,
  ...CUSTOMER_PROMPTS,
  ...PRODUCT_PROMPTS,
  ...OPERATIONS_PROMPTS,
  ...DESIGN_PROMPTS,
  ...IMAGE_PROMPTS,
  ...VIDEO_PROMPTS,
  ...SOCIAL_PROMPTS,
  ...EMAIL_PROMPTS,
  ...PRODUCTIVITY_PROMPTS,
  ...EDUCATION_PROMPTS,
  ...RESEARCH_PROMPTS,
  ...DATA_PROMPTS,
  ...FINANCE_PROMPTS,
  ...LEGAL_PROMPTS,
  ...HEALTH_PROMPTS,
  ...THINKING_PROMPTS,
  ...SUMMARIZE_PROMPTS,
  ...REVIEW_PROMPTS,
  ...ROLEPLAY_PROMPTS,
  ...META_PROMPTS,
];

if (import.meta.env.DEV) {
  // Fail fast in development: a malformed data file raises a readable error right away, keeping bad data out of the UI.
  // Production builds tree-shake this branch away, so it costs nothing at runtime.
  const issues = validatePromptData(PROMPTS, PROMPT_CATEGORIES);
  if (issues.length > 0) {
    throw new Error(`[ai-prompts] 提示词数据校验失败：\n- ${issues.join('\n- ')}`);
  }
}
