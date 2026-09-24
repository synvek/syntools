export type HeaderTarget = 'nginx' | 'apache' | 'express' | 'vercel' | 'raw';

export interface HeaderOptions {
  hsts: boolean;
  hstsMaxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
  csp: boolean;
  cspDirectives: string;
  frameOptions: 'none' | 'deny' | 'sameorigin';
  referrerPolicy: string;
  contentTypeOptions: boolean;
  permissionsPolicy: boolean;
  coop: 'none' | 'same-origin' | 'same-origin-allow-popups';
  coep: 'none' | 'require-corp' | 'credentialless';
  corsOrigin: string;
}

export const DEFAULT_OPTIONS: HeaderOptions = {
  hsts: true,
  hstsMaxAge: 31536000,
  includeSubDomains: true,
  preload: false,
  csp: true,
  cspDirectives: "default-src 'self'; img-src 'self' data:; object-src 'none'",
  frameOptions: 'deny',
  referrerPolicy: 'strict-origin-when-cross-origin',
  contentTypeOptions: true,
  permissionsPolicy: true,
  coop: 'same-origin',
  coep: 'none',
  corsOrigin: '',
};

/** 根据选项生成响应头键值对（顺序稳定，便于测试与对比） */
export function buildHeaders(options: HeaderOptions): Array<[string, string]> {
  const headers: Array<[string, string]> = [];

  if (options.hsts) {
    const maxAge = Number.isFinite(options.hstsMaxAge)
      ? Math.max(0, Math.trunc(options.hstsMaxAge))
      : 0;
    const parts = [`max-age=${maxAge}`];
    if (options.includeSubDomains) parts.push('includeSubDomains');
    if (options.preload) parts.push('preload');
    headers.push(['Strict-Transport-Security', parts.join('; ')]);
  }

  if (options.csp) {
    const value = options.cspDirectives.trim();
    if (value) headers.push(['Content-Security-Policy', value]);
  }

  if (options.frameOptions === 'deny') headers.push(['X-Frame-Options', 'DENY']);
  if (options.frameOptions === 'sameorigin') headers.push(['X-Frame-Options', 'SAMEORIGIN']);

  if (options.contentTypeOptions) headers.push(['X-Content-Type-Options', 'nosniff']);

  if (options.referrerPolicy.trim()) {
    headers.push(['Referrer-Policy', options.referrerPolicy.trim()]);
  }

  if (options.permissionsPolicy) {
    headers.push([
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
    ]);
  }

  if (options.coop !== 'none') {
    headers.push(['Cross-Origin-Opener-Policy', options.coop]);
  }
  if (options.coep !== 'none') {
    headers.push(['Cross-Origin-Embedder-Policy', options.coep]);
  }

  const origin = options.corsOrigin.trim();
  if (origin) {
    headers.push(['Access-Control-Allow-Origin', origin]);
  }

  return headers;
}

/** 按目标平台渲染配置片段 */
export function renderHeaders(options: HeaderOptions, target: HeaderTarget): string {
  const headers = buildHeaders(options);
  switch (target) {
    case 'nginx':
      return headers.map(([k, v]) => `add_header ${k} "${v}" always;`).join('\n');
    case 'apache':
      return headers.map(([k, v]) => `Header always set ${k} "${v}"`).join('\n');
    case 'express':
      return [
        'app.use((_req, res, next) => {',
        ...headers.map(([k, v]) => `  res.setHeader('${k}', '${v}');`),
        '  next();',
        '});',
      ].join('\n');
    case 'vercel':
      return JSON.stringify({ headers: [{ source: '/(.*)', headers }] }, null, 2);
    case 'raw':
      return headers.map(([k, v]) => `${k}: ${v}`).join('\n');
  }
}
