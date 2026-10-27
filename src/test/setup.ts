import '@testing-library/jest-dom/vitest';
import { i18n } from '@/core/i18n'; // Component tests rely on i18n resources (T29)

// Component tests assert Chinese copy, so pin zh in the test env (zh/en are sync bundles, no effect on production).
void i18n.changeLanguage('zh');
