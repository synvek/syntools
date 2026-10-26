import type { SeoLang } from '@/core/seo/copy';

/**
 * 只给**预渲染**用的正文素材：静态页的小节，以及骨架里的固定句子。
 *
 * 这个模块不会被浏览器加载——`core/seo/meta.ts` 只引 `copy.ts`。
 * 拆开的理由很直接：无 JS 环境下 crawler 读到的正文有 25 条条目，全部塞进
 * 首屏 bundle 是在为爬虫浪费每个访客的 195 KB 预算（`pnpm size` 有硬门禁）。
 */

export interface SeoSection {
  heading: string;
  items: string[];
}

/** 静态页正文小节，键为语言无关路径 */
export const STATIC_PAGE_SECTIONS: Record<SeoLang, Record<string, SeoSection[]>> = {
  en: {
    '/pricing/': [
      {
        heading: 'Web app (free)',
        items: [
          'All tools, unlimited use; no cap on single-file processing',
          'No signup, no install; files are processed in the browser and never uploaded',
          'No watermarks, no quality downgrades, no artificial countdowns',
        ],
      },
      {
        heading: 'Desktop: Community (free) and Pro (planned)',
        items: [
          'Community edition is AGPL-3.0: no browser tab memory ceiling, works fully offline',
          'Shipped as source and installers — build and modify it yourself; internal use carries no open-source obligation',
          'Pro scope, licensing terms and pricing are still being planned and will be published here',
        ],
      },
      {
        heading: 'Server: Community Server (free) and Enterprise Server (planned)',
        items: [
          'The same build output: a static site, no database, no server process',
          'Community Server is AGPL-3.0: deploy with docker-compose or any static server, zero outbound requests',
          'Enterprise Server licensing, maintenance terms and pricing are still being planned',
        ],
      },
    ],
    '/security/': [
      {
        heading: 'Where data is processed',
        items: [
          'The web app has no upload endpoint; files are processed in browser memory by Canvas / WebAssembly / JavaScript',
          'Processing a file produces no outbound requests — verify in the Network panel',
        ],
      },
      {
        heading: 'What the Content-Security-Policy blocks',
        items: [
          "default-src 'self': only assets from this origin may load",
          "connect-src 'self': network requests can only go back here, so third-party analytics cannot work",
          "script-src 'self' 'wasm-unsafe-eval': no inline scripts, no CDN scripts",
          'frame-ancestors none: the site cannot be framed by any other origin',
        ],
      },
      {
        heading: 'Auditable by you',
        items: [
          'Source is published under AGPL-3.0 — clone, review, build offline',
          'Dependencies are pinned in pnpm-lock.yaml, so you can generate an SBOM and verify versions and hashes',
          'Core dependencies are MIT / Apache-2.0 / MPL-2.0 with no viral GPL components',
        ],
      },
    ],
    '/privacy/': [
      {
        heading: 'Your files',
        items: [
          'Never uploaded: there is no upload endpoint; results are produced on your machine',
          'File names, contents and results never enter any log',
        ],
      },
      {
        heading: 'Local storage and analytics',
        items: [
          'localStorage holds interface settings, favourites, recents and unsaved drafts only',
          'Analytics is off by default; when enabled it reports event name, tool id, duration and interface language',
          'No cookies, no device fingerprinting; collection stops when DNT / GPC is set',
        ],
      },
    ],
    '/about/': [
      {
        heading: 'What it is',
        items: [
          'Everyday utilities gathered into one entry point with shared search, favourites and recents',
          'The web app is a static site; Desktop Community and Pro are the same UI offline; the server editions put that same build on your own hardware',
        ],
      },
      {
        heading: 'Licensing',
        items: [
          'Open source under AGPL-3.0-only: use, modify and self-host freely',
          'Closed-source and intranet deployments can take a commercial licence instead of the AGPL obligations',
        ],
      },
    ],
  },
  zh: {
    '/pricing/': [
      {
        heading: '网页版（免费）',
        items: [
          '全部工具不限次数使用，单文件处理无限制',
          '无需注册、无需安装，文件在浏览器内处理且不上传',
          '不加水印、不降精度、不设等待倒计时',
        ],
      },
      {
        heading: '桌面端：社区版（免费）与专业版（规划中）',
        items: [
          '社区版按 AGPL-3.0 提供：没有浏览器标签页内存上限，可完全离线运行',
          '以源码或安装包形式提供，可自行构建与改动，内部自用不受开源义务约束',
          '专业版的功能范围、授权方式与价格仍在规划中，确定后在定价页公布',
        ],
      },
      {
        heading: '服务器端：社区服务器版（免费）与企业服务器版（规划中）',
        items: [
          '同一份构建产物：纯静态站点，不需要数据库，也没有服务端进程',
          '社区服务器版按 AGPL-3.0 提供：docker-compose 或任意静态服务器自助部署，无外部请求',
          '企业服务器版的授权方式、维保条款与价格仍在规划中',
        ],
      },
    ],
    '/security/': [
      {
        heading: '数据在哪里处理',
        items: [
          '网页版没有上传接口，文件在浏览器内存中由 Canvas / WebAssembly / JavaScript 处理',
          '处理文件期间不产生任何出站请求，可在开发者工具 Network 面板验证',
        ],
      },
      {
        heading: '内容安全策略限制了哪些能力',
        items: [
          "default-src 'self'：只允许加载本站资源",
          "connect-src 'self'：网络请求只能回本站，第三方统计脚本无法工作",
          "script-src 'self' 'wasm-unsafe-eval'：禁止内联脚本与 CDN 脚本",
          'frame-ancestors none：不允许被任何站点用 iframe 嵌套',
        ],
      },
      {
        heading: '可自行审计',
        items: [
          '源码以 AGPL-3.0 公开，可克隆、审阅、离线构建',
          '依赖锁定在 pnpm-lock.yaml，可生成 SBOM 核对版本与哈希',
          '核心依赖为 MIT / Apache-2.0 / MPL-2.0，无 GPL 传染性依赖',
        ],
      },
    ],
    '/privacy/': [
      {
        heading: '你的文件',
        items: ['不会被上传：没有上传接口，处理结果在本机生成', '文件名、内容与结果不进入任何日志'],
      },
      {
        heading: '本机存储与统计',
        items: [
          'localStorage 只保存界面设置、收藏与最近使用、未保存草稿',
          '统计埋点默认关闭；启用后只上报事件名、工具 id、耗时与界面语言',
          '不使用 Cookie，不做设备指纹，DNT / GPC 生效时停止采集',
        ],
      },
    ],
    '/about/': [
      {
        heading: '这是什么',
        items: [
          '把日常零碎工具收拢到一个入口，统一搜索、收藏与最近使用',
          '网页版为纯静态站点；桌面社区版与专业版是同一套界面的离线形态；服务器版把同一份构建产物部署到自有机器或内网',
        ],
      },
      {
        heading: '许可',
        items: [
          'AGPL-3.0-only 开源，可自由使用、修改与自建',
          '闭源或内网场景可选择商业许可，免除 AGPL 义务',
        ],
      },
    ],
  },
};

