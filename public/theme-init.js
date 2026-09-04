// 主题初始化：在首帧前读取本地设置，避免亮/暗主题闪烁（见技术设计 §6.3）
// 独立为外部脚本以兼容严格 CSP（script-src 'self'，不允许内联脚本）
(function () {
  try {
    var raw = localStorage.getItem('syntools:settings.v1');
    var theme = raw ? JSON.parse(raw).theme || 'system' : 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (theme === 'dark' || (theme === 'system' && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch {
    /* 忽略：降级为亮色 */
  }
})();
