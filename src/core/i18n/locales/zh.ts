/** 简体中文文案资源（外壳 + 工具元数据；`tools.*` 见 zh.tools.ts） */
export default {
  app: {
    docTitle: 'SynTools · 在线工具集',
  },
  header: {
    openMenu: '打开菜单',
    searchPlaceholder: '搜索工具…',
    searchAria: '搜索工具',
    themeAria: '切换主题',
    langAria: '切换语言',
    downloadAria: '下载桌面版',
    sourceAria: '源码',
  },
  sidebar: {
    nav: '工具导航',
    closeMenu: '关闭菜单',
    filter: '筛选工具',
    filterPlaceholder: '筛选…',
    filterEmpty: '无匹配工具',
    categoryActions: '分类操作',
    expandAll: '展开所有分类',
    collapseAll: '收起所有分类',
  },
  home: {
    title: '在线工具集',
    tagline: '默认本地计算、数据不出浏览器（CSP 零外发）· 按 <1>⌘K</1> 或 <3>/</3> 快速搜索',
    favorites: '我的收藏',
    recent: '最近使用',
    favoriteAria: '收藏',
    unfavoriteAria: '取消收藏',
  },
  search: {
    aria: '搜索工具',
    placeholder: '搜索工具（名称 / 关键词）…',
    empty: '未找到匹配的工具',
  },
  categories: {
    file: '文件工具',
    media: '音视频',
    cheatsheet: '速查表',
    advanced: '文档与创作',
    encoding: '编码转换',
    text: '文本处理',
    formatting: '格式化',
    crypto: '加密哈希',
    datetime: '时间日期',
    generator: '生成器',
    network: '网络',
    image: '图片处理',
    pdf: 'PDF 工具',
    other: '其他',
  },
  common: {
    copy: '复制',
    copied: '已复制',
    clear: '清空',
    discardConfirm: '当前文档尚未保存，新建将丢弃当前内容，确定要新建吗？',
    swap: '交换',
    newDoc: '新建文稿',
    saved: '已保存到本地草稿',
    saving: '停止输入后自动保存',
    download: '下载',
    share: '分享',
    shareTooLong: '内容过长（超过 2KB），无法生成分享链接',
    retry: '重试',
    loading: '加载中',
    operation: '操作',
    encode: '编码',
    decode: '解码',
    result: '结果',
    rawText: '原始文本',
    input: '输入',
    output: '输出',
    text: '文本',
    file: '文件',
    remove: '移除',
    bytes: '{{size}} 字节',
  },
  io: {
    stats: '{{chars}} 字符 / {{bytes}} 字节',
    warnLarge: '输入较大（> 500KB），实时计算可能变慢',
    overflow: '输入已超过 5MB 上限，请使用文件模式处理大内容',
  },
  file: {
    hint: '拖拽文件到此处，或点击选择',
    max: '最大 {{size}}',
    over: '文件超出 {{max}} 上限（当前 {{size}}）',
    uploadAria: '上传文件',
    previewAlt: '{{name}} 预览',
    pages: '{{n}} 页',
    encrypted: '已加密',
  },
  pdf: {
    password: 'PDF 密码',
    passwordPlaceholder: '请输入打开密码',
    passwordHint: '此 PDF 已加密，请输入密码后继续',
    unlock: '解锁',
    errors: {
      NEED_PASSWORD: '此 PDF 已加密，请输入密码',
      WRONG_PASSWORD: '密码错误，请重试',
    },
  },
  tool: {
    errorTitle: '工具运行出错',
    localBadge: '本地处理',
    serverBadge: '需服务端',
    related: '相关工具',
    nextSteps: '下一步',
    openIn: '在 {{name}} 中打开',
    progress: '进度 {{current}} / {{total}}',
  },
  notFound: {
    message: '页面或工具不存在',
    back: '返回首页',
  },
  toolsMeta: {
    'code-editor': {
      name: '代码编辑器',
      description: '语法高亮可编辑代码，支持多语言格式化、10 套风格与源码 / HTML / 图片导出',
    },
    'video-convert': {
      name: '视频转码',
      description: 'WebCodecs 优先的视频转码（MP4 / WebM / MKV），不支持时自动回退 ffmpeg.wasm',
    },
    'video-to-gif': {
      name: '视频转 GIF',
      description: '截取视频片段并生成 GIF 动图（纯前端，自实现 GIF 编码，无需上传）',
    },
    'audio-convert': {
      name: '音频转码',
      description:
        '音频格式转换：WAV（原生精修）与 MP3 / M4A / OGG / FLAC（WebCodecs 优先，回退 ffmpeg.wasm）',
    },
    'subtitle-tool': {
      name: '字幕转换',
      description: 'SRT / WebVTT 字幕互转，支持整体平移时间轴与逐条预览',
    },
    'git-cheatsheet': {
      name: 'Git 命令速查',
      description: '按分类整理的常用 Git 命令速查表，支持搜索',
    },
    'mime-types': {
      name: 'MIME 类型速查',
      description: '常见文件扩展名与 MIME 类型对照表，支持搜索与反查',
    },
    'http-status': {
      name: 'HTTP 状态码速查',
      description: 'HTTP 状态码大全：分类、标准名称与含义，支持搜索',
    },
    'id-photo': {
      name: '证件照制作',
      description: '按 1 寸 / 2 寸 / 护照等标准尺寸裁剪证件照，可设背景色与 DPI',
    },
    'image-grid-cut': {
      name: '图片九宫格切图',
      description: '将图片按行列切分为多块（九宫格 / 拼图），逐块下载',
    },
    'image-ascii': {
      name: '图片转 ASCII',
      description: '将图片转换为 ASCII 字符画，支持多种字符集、宽度与反色',
    },
    'timezone-converter': {
      name: '时区转换',
      description: '在多个 IANA 时区之间转换时间，显示本地时间与 UTC 偏移',
    },
    'tax-loan-calculator': {
      name: '贷款 / 个税计算',
      description: '房贷等额本息 / 等额本金还款计划与工资薪金个税估算',
    },
    'unit-converter': {
      name: '单位换算',
      description: '长度 / 质量 / 面积 / 体积 / 温度 / 速度 / 数据 / 时间 单位互转',
    },
    'bulk-rename': {
      name: '批量重命名',
      description: '按前后缀、查找替换（支持正则）、编号、扩展名与大小写规则批量生成新文件名',
    },
    'file-split-merge': {
      name: '文件切分 / 合并',
      description: '将大文件按大小或数量切分为多个分片，或按文件名顺序合并分片还原',
    },
    'zip-manager': {
      name: 'ZIP 压缩管理',
      description: '将多个文件打包为 ZIP，或解压查看并下载 ZIP 内单个文件（基于 JSZip）',
    },
    barcode: {
      name: '条形码生成',
      description: '生成 Code 39 / Code 128 / EAN-13 条形码（SVG，纯前端）',
    },
    'id-generator': {
      name: 'ID 生成器',
      description: '生成 ULID / NanoID / Snowflake / MongoDB ObjectId，支持批量与解析',
    },
    'code-minify': {
      name: '代码压缩',
      description: 'CSS / HTML / JS / JSON 代码压缩（CSS 基于 csso，JS/HTML 为保守实现）',
    },
    'csv-tool': {
      name: 'CSV 工具',
      description: 'CSV ↔ JSON 互转，支持自定义分隔符、表头与引号转义（RFC 4180）',
    },
    'key-converter': {
      name: '密钥格式转换',
      description: 'RSA 密钥在 PEM / DER / JWK / OpenSSH 之间互转（基于 WebCrypto）',
    },
    'rsa-crypto': {
      name: 'RSA 加解密',
      description: 'RSA-OAEP 加解密、RSA-PSS 签名验签与密钥对生成（基于 WebCrypto）',
    },
    'password-hash': {
      name: '口令哈希 (PBKDF2)',
      description: '基于 WebCrypto 的 PBKDF2 口令派生哈希，支持自定义盐与迭代次数',
    },
    'password-strength': {
      name: '密码强度检测',
      description: '本地估算密码强度：熵值、字符集覆盖与常见弱模式提示',
    },
    checksum: {
      name: '校验和',
      description: 'CRC-32 / Adler-32 / FNV-1a 校验和计算（纯前端，零依赖）',
    },
    'encoding-rescue': {
      name: '乱码修复',
      description: '用 GBK / Big5 / Shift-JIS 等编码重新解读 UTF-8 误读产生的乱码',
    },
    'escape-unescape': {
      name: '转义 / 反转义',
      description: 'JSON / JS / HTML / XML / URL 的转义与反转义',
    },
    'caesar-cipher': {
      name: '凯撒 / ROT13 / 栅栏',
      description: '凯撒密码、ROT13、Atbash 与栅栏密码的加密与解密',
    },
    'morse-code': {
      name: '摩斯电码',
      description: '文本与摩斯电码互转，支持字母、数字与空格分词',
    },
    'base-encoding': {
      name: 'Base 系列编码',
      description: 'Base16/32/32Hex/58/64/64URL 编码与解码（纯前端，零依赖）',
    },
    'pdf-compress': {
      name: 'PDF 压缩',
      description: '压缩 PDF：对象流无损压缩，或逐页重编码为 JPEG 的有损压缩',
    },
    'pdf-watermark': {
      name: 'PDF 水印',
      description: '为 PDF 添加文字水印，支持平铺、旋转、透明度与页面范围（本地运行）',
    },
    'pdf-decrypt': {
      name: 'PDF 移除密码',
      description: '用密码加载后导出无保护 PDF（等效 qpdf --decrypt，纯本地）',
    },
    'pdf-extract-text': {
      name: 'PDF 提取文本',
      description: '从 PDF 中提取全部页面的可复制文本（本地运行，支持加密文件）',
    },
    'random-port': {
      name: '随机端口与地址生成',
      description: '生成随机端口、内网 IPv4、MAC 与 IPv6 地址（可选去重与避开常见端口）',
    },
    'websocket-tester': {
      name: 'WebSocket 测试器',
      description: '连接 WebSocket 服务，收发文本 / 二进制消息并查看实时日志',
    },
    'http-request': {
      name: 'HTTP 请求调试器',
      description: '浏览器内发起 HTTP 请求，查看状态码、耗时、响应头与正文（注意 CORS 限制）',
    },
    'http-headers': {
      name: '安全响应头生成器',
      description:
        '生成 CSP / HSTS / Referrer-Policy 等安全响应头（nginx / Apache / Express / Vercel）',
    },
    'ua-generator': {
      name: 'User-Agent 生成器',
      description: '按浏览器 / 系统组合生成 User-Agent，附常见 UA 库',
    },
    'url-parser': {
      name: 'URL 解析器',
      description: '拆解 URL 的协议、主机、端口、路径、查询参数与锚点',
    },
    'mac-address': {
      name: 'MAC 地址工具',
      description: 'MAC 地址格式化、厂商（OUI）查询、EUI-64 与随机批量生成',
    },
    'ip-calc': {
      name: 'IP 计算器',
      description: 'IPv4/IPv6 地址、子网划分（VLSM）、超网与通配符掩码计算',
    },
    'flowchart-editor': {
      name: '流程图编辑器',
      description: '本地绘制流程图，支持节点连线、模板、自动布局与 PNG/SVG 导出',
    },
    'mindmap-editor': {
      name: '脑图编辑器',
      description: '本地绘制思维导图，支持键盘建节点、折叠分支、多布局主题与 PNG/SVG/Markdown 导出',
    },
    'photo-editor': {
      name: '照片编辑器',
      description: '浏览器本地多图层修图：图层、选区、裁剪、调色滤镜、画笔文字与工程文件续编',
    },
    base64: {
      name: 'Base64 编解码',
      description: '文本与 Base64 互转，Unicode 安全，支持 URL Safe 与文件模式',
    },
    'url-codec': {
      name: 'URL 编解码',
      description: 'encodeURIComponent / encodeURI 两种模式互转，非法 % 序列报错',
    },
    'regex-tester': {
      name: '正则表达式工具',
      description: '正则匹配高亮、替换、捕获组表格、预设与语法速查',
    },
    'text-diff': {
      name: '文本对比',
      description: '左右编辑器行级 Diff 高亮与行号，支持忽略空白',
    },
    'json-format': {
      name: 'JSON 格式化',
      description: '格式化 / 压缩 / 校验，2/4 缩进可选，解析错误行列定位',
    },
    'json-convert': {
      name: 'JSON 转换',
      description: '将 JSON 解析并转换为 YAML / XML / CSV',
    },
    timestamp: {
      name: '时间戳转换',
      description: 'Unix ⇄ 可读时间，秒/毫秒自动识别，实时走秒与时区展示',
    },
    uuid: {
      name: 'UUID 生成器',
      description: 'v4 / v7 随机 UUID，批量生成与大小写、横线、花括号格式选项',
    },
    hash: {
      name: '哈希计算',
      description: 'MD5 / SHA-1 / SHA-256 / SHA-512，支持文本与文件（流式），hex / base64 输出',
    },
    'jwt-parser': {
      name: 'JWT 解析',
      description: '解析 header / payload / signature，读取 exp 等时间声明（只读不验签）',
    },
    'aes-crypto': {
      name: 'AES 加解密',
      description: 'AES-GCM 加解密：口令 PBKDF2 或原始密钥，输出 base64(salt|iv|密文)',
    },
    hmac: {
      name: 'HMAC',
      description: 'HMAC-SHA256 / SHA512，hex / base64 输出',
    },
    totp: {
      name: 'TOTP 动态口令',
      description: 'RFC 6238 TOTP：生成 / 校验，6/8 位，剩余秒数',
    },
    'x509-decode': {
      name: 'X.509 证书解析',
      description: '解析 PEM：指纹 SHA-256/SHA-1、类型、DER 长度与 CN',
    },
    'cidr-calc': {
      name: 'CIDR 计算器',
      description: 'IPv4 CIDR：网络 / 广播 / 主机范围 / 掩码 / 主机数',
    },
    'text-lines': {
      name: '文本行处理',
      description: '行排序 / 去重 / 反转 / 编号 / 去空行',
    },
    'hex-codec': {
      name: 'Hex 编解码',
      description: 'Hex ↔ UTF-8 文本，可选空格分隔',
    },
    'url-query': {
      name: 'URL Query 解析',
      description: '解析 URL 各部分与查询参数，编辑后重建',
    },
    'json-path': {
      name: 'JSONPath 查询',
      description: '简易路径查询 a.b[0].c，提取 JSON 字段',
    },
    'gzip-tool': {
      name: 'Gzip 压缩',
      description: '文本 Gzip 压缩为 base64 / 解压还原',
    },
    'exif-strip': {
      name: 'EXIF 清除',
      description: 'JPEG 读取基础 EXIF 并剥离 APP1，下载无 EXIF 文件',
    },
    'fake-data': {
      name: '假数据生成',
      description: '生成姓名 / 邮箱 / UUID / 段落，中英模板，1–50 条',
    },
    'password-gen': {
      name: '随机密码生成器',
      description: '高强度随机密码：长度 / 字符集可选，熵估算与强度分级',
    },
    'entity-codec': {
      name: 'HTML 编解码',
      description: 'HTML 特殊字符编解码：命名 / 十进制 / 十六进制 / \\u 转义',
    },
    'cron-parser': {
      name: 'Cron 表达式解析',
      description: '校验 Cron 表达式，字段含义解读与未来执行时间预览',
    },
    'convert-data': {
      name: '配置数据格式互转',
      description: 'YAML ⇄ JSON ⇄ TOML 任意互转，以 JS 值为中间态无损转换',
    },
    'sql-format': {
      name: 'SQL 格式化',
      description: '多方言 SQL 美化：缩进 / 关键字大小写可选',
    },
    'html-format': {
      name: 'HTML 压缩 / 格式化',
      description: 'HTML 压缩与美化，支持 2/4 空格缩进',
    },
    'js-format': {
      name: 'JS 压缩 / 格式化',
      description: 'JavaScript 压缩与美化，支持 2/4 空格缩进',
    },
    'css-format': {
      name: 'CSS 压缩 / 格式化',
      description: 'CSS 压缩与美化，支持 2/4 空格缩进',
    },
    'xml-format': {
      name: 'XML 格式化 / 压缩',
      description: 'XML 美化与压缩，支持 2/4 空格缩进，保留 CDATA',
    },
    'xml-json': {
      name: 'XML 转 JSON',
      description: '将 XML 解析为 JSON，保留属性（@_ 前缀）',
    },
    qrcode: {
      name: '二维码',
      description: '文本生成二维码 / 图片识别二维码，支持纠错、尺寸、颜色与边距',
    },
    'color-converter': {
      name: '颜色转换',
      description: 'HEX / RGB / HSL 颜色格式互转与预览',
    },
    'radix-converter': {
      name: '进制转换',
      description: '2/8/10/16 进制互转与位运算可视化，支持 64 位有符号整数',
    },
    'markdown-preview': {
      name: 'Markdown 编辑器',
      description: '实时高亮编辑与预览、大纲导航、字数统计，支持打开/保存 .md 与导出 HTML',
    },
    'image-compress': {
      name: '图片压缩',
      description: '纯前端图片压缩与格式转换（PNG / JPEG / WebP），支持缩放与质量调节',
    },
    'unicode-codec': {
      name: 'Unicode 编码转换',
      description: '文本与 \\uXXXX / 码点 / HTML 实体 / UTF-8 字节互转',
    },
    'html-color-picker': {
      name: 'HTML 取色器',
      description: '可视化取色，输出 HEX / RGB / HSL 与 HTML/CSS 片段',
    },
    'web-color-table': {
      name: 'Web 颜色表',
      description: 'CSS 命名颜色对照表，支持分类筛选与复制名称 / HEX / RGB',
    },
    pinyin: {
      name: '汉字转拼音',
      description: '将汉字转换为拼音，支持声调、分隔符与大小写',
    },
    'length-converter': {
      name: '长度单位转换',
      description: '公制 / 英制长度单位互转（mm、cm、m、km、in、ft 等）',
    },
    'zh-convert': {
      name: '繁体字转换',
      description: '简体与繁体中文互相转换',
    },
    'weight-converter': {
      name: '重量单位转换',
      description: '公制 / 英制重量单位互转（mg、g、kg、t、oz、lb、st）',
    },
    'text-counter': {
      name: '字数统计',
      description: '统计字符、单词、行数、段落、CJK 与 UTF-8 字节',
    },
    calendar: {
      name: '在线日历',
      description: '月视图：农历/节日/休班/宜忌，英文本地假日',
    },
    'css-button': {
      name: 'CSS 按钮生成器',
      description: '可视化调整样式并生成按钮 CSS / HTML 代码',
    },
    'random-number': {
      name: '随机数生成器',
      description: '指定范围与数量生成随机整数或小数，支持去重',
    },
    'random-string': {
      name: '随机字符串生成器',
      description: '按长度与字符集批量生成随机字符串（字母数字 / hex / 自定义）',
    },
    'doodle-board': {
      name: '在线涂鸦画板',
      description:
        '浏览器画板涂鸦：画笔/荧光笔/橡皮、形状与多边形、吸管取色、移动与缩放、多格式导出',
    },
    calculator: {
      name: '在线计算器',
      description: '安全表达式计算，支持四则运算、幂、取余与常用函数',
    },
    'code-image': {
      name: '代码生成图片',
      description: '将代码渲染为带语法高亮的卡片图片并导出 PNG',
    },
    'image-color-picker': {
      name: '图片取色器',
      description: '上传图片并点击像素取色，输出 HEX / RGB',
    },
    'ascii-table': {
      name: 'ASCII 表',
      description: 'ASCII 0–127 对照表，支持按十进制 / 十六进制 / 字符搜索',
    },
    'image-watermark': {
      name: '图片加水印',
      description: '为图片添加文字水印，支持位置、透明度、旋转与平铺',
    },
    'case-convert': {
      name: '字母大小写转换',
      description: '大小写、标题句式与 camel / snake / kebab 等命名风格互转',
    },
    'bmi-calculator': {
      name: 'BMI 计算',
      description: '按身高体重计算 BMI，并按 WHO 成人标准分级',
    },
    'placeholder-image': {
      name: '在线占位图生成',
      description: '按尺寸与颜色生成占位 PNG，可自定义文字',
    },
    'image-merge': {
      name: '在线图片合并',
      description: '将多张图片横向 / 纵向 / 网格拼接为一张 PNG',
    },
    'cron-generator': {
      name: '在线 Crontab 生成',
      description: '可视化配置分/时/日/月/周字段，生成标准 5 段 Cron 表达式',
    },
    'ua-parser': {
      name: 'User-Agent 解析',
      description: '解析浏览器 User-Agent，识别浏览器、引擎、系统与设备',
    },
    'latex-editor': {
      name: 'LaTeX 数学公式编辑器',
      description: '快捷符号与经典公式，KaTeX 预览，导出 PNG/JPG/SVG',
    },
    countdown: {
      name: '在线倒计时器',
      description: '设置时分秒倒计时，支持暂停、继续与结束提示',
    },
    stopwatch: {
      name: '秒表',
      description: '在线秒表，支持开始、暂停、计圈与重置',
    },
    'svg-to-png': {
      name: '在线 SVG 转 PNG',
      description: '将 SVG 代码或文件转换为 PNG，支持缩放与透明背景',
    },
    'image-frame': {
      name: '图片边框 / 圆角 / 阴影',
      description: '为图片添加边框、圆角与阴影效果并导出 PNG',
    },
    'image-adjust': {
      name: '在线图片调色',
      description: '调整图片亮度、对比度、饱和度与色相并导出 PNG',
    },
    'gif-frames': {
      name: '在线 GIF 拆帧',
      description: '将 GIF 动画拆分为逐帧 PNG，可单帧或批量下载',
    },
    'image-crop': {
      name: '在线图片裁剪',
      description: '按自由框或固定比例裁剪图片并导出 PNG',
    },
    'mbti-test': {
      name: 'MBTI 在线性格测试',
      description: '24 题简易 MBTI 测试，得出 16 型人格倾向（仅供娱乐参考）',
    },
    'text-card': {
      name: '文字转卡片',
      description: '将标题与正文排版成精美卡片并导出 PNG',
    },
    'image-card': {
      name: '图片转卡片',
      description: '图文一体卡片：标题/副标题、背景预设或渐变、照片旋转并导出 PNG',
    },
    'code-highlight': {
      name: '代码在线高亮',
      description: '多语言语法高亮预览，支持行号与复制 HTML 片段',
    },
    'image-base64': {
      name: '图片 ↔ Base64',
      description: '图片与 Base64 / Data URL 互转，本地完成',
    },
    'image-ico': {
      name: 'ICO 转换',
      description: '图片转多尺寸 ICO（favicon），或从 ICO 提取 PNG',
    },
    'hsv-cmyk': {
      name: 'HSV / CMYK 转换',
      description: 'RGB、HSV、CMYK、HEX 颜色空间互转与预览',
    },
    'ai-prompts': {
      name: 'AI 提示词库',
      description: '分类常用提示词，支持搜索与一键复制',
    },
    'md-mindmap': {
      name: 'Markdown 思维导图',
      description: 'Markdown 转思维导图，多主题、缩放，导出 PNG/SVG',
    },
    'mermaid-editor': {
      name: 'Mermaid 在线绘图',
      description: '本地渲染 Mermaid，多主题、缩放，导出 PNG/SVG',
    },
    'css-gradient': {
      name: 'CSS 渐变生成器',
      description: '可视化编辑 linear / radial 渐变，含分类预设与 CSS 复制',
    },
    'image-to-paper': {
      name: '图片转纸张 PDF',
      description: '将图片按 A3/A4/A5/Letter 纸张适配并导出 PDF',
    },
    'md-to-image': {
      name: 'Markdown 转图片',
      description: '将 Markdown 渲染为卡片图并导出 PNG，可调字体、字号、宽度与颜色',
    },
    'chart-generator': {
      name: '在线图表生成器',
      description: 'CSV 生成柱状/条形/折线/面积/饼/环/散点图，含图例、坐标轴与配色预设',
    },
    'css3-generator': {
      name: 'CSS3 代码生成器',
      description: '可视化生成 border-radius、阴影、transform、filter 等 CSS3',
    },
    'xslt-transform': {
      name: 'XSLT 转换',
      description: '用 XSLT 将 XML 转换为 HTML，浏览器本地完成',
    },
    'rich-text-editor': {
      name: '文字处理器',
      description: '本地文字处理，支持导入导出 Word(.docx) 与两种模式导出 PDF',
    },
    'slide-editor': {
      name: '幻灯片编辑器',
      description: '本地编辑幻灯片，支持 PPTX(.pptx) 导入导出与放映',
    },
    'spreadsheet-editor': {
      name: '电子表格编辑器',
      description: '本地编辑表格并导入导出 Excel(.xlsx)，支持公式与多工作表',
    },
    'pdf-merge': { name: 'PDF 合并', description: '将多个 PDF 合并为一个文件' },
    'pdf-split': { name: 'PDF 拆分', description: '将 PDF 按页拆分为多个文件' },
    'pdf-delete-pages': { name: 'PDF 删除页面', description: '删除 PDF 中的指定页面' },
    'pdf-extract-pages': { name: 'PDF 提取页面', description: '从 PDF 中提取指定页面' },
    'pdf-reorder': { name: 'PDF 页面排序', description: '重新排列 PDF 页面顺序' },
    'pdf-rotate': { name: 'PDF 旋转页面', description: '旋转 PDF 指定或全部页面' },
    'pdf-to-image': { name: 'PDF 转图片', description: '将 PDF 页面渲染为 JPG/PNG' },
    'images-to-pdf': { name: '图片转 PDF', description: '将多张图片合成为 PDF' },
    'pdf-viewer': { name: 'PDF 在线阅读', description: '本地打开并阅读 PDF' },
    'pdf-page-numbers': { name: 'PDF 添加页码', description: '为 PDF 添加页码' },
    'pdf-header-footer': { name: 'PDF 页眉页脚', description: '为 PDF 添加页眉与页脚' },
    'pdf-insert-image': { name: 'PDF 插入图片', description: '在 PDF 页面上插入图片' },
    'pdf-add-text': { name: 'PDF 添加文本', description: '在 PDF 页面上添加文本' },
    'pdf-sign': { name: 'PDF 签名', description: '手写或上传签名图（外观签名，非数字证书）' },
    'pdf-metadata': { name: 'PDF 元数据', description: '查看与编辑 PDF 元数据' },
    'pdf-encrypt': { name: 'PDF 加密保护', description: '为 PDF 设置密码与操作权限' },
    'pdf-crop': { name: 'PDF 裁剪', description: '裁剪 PDF 页面边距（cropBox）' },
    'pdf-grayscale': { name: 'PDF 转灰度', description: '将 PDF 转为视觉灰度版（渲图重打）' },
    'pdf-annotate': { name: 'PDF 标注', description: '在页面上可视化绘制高亮、画笔、形状与文本' },
  },
};