/**
 * 预渲染正文骨架里的固定句子。
 *
 * 同样不进运行时：它们只出现在「JS 未执行」的那一版页面里，
 * 而那正是爬虫与极慢网络下的降级视图。
 */
export interface ShellText {
  homeH1: string;
  homeNote: string;
  toolNote: string;
  relatedHeading: string;
  allTools: string;
  downloadDesktop: string;
  staticNote: string;
  toolCountSuffix: string;
}

export const SHELL_TEXT: Record<SeoLang, ShellText> = {
  en: {
    homeH1: 'Online Toolkit',
    homeNote:
      'Every tool above computes locally in your browser; files and text are never uploaded. A desktop build is available for fully offline use.',
    toolNote:
      'This tool computes locally in your browser; input is never uploaded. A desktop build is available for offline use.',
    relatedHeading: 'Related tools',
    allTools: 'All tools',
    downloadDesktop: 'Download desktop',
    staticNote:
      'All SynTools utilities compute locally in your browser; files and text are never uploaded.',
    toolCountSuffix: 'tools',
  },
  zh: {
    homeH1: '在线工具集',
    homeNote:
      '以上全部工具默认在浏览器本地计算，文件与文本不会上传到服务器。可另下载桌面版，完全离线使用。',
    toolNote:
      '本工具默认在浏览器内本地计算，输入内容不会上传到服务器。若需要离线使用，可下载桌面版。',
    relatedHeading: '同类工具',
    allTools: '全部工具',
    downloadDesktop: '下载桌面版',
    staticNote: 'SynTools 的全部工具默认在浏览器本地计算，文件与文本不会上传到服务器。',
    toolCountSuffix: '个工具',
  },
};
