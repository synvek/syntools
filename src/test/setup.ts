import '@testing-library/jest-dom/vitest';
import { i18n } from '@/core/i18n'; // 组件测试依赖 i18n 资源（T29）

// 组件测试用例中的文案断言基于中文，统一在测试环境锁定 zh（zh/en 均为同步打包资源，不影响生产构建）。
void i18n.changeLanguage('zh');
