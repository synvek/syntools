import type { ShellResources } from '../types';

/** zh-TW 文案资源（外壳 + 工具元数据；`tools.*` 见 zh-TW.tools.ts） */
const zhTW = {
  app: {
    docTitle: 'SynTools · 在線工具集',
  },
  header: {
    openMenu: '打開選單',
    searchPlaceholder: '搜尋工具…',
    searchAria: '搜尋工具',
    themeAria: '切換主題',
    langAria: '切換語言',
    downloadAria: '下載桌面版',
    sourceAria: '源碼',
  },
  sidebar: {
    nav: '工具導航',
    closeMenu: '關閉選單',
    filter: '篩選工具',
    filterPlaceholder: '篩選…',
    filterEmpty: '無匹配工具',
    categoryActions: '分類操作',
    expandAll: '展開所有分類',
    collapseAll: '收合所有分類',
  },
  home: {
    title: '在線工具集',
    tagline: '預設本地計算、資料不出瀏覽器（CSP 零外發）· 按 <1>⌘K</1> 或 <3>/</3> 快速搜尋',
    favorites: '我的收藏',
    recent: '最近使用',
    favoriteAria: '收藏',
    unfavoriteAria: '取消收藏',
  },
  search: {
    aria: '搜尋工具',
    placeholder: '搜尋工具（名稱 / 關鍵詞）…',
    empty: '未找到匹配的工具',
  },
  categories: {
    file: '檔案工具',
    media: '影音',
    cheatsheet: '速查表',
    advanced: '文件與創作',
    encoding: '編碼轉換',
    text: '文本處理',
    formatting: '格式化',
    crypto: '加密哈希',
    datetime: '時間日期',
    generator: '生成器',
    network: '網路',
    image: '圖片處理',
    pdf: 'PDF 工具',
    other: '其他',
  },
  common: {
    copy: '復制',
    copied: '已復制',
    clear: '清空',
    discardConfirm: '目前文件尚未儲存，新建將捨棄目前內容，確定要新建嗎？',
    swap: '交換',
    newDoc: '新建文稿',
    saved: '已儲存至本機草稿',
    saving: '停止輸入後自動儲存',
    download: '下載',
    share: '分享',
    shareTooLong: '內容過長（超過 2KB），無法生成分享鏈接',
    retry: '重試',
    loading: '加載中',
    operation: '操作',
    encode: '編碼',
    decode: '解碼',
    result: '結果',
    rawText: '原始文本',
    input: '輸入',
    output: '輸出',
    text: '文本',
    file: '文件',
    remove: '移除',
    bytes: '{{size}} 字節',
  },
  io: {
    stats: '{{chars}} 字符 / {{bytes}} 字節',
    warnLarge: '輸入較大（> 500KB），實時計算可能變慢',
    overflow: '輸入已超過 5MB 上限，請使用文件模式處理大內容',
  },
  file: {
    hint: '拖拽文件到此處，或點擊選擇',
    max: '最大 {{size}}',
    over: '文件超出 {{max}} 上限（當前 {{size}}）',
    uploadAria: '上傳文件',
    previewAlt: '{{name}} 預覽',
    pages: '{{n}} 頁',
    encrypted: '已加密',
  },
  pdf: {
    password: 'PDF 密碼',
    passwordPlaceholder: '請輸入打開密碼',
    passwordHint: '此 PDF 已加密，請輸入密碼後繼續',
    unlock: '解鎖',
    errors: {
      NEED_PASSWORD: '此 PDF 已加密，請輸入密碼',
      WRONG_PASSWORD: '密碼錯誤，請重試',
    },
  },
  tool: {
    errorTitle: '工具運行出錯',
    localBadge: '本地處理',
    serverBadge: '需服務端',
    related: '相關工具',
    nextSteps: '下一步',
    openIn: '在 {{name}} 中打開',
    progress: '進度 {{current}} / {{total}}',
  },
  notFound: {
    message: '頁面或工具不存在',
    back: '返回首頁',
  },
  toolsMeta: {
    'code-editor': {
      name: '程式碼編輯器',
      description: '語法高亮可編輯程式碼，支援多語言格式化、10 種風格與原始碼 / HTML / 圖片匯出',
    },
    'video-convert': {
      name: '影片轉碼',
      description: 'WebCodecs 優先的影片轉碼（MP4 / WebM / MKV），不支援時自動回退 ffmpeg.wasm',
    },
    'video-to-gif': {
      name: '影片轉 GIF',
      description: '截取影片片段並產生 GIF 動圖（純前端，自製 GIF 編碼）',
    },
    'audio-convert': {
      name: '音訊轉碼',
      description:
        '音訊格式轉換：WAV（原生精修）與 MP3 / M4A / OGG / FLAC（WebCodecs 優先，回退 ffmpeg.wasm）',
    },
    'subtitle-tool': {
      name: '字幕轉換',
      description: 'SRT / WebVTT 字幕互轉，支援整體平移時間軸與逐條預覽',
    },
    'git-cheatsheet': {
      name: 'Git 命令速查',
      description: '按分類整理的常用 Git 命令速查表，支援搜尋',
    },
    'mime-types': {
      name: 'MIME 類型速查',
      description: '常見副檔名與 MIME 類型對照表，支援搜尋與反查',
    },
    'http-status': {
      name: 'HTTP 狀態碼速查',
      description: 'HTTP 狀態碼大全：分類、標準名稱與含義，支援搜尋',
    },
    'id-photo': {
      name: '證件照製作',
      description: '依 1 吋 / 2 吋 / 護照等標準尺寸裁切證件照，可設背景色與 DPI',
    },
    'image-grid-cut': {
      name: '圖片九宮格切圖',
      description: '將圖片按行列切分為多塊（九宮格 / 拼圖），逐塊下載',
    },
    'image-ascii': {
      name: '圖片轉 ASCII',
      description: '將圖片轉換為 ASCII 字元畫，支援多種字元集、寬度與反色',
    },
    'timezone-converter': {
      name: '時區轉換',
      description: '在多個 IANA 時區之間轉換時間，顯示本地時間與 UTC 偏移',
    },
    'tax-loan-calculator': {
      name: '貸款 / 個稅計算',
      description: '房貸等額本息 / 等額本金還款計畫與薪資個稅估算',
    },
    'unit-converter': {
      name: '單位換算',
      description: '長度 / 質量 / 面積 / 體積 / 溫度 / 速度 / 資料 / 時間 單位互轉',
    },
    'bulk-rename': {
      name: '批量重新命名',
      description: '依前後綴、尋找取代（支援正則）、編號、副檔名與大小寫規則批量產生新檔名',
    },
    'file-split-merge': {
      name: '檔案切分 / 合併',
      description: '將大檔案按大小或數量切分為多個分片，或按檔名順序合併還原',
    },
    'zip-manager': {
      name: 'ZIP 壓縮管理',
      description: '將多個檔案打包為 ZIP，或解壓檢視並下載 ZIP 內單一檔案（基於 JSZip）',
    },
    barcode: {
      name: '條碼產生器',
      description: '產生 Code 39 / Code 128 / EAN-13 條碼（SVG，純前端）',
    },
    'id-generator': {
      name: 'ID 產生器',
      description: '產生 ULID / NanoID / Snowflake / MongoDB ObjectId，支援批量',
    },
    'code-minify': {
      name: '程式碼壓縮',
      description: 'CSS / HTML / JS / JSON 壓縮（CSS 基於 csso，JS/HTML 為保守實作）',
    },
    'csv-tool': {
      name: 'CSV 工具',
      description: 'CSV ↔ JSON 互轉，支援自訂分隔符、表頭與引號轉義（RFC 4180）',
    },
    'key-converter': {
      name: '金鑰格式轉換',
      description: 'RSA 金鑰在 PEM / DER / JWK / OpenSSH 之間互轉（基於 WebCrypto）',
    },
    'rsa-crypto': {
      name: 'RSA 加解密',
      description: 'RSA-OAEP 加解密、RSA-PSS 簽名驗簽與金鑰對產生（基於 WebCrypto）',
    },
    'password-hash': {
      name: '口令雜湊 (PBKDF2)',
      description: '基於 WebCrypto 的 PBKDF2 口令派生雜湊，支援自訂鹽與迭代次數',
    },
    'password-strength': {
      name: '密碼強度檢測',
      description: '本地估算密碼強度：熵值、字元集覆蓋與常見弱模式提示',
    },
    checksum: {
      name: '校驗和',
      description: 'CRC-32 / Adler-32 / FNV-1a 校驗和計算（純前端，零依賴）',
    },
    'encoding-rescue': {
      name: '亂碼修復',
      description: '用 GBK / Big5 / Shift-JIS 等編碼重新解讀 UTF-8 誤讀產生的亂碼',
    },
    'escape-unescape': {
      name: '轉義 / 反轉義',
      description: 'JSON / JS / HTML / XML / URL 的轉義與反轉義',
    },
    'caesar-cipher': {
      name: '凱撒 / ROT13 / 柵欄',
      description: '凱撒密碼、ROT13、Atbash 與柵欄密碼的加密與解密',
    },
    'morse-code': {
      name: '摩斯電碼',
      description: '文字與摩斯電碼互轉，支援字母、數字與空格分詞',
    },
    'base-encoding': {
      name: 'Base 系列編碼',
      description: 'Base16/32/32Hex/58/64/64URL 編碼與解碼（純前端，零依賴）',
    },
    'pdf-compress': {
      name: 'PDF 壓縮',
      description: '壓縮 PDF：物件流無損壓縮，或逐頁重編碼為 JPEG 的有損壓縮',
    },
    'pdf-watermark': {
      name: 'PDF 浮水印',
      description: '為 PDF 加入文字浮水印，支援平鋪、旋轉、透明度與頁面範圍（本地執行）',
    },
    'pdf-decrypt': {
      name: 'PDF 移除密碼',
      description: '用密碼載入後匯出無保護 PDF（等同 qpdf --decrypt，純本地）',
    },
    'pdf-extract-text': {
      name: 'PDF 提取文字',
      description: '從 PDF 擷取所有頁面的可複製文字（本地執行，支援加密檔案）',
    },
    'random-port': {
      name: '隨機連接埠與位址生成',
      description: '產生隨機連接埠、內網 IPv4、MAC 與 IPv6（可去重與避開常見連接埠）',
    },
    'websocket-tester': {
      name: 'WebSocket 測試器',
      description: '連線 WebSocket 服務，收發文字 / 二進位訊息並檢視即時日誌',
    },
    'http-request': {
      name: 'HTTP 請求除錯器',
      description: '於瀏覽器內發送 HTTP 請求，檢視狀態碼、耗時、回應頭與正文（注意 CORS 限制）',
    },
    'http-headers': {
      name: '安全回應頭生成器',
      description:
        '產生 CSP / HSTS / Referrer-Policy 等安全回應頭（nginx / Apache / Express / Vercel）',
    },
    'ua-generator': {
      name: 'User-Agent 產生器',
      description: '依瀏覽器 / 系統組合產生 User-Agent，附常見 UA 庫',
    },
    'url-parser': {
      name: 'URL 解析器',
      description: '拆解 URL 的協定、主機、連接埠、路徑、查詢參數與錨點',
    },
    'mac-address': {
      name: 'MAC 位址工具',
      description: 'MAC 位址格式化、廠商（OUI）查詢、EUI-64 與隨機批量生成',
    },
    'ip-calc': {
      name: 'IP 計算器',
      description: 'IPv4/IPv6 位址、子網劃分（VLSM）、超網與萬用字元遮罩計算',
    },
    'flowchart-editor': {
      name: '流程圖編輯器',
      description: '本地繪製流程圖，支援節點連線、模板、自動排版與 PNG/SVG 匯出',
    },
    'mindmap-editor': {
      name: '心智圖編輯器',
      description:
        '本機繪製心智圖，支援鍵盤建立節點、摺疊分支、多種版面與主題，並可匯出 PNG/SVG/Markdown',
    },
    'photo-editor': {
      name: '照片編輯器',
      description: '瀏覽器本機多圖層修圖：圖層、選取、裁剪、調色濾鏡、畫筆文字，並可匯出專案檔續編',
    },
    base64: {
      name: 'Base64 編解碼',
      description: '文本與 Base64 互轉，Unicode 安全，支持 URL Safe 與文件模式',
    },
    'url-codec': {
      name: 'URL 編解碼',
      description: 'encodeURIComponent / encodeURI 兩種模式互轉，非法 % 序列報錯',
    },
    'regex-tester': {
      name: '正則表達式工具',
      description: '正則匹配高亮、替換、捕獲組表格、預設與語法速查',
    },
    'text-diff': {
      name: '文本對比',
      description: '左右編輯器行級 Diff 高亮與行號，支持忽略空白',
    },
    'json-format': {
      name: 'JSON 格式化',
      description: '格式化 / 壓縮 / 校驗，2/4 縮進可選，解析錯誤行列定位',
    },
    'json-convert': {
      name: 'JSON 轉換',
      description: '將 JSON 解析並轉換為 YAML / XML / CSV',
    },
    timestamp: {
      name: '時間戳轉換',
      description: 'Unix ⇄ 可讀時間，秒/毫秒自動識別，實時走秒與時區展示',
    },
    uuid: {
      name: 'UUID 生成器',
      description: 'v4 / v7 隨機 UUID，批量生成與大小寫、橫線、花括號格式選項',
    },
    hash: {
      name: '哈希計算',
      description: 'MD5 / SHA-1 / SHA-256 / SHA-512，支持文本與文件（流式），hex / base64 輸出',
    },
    'jwt-parser': {
      name: 'JWT 解析',
      description: '解析 header / payload / signature，讀取 exp 等時間聲明（只讀不驗簽）',
    },
    'aes-crypto': {
      name: 'AES 加解密',
      description: 'AES-GCM 加解密：口令 PBKDF2 或原始密鑰，輸出 base64(salt|iv|密文)',
    },
    hmac: {
      name: 'HMAC',
      description: 'HMAC-SHA256 / SHA512，hex / base64 輸出',
    },
    totp: {
      name: 'TOTP 動態口令',
      description: 'RFC 6238 TOTP：生成 / 校驗，6/8 位，剩余秒數',
    },
    'x509-decode': {
      name: 'X.509 證書解析',
      description: '解析 PEM：指紋 SHA-256/SHA-1、類型、DER 長度與 CN',
    },
    'cidr-calc': {
      name: 'CIDR 計算器',
      description: 'IPv4 CIDR：網路 / 廣播 / 主機范圍 / 掩碼 / 主機數',
    },
    'text-lines': {
      name: '文本行處理',
      description: '行排序 / 去重 / 反轉 / 編號 / 去空行',
    },
    'hex-codec': {
      name: 'Hex 編解碼',
      description: 'Hex ↔ UTF-8 文本，可選空格分隔',
    },
    'url-query': {
      name: 'URL Query 解析',
      description: '解析 URL 各部分與查詢參數，編輯後重建',
    },
    'json-path': {
      name: 'JSONPath 查詢',
      description: '簡易路徑查詢 a.b[0].c，提取 JSON 字段',
    },
    'gzip-tool': {
      name: 'Gzip 壓縮',
      description: '文本 Gzip 壓縮為 base64 / 解壓還原',
    },
    'exif-strip': {
      name: 'EXIF 清除',
      description: 'JPEG 讀取基礎 EXIF 並剝離 APP1，下載無 EXIF 文件',
    },
    'fake-data': {
      name: '假資料生成',
      description: '生成姓名 / 郵箱 / UUID / 段落，中英模板，1–50 條',
    },
    'password-gen': {
      name: '隨機密碼生成器',
      description: '高強度隨機密碼：長度 / 字符集可選，熵估算與強度分級',
    },
    'entity-codec': {
      name: 'HTML 編解碼',
      description: 'HTML 特殊字符編解碼：命名 / 十進制 / 十六進制 / \\u 轉義',
    },
    'cron-parser': {
      name: 'Cron 表達式解析',
      description: '校驗 Cron 表達式，字段含義解讀與未來執行時間預覽',
    },
    'convert-data': {
      name: '配置資料格式互轉',
      description: 'YAML ⇄ JSON ⇄ TOML 任意互轉，以 JS 值為中間態無損轉換',
    },
    'sql-format': {
      name: 'SQL 格式化',
      description: '多方言 SQL 美化：縮進 / 關鍵字大小寫可選',
    },
    'html-format': {
      name: 'HTML 壓縮 / 格式化',
      description: 'HTML 壓縮與美化，支持 2/4 空格縮進',
    },
    'js-format': {
      name: 'JS 壓縮 / 格式化',
      description: 'JavaScript 壓縮與美化，支持 2/4 空格縮進',
    },
    'css-format': {
      name: 'CSS 壓縮 / 格式化',
      description: 'CSS 壓縮與美化，支持 2/4 空格縮進',
    },
    'xml-format': {
      name: 'XML 格式化 / 壓縮',
      description: 'XML 美化與壓縮，支持 2/4 空格縮進，保留 CDATA',
    },
    'xml-json': {
      name: 'XML 轉 JSON',
      description: '將 XML 解析為 JSON，保留屬性（@_ 前綴）',
    },
    qrcode: {
      name: '二維碼',
      description: '文本生成二維碼 / 圖片識別二維碼，支持糾錯、尺寸、顏色與邊距',
    },
    'color-converter': {
      name: '顏色轉換',
      description: 'HEX / RGB / HSL 顏色格式互轉與預覽',
    },
    'radix-converter': {
      name: '進制轉換',
      description: '2/8/10/16 進制互轉與位運算可視化，支持 64 位有符號整數',
    },
    'markdown-preview': {
      name: 'Markdown 編輯器',
      description: '即時高亮編輯與預覽、大綱導覽、字數統計，支援開啟/儲存 .md 與匯出 HTML',
    },
    'image-compress': {
      name: '圖片壓縮',
      description: '純前端圖片壓縮與格式轉換（PNG / JPEG / WebP），支持縮放與質量調節',
    },
    'unicode-codec': {
      name: 'Unicode 編碼轉換',
      description: '文本與 \\uXXXX / 碼點 / HTML 實體 / UTF-8 字節互轉',
    },
    'html-color-picker': {
      name: 'HTML 取色器',
      description: '可視化取色，輸出 HEX / RGB / HSL 與 HTML/CSS 片段',
    },
    'web-color-table': {
      name: 'Web 顏色表',
      description: 'CSS 命名顏色對照表，支持分類篩選與復制名稱 / HEX / RGB',
    },
    pinyin: {
      name: '漢字轉拼音',
      description: '將漢字轉換為拼音，支持聲調、分隔符與大小寫',
    },
    'length-converter': {
      name: '長度單位轉換',
      description: '公制 / 英制長度單位互轉（mm、cm、m、km、in、ft 等）',
    },
    'zh-convert': {
      name: '繁體字轉換',
      description: '簡體與繁體中文互相轉換',
    },
    'weight-converter': {
      name: '重量單位轉換',
      description: '公制 / 英制重量單位互轉（mg、g、kg、t、oz、lb、st）',
    },
    'text-counter': {
      name: '字數統計',
      description: '統計字符、單詞、行數、段落、CJK 與 UTF-8 字節',
    },
    calendar: {
      name: '在線日歷',
      description: '月視圖：農歷/節日/休班/宜忌，英文本地假日',
    },
    'css-button': {
      name: 'CSS 按鈕生成器',
      description: '可視化調整樣式並生成按鈕 CSS / HTML 代碼',
    },
    'random-number': {
      name: '隨機數生成器',
      description: '指定范圍與數量生成隨機整數或小數，支持去重',
    },
    'random-string': {
      name: '隨機字符串生成器',
      description: '按長度與字符集批量生成隨機字符串（字母數字 / hex / 自定義）',
    },
    'doodle-board': {
      name: '在線涂鴉畫板',
      description:
        '瀏覽器畫板塗鴉：畫筆/螢光筆/橡皮、形狀與多邊形、吸管取色、移動與縮放、多格式匯出',
    },
    calculator: {
      name: '在線計算器',
      description: '安全表達式計算，支持四則運算、冪、取余與常用函數',
    },
    'code-image': {
      name: '代碼生成圖片',
      description: '將代碼渲染為帶語法高亮的卡片圖片並導出 PNG',
    },
    'image-color-picker': {
      name: '圖片取色器',
      description: '上傳圖片並點擊像素取色，輸出 HEX / RGB',
    },
    'ascii-table': {
      name: 'ASCII 表',
      description: 'ASCII 0–127 對照表，支持按十進制 / 十六進制 / 字符搜尋',
    },
    'image-watermark': {
      name: '圖片加水印',
      description: '為圖片添加文字水印，支持位置、透明度、旋轉與平鋪',
    },
    'case-convert': {
      name: '字母大小寫轉換',
      description: '大小寫、標題句式與 camel / snake / kebab 等命名風格互轉',
    },
    'bmi-calculator': {
      name: 'BMI 計算',
      description: '按身高體重計算 BMI，並按 WHO 成人標准分級',
    },
    'placeholder-image': {
      name: '在線佔位圖生成',
      description: '按尺寸與顏色生成佔位 PNG，可自定義文字',
    },
    'image-merge': {
      name: '在線圖片合並',
      description: '將多張圖片橫向 / 縱向 / 網格拼接為一張 PNG',
    },
    'cron-generator': {
      name: '在線 Crontab 生成',
      description: '可視化配置分/時/日/月/周字段，生成標准 5 段 Cron 表達式',
    },
    'ua-parser': {
      name: 'User-Agent 解析',
      description: '解析瀏覽器 User-Agent，識別瀏覽器、引擎、系統與設備',
    },
    'latex-editor': {
      name: 'LaTeX 數學公式編輯器',
      description: '快捷符號與經典公式，KaTeX 預覽，導出 PNG/JPG/SVG',
    },
    countdown: {
      name: '在線倒計時器',
      description: '設置時分秒倒計時，支持暫停、繼續與結束提示',
    },
    stopwatch: {
      name: '秒表',
      description: '在線秒表，支持開始、暫停、計圈與重置',
    },
    'svg-to-png': {
      name: '在線 SVG 轉 PNG',
      description: '將 SVG 代碼或文件轉換為 PNG，支持縮放與透明背景',
    },
    'image-frame': {
      name: '圖片邊框 / 圓角 / 陰影',
      description: '為圖片添加邊框、圓角與陰影效果並導出 PNG',
    },
    'image-adjust': {
      name: '在線圖片調色',
      description: '調整圖片亮度、對比度、飽和度與色相並導出 PNG',
    },
    'gif-frames': {
      name: '在線 GIF 拆幀',
      description: '將 GIF 動畫拆分為逐幀 PNG，可單幀或批量下載',
    },
    'image-crop': {
      name: '在線圖片裁剪',
      description: '按自由框或固定比例裁剪圖片並導出 PNG',
    },
    'mbti-test': {
      name: 'MBTI 在線性格測試',
      description: '24 題簡易 MBTI 測試，得出 16 型人格傾向（僅供娛樂參考）',
    },
    'text-card': {
      name: '文字轉卡片',
      description: '將標題與正文排版成精美卡片並導出 PNG',
    },
    'image-card': {
      name: '圖片轉卡片',
      description: '圖文一體卡片：標題/副標題、背景預設或漸變、照片旋轉並導出 PNG',
    },
    'code-highlight': {
      name: '代碼在線高亮',
      description: '多語言語法高亮預覽，支持行號與復制 HTML 片段',
    },
    'image-base64': {
      name: '圖片 ↔ Base64',
      description: '圖片與 Base64 / Data URL 互轉，本地完成',
    },
    'image-ico': {
      name: 'ICO 轉換',
      description: '圖片轉多尺寸 ICO（favicon），或從 ICO 提取 PNG',
    },
    'hsv-cmyk': {
      name: 'HSV / CMYK 轉換',
      description: 'RGB、HSV、CMYK、HEX 顏色空間互轉與預覽',
    },
    'ai-prompts': {
      name: 'AI 提示詞庫',
      description: '分類常用提示詞，支持搜尋與一鍵復制',
    },
    'md-mindmap': {
      name: 'Markdown 思維導圖',
      description: 'Markdown 轉思維導圖，多主題、縮放，導出 PNG/SVG',
    },
    'mermaid-editor': {
      name: 'Mermaid 在線繪圖',
      description: '本地渲染 Mermaid，多主題、縮放，導出 PNG/SVG',
    },
    'css-gradient': {
      name: 'CSS 漸變生成器',
      description: '可視化編輯 linear / radial 漸變，含分類預設與 CSS 復制',
    },
    'image-to-paper': {
      name: '圖片轉紙張 PDF',
      description: '將圖片按 A3/A4/A5/Letter 紙張適配並導出 PDF',
    },
    'md-to-image': {
      name: 'Markdown 轉圖片',
      description: '將 Markdown 渲染為卡片圖並導出 PNG，可調字體、字號、寬度與顏色',
    },
    'chart-generator': {
      name: '在線圖表生成器',
      description: 'CSV 生成柱狀/條形/折線/面積/餅/環/散點圖，含圖例、坐標軸與配色預設',
    },
    'css3-generator': {
      name: 'CSS3 代碼生成器',
      description: '可視化生成 border-radius、陰影、transform、filter 等 CSS3',
    },
    'xslt-transform': {
      name: 'XSLT 轉換',
      description: '用 XSLT 將 XML 轉換為 HTML，瀏覽器本地完成',
    },
    'rich-text-editor': {
      name: '文字處理器',
      description: '本地文字處理，支援匯入匯出 Word(.docx) 與兩種 PDF 匯出模式',
    },
    'slide-editor': {
      name: '投影片編輯器',
      description: '本機 Canvas 編輯投影片，支援 PPTX(.pptx) 匯入匯出與放映預覽',
    },
    'spreadsheet-editor': {
      name: '電子表格編輯器',
      description: '本地編輯表格並匯入匯出 Excel(.xlsx)，支援公式與多工作表',
    },
    'pdf-merge': {
      name: 'PDF 合並',
      description: '將多個 PDF 合並為一個文件',
    },
    'pdf-split': {
      name: 'PDF 拆分',
      description: '將 PDF 按頁拆分為多個文件',
    },
    'pdf-delete-pages': {
      name: 'PDF 刪除頁面',
      description: '刪除 PDF 中的指定頁面',
    },
    'pdf-extract-pages': {
      name: 'PDF 提取頁面',
      description: '從 PDF 中提取指定頁面',
    },
    'pdf-reorder': {
      name: 'PDF 頁面排序',
      description: '重新排列 PDF 頁面順序',
    },
    'pdf-rotate': {
      name: 'PDF 旋轉頁面',
      description: '旋轉 PDF 指定或全部頁面',
    },
    'pdf-to-image': {
      name: 'PDF 轉圖片',
      description: '將 PDF 頁面渲染為 JPG/PNG',
    },
    'images-to-pdf': {
      name: '圖片轉 PDF',
      description: '將多張圖片合成為 PDF',
    },
    'pdf-viewer': {
      name: 'PDF 在線閱讀',
      description: '本地打開並閱讀 PDF',
    },
    'pdf-page-numbers': {
      name: 'PDF 添加頁碼',
      description: '為 PDF 添加頁碼',
    },
    'pdf-header-footer': {
      name: 'PDF 頁眉頁腳',
      description: '為 PDF 添加頁眉與頁腳',
    },
    'pdf-insert-image': {
      name: 'PDF 插入圖片',
      description: '在 PDF 頁面上插入圖片',
    },
    'pdf-add-text': {
      name: 'PDF 添加文本',
      description: '在 PDF 頁面上添加文本',
    },
    'pdf-sign': {
      name: 'PDF 簽名',
      description: '手寫或上傳簽名圖（外觀簽名，非數字證書）',
    },
    'pdf-metadata': {
      name: 'PDF 元資料',
      description: '查看與編輯 PDF 元資料',
    },
    'pdf-encrypt': {
      name: 'PDF 加密保護',
      description: '為 PDF 設置密碼與操作權限',
    },
    'pdf-crop': {
      name: 'PDF 裁剪',
      description: '裁剪 PDF 頁面邊距（cropBox）',
    },
    'pdf-grayscale': {
      name: 'PDF 轉灰度',
      description: '將 PDF 轉為視覺灰度版（渲圖重打）',
    },
    'pdf-annotate': {
      name: 'PDF 標注',
      description: '在頁面上可視化繪制高亮、畫筆、形狀與文本',
    },
  },
} satisfies ShellResources;

export default zhTW;
