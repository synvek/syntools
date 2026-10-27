// Theme init: read local settings before the first frame to avoid a light/dark flash (see Technical Design §6.3)
// Kept as an external script to satisfy a strict CSP (script-src 'self'; no inline scripts)
(function () {
  try {
    var raw = localStorage.getItem('syntools:settings.v1');
    var theme = raw ? JSON.parse(raw).theme || 'system' : 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (theme === 'dark' || (theme === 'system' && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch {
    /* Ignore: fall back to the light theme */
  }
})();
