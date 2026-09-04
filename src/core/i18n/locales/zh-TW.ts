import type { TranslationResources } from '../types';

/** Traditional Chinese — generated from zh (tify + TW phrase tweaks) */
const zhTW = {
  "app": {
    "docTitle": "SynTools · 開發者在線工具集"
  },
  "header": {
    "openMenu": "打開選單",
    "searchPlaceholder": "搜尋工具…",
    "searchAria": "搜尋工具",
    "themeAria": "切換主題",
    "langAria": "切換語言",
    "sourceAria": "源碼"
  },
  "sidebar": {
    "nav": "工具導航",
    "closeMenu": "關閉選單",
    "filter": "篩選工具",
    "filterPlaceholder": "篩選…",
    "filterEmpty": "無匹配工具"
  },
  "home": {
    "title": "開發者在線工具集",
    "tagline": "預設本地計算、資料不出瀏覽器（CSP 零外發）· 按 <1>⌘K</1> 或 <3>/</3> 快速搜尋",
    "favorites": "我的收藏",
    "recent": "最近使用",
    "favoriteAria": "收藏",
    "unfavoriteAria": "取消收藏"
  },
  "search": {
    "aria": "搜尋工具",
    "placeholder": "搜尋工具（名稱 / 關鍵詞）…",
    "empty": "未找到匹配的工具"
  },
  "categories": {
    "encoding": "編碼轉換",
    "text": "文本處理",
    "formatting": "格式化",
    "crypto": "加密哈希",
    "datetime": "時間日期",
    "generator": "生成器",
    "network": "網路",
    "image": "圖片處理",
    "pdf": "PDF 工具",
    "other": "其他"
  },
  "common": {
    "copy": "復制",
    "copied": "已復制",
    "clear": "清空",
    "swap": "交換",
    "download": "下載",
    "share": "分享",
    "shareTooLong": "內容過長（超過 2KB），無法生成分享鏈接",
    "retry": "重試",
    "loading": "加載中",
    "operation": "操作",
    "encode": "編碼",
    "decode": "解碼",
    "result": "結果",
    "rawText": "原始文本",
    "input": "輸入",
    "output": "輸出",
    "text": "文本",
    "file": "文件",
    "remove": "移除",
    "bytes": "{{size}} 字節"
  },
  "io": {
    "stats": "{{chars}} 字符 / {{bytes}} 字節",
    "warnLarge": "輸入較大（> 500KB），實時計算可能變慢",
    "overflow": "輸入已超過 5MB 上限，請使用文件模式處理大內容"
  },
  "file": {
    "hint": "拖拽文件到此處，或點擊選擇",
    "max": "最大 {{size}}",
    "over": "文件超出 {{max}} 上限（當前 {{size}}）",
    "uploadAria": "上傳文件",
    "previewAlt": "{{name}} 預覽",
    "pages": "{{n}} 頁",
    "encrypted": "已加密"
  },
  "pdf": {
    "password": "PDF 密碼",
    "passwordPlaceholder": "請輸入打開密碼",
    "passwordHint": "此 PDF 已加密，請輸入密碼後繼續",
    "unlock": "解鎖",
    "errors": {
      "NEED_PASSWORD": "此 PDF 已加密，請輸入密碼",
      "WRONG_PASSWORD": "密碼錯誤，請重試"
    }
  },
  "tool": {
    "errorTitle": "工具運行出錯",
    "localBadge": "本地處理",
    "serverBadge": "需服務端",
    "related": "相關工具",
    "nextSteps": "下一步",
    "openIn": "在 {{name}} 中打開",
    "progress": "進度 {{current}} / {{total}}"
  },
  "notFound": {
    "message": "頁面或工具不存在",
    "back": "返回首頁"
  },
  "toolsMeta": {
    "base64": {
      "name": "Base64 編解碼",
      "description": "文本與 Base64 互轉，Unicode 安全，支持 URL Safe 與文件模式"
    },
    "url-codec": {
      "name": "URL 編解碼",
      "description": "encodeURIComponent / encodeURI 兩種模式互轉，非法 % 序列報錯"
    },
    "regex-tester": {
      "name": "正則表達式工具",
      "description": "正則匹配高亮、替換、捕獲組表格、預設與語法速查"
    },
    "text-diff": {
      "name": "文本對比",
      "description": "左右編輯器行級 Diff 高亮與行號，支持忽略空白"
    },
    "json-format": {
      "name": "JSON 格式化",
      "description": "格式化 / 壓縮 / 校驗，2/4 縮進可選，解析錯誤行列定位"
    },
    "json-convert": {
      "name": "JSON 轉換",
      "description": "將 JSON 解析並轉換為 YAML / XML / CSV"
    },
    "timestamp": {
      "name": "時間戳轉換",
      "description": "Unix ⇄ 可讀時間，秒/毫秒自動識別，實時走秒與時區展示"
    },
    "uuid": {
      "name": "UUID 生成器",
      "description": "v4 / v7 隨機 UUID，批量生成與大小寫、橫線、花括號格式選項"
    },
    "hash": {
      "name": "哈希計算",
      "description": "MD5 / SHA-1 / SHA-256 / SHA-512，支持文本與文件（流式），hex / base64 輸出"
    },
    "jwt-parser": {
      "name": "JWT 解析",
      "description": "解析 header / payload / signature，讀取 exp 等時間聲明（只讀不驗簽）"
    },
    "aes-crypto": {
      "name": "AES 加解密",
      "description": "AES-GCM 加解密：口令 PBKDF2 或原始密鑰，輸出 base64(salt|iv|密文)"
    },
    "hmac": {
      "name": "HMAC",
      "description": "HMAC-SHA256 / SHA512，hex / base64 輸出"
    },
    "totp": {
      "name": "TOTP 動態口令",
      "description": "RFC 6238 TOTP：生成 / 校驗，6/8 位，剩余秒數"
    },
    "x509-decode": {
      "name": "X.509 證書解析",
      "description": "解析 PEM：指紋 SHA-256/SHA-1、類型、DER 長度與 CN"
    },
    "cidr-calc": {
      "name": "CIDR 計算器",
      "description": "IPv4 CIDR：網路 / 廣播 / 主機范圍 / 掩碼 / 主機數"
    },
    "text-lines": {
      "name": "文本行處理",
      "description": "行排序 / 去重 / 反轉 / 編號 / 去空行"
    },
    "hex-codec": {
      "name": "Hex 編解碼",
      "description": "Hex ↔ UTF-8 文本，可選空格分隔"
    },
    "url-query": {
      "name": "URL Query 解析",
      "description": "解析 URL 各部分與查詢參數，編輯後重建"
    },
    "json-path": {
      "name": "JSONPath 查詢",
      "description": "簡易路徑查詢 a.b[0].c，提取 JSON 字段"
    },
    "gzip-tool": {
      "name": "Gzip 壓縮",
      "description": "文本 Gzip 壓縮為 base64 / 解壓還原"
    },
    "exif-strip": {
      "name": "EXIF 清除",
      "description": "JPEG 讀取基礎 EXIF 並剝離 APP1，下載無 EXIF 文件"
    },
    "fake-data": {
      "name": "假資料生成",
      "description": "生成姓名 / 郵箱 / UUID / 段落，中英模板，1–50 條"
    },
    "password-gen": {
      "name": "隨機密碼生成器",
      "description": "高強度隨機密碼：長度 / 字符集可選，熵估算與強度分級"
    },
    "entity-codec": {
      "name": "HTML 編解碼",
      "description": "HTML 特殊字符編解碼：命名 / 十進制 / 十六進制 / \\u 轉義"
    },
    "cron-parser": {
      "name": "Cron 表達式解析",
      "description": "校驗 Cron 表達式，字段含義解讀與未來執行時間預覽"
    },
    "convert-data": {
      "name": "配置資料格式互轉",
      "description": "YAML ⇄ JSON ⇄ TOML 任意互轉，以 JS 值為中間態無損轉換"
    },
    "sql-format": {
      "name": "SQL 格式化",
      "description": "多方言 SQL 美化：縮進 / 關鍵字大小寫可選"
    },
    "html-format": {
      "name": "HTML 壓縮 / 格式化",
      "description": "HTML 壓縮與美化，支持 2/4 空格縮進"
    },
    "js-format": {
      "name": "JS 壓縮 / 格式化",
      "description": "JavaScript 壓縮與美化，支持 2/4 空格縮進"
    },
    "css-format": {
      "name": "CSS 壓縮 / 格式化",
      "description": "CSS 壓縮與美化，支持 2/4 空格縮進"
    },
    "xml-format": {
      "name": "XML 格式化 / 壓縮",
      "description": "XML 美化與壓縮，支持 2/4 空格縮進，保留 CDATA"
    },
    "xml-json": {
      "name": "XML 轉 JSON",
      "description": "將 XML 解析為 JSON，保留屬性（@_ 前綴）"
    },
    "qrcode": {
      "name": "二維碼",
      "description": "文本生成二維碼 / 圖片識別二維碼，支持糾錯、尺寸、顏色與邊距"
    },
    "color-converter": {
      "name": "顏色轉換",
      "description": "HEX / RGB / HSL 顏色格式互轉與預覽"
    },
    "radix-converter": {
      "name": "進制轉換",
      "description": "2/8/10/16 進制互轉與位運算可視化，支持 64 位有符號整數"
    },
    "markdown-preview": {
      "name": "Markdown 預覽",
      "description": "GFM 實時渲染，輸出經 DOMPurify 消毒，安全預覽"
    },
    "image-compress": {
      "name": "圖片壓縮",
      "description": "純前端圖片壓縮與格式轉換（PNG / JPEG / WebP），支持縮放與質量調節"
    },
    "unicode-codec": {
      "name": "Unicode 編碼轉換",
      "description": "文本與 \\uXXXX / 碼點 / HTML 實體 / UTF-8 字節互轉"
    },
    "html-color-picker": {
      "name": "HTML 取色器",
      "description": "可視化取色，輸出 HEX / RGB / HSL 與 HTML/CSS 片段"
    },
    "web-color-table": {
      "name": "Web 顏色表",
      "description": "CSS 命名顏色對照表，支持分類篩選與復制名稱 / HEX / RGB"
    },
    "pinyin": {
      "name": "漢字轉拼音",
      "description": "將漢字轉換為拼音，支持聲調、分隔符與大小寫"
    },
    "length-converter": {
      "name": "長度單位轉換",
      "description": "公制 / 英制長度單位互轉（mm、cm、m、km、in、ft 等）"
    },
    "zh-convert": {
      "name": "繁體字轉換",
      "description": "簡體與繁體中文互相轉換"
    },
    "weight-converter": {
      "name": "重量單位轉換",
      "description": "公制 / 英制重量單位互轉（mg、g、kg、t、oz、lb、st）"
    },
    "text-counter": {
      "name": "字數統計",
      "description": "統計字符、單詞、行數、段落、CJK 與 UTF-8 字節"
    },
    "calendar": {
      "name": "在線日歷",
      "description": "月視圖：農歷/節日/休班/宜忌，英文本地假日"
    },
    "css-button": {
      "name": "CSS 按鈕生成器",
      "description": "可視化調整樣式並生成按鈕 CSS / HTML 代碼"
    },
    "random-number": {
      "name": "隨機數生成器",
      "description": "指定范圍與數量生成隨機整數或小數，支持去重"
    },
    "random-string": {
      "name": "隨機字符串生成器",
      "description": "按長度與字符集批量生成隨機字符串（字母數字 / hex / 自定義）"
    },
    "doodle-board": {
      "name": "在線涂鴉畫板",
      "description": "瀏覽器畫板涂鴉，支持畫筆、橡皮與導出 PNG"
    },
    "calculator": {
      "name": "在線計算器",
      "description": "安全表達式計算，支持四則運算、冪、取余與常用函數"
    },
    "code-image": {
      "name": "代碼生成圖片",
      "description": "將代碼渲染為帶語法高亮的卡片圖片並導出 PNG"
    },
    "image-color-picker": {
      "name": "圖片取色器",
      "description": "上傳圖片並點擊像素取色，輸出 HEX / RGB"
    },
    "ascii-table": {
      "name": "ASCII 表",
      "description": "ASCII 0–127 對照表，支持按十進制 / 十六進制 / 字符搜尋"
    },
    "image-watermark": {
      "name": "圖片加水印",
      "description": "為圖片添加文字水印，支持位置、透明度、旋轉與平鋪"
    },
    "case-convert": {
      "name": "字母大小寫轉換",
      "description": "大小寫、標題句式與 camel / snake / kebab 等命名風格互轉"
    },
    "bmi-calculator": {
      "name": "BMI 計算",
      "description": "按身高體重計算 BMI，並按 WHO 成人標准分級"
    },
    "placeholder-image": {
      "name": "在線佔位圖生成",
      "description": "按尺寸與顏色生成佔位 PNG，可自定義文字"
    },
    "image-merge": {
      "name": "在線圖片合並",
      "description": "將多張圖片橫向 / 縱向 / 網格拼接為一張 PNG"
    },
    "cron-generator": {
      "name": "在線 Crontab 生成",
      "description": "可視化配置分/時/日/月/周字段，生成標准 5 段 Cron 表達式"
    },
    "ua-parser": {
      "name": "User-Agent 解析",
      "description": "解析瀏覽器 User-Agent，識別瀏覽器、引擎、系統與設備"
    },
    "latex-editor": {
      "name": "LaTeX 數學公式編輯器",
      "description": "快捷符號與經典公式，KaTeX 預覽，導出 PNG/JPG/SVG"
    },
    "countdown": {
      "name": "在線倒計時器",
      "description": "設置時分秒倒計時，支持暫停、繼續與結束提示"
    },
    "stopwatch": {
      "name": "秒表",
      "description": "在線秒表，支持開始、暫停、計圈與重置"
    },
    "svg-to-png": {
      "name": "在線 SVG 轉 PNG",
      "description": "將 SVG 代碼或文件轉換為 PNG，支持縮放與透明背景"
    },
    "image-frame": {
      "name": "圖片邊框 / 圓角 / 陰影",
      "description": "為圖片添加邊框、圓角與陰影效果並導出 PNG"
    },
    "image-adjust": {
      "name": "在線圖片調色",
      "description": "調整圖片亮度、對比度、飽和度與色相並導出 PNG"
    },
    "gif-frames": {
      "name": "在線 GIF 拆幀",
      "description": "將 GIF 動畫拆分為逐幀 PNG，可單幀或批量下載"
    },
    "image-crop": {
      "name": "在線圖片裁剪",
      "description": "按自由框或固定比例裁剪圖片並導出 PNG"
    },
    "mbti-test": {
      "name": "MBTI 在線性格測試",
      "description": "24 題簡易 MBTI 測試，得出 16 型人格傾向（僅供娛樂參考）"
    },
    "text-card": {
      "name": "文字轉卡片",
      "description": "將標題與正文排版成精美卡片並導出 PNG"
    },
    "image-card": {
      "name": "圖片轉卡片",
      "description": "圖文一體卡片：標題/副標題、背景預設或漸變、照片旋轉並導出 PNG"
    },
    "code-highlight": {
      "name": "代碼在線高亮",
      "description": "多語言語法高亮預覽，支持行號與復制 HTML 片段"
    },
    "image-base64": {
      "name": "圖片 ↔ Base64",
      "description": "圖片與 Base64 / Data URL 互轉，本地完成"
    },
    "image-ico": {
      "name": "ICO 轉換",
      "description": "圖片轉多尺寸 ICO（favicon），或從 ICO 提取 PNG"
    },
    "hsv-cmyk": {
      "name": "HSV / CMYK 轉換",
      "description": "RGB、HSV、CMYK、HEX 顏色空間互轉與預覽"
    },
    "ai-prompts": {
      "name": "AI 提示詞庫",
      "description": "分類常用提示詞，支持搜尋與一鍵復制"
    },
    "md-mindmap": {
      "name": "Markdown 思維導圖",
      "description": "Markdown 轉思維導圖，多主題、縮放，導出 PNG/SVG"
    },
    "mermaid-editor": {
      "name": "Mermaid 在線繪圖",
      "description": "本地渲染 Mermaid，多主題、縮放，導出 PNG/SVG"
    },
    "css-gradient": {
      "name": "CSS 漸變生成器",
      "description": "可視化編輯 linear / radial 漸變，含分類預設與 CSS 復制"
    },
    "image-to-paper": {
      "name": "圖片轉紙張 PDF",
      "description": "將圖片按 A3/A4/A5/Letter 紙張適配並導出 PDF"
    },
    "md-to-image": {
      "name": "Markdown 轉圖片",
      "description": "將 Markdown 渲染為卡片圖並導出 PNG，可調字體、字號、寬度與顏色"
    },
    "chart-generator": {
      "name": "在線圖表生成器",
      "description": "CSV 生成柱狀/條形/折線/面積/餅/環/散點圖，含圖例、坐標軸與配色預設"
    },
    "css3-generator": {
      "name": "CSS3 代碼生成器",
      "description": "可視化生成 border-radius、陰影、transform、filter 等 CSS3"
    },
    "xslt-transform": {
      "name": "XSLT 轉換",
      "description": "用 XSLT 將 XML 轉換為 HTML，瀏覽器本地完成"
    },
    "pdf-merge": {
      "name": "PDF 合並",
      "description": "將多個 PDF 合並為一個文件"
    },
    "pdf-split": {
      "name": "PDF 拆分",
      "description": "將 PDF 按頁拆分為多個文件"
    },
    "pdf-delete-pages": {
      "name": "PDF 刪除頁面",
      "description": "刪除 PDF 中的指定頁面"
    },
    "pdf-extract-pages": {
      "name": "PDF 提取頁面",
      "description": "從 PDF 中提取指定頁面"
    },
    "pdf-reorder": {
      "name": "PDF 頁面排序",
      "description": "重新排列 PDF 頁面順序"
    },
    "pdf-rotate": {
      "name": "PDF 旋轉頁面",
      "description": "旋轉 PDF 指定或全部頁面"
    },
    "pdf-to-image": {
      "name": "PDF 轉圖片",
      "description": "將 PDF 頁面渲染為 JPG/PNG"
    },
    "images-to-pdf": {
      "name": "圖片轉 PDF",
      "description": "將多張圖片合成為 PDF"
    },
    "pdf-viewer": {
      "name": "PDF 在線閱讀",
      "description": "本地打開並閱讀 PDF"
    },
    "pdf-page-numbers": {
      "name": "PDF 添加頁碼",
      "description": "為 PDF 添加頁碼"
    },
    "pdf-header-footer": {
      "name": "PDF 頁眉頁腳",
      "description": "為 PDF 添加頁眉與頁腳"
    },
    "pdf-insert-image": {
      "name": "PDF 插入圖片",
      "description": "在 PDF 頁面上插入圖片"
    },
    "pdf-add-text": {
      "name": "PDF 添加文本",
      "description": "在 PDF 頁面上添加文本"
    },
    "pdf-sign": {
      "name": "PDF 簽名",
      "description": "手寫或上傳簽名圖（外觀簽名，非數字證書）"
    },
    "pdf-metadata": {
      "name": "PDF 元資料",
      "description": "查看與編輯 PDF 元資料"
    },
    "pdf-encrypt": {
      "name": "PDF 加密保護",
      "description": "為 PDF 設置密碼與操作權限"
    },
    "pdf-crop": {
      "name": "PDF 裁剪",
      "description": "裁剪 PDF 頁面邊距（cropBox）"
    },
    "pdf-grayscale": {
      "name": "PDF 轉灰度",
      "description": "將 PDF 轉為視覺灰度版（渲圖重打）"
    },
    "pdf-annotate": {
      "name": "PDF 標注",
      "description": "在頁面上可視化繪制高亮、畫筆、形狀與文本"
    }
  },
  "tools": {
    "base64": {
      "direction": {
        "encode": "編碼（文本 → Base64）",
        "decode": "解碼（Base64 → 文本）"
      },
      "urlSafe": "URL Safe（- _ 且無填充）",
      "labels": {
        "rawText": "原始文本",
        "base64Input": "Base64 輸入",
        "base64Result": "Base64 結果",
        "decodeResult": "解碼結果"
      },
      "placeholders": {
        "encode": "輸入要編碼的文本…",
        "decode": "貼上 Base64 字符串…"
      },
      "fileNote": "當前展示的是文件的 Base64 編碼結果，輸入文本將清除該結果。",
      "fileMode": "文件模式：文件 → Base64（ArrayBuffer 分塊）",
      "err": {
        "INVALID_PADDING": "第 {{position}} 位出現非法的填充字符 \"=\"",
        "INVALID_CHAR": "第 {{position}} 位出現非法字符 \"{{char}}\"",
        "INVALID_LENGTH": "長度非法：Base64 內容長度除以 4 不能余 1",
        "DECODE_FAILED": "解碼失敗：不是合法的 Base64 輸入"
      }
    },
    "url": {
      "modes": {
        "component": "component（參數值，編碼保留字符）",
        "full": "整串 URL（保留 : / ? & 等結構字符）"
      },
      "mode": "模式",
      "labels": {
        "rawText": "原始文本",
        "encodedText": "已編碼文本"
      },
      "placeholders": {
        "encode": "輸入要編碼的內容…",
        "decode": "貼上 % 編碼的內容…"
      },
      "err": {
        "ENCODE_FAILED": "編碼失敗：輸入包含無法編碼的孤立代理字符",
        "DECODE_FAILED": "解碼失敗：存在非法的 % 序列（malformed percent-encoding）"
      }
    },
    "regex": {
      "presets": "常用正則",
      "presetPlaceholder": "選擇後自動填入…",
      "expression": "表達式",
      "expressionPlaceholder": "例如 \\d+",
      "flags": "標志",
      "testText": "測試文本",
      "testTextPlaceholder": "貼上要匹配的文本…",
      "matchCount": "共 {{count}} 個匹配",
      "truncated": "（已截斷，僅展示前 1000 個）",
      "position": "位置",
      "matchContent": "匹配內容",
      "captureGroups": "捕獲組",
      "emptyMatch": "（空匹配）",
      "tableLimit": "僅展示前 {{count}} 條",
      "mode": "模式",
      "modes": {
        "match": "匹配",
        "replace": "替換"
      },
      "replacement": "替換為",
      "replacementPlaceholder": "支持 $1、$& 等…",
      "replaceResult": "替換結果",
      "cheatSheet": "語法速查（點擊插入）",
      "cheat": {
        "dot": "任意字符",
        "digit": "數字",
        "word": "單詞字符",
        "space": "空白",
        "start": "行首",
        "end": "行尾",
        "star": "0 次或多次",
        "plus": "1 次或多次",
        "question": "0 或 1 次",
        "or": "或",
        "group": "捕獲組",
        "class": "字符類",
        "range": "范圍",
        "not": "排除字符類"
      },
      "presetsList": {
        "email": "電子郵箱",
        "phoneCn": "手機號（中國大陸）",
        "idCard": "身份證號（18 位）",
        "url": "URL",
        "ipv4": "IPv4 地址",
        "date": "日期（yyyy-mm-dd）"
      },
      "err": {
        "EMPTY": "正則表達式不能為空",
        "COMPILE": "編譯失敗：{{message}}",
        "TEXT_TOO_LONG": "文本超過 {{limit}}K 字符上限，已停止匹配（防 ReDoS / 長時間阻塞）"
      }
    },
    "textDiff": {
      "oldText": "原文本",
      "newText": "新文本",
      "swapSides": "交換左右",
      "stats": "+{{added}} 新增 / −{{removed}} 刪除 / {{same}} 未變",
      "identical": "兩段文本完全一致",
      "renderLimit": "差異行數較多，僅渲染前 {{count}} 行",
      "ignoreWhitespace": "忽略行尾空白與連續空格",
      "err": {
        "TOO_LARGE": "文本總量超過 {{limit}}K 字符上限，已停止對比（防長時間阻塞）"
      }
    },
    "json": {
      "actions": {
        "format": "格式化",
        "compress": "壓縮",
        "validate": "僅校驗"
      },
      "indent": "縮進",
      "indent2": "2 空格",
      "indent4": "4 空格",
      "inputLabel": "JSON 輸入",
      "validateResult": "校驗結果",
      "inputPlaceholder": "貼上 JSON，如 {\"a\": 1}…",
      "valid": "✓ 合法 JSON",
      "err": {
        "EMPTY": "JSON 解析失敗：輸入為空",
        "UNKNOWN": "JSON 解析失敗：未知錯誤",
        "INVALID_LITERAL": "JSON 解析失敗：非法字面量，應為 \"{{literal}}\"（第 {{line}} 行，第 {{column}} 列）",
        "NEWLINE_IN_STRING": "JSON 解析失敗：字符串不能跨行（第 {{line}} 行，第 {{column}} 列）",
        "UNEXPECTED_STRING_END": "JSON 解析失敗：字符串意外結束（第 {{line}} 行，第 {{column}} 列）",
        "INVALID_UNICODE_ESCAPE": "JSON 解析失敗：非法的 \\u 轉義，需 4 位十六進制（第 {{line}} 行，第 {{column}} 列）",
        "INVALID_ESCAPE": "JSON 解析失敗：非法轉義字符 \"\\{{char}}\"（第 {{line}} 行，第 {{column}} 列）",
        "INVALID_NUMBER": "JSON 解析失敗：非法數字（第 {{line}} 行，第 {{column}} 列）",
        "DECIMAL_NO_DIGITS": "JSON 解析失敗：小數點後需有數字（第 {{line}} 行，第 {{column}} 列）",
        "EXPONENT_NO_DIGITS": "JSON 解析失敗：指數部分需有數字（第 {{line}} 行，第 {{column}} 列）",
        "UNEXPECTED_END": "JSON 解析失敗：輸入意外結束，缺少值（第 {{line}} 行，第 {{column}} 列）",
        "INVALID_CHAR": "JSON 解析失敗：非法字符 \"{{char}}\"（第 {{line}} 行，第 {{column}} 列）",
        "TRAILING_COMMA": "JSON 解析失敗：不允許尾隨逗號（第 {{line}} 行，第 {{column}} 列）",
        "KEY_MUST_BE_STRING": "JSON 解析失敗：對象鍵必須是字符串（第 {{line}} 行，第 {{column}} 列）",
        "MISSING_COLON": "JSON 解析失敗：對象鍵後缺少 \":\"（第 {{line}} 行，第 {{column}} 列）",
        "MISSING_VALUE": "JSON 解析失敗：缺少值（第 {{line}} 行，第 {{column}} 列）",
        "UNCLOSED_OBJECT": "JSON 解析失敗：對象未閉合，缺少 \"}\"（第 {{line}} 行，第 {{column}} 列）",
        "MISSING_COMMA_OBJECT": "JSON 解析失敗：對象成員之間缺少 \",\"（第 {{line}} 行，第 {{column}} 列）",
        "UNCLOSED_ARRAY": "JSON 解析失敗：數組未閉合，缺少 \"]\"（第 {{line}} 行，第 {{column}} 列）",
        "MISSING_COMMA_ARRAY": "JSON 解析失敗：數組元素之間缺少 \",\"（第 {{line}} 行，第 {{column}} 列）",
        "EXTRA_CONTENT": "JSON 解析失敗：值之後存在多余內容（第 {{line}} 行，第 {{column}} 列）",
        "UNCLOSED_STRING": "JSON 解析失敗：字符串未閉合（第 {{line}} 行，第 {{column}} 列）"
      }
    },
    "timestamp": {
      "currentTime": "當前時間",
      "pauseTick": "暫停走秒",
      "resumeTick": "繼續走秒",
      "second": "秒",
      "millisecond": "毫秒",
      "localPrefix": "本地：{{local}} · {{utc}}",
      "tsToReadable": "時間戳 → 可讀時間（自動識別秒 / 毫秒）",
      "fillCurrentSec": "填入當前（秒）",
      "tsInput": "時間戳輸入",
      "tsPlaceholder": "如 1725000000 或 1725000000000",
      "localTime": "本地時間",
      "relative": "相對（識別為{{unit}}）",
      "unitSeconds": "秒",
      "unitMilliseconds": "毫秒",
      "dateToTs": "可讀時間 → 時間戳（空格分隔按本地時區）",
      "dateInput": "日期時間輸入",
      "datePlaceholder": "如 2026-09-01 12:00:00 或 2026-09-01T04:00:00Z",
      "relativeAgo": "{{count}} {{unit}}前",
      "relativeLater": "{{count}} {{unit}}後",
      "units": {
        "second": "秒",
        "minute": "分鐘",
        "hour": "小時",
        "day": "天",
        "year": "年"
      },
      "err": {
        "NOT_NUMERIC": "時間戳必須是純數字（可為負數）",
        "OUT_OF_RANGE": "時間戳超出數值范圍",
        "TS_TOO_LARGE": "時間戳超出可表示范圍（±275760 年）",
        "DATE_EMPTY": "請輸入日期時間",
        "DATE_INVALID": "無法解析該日期時間（示例：2026-09-01 12:00:00 或 ISO 8601）"
      }
    },
    "uuid": {
      "version": "版本",
      "versions": {
        "v4": "v4（隨機）",
        "v7": "v7（時間有序）"
      },
      "count": "數量",
      "uppercase": "大寫",
      "hyphens": "橫線",
      "braces": "花括號",
      "generate": "生成",
      "output": "生成結果（每行一個）",
      "err": {
        "INVALID_COUNT": "生成數量需為 ≧ 1 的整數",
        "TOO_MANY": "單次最多生成 {{max}} 個"
      }
    },
    "hash": {
      "algorithm": "算法",
      "encoding": "輸出",
      "encodings": {
        "hex": "hex（十六進制）",
        "base64": "base64"
      },
      "source": "來源",
      "textInput": "文本輸入",
      "textPlaceholder": "輸入要計算哈希的文本…",
      "result": "{{algorithm}} 結果",
      "computing": "計算中…",
      "fileHint": "拖拽文件到此處，或點擊選擇（MD5 流式計算，大文件不佔記憶體）",
      "limitHint": "注意：非 MD5 算法會將整文件讀入記憶體，超大文件可能導致記憶體不足",
      "err": {
        "UNSUPPORTED": "哈希計算失敗：當前環境不支持該算法",
        "FILE_HASH": "文件哈希計算失敗：{{message}}",
        "FILE_READ": "讀取文件內容失敗"
      }
    },
    "jwt": {
      "mode": "模式",
      "modes": {
        "parse": "解析",
        "sign": "簽發（HS256）"
      },
      "secretPlaceholder": "HMAC 密鑰…",
      "payloadJson": "Payload JSON",
      "payloadPlaceholder": "{ \"sub\": \"123\", \"name\": \"Alice\" }",
      "signedToken": "簽發結果",
      "signNote": "使用 HS256 在瀏覽器內簽發；密鑰不會上傳",
      "inputLabel": "JWT 輸入",
      "inputPlaceholder": "貼上 JWT（支持 Bearer 前綴），如 eyJhbGci…",
      "header": "Header（頭部）",
      "payload": "Payload（載荷）",
      "signature": "Signature（簽名）",
      "note": "僅解析、不驗簽：驗簽需要密鑰；所有處理均在瀏覽器內完成",
      "alg": "算法",
      "expired": "已過期",
      "notExpired": "未過期",
      "claims": {
        "exp": "過期時間 exp",
        "nbf": "生效時間 nbf",
        "iat": "簽發時間 iat"
      },
      "err": {
        "EMPTY": "請貼上一個 JWT",
        "INVALID_PARTS": "格式錯誤：JWT 由 header.payload.signature 三段組成",
        "INVALID_HEADER": "Header 段解析失敗：不是合法的 base64url 編碼 JSON",
        "INVALID_PAYLOAD": "Payload 段解析失敗：不是合法的 base64url 編碼 JSON",
        "SIGN_FAILED": "簽發失敗"
      }
    },
    "aes-crypto": {
      "encrypt": "加密",
      "decrypt": "解密",
      "keyMode": "密鑰方式",
      "passphrase": "口令（PBKDF2）",
      "rawKey": "原始密鑰（hex）",
      "passphrasePlaceholder": "輸入口令…",
      "keyHexPlaceholder": "32 或 64 位十六進制密鑰（AES-128/256）…",
      "ivPlaceholder": "可選 IV（24 位 hex，12 字節）；留空則隨機",
      "plaintext": "明文",
      "ciphertext": "密文（base64）",
      "inputPlaceholder": "輸入內容…",
      "note": "加密輸出格式：base64(salt|iv|ciphertext+tag)；口令模式使用 PBKDF2-SHA256",
      "err": {
        "EMPTY": "請輸入內容",
        "INVALID_KEY": "密鑰無效：請檢查口令或 hex 密鑰長度",
        "DECRYPT_FAILED": "解密失敗：口令/密鑰錯誤或資料損壞",
        "INVALID_INPUT": "輸入無效：密文格式或 IV 不正確"
      }
    },
    "hmac": {
      "algorithm": "算法",
      "encoding": "輸出",
      "secretPlaceholder": "HMAC 密鑰…",
      "message": "消息",
      "messagePlaceholder": "輸入要計算 HMAC 的消息…",
      "err": {
        "EMPTY": "請輸入消息",
        "INVALID_KEY": "請輸入有效密鑰"
      }
    },
    "totp": {
      "digits": "位數",
      "secret": "Base32 密鑰",
      "secretPlaceholder": "貼上 Authenticator 密鑰（Base32）…",
      "code": "當前口令",
      "remaining": "剩余秒數",
      "verify": "校驗口令（可選）",
      "verifyPlaceholder": "輸入要校驗的 6/8 位碼…",
      "verifyOk": "校驗通過",
      "verifyFail": "校驗失敗",
      "err": {
        "EMPTY": "請輸入密鑰或校驗碼",
        "INVALID_SECRET": "密鑰不是合法的 Base32"
      }
    },
    "cidr-calc": {
      "input": "CIDR",
      "placeholder": "例如 192.168.1.0/24",
      "fields": {
        "network": "網路地址",
        "broadcast": "廣播地址",
        "firstHost": "首主機",
        "lastHost": "末主機",
        "netmask": "子網掩碼",
        "wildcard": "通配掩碼",
        "prefix": "前綴長度",
        "hostCount": "可用主機數",
        "totalAddresses": "總地址數"
      },
      "err": {
        "EMPTY": "請輸入 CIDR",
        "INVALID": "CIDR 格式無效（需為 IPv4/前綴，如 10.0.0.0/8）"
      }
    },
    "text-lines": {
      "placeholder": "每行一段文本…",
      "ops": {
        "sort-asc": "升序排序",
        "sort-desc": "降序排序",
        "unique": "去重",
        "reverse": "反轉行序",
        "number": "添加行號",
        "trim-empty": "去除空行"
      },
      "err": {
        "EMPTY": "請輸入文本"
      }
    },
    "hex-codec": {
      "spaced": "空格分隔字節",
      "placeholder": "文本或十六進制…",
      "err": {
        "EMPTY": "請輸入內容",
        "INVALID_HEX": "非法十六進制（需偶數位 0-9a-f）"
      }
    },
    "url-query": {
      "input": "URL",
      "placeholder": "https://example.com/path?a=1&b=2",
      "addParam": "添加參數",
      "key": "鍵",
      "value": "值",
      "rebuilt": "重建後的 URL",
      "parts": {
        "protocol": "協議",
        "hostname": "主機",
        "port": "端口",
        "pathname": "路徑",
        "hash": "哈希",
        "origin": "Origin"
      },
      "err": {
        "EMPTY": "請輸入 URL",
        "INVALID_URL": "URL 無效"
      }
    },
    "json-path": {
      "pathPlaceholder": "路徑，如 a.b[0].c 或 $.a.b[0]",
      "json": "JSON",
      "jsonPlaceholder": "貼上 JSON…",
      "err": {
        "EMPTY": "請輸入 JSON 與路徑",
        "INVALID_JSON": "JSON 解析失敗",
        "NOT_FOUND": "路徑未匹配到值"
      }
    },
    "gzip-tool": {
      "compress": "壓縮（文本 → base64）",
      "decompress": "解壓（base64 → 文本）",
      "placeholder": "輸入文本或 Gzip 的 base64…",
      "err": {
        "EMPTY": "請輸入內容",
        "INVALID": "輸入無效",
        "DECOMPRESS_FAILED": "解壓失敗：不是合法的 Gzip 資料"
      }
    },
    "x509-decode": {
      "input": "PEM 證書",
      "placeholder": "-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----",
      "fields": {
        "pemType": "類型",
        "derLength": "DER 長度",
        "sha256": "SHA-256",
        "sha1": "SHA-1",
        "subject": "Subject CN",
        "issuer": "Issuer CN"
      },
      "err": {
        "EMPTY": "請貼上 PEM",
        "INVALID_PEM": "不是合法的 PEM"
      }
    },
    "exif-strip": {
      "hint": "僅支持 JPEG：剝離 APP1（EXIF）後下載。",
      "drop": "拖入 JPEG 圖片",
      "hasExif": "含 EXIF",
      "orientation": "方向",
      "make": "相機制造商",
      "yes": "是",
      "no": "否",
      "download": "下載無 EXIF 文件",
      "err": {
        "EMPTY": "請選擇文件",
        "UNSUPPORTED": "僅支持 JPEG",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "fake-data": {
      "kind": "類型",
      "locale": "語言",
      "count": "數量",
      "generate": "生成",
      "kinds": {
        "name": "姓名",
        "email": "郵箱",
        "uuid": "UUID",
        "lorem": "段落"
      },
      "err": {
        "EMPTY": "請完善選項",
        "INVALID_COUNT": "數量需為 1–50 的整數"
      }
    },
    "password": {
      "length": "長度",
      "generate": "生成密碼",
      "lowercase": "小寫字母（a-z）",
      "uppercase": "大寫字母（A-Z）",
      "digits": "數字（0-9）",
      "symbols": "特殊符號（!@#$%…）",
      "excludeAmbiguous": "排除易混淆字符（0 O 1 l I 等）",
      "ensureEach": "每種已選字符集至少出現一次",
      "output": "生成結果",
      "outputPlaceholder": "點擊「生成密碼」獲取",
      "entropy": "熵 ≒ {{bits}} bit",
      "strength": {
        "weak": "弱",
        "medium": "中",
        "strong": "強"
      },
      "err": {
        "NO_SETS": "請至少選擇一種字符集",
        "INVALID_LENGTH": "長度需在 4 到 128 之間"
      }
    },
    "entity": {
      "direction": "方向",
      "encode": "編碼",
      "decode": "解碼",
      "mode": "編碼形式",
      "modes": {
        "named": "命名實體（&amp;）",
        "decimal": "十進制（&#38;）",
        "hex": "十六進制（&#x26;）",
        "unicode": "\\u 轉義（\\u4E2D）"
      },
      "scope": "范圍",
      "scopes": {
        "special": "僅特殊字符（& < > 等）",
        "nonascii": "特殊字符 + 非 ASCII"
      },
      "input": "輸入",
      "output": "輸出",
      "inputEncodePlaceholder": "輸入待編碼文本，如 <b>你好</b>…",
      "inputDecodePlaceholder": "輸入待解碼文本，如 &lt;b&gt;&#20320;&#22909;…",
      "unknown": "未識別的實體（已原樣保留）"
    },
    "cron": {
      "expression": "表達式",
      "placeholder": "如 */5 8-18 * * 1-5 或 @daily（5 字段，6 字段含秒）",
      "count": "次數",
      "normalized": "歸一化",
      "fieldsTitle": "字段說明",
      "colField": "字段",
      "colValue": "值",
      "colMeaning": "含義",
      "nextTitle": "未來 {{count}} 次執行",
      "fieldNames": {
        "second": "秒",
        "minute": "分鐘",
        "hour": "小時",
        "day": "日",
        "month": "月",
        "week": "星期"
      },
      "err": {
        "EMPTY": "請輸入 Cron 表達式",
        "INVALID": "無法解析：請檢查字段數（5 或 6）與取值范圍（分 0-59 / 時 0-23 / 日 1-31 / 月 1-12 / 周 0-7）"
      },
      "desc": {
        "every": {
          "second": "每秒",
          "minute": "每分鐘",
          "hour": "每小時",
          "day": "每天",
          "month": "每月",
          "week": "每天（不限星期）"
        },
        "step": "每 {{n}} {{unit}}",
        "at": "{{noun}} {{values}}",
        "range": "{{noun}} {{a}} 到 {{b}}",
        "rangeStep": "{{noun}} {{a}} 到 {{b}}，每 {{n}}",
        "units": {
          "second": "秒",
          "minute": "分鐘",
          "hour": "小時",
          "day": "天",
          "month": "個月",
          "week": "天"
        },
        "nouns": {
          "second": "秒",
          "minute": "分鐘",
          "hour": "小時",
          "day": "日",
          "month": "月",
          "week": "星期"
        },
        "sep": "、",
        "days": [
          "周日",
          "周一",
          "周二",
          "周三",
          "周四",
          "周五",
          "周六"
        ],
        "months": [
          "1月",
          "2月",
          "3月",
          "4月",
          "5月",
          "6月",
          "7月",
          "8月",
          "9月",
          "10月",
          "11月",
          "12月"
        ]
      }
    },
    "convert": {
      "from": "輸入格式",
      "to": "輸出格式",
      "formats": {
        "yaml": "YAML",
        "json": "JSON",
        "toml": "TOML"
      },
      "input": "輸入",
      "output": "輸出",
      "placeholder": "貼上待轉換內容…",
      "err": {
        "PARSE": "輸入解析失敗：請檢查語法是否正確",
        "STRINGIFY": "無法轉換為目標格式（如 TOML 不支持頂層數組 / 標量）"
      }
    },
    "sql": {
      "dialect": "方言",
      "indent": "縮進",
      "keywordCase": "關鍵字大小寫",
      "cases": {
        "upper": "大寫",
        "lower": "小寫",
        "preserve": "保持原樣"
      },
      "languages": {
        "sql": "通用 SQL",
        "mysql": "MySQL",
        "postgresql": "PostgreSQL",
        "sqlite": "SQLite",
        "mariadb": "MariaDB",
        "transactsql": "SQL Server",
        "plsql": "PL/SQL"
      },
      "input": "SQL 輸入",
      "output": "輸出",
      "placeholder": "貼上 SQL，如 select * from users where id = 1…",
      "err": {
        "INVALID": "無法解析該 SQL：請檢查語法"
      }
    },
    "html": {
      "actions": {
        "format": "格式化（美化）",
        "compress": "壓縮"
      },
      "indent": "縮進",
      "indent2": "2 空格",
      "indent4": "4 空格",
      "input": "HTML 輸入",
      "placeholder": "貼上 HTML，如 <div><span>Hello</span></div>…",
      "err": {
        "EMPTY": "請輸入 HTML 內容",
        "INVALID": "處理失敗：請檢查 HTML 是否合法"
      }
    },
    "js": {
      "actions": {
        "format": "格式化（美化）",
        "compress": "壓縮"
      },
      "indent": "縮進",
      "indent2": "2 空格",
      "indent4": "4 空格",
      "input": "JavaScript 輸入",
      "placeholder": "貼上 JS，如 function hello(){return 1}…",
      "err": {
        "EMPTY": "請輸入 JavaScript 內容",
        "INVALID": "處理失敗：請檢查語法是否正確"
      }
    },
    "css": {
      "actions": {
        "format": "格式化（美化）",
        "compress": "壓縮"
      },
      "indent": "縮進",
      "indent2": "2 空格",
      "indent4": "4 空格",
      "input": "CSS 輸入",
      "placeholder": "貼上 CSS，如 .box{color:red}…",
      "err": {
        "EMPTY": "請輸入 CSS 內容",
        "INVALID": "處理失敗：請檢查 CSS 是否合法"
      }
    },
    "qr": {
      "input": "文本內容",
      "placeholder": "輸入文本或網址，如 https://example.com…",
      "level": "糾錯等級",
      "size": "尺寸",
      "margin": "邊距",
      "foreground": "前景色",
      "background": "背景色",
      "levels": {
        "L": "L（約 7%）",
        "M": "M（約 15%）",
        "Q": "Q（約 25%）",
        "H": "H（約 30%）"
      },
      "preview": "二維碼預覽",
      "decodeTitle": "解析二維碼",
      "decodeHint": "拖入或選擇包含二維碼的圖片（PNG / JPG 等）",
      "decodeOutput": "解析結果",
      "err": {
        "EMPTY": "請輸入要生成二維碼的內容",
        "TOO_LONG": "內容過長，超出二維碼容量：請精簡內容或調低糾錯等級",
        "NOT_FOUND": "未在圖片中識別到二維碼",
        "DECODE": "圖片解碼失敗",
        "LOAD": "圖片加載失敗：請確認為有效的圖片文件",
        "INVALID_COLOR": "顏色須為 #RGB 或 #RRGGBB",
        "INVALID_MARGIN": "邊距須為 0–10 的整數（模塊數）"
      }
    },
    "color": {
      "input": "顏色",
      "placeholder": "如 #3b82f6、rgb(59,130,246)、hsl(217,91%,60%)…",
      "preview": "顏色預覽",
      "supportHint": "支持 HEX / RGB / HSL（含簡寫與百分比）",
      "err": {
        "EMPTY": "請輸入顏色值",
        "INVALID": "無法解析：請使用 HEX、RGB 或 HSL 格式"
      }
    },
    "radix": {
      "radix": "進制",
      "auto": "自動識別",
      "input": "整數輸入",
      "placeholder": "如 255、0xff、0b11111111、0377…",
      "bitPattern": "位模式",
      "twosComplement": "補碼",
      "bitOps": "位運算",
      "operator": "運算符",
      "operandB": "操作數 B",
      "opHint": "操作數 A 復用上方輸入；結果限制在 64 位有符號整數范圍內",
      "ops": {
        "and": "AND（與）",
        "or": "OR（或）",
        "xor": "XOR（異或）",
        "shl": "<<（左移）",
        "shr": ">>（右移）",
        "not": "NOT（取反）"
      },
      "err": {
        "EMPTY": "請輸入整數",
        "INVALID": "無法解析：請檢查進制與數字格式",
        "RANGE": "數值超出 64 位有符號整數范圍（−2⁶³ ~ 2⁶³−1）"
      }
    },
    "markdown": {
      "gfm": "GFM（表格 / 刪除線 / 任務列表）",
      "breaks": "換行即換行（breaks）",
      "input": "Markdown 編輯",
      "placeholder": "輸入 Markdown，如 # 標題…",
      "preview": "預覽",
      "shortcuts": "快捷鍵：⌘/Ctrl+B 加粗 · ⌘/Ctrl+I 斜體 · ⌘/Ctrl+K 鏈接 · ⌘/Ctrl+E 行內代碼",
      "toolbar": {
        "aria": "Markdown 編輯工具欄",
        "bold": "加粗（**）",
        "italic": "斜體（*）",
        "strike": "刪除線（~~）",
        "h1": "一級標題（#）",
        "h2": "二級標題（##）",
        "h3": "三級標題（###）",
        "h4": "四級標題（####）",
        "h5": "五級標題（#####）",
        "h6": "六級標題（######）",
        "quote": "引用（>）",
        "code": "行內代碼（`）",
        "codeBlock": "代碼塊（```）",
        "link": "鏈接",
        "image": "圖片",
        "ul": "無序列表",
        "ol": "有序列表",
        "hr": "分隔線",
        "table": "表格"
      },
      "err": {
        "EMPTY": "請輸入 Markdown 內容",
        "PARSE": "渲染失敗：請檢查 Markdown 語法"
      }
    },
    "image": {
      "format": "輸出格式",
      "quality": "質量",
      "maxDim": "最大邊長",
      "original": "原尺寸",
      "dropHint": "拖拽圖片到此處，或點擊選擇（PNG / JPEG / WebP / GIF 等）",
      "before": "原圖",
      "after": "輸出",
      "saved": "體積減少 {{ratio}}%",
      "increased": "體積增加 {{ratio}}%",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "ENCODE": "圖片編碼失敗：請確認瀏覽器支持該格式，或換一張圖片重試"
      }
    },
    "jsonConvert": {
      "target": "目標格式",
      "targets": {
        "yaml": "YAML",
        "xml": "XML",
        "csv": "CSV"
      },
      "input": "JSON 輸入",
      "placeholder": "貼上 JSON，如 [{\"id\":1,\"name\":\"a\"}]…",
      "err": {
        "PARSE": "JSON 解析失敗：請檢查語法",
        "CONVERT": "無法轉換為目標格式（CSV 需要對象數組）"
      }
    },
    "xml": {
      "actions": {
        "format": "格式化（美化）",
        "compress": "壓縮"
      },
      "indent": "縮進",
      "indent2": "2 空格",
      "indent4": "4 空格",
      "input": "XML 輸入",
      "placeholder": "貼上 XML，如 <root><item>a</item></root>…",
      "err": {
        "EMPTY": "請輸入 XML 內容",
        "INVALID": "處理失敗：請檢查 XML 是否合法"
      }
    },
    "xmlJson": {
      "indent": "縮進",
      "indent2": "2 空格",
      "indent4": "4 空格",
      "input": "XML 輸入",
      "output": "JSON 輸出",
      "placeholder": "貼上 XML，如 <root a=\"1\"><item>x</item></root>…",
      "err": {
        "EMPTY": "請輸入 XML 內容",
        "PARSE": "XML 解析失敗：請檢查語法"
      }
    },
    "unicode": {
      "format": "編碼格式",
      "formats": {
        "js": "JS \\uXXXX",
        "jsBrace": "JS \\u{…}",
        "codePoint": "碼點 U+",
        "htmlHex": "HTML &#x…;",
        "htmlDec": "HTML &#…;",
        "utf8": "UTF-8 字節"
      },
      "raw": "原始文本",
      "encoded": "編碼文本",
      "placeholderEncode": "輸入文本，如 中 / A / 😀…",
      "placeholderDecode": "輸入 \\u4e2d、U+4E2D、&#x4E2D; 或 E4 B8 AD…",
      "hint": "解碼支持混排多種寫法；編碼時按所選格式輸出",
      "err": {
        "EMPTY": "請輸入內容",
        "INVALID": "無法解析：請檢查 Unicode / UTF-8 表示是否合法"
      }
    },
    "colorPicker": {
      "picker": "色盤",
      "input": "色值",
      "placeholder": "#3b82f6 / rgb(59,130,246)…",
      "eyedropper": "屏幕取色",
      "preview": "顏色預覽",
      "fields": {
        "hex": "HEX",
        "rgb": "RGB",
        "hsl": "HSL",
        "cssColor": "CSS color",
        "cssBg": "CSS background",
        "htmlInline": "HTML style"
      },
      "err": {
        "EMPTY": "請輸入顏色",
        "INVALID": "無法識別的顏色格式"
      }
    },
    "webColorTable": {
      "search": "搜尋",
      "searchPlaceholder": "名稱 / HEX / RGB…",
      "group": "分類",
      "groups": {
        "all": "全部",
        "red": "紅",
        "orange": "橙",
        "yellow": "黃",
        "green": "綠",
        "cyan": "青",
        "blue": "藍",
        "purple": "紫",
        "pink": "粉",
        "brown": "棕",
        "white": "白",
        "gray": "灰",
        "black": "黑"
      },
      "count": "顯示 {{n}} / {{total}} 種顏色",
      "empty": "沒有匹配的顏色",
      "swatch": "色塊",
      "name": "名稱",
      "hex": "HEX",
      "rgb": "RGB",
      "copyName": "名稱",
      "copyHex": "HEX",
      "copyRgb": "RGB",
      "hint": "CSS 命名顏色（含 Grey 別名與 RebeccaPurple），可直接用於 color / background。"
    },
    "pinyin": {
      "input": "漢字",
      "output": "拼音",
      "placeholder": "輸入漢字，如 你好世界…",
      "separator": "分隔符",
      "separators": {
        "space": "空格",
        "none": "無",
        "dash": "連字符 -"
      },
      "letterCase": "大小寫",
      "cases": {
        "lower": "小寫",
        "upper": "大寫"
      },
      "tone": "啟用聲調",
      "hint": "基於常用讀音；多音字取預設讀音",
      "err": {
        "EMPTY": "請輸入漢字"
      }
    },
    "length": {
      "value": "數值",
      "from": "單位",
      "placeholder": "如 1.5",
      "units": {
        "mm": "毫米 mm",
        "cm": "釐米 cm",
        "m": "米 m",
        "km": "千米 km",
        "in": "英寸 in",
        "ft": "英尺 ft",
        "yd": "碼 yd",
        "mi": "英裡 mi",
        "nmi": "海裡 nmi"
      },
      "err": {
        "EMPTY": "請輸入數值",
        "INVALID": "請輸入有效數字"
      }
    },
    "zhConvert": {
      "s2t": "簡體 → 繁體",
      "t2s": "繁體 → 簡體",
      "simplified": "簡體中文",
      "traditional": "繁體中文",
      "placeholderS2t": "輸入簡體中文…",
      "placeholderT2s": "輸入繁體中文…",
      "hint": "字符級簡繁映射，專名/地區詞可能與 OpenCC 詞庫結果不同",
      "err": {
        "EMPTY": "請輸入文本"
      }
    },
    "weight": {
      "value": "數值",
      "from": "單位",
      "placeholder": "如 1.5",
      "units": {
        "mg": "毫克 mg",
        "g": "克 g",
        "kg": "千克 kg",
        "t": "噸 t",
        "oz": "盎司 oz",
        "lb": "磅 lb",
        "st": "英石 st"
      },
      "err": {
        "EMPTY": "請輸入數值",
        "INVALID": "請輸入有效數字"
      }
    },
    "textCounter": {
      "input": "文本",
      "placeholder": "貼上或輸入要統計的文本…",
      "emptyHint": "輸入文本後將顯示統計結果",
      "stats": {
        "chars": "字符數（含空白）",
        "charsNoSpace": "字符數（不含空白）",
        "words": "詞數",
        "cjk": "漢字數",
        "lines": "行數",
        "paragraphs": "段落數",
        "spaces": "空白字符",
        "bytes": "UTF-8 字節",
        "utf16Length": "UTF-16 長度"
      }
    },
    "calendar": {
      "title": "{{year}} 年 {{month}} 月",
      "weekStart": "周起始",
      "weekStarts": {
        "mon": "周一",
        "sun": "周日"
      },
      "today": "今天",
      "prev": "上一月",
      "next": "下一月",
      "selected": "選中日期",
      "lunar": "農歷",
      "ganZhi": "日柱 {{day}}",
      "festivals": "節日 / 節氣",
      "restLabel": "休息標識",
      "yi": "宜",
      "ji": "忌",
      "legendZh": "紅字多為周末或節日；角標「休」法定休息、「班」調休上班。右側可見宜忌。",
      "legendEn": "Red days are weekends or holidays. US public holidays shown for English (en-GB uses UK bank holidays).",
      "rest": {
        "off": "休",
        "work": "班",
        "weekend": "周末"
      },
      "weekdays": {
        "0": "日",
        "1": "一",
        "2": "二",
        "3": "三",
        "4": "四",
        "5": "五",
        "6": "六"
      },
      "formats": {
        "iso": "ISO",
        "slash": "斜槓",
        "locale": "本地"
      }
    },
    "cssButton": {
      "label": "按鈕文字",
      "bg": "背景",
      "color": "文字",
      "hoverBg": "懸停",
      "borderColor": "邊框色",
      "radius": "圓角",
      "paddingX": "水平內邊距",
      "paddingY": "垂直內邊距",
      "fontSize": "字號",
      "borderWidth": "邊框寬",
      "fontWeight": "字重",
      "shadow": "陰影",
      "fullWidth": "撐滿寬度",
      "previewFallback": "按鈕",
      "css": "CSS",
      "html": "HTML"
    },
    "randomNumber": {
      "min": "最小值",
      "max": "最大值",
      "count": "數量",
      "decimals": "小數位",
      "unique": "不重復",
      "generate": "生成",
      "err": {
        "INVALID_RANGE": "范圍無效：請確保最小值 ≦ 最大值，且去重時區間足夠大",
        "INVALID_COUNT": "數量需為 1–1000 的整數",
        "INVALID_DECIMALS": "小數位需為 0–10 的整數"
      }
    },
    "randomString": {
      "length": "長度",
      "count": "數量",
      "preset": "字符集",
      "presets": {
        "alnum": "字母+數字",
        "alpha": "僅字母",
        "hex": "十六進制",
        "base64": "Base64",
        "custom": "自定義"
      },
      "custom": "自定義字符",
      "customPlaceholder": "輸入可用字符…",
      "generate": "生成",
      "err": {
        "EMPTY_CHARSET": "請提供非空字符集",
        "INVALID_LENGTH": "長度需為 1–256 的整數",
        "INVALID_COUNT": "數量需為 1–100 的整數"
      }
    },
    "doodle": {
      "size": "粗細",
      "eraser": "橡皮",
      "clear": "清空",
      "download": "導出 PNG",
      "hint": "在畫布上拖拽繪制；支持觸控與鼠標"
    },
    "calculator": {
      "expression": "表達式",
      "placeholder": "例如 (1+2)*3 或 sqrt(9)+pi",
      "functions": "常用函數",
      "hint": "支持 + - * / % ^ () 與 sqrt/abs/sin/cos/tan/ln/log/floor/ceil/round，以及 pi、e",
      "err": {
        "EMPTY": "請輸入表達式",
        "SYNTAX": "表達式語法錯誤",
        "DIV_ZERO": "除數不能為 0"
      }
    },
    "codeImage": {
      "language": "語言",
      "theme": "主題",
      "themes": {
        "dark": "深色",
        "light": "淺色"
      },
      "lineNumbers": "行號",
      "padding": "內邊距",
      "download": "導出 PNG",
      "exporting": "導出中…",
      "input": "代碼",
      "preview": "預覽",
      "placeholder": "貼上代碼…"
    },
    "imageColor": {
      "dropHint": "拖入或選擇圖片（PNG / JPEG / WebP / GIF 等）",
      "empty": "上傳圖片後在此點擊取色",
      "picked": "取色結果",
      "preview": "顏色預覽",
      "clickHint": "點擊圖片上的像素以取樣",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "LOAD": "圖片加載失敗"
      }
    },
    "ascii": {
      "search": "搜尋",
      "searchPlaceholder": "十進制 / 十六進制 / 字符 / 名稱…",
      "dec": "十進制",
      "hex": "十六進制",
      "char": "字符",
      "name": "名稱",
      "hint": "控制字符無可見字形時顯示為 ·；可復制字符或 \\xHH"
    },
    "watermark": {
      "text": "水印文字",
      "position": "位置",
      "positions": {
        "top-left": "左上",
        "top-right": "右上",
        "center": "居中",
        "bottom-left": "左下",
        "bottom-right": "右下",
        "tile": "平鋪"
      },
      "color": "顏色",
      "fontSize": "字號",
      "opacity": "透明度",
      "rotate": "旋轉",
      "gap": "間距",
      "dropHint": "拖入或選擇要加水印的圖片",
      "original": "原圖",
      "result": "結果",
      "download": "下載 PNG",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "ENCODE": "處理失敗：請換一張圖片重試"
      }
    },
    "caseConvert": {
      "mode": "轉換方式",
      "placeholder": "輸入要轉換的文本…",
      "modes": {
        "upper": "全部大寫",
        "lower": "全部小寫",
        "title": "標題格式（Title Case）",
        "sentence": "句首大寫",
        "swap": "大小寫互換",
        "camel": "camelCase",
        "pascal": "PascalCase",
        "snake": "snake_case",
        "kebab": "kebab-case",
        "constant": "CONSTANT_CASE"
      },
      "err": {
        "EMPTY": "請輸入文本"
      }
    },
    "bmi": {
      "unit": "單位制",
      "metric": "公制（cm / kg）",
      "imperial": "英制（in / lb）",
      "heightCm": "身高（cm，也可填米）",
      "heightIn": "身高（英寸）",
      "weightKg": "體重（kg）",
      "weightLb": "體重（磅）",
      "bmi": "BMI",
      "category": "分級",
      "categories": {
        "underweight": "偏瘦",
        "normal": "正常",
        "overweight": "超重",
        "obese": "肥胖"
      },
      "hint": "分級依據 WHO 成人標准，僅供參考，不構成醫療建議。",
      "err": {
        "INVALID": "請輸入有效的身高與體重",
        "RANGE": "數值超出合理范圍，請核對單位與輸入"
      }
    },
    "placeholder": {
      "width": "寬度",
      "height": "高度",
      "bg": "背景色",
      "fg": "文字色",
      "text": "文字",
      "textPlaceholder": "預設顯示尺寸",
      "download": "下載 PNG",
      "err": {
        "INVALID_SIZE": "尺寸須為 16–4000 的整數",
        "INVALID_COLOR": "顏色須為 #RGB 或 #RRGGBB"
      }
    },
    "imageMerge": {
      "direction": "方向",
      "directions": {
        "horizontal": "橫向",
        "vertical": "縱向",
        "grid": "網格"
      },
      "gap": "間距（px）",
      "dropHint": "逐張添加圖片（最多 {{max}} 張）",
      "download": "下載合並圖",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "TOO_MANY": "圖片數量已達上限",
        "ENCODE": "合並失敗，請重試",
        "EMPTY": "請至少添加一張圖片"
      }
    },
    "cronGen": {
      "preset": "常用預設",
      "presetPick": "選擇預設…",
      "presets": {
        "everyMinute": "每分鐘",
        "hourly": "每小時（整點）",
        "daily": "每天 0:00",
        "weekly": "每周一 0:00",
        "monthly": "每月 1 日 0:00"
      },
      "fields": {
        "minute": "分鐘",
        "hour": "小時",
        "day": "日",
        "month": "月",
        "weekday": "星期"
      },
      "modes": {
        "every": "每（*）",
        "value": "指定值",
        "range": "范圍",
        "step": "步進",
        "list": "列表"
      },
      "listPlaceholder": "如 1,3,5",
      "everyHint": "該字段每次都匹配",
      "expression": "表達式",
      "openParser": "在解析工具中預覽",
      "hint": "標准 5 段：分 時 日 月 周（星期 0=周日）",
      "err": {
        "INVALID_FIELD": "字段取值不合法，請檢查范圍與列表"
      }
    },
    "uaParser": {
      "input": "User-Agent",
      "placeholder": "貼上 User-Agent 字符串…",
      "useCurrent": "使用當前瀏覽器",
      "field": "字段",
      "name": "名稱",
      "version": "版本",
      "extra": "補充",
      "fields": {
        "browser": "瀏覽器",
        "engine": "引擎",
        "os": "操作系統",
        "device": "設備",
        "cpu": "CPU"
      },
      "err": {
        "EMPTY": "請輸入 User-Agent"
      }
    },
    "latex": {
      "input": "LaTeX",
      "placeholder": "例如 E = mc^2 或 \\frac{a}{b}",
      "preview": "預覽",
      "displayMode": "獨立公式（display）",
      "copyHtml": "復制 HTML",
      "symbols": "快捷符號",
      "formulasTitle": "經典公式",
      "downloadPng": "導出 PNG",
      "downloadJpg": "導出 JPG",
      "downloadSvg": "導出 SVG",
      "exporting": "導出中…",
      "empty": "輸入公式以預覽",
      "hint": "點擊符號插入光標處；經典公式會替換當前內容。由 KaTeX 渲染，復雜宏可能不兼容。",
      "categories": {
        "operators": "運算符",
        "relations": "關系符號",
        "greek": "希臘字母",
        "trig": "三角函數",
        "calculus": "微積分",
        "sumprod": "求和與積",
        "set": "集合論",
        "logic": "邏輯符號",
        "arrows": "箭頭符號",
        "matrix": "矩陣向量",
        "special": "特殊符號"
      },
      "formulas": {
        "einstein": "質能方程",
        "quadratic": "求根公式",
        "pythagorean": "勾股定理",
        "euler": "歐拉公式",
        "binomial": "二項式定理",
        "taylor": "泰勒展開",
        "gaussian": "高斯積分",
        "cauchySchwarz": "柯西–施瓦茨",
        "bayes": "貝葉斯定理",
        "derivative": "導數定義",
        "fourier": "傅裡葉變換",
        "navierStokes": "納維–斯托克斯",
        "maxwell": "麥克斯韋方程",
        "schrodinger": "薛定諤方程",
        "normalDist": "正態分布",
        "matrix2x2Det": "二階行列式"
      },
      "err": {
        "EMPTY": "請輸入公式",
        "RENDER": "渲染失敗：{{message}}"
      }
    },
    "countdown": {
      "hours": "時",
      "minutes": "分",
      "seconds": "秒",
      "start": "開始",
      "pause": "暫停",
      "resume": "繼續",
      "reset": "重置",
      "done": "時間到！",
      "err": {
        "INVALID": "請輸入合法的時 / 分 / 秒",
        "ZERO": "時長須大於 0"
      }
    },
    "stopwatch": {
      "start": "開始",
      "pause": "暫停",
      "resume": "繼續",
      "reset": "重置",
      "lap": "計圈",
      "lapIndex": "圈",
      "lapTime": "本圈",
      "totalTime": "累計"
    },
    "svgPng": {
      "input": "SVG 源碼",
      "placeholder": "貼上 SVG 標記…",
      "dropHint": "拖入或選擇 .svg 文件",
      "scale": "縮放",
      "transparent": "透明背景",
      "download": "下載 PNG",
      "sizeHint": "源 {{sw}}×{{sh}} → 輸出 {{pw}}×{{ph}}",
      "err": {
        "EMPTY": "請輸入 SVG",
        "INVALID_SVG": "不是有效的 SVG",
        "INVALID_SIZE": "輸出尺寸非法（檢查縮放，最大邊 8192）",
        "ENCODE": "轉換失敗，請檢查 SVG 或縮小縮放倍數"
      }
    },
    "imageFrame": {
      "borderWidth": "邊框寬度",
      "borderColor": "邊框顏色",
      "radius": "圓角",
      "shadowBlur": "陰影模糊",
      "shadowOffsetY": "陰影偏移",
      "shadowOpacity": "陰影透明度",
      "dropHint": "拖入或選擇圖片",
      "download": "下載 PNG",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "ENCODE": "處理失敗，請換一張圖片重試"
      }
    },
    "imageAdjust": {
      "brightness": "亮度",
      "contrast": "對比度",
      "saturate": "飽和度",
      "hue": "色相",
      "reset": "重置參數",
      "dropHint": "拖入或選擇要調色的圖片",
      "original": "原圖",
      "download": "下載 PNG",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "ENCODE": "處理失敗，請換一張圖片重試"
      }
    },
    "gifFrames": {
      "dropHint": "拖入或選擇 GIF 文件",
      "meta": "{{w}}×{{h}} · {{n}} 幀",
      "download": "下載",
      "downloadAll": "下載全部幀",
      "err": {
        "NOT_GIF": "請選擇 GIF 文件",
        "EMPTY": "文件為空",
        "PARSE": "GIF 解析失敗"
      }
    },
    "imageCrop": {
      "aspect": "比例",
      "aspects": {
        "free": "自由",
        "1_1": "1:1",
        "4_3": "4:3",
        "3_4": "3:4",
        "16_9": "16:9",
        "9_16": "9:16"
      },
      "x": "X",
      "y": "Y",
      "width": "寬",
      "height": "高",
      "dropHint": "拖入或選擇要裁剪的圖片",
      "hint": "自由比例下可拖拽框選；也可用下方數值精確調整",
      "download": "下載 PNG",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "ENCODE": "裁剪失敗，請重試",
        "INVALID": "裁剪區域無效"
      }
    },
    "mbti": {
      "progress": "已答 {{done}} / {{total}}",
      "questionIndex": "第 {{n}} / {{total}} 題",
      "prev": "上一題",
      "next": "下一題",
      "submit": "查看結果",
      "reset": "清空",
      "retake": "重新測試",
      "yourType": "你的類型傾向",
      "hint": "選擇更貼近你的一項；全部答完後可提交。",
      "disclaimer": "本測試為簡化娛樂版，結果不構成專業心理評估。",
      "dims": {
        "EI": "外向 E / 內向 I",
        "SN": "實感 S / 直覺 N",
        "TF": "思考 T / 情感 F",
        "JP": "判斷 J / 感知 P"
      }
    },
    "textCard": {
      "theme": "主題",
      "themes": {
        "slate": "石板",
        "ocean": "海洋",
        "sunset": "日落",
        "forest": "森林",
        "mono": "黑白",
        "paper": "紙感"
      },
      "align": "對齊",
      "aligns": {
        "left": "左對齊",
        "center": "居中",
        "right": "右對齊"
      },
      "fontSize": "字號",
      "padding": "內邊距",
      "width": "寬度",
      "title": "標題",
      "titlePlaceholder": "可選標題…",
      "body": "正文",
      "bodyPlaceholder": "輸入要做成卡片的文字…",
      "preview": "預覽",
      "empty": "輸入標題或正文以預覽",
      "download": "導出 PNG",
      "exporting": "導出中…"
    },
    "imageCard": {
      "shadow": "陰影",
      "padding": "內邊距",
      "radius": "區塊圓角",
      "width": "寬度",
      "textPosition": "文字位置",
      "positions": {
        "below": "圖片下方",
        "above": "圖片上方"
      },
      "align": "對齊",
      "aligns": {
        "left": "左",
        "center": "中",
        "right": "右"
      },
      "textPadding": "文字內邊距",
      "textBg": "文字背景",
      "titleSize": "標題字號",
      "subtitleSize": "副標題字號",
      "rotate": "照片旋轉",
      "backdrop": "背景層",
      "backdropModes": {
        "preset": "預設",
        "color": "純色",
        "gradient": "漸變"
      },
      "backdropColor": "背景色",
      "gradientFrom": "漸變起點",
      "gradientTo": "漸變終點",
      "gradientAngle": "漸變角度",
      "backdrops": {
        "paper": "紙白",
        "fog": "薄霧",
        "night": "夜色",
        "mint": "薄荷",
        "sand": "沙色",
        "ink": "墨色",
        "sunset": "日落",
        "ocean": "海洋",
        "lavender": "薰衣草",
        "peach": "蜜桃",
        "aurora": "極光",
        "charcoal": "炭灰"
      },
      "title": "標題",
      "titlePlaceholder": "卡片標題…",
      "subtitle": "副標題",
      "subtitlePlaceholder": "補充說明…",
      "dropHint": "拖入或選擇要做成卡片的圖片",
      "empty": "上傳圖片後即可預覽卡片",
      "download": "導出 PNG",
      "exporting": "導出中…",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "ENCODE": "導出失敗，請換一張圖片重試"
      }
    },
    "codeHighlight": {
      "language": "語言",
      "theme": "主題",
      "themes": {
        "dark": "深色",
        "light": "淺色"
      },
      "lineNumbers": "行號",
      "input": "代碼",
      "preview": "高亮預覽",
      "placeholder": "貼上代碼…",
      "copyCode": "復制代碼",
      "copyHtml": "復制 HTML",
      "hint": "基於 Prism 高亮；可復制帶 class 的 HTML 片段用於博客等場景。"
    },
    "imageBase64": {
      "upload": "圖片 → Base64",
      "uploadHint": "拖拽或選擇圖片",
      "copyDataUrl": "復制 Data URL",
      "base64Out": "Base64",
      "paste": "Base64 → 圖片",
      "pastePlaceholder": "貼上 Data URL 或純 Base64…",
      "err": {
        "EMPTY": "請輸入 Base64 或選擇圖片",
        "INVALID_BASE64": "Base64 格式無效",
        "NOT_IMAGE": "請選擇圖片文件"
      }
    },
    "imageIco": {
      "mode": "模式",
      "toIco": "圖片 → ICO",
      "fromIco": "ICO → PNG",
      "sizes": "尺寸",
      "uploadImageHint": "拖拽或選擇 PNG / JPG / WebP 等圖片",
      "uploadIcoHint": "拖拽或選擇 .ico 文件",
      "convert": "生成 ICO",
      "converting": "處理中…",
      "downloadIco": "下載 ICO",
      "downloadPng": "下載 PNG",
      "extracted": "已從 {{name}} 提取 {{n}} 個尺寸",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "NOT_ICO": "請選擇 ICO 文件",
        "USE_FROM_ICO": "請切換到「ICO → PNG」模式打開 ICO",
        "NO_SIZES": "請至少選擇一個尺寸",
        "EMPTY": "文件為空",
        "INVALID_ICO": "ICO 文件無效或已損壞",
        "ENCODE": "生成失敗，請換一張圖片重試"
      }
    },
    "hsvCmyk": {
      "preview": "顏色預覽"
    },
    "aiPrompts": {
      "search": "搜尋",
      "searchPlaceholder": "關鍵詞…",
      "category": "分類",
      "empty": "沒有匹配的提示詞",
      "cat": {
        "all": "全部",
        "writing": "寫作",
        "coding": "編程",
        "translate": "翻譯",
        "marketing": "營銷",
        "learning": "學習",
        "career": "職場"
      }
    },
    "mdMindmap": {
      "input": "Markdown",
      "placeholder": "# 主題\n## 分支\n- 要點…",
      "preview": "思維導圖",
      "theme": "主題",
      "themes": {
        "sky": "天空",
        "forest": "森林",
        "sunset": "日落",
        "grape": "葡萄",
        "ocean": "海洋",
        "mono": "黑白"
      },
      "zoomIn": "放大",
      "zoomOut": "縮小",
      "zoomReset": "重置縮放",
      "zoomHint": "預覽區按住 Ctrl / ⌘ + 滾輪可縮放",
      "downloadSvg": "導出 SVG",
      "downloadPng": "導出 PNG",
      "download": "導出 SVG",
      "exporting": "導出中…",
      "empty": "輸入 Markdown 標題或列表以生成導圖",
      "err": {
        "EMPTY": "請輸入 Markdown 內容"
      }
    },
    "mermaid": {
      "input": "Mermaid",
      "placeholder": "flowchart TD\n  A-->B",
      "preview": "預覽",
      "theme": "主題",
      "themes": {
        "default": "預設",
        "neutral": "中性",
        "forest": "森林",
        "dark": "深色",
        "ocean": "海洋",
        "sunset": "日落",
        "mono": "黑白"
      },
      "zoomIn": "放大",
      "zoomOut": "縮小",
      "zoomReset": "重置縮放",
      "zoomHint": "預覽區按住 Ctrl / ⌘ + 滾輪可縮放",
      "downloadSvg": "導出 SVG",
      "downloadPng": "導出 PNG",
      "download": "導出 SVG",
      "exporting": "導出中…",
      "empty": "輸入 Mermaid 語法以渲染",
      "rendering": "渲染中…",
      "err": {
        "RENDER": "渲染失敗：{{message}}"
      }
    },
    "cssGradient": {
      "type": "類型",
      "linear": "線性",
      "radial": "徑向",
      "angle": "角度",
      "shape": "形狀",
      "preview": "漸變預覽",
      "stops": "色標",
      "addStop": "添加色標",
      "position": "位置 %",
      "removeStop": "刪除",
      "css": "CSS",
      "presetsTitle": "常用預設",
      "presetCategories": {
        "warm": "暖色系",
        "cool": "冷色系",
        "nature": "自然綠",
        "pink": "浪漫粉",
        "purple": "神秘紫",
        "dark": "深色系",
        "light": "淺色系",
        "rainbow": "多彩",
        "sunset": "日落",
        "ocean": "海洋"
      },
      "presetNames": {
        "warm-golden": "金色暖陽",
        "warm-peach": "蜜桃",
        "warm-coral": "珊瑚",
        "warm-amber": "琥珀",
        "warm-spice": "香料橙",
        "warm-rose-gold": "玫瑰金",
        "warm-papaya": "木瓜奶",
        "warm-flame": "烈焰",
        "warm-honey": "蜂蜜金",
        "warm-terracotta": "陶土橙",
        "warm-mango": "芒果",
        "warm-autumn": "秋日",
        "warm-cinnamon": "肉桂",
        "warm-tangerine": "柑橘",
        "warm-sunset-orange": "落日橙",
        "warm-brick": "磚紅",
        "warm-caramel": "焦糖",
        "warm-radial": "暖陽光暈",
        "warm-saffron": "藏紅花",
        "warm-burnt": "焦褐",
        "warm-apricot": "杏色",
        "cool-arctic": "極地藍",
        "cool-ice": "冰藍",
        "cool-frost": "霜凍",
        "cool-steel": "鋼鐵灰",
        "cool-mint-ice": "薄荷冰",
        "cool-glacier": "冰川",
        "cool-skyline": "天際線",
        "cool-polar": "極地光暈",
        "cool-nordic": "北歐灰",
        "cool-periwinkle": "長春花藍",
        "cool-cobalt": "鈷藍",
        "cool-teal-breeze": "青綠微風",
        "cool-sapphire": "藍寶石",
        "cool-winter": "冬日",
        "cool-azure": "天青三色",
        "cool-denim": "丹寧藍",
        "cool-moonlight": "月光",
        "cool-cyan": "青藍",
        "cool-harbor": "港灣",
        "cool-iceberg": "冰山",
        "nature-forest": "森林",
        "nature-moss": "苔蘚",
        "nature-jungle": "叢林",
        "nature-spring": "春日",
        "nature-fern": "蕨葉",
        "nature-matcha": "抹茶",
        "nature-emerald": "翡翠",
        "nature-leaf": "綠葉光暈",
        "nature-bamboo": "竹青",
        "nature-pine": "松林",
        "nature-sage": "鼠尾草",
        "nature-meadow": "草甸",
        "nature-rainforest": "雨林",
        "nature-olive": "橄欖",
        "nature-cypress": "柏樹",
        "nature-mint": "薄荷",
        "nature-tea": "茶園",
        "nature-canopy": "樹冠",
        "nature-dew": "晨露",
        "nature-avocado": "牛油果",
        "pink-blush": "腮紅",
        "pink-rose": "玫瑰",
        "pink-cotton": "棉花糖",
        "pink-sakura": "櫻花",
        "pink-cherry": "櫻桃",
        "pink-bubble": "泡泡糖",
        "pink-dream": "夢境粉",
        "pink-valentine": "情人節",
        "pink-lotus": "蓮花",
        "pink-peony": "牡丹",
        "pink-strawberry": "草莓",
        "pink-fairy": "仙女粉",
        "pink-magnolia": "玉蘭",
        "pink-petal": "花瓣",
        "pink-candy": "糖果粉",
        "pink-radial": "粉暈",
        "pink-rosewater": "玫瑰水",
        "pink-ballet": "芭蕾粉",
        "purple-galaxy": "星河",
        "purple-mystic": "神秘紫調",
        "purple-amethyst": "紫水晶",
        "purple-velvet": "絲絨紫",
        "purple-neon": "霓虹紫",
        "purple-twilight": "暮光紫",
        "purple-royal": "皇家紫",
        "purple-orb": "紫晶光球",
        "purple-lilac": "丁香紫",
        "purple-indigo": "靛藍紫",
        "purple-plum": "梅子",
        "purple-cosmic": "宇宙紫",
        "purple-dusk": "暮紫",
        "purple-wine": "酒紅紫",
        "purple-iris": "鳶尾",
        "purple-void": "虛空",
        "purple-haze": "紫霧",
        "purple-orchid": "蘭花紫",
        "purple-aurora": "極光紫",
        "purple-midnight": "午夜紫",
        "dark-charcoal": "炭灰",
        "dark-midnight": "午夜",
        "dark-slate": "板岩",
        "dark-eclipse": "日蝕",
        "dark-carbon": "碳黑",
        "dark-noir": "黑色電影",
        "dark-abyss": "深淵",
        "dark-spotlight": "聚光暗場",
        "dark-obsidian": "黑曜石",
        "dark-graphite": "石墨",
        "dark-onyx": "縞瑪瑙",
        "dark-storm": "風暴夜",
        "dark-ink": "墨黑",
        "dark-vignette": "暗角",
        "dark-smoke": "煙灰",
        "dark-raven": "烏鴉羽",
        "dark-void": "虛空黑",
        "light-cloud": "雲朵",
        "light-pearl": "珍珠",
        "light-mist": "薄霧",
        "light-cream": "奶油",
        "light-linen": "亞麻",
        "light-sand": "沙灘",
        "light-lavender": "淡紫霧",
        "light-glow": "柔光",
        "light-ivory": "象牙",
        "light-snow": "雪白",
        "light-blush": "淡粉",
        "light-morning": "清晨",
        "light-silk": "絲綢",
        "light-frost": "霜白",
        "light-champagne": "香檳",
        "light-dawn": "晨曦",
        "light-powder": "粉藍",
        "light-cotton": "棉白",
        "rainbow-classic": "經典彩虹",
        "rainbow-neon": "霓虹彩",
        "rainbow-candy": "糖果色",
        "rainbow-aurora": "極光",
        "rainbow-sunset": "日落彩",
        "rainbow-pastel": "馬卡龍",
        "rainbow-vivid": "鮮豔三色",
        "rainbow-prism": "棱鏡",
        "rainbow-spectrum": "光譜",
        "rainbow-holo": "全息彩",
        "rainbow-pop": "波普",
        "rainbow-soda": "汽水",
        "rainbow-tropical": "熱帶",
        "rainbow-laser": "激光",
        "rainbow-universe": "宇宙彩",
        "rainbow-dream": "夢幻彩",
        "rainbow-galaxy": "星系彩",
        "rainbow-confetti": "彩紙",
        "rainbow-cyber": "賽博",
        "rainbow-retro": "復古雙彩",
        "rainbow-synth": "合成波",
        "rainbow-cotton": "棉花糖彩",
        "rainbow-electric": "電光",
        "rainbow-sunrise": "日出彩",
        "sunset-dusk": "暮色",
        "sunset-horizon": "地平線",
        "sunset-glow": "余暉",
        "sunset-beach": "海灘日落",
        "sunset-desert": "沙漠黃昏",
        "sunset-evening": "傍晚",
        "sunset-fire": "火燒雲",
        "sunset-radial": "落日光暈",
        "sunset-amber": "琥珀暮",
        "sunset-crimson": "緋紅暮",
        "sunset-twilight": "暮光",
        "sunset-mango": "芒果暮",
        "sunset-ember": "余燼",
        "sunset-sky": "天際暮",
        "sunset-sahara": "撒哈拉",
        "sunset-golden": "金色暮",
        "sunset-coast": "海岸暮",
        "sunset-violet": "紫霞",
        "sunset-radial-glow": "落日圓暈",
        "sunset-lake": "湖畔暮",
        "ocean-deep": "深海",
        "ocean-wave": "海浪",
        "ocean-lagoon": "瀉湖",
        "ocean-reef": "珊瑚礁",
        "ocean-abyss": "海溝",
        "ocean-tide": "潮汐",
        "ocean-coral": "碧海",
        "ocean-bubble": "海底氣泡",
        "ocean-marine": "海軍藍",
        "ocean-aqua": "水藍",
        "ocean-storm": "風暴海",
        "ocean-seafoam": "海沫",
        "ocean-caribbean": "加勒比",
        "ocean-pacific": "太平洋",
        "ocean-arctic": "北極海",
        "ocean-turquoise": "綠松石",
        "ocean-depth": "深海光暈",
        "ocean-surf": "沖浪",
        "ocean-kelp": "海藻",
        "ocean-mist": "海霧",
        "ocean-pearl": "海珍珠"
      }
    },
    "imageToPaper": {
      "paper": "紙張",
      "orientation": "方向",
      "portrait": "縱向",
      "landscape": "橫向",
      "fit": "適配",
      "contain": "完整放入",
      "cover": "鋪滿裁切",
      "margin": "邊距 (mm)",
      "uploadHint": "拖拽或選擇圖片",
      "downloadPng": "下載 PNG",
      "downloadPdf": "導出 PDF",
      "exporting": "導出中…",
      "err": {
        "NOT_IMAGE": "請選擇圖片文件",
        "INVALID_MARGIN": "邊距無效",
        "INVALID_IMAGE": "圖片尺寸無效"
      }
    },
    "mdToImage": {
      "gfm": "GFM",
      "breaks": "換行轉 <br>",
      "font": "字體",
      "fonts": {
        "sans": "無襯線",
        "serif": "襯線",
        "mono": "等寬",
        "song": "宋體",
        "hei": "黑體"
      },
      "fontSize": "字號",
      "width": "寬度",
      "padding": "內邊距",
      "lineHeight": "行高",
      "fg": "文字色",
      "bg": "背景色",
      "download": "導出 PNG",
      "exporting": "導出中…",
      "input": "Markdown",
      "placeholder": "# 標題\n正文…",
      "preview": "預覽",
      "err": {
        "EMPTY": "請輸入 Markdown",
        "PARSE": "解析失敗",
        "INVALID_COLOR": "顏色須為 #RGB 或 #RRGGBB",
        "INVALID_SIZE": "字號 / 寬度 / 內邊距 / 行高超出范圍",
        "INVALID_FONT": "不支持的字體"
      }
    },
    "chartGenerator": {
      "type": "類型",
      "types": {
        "bar": "柱狀圖",
        "hbar": "條形圖",
        "line": "折線圖",
        "area": "面積圖",
        "pie": "餅圖",
        "doughnut": "環形圖",
        "scatter": "散點圖"
      },
      "bar": "柱狀圖",
      "line": "折線圖",
      "pie": "餅圖",
      "title": "標題",
      "seriesLabel": "資料集標簽",
      "legend": "圖例位置",
      "legends": {
        "top": "上方",
        "bottom": "下方",
        "left": "左側",
        "right": "右側",
        "none": "隱藏"
      },
      "colorScheme": "配色方案",
      "schemes": {
        "vibrant": "鮮豔",
        "pastel": "馬卡龍",
        "ocean": "海洋",
        "sunset": "日落",
        "forest": "森林",
        "mono": "黑白",
        "rainbow": "彩虹"
      },
      "xLabel": "X 軸標簽",
      "yLabel": "Y 軸標簽",
      "xLabelPlaceholder": "例如：月份",
      "yLabelPlaceholder": "例如：銷量",
      "color": "主色",
      "width": "寬",
      "height": "高",
      "data": "資料 (CSV)",
      "dataPlaceholder": "標簽,數值\n蘋果,30\n香蕉,20",
      "preview": "預覽",
      "downloadSvg": "下載 SVG",
      "downloadPng": "下載 PNG",
      "copySvg": "復制 SVG",
      "err": {
        "EMPTY": "請輸入資料",
        "INVALID": "資料格式無效",
        "NO_NUMERIC": "未找到有效數值"
      }
    },
    "css3Generator": {
      "linked": "四角聯動",
      "topLeft": "左上",
      "topRight": "右上",
      "bottomRight": "右下",
      "bottomLeft": "左下",
      "offsetX": "X 偏移",
      "offsetY": "Y 偏移",
      "blur": "模糊",
      "spread": "擴散",
      "color": "顏色",
      "inset": "內陰影",
      "translateX": "平移 X",
      "translateY": "平移 Y",
      "rotate": "旋轉",
      "scale": "縮放",
      "skewX": "傾斜 X",
      "property": "屬性",
      "duration": "時長 (s)",
      "timing": "緩動",
      "delay": "延遲 (s)",
      "brightness": "亮度",
      "contrast": "對比度",
      "saturate": "飽和度",
      "grayscale": "灰度",
      "hueRotate": "色相旋轉",
      "preview": "預覽",
      "previewLabel": "預覽塊",
      "css": "CSS",
      "modules": {
        "borderRadius": "圓角",
        "boxShadow": "盒陰影",
        "textShadow": "文字陰影",
        "transform": "變換",
        "transition": "過渡",
        "filter": "濾鏡"
      }
    },
    "pdf-merge": {
      "hint": "全部在本地合並，文件不會上傳。建議單文件 < 50MB。",
      "drop": "拖入多個 PDF",
      "run": "合並並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-split": {
      "hint": "按頁拆分為多個 PDF 並依次下載。",
      "asZip": "打包為 ZIP 下載",
      "drop": "拖入 PDF",
      "run": "拆分並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-delete-pages": {
      "hint": "輸入要刪除的頁碼，如 1,3-5。至少保留一頁。",
      "pages": "刪除頁碼",
      "run": "刪除並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-extract-pages": {
      "hint": "輸入要提取的頁碼，如 1,3-5。",
      "pages": "提取頁碼",
      "run": "提取並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-reorder": {
      "hint": "用上下箭頭調整頁面順序後導出。",
      "pagesUnit": "頁",
      "pageLabel": "第 {{n}} 頁",
      "run": "應用排序並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-rotate": {
      "hint": "選擇角度，可旋轉全部或指定頁。",
      "allPages": "全部頁面",
      "pages": "頁碼",
      "run": "旋轉並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-to-image": {
      "hint": "使用本地渲染導出圖片；大文件可能較慢。",
      "scale": "縮放",
      "pages": "頁碼（可選）",
      "pagesAll": "留空表示全部",
      "run": "導出圖片",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "images-to-pdf": {
      "hint": "每張圖片一頁，按像素尺寸生成 PDF。",
      "drop": "拖入多張圖片",
      "run": "生成 PDF",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-viewer": {
      "hint": "本地預覽，不會上傳文件。",
      "prev": "上一頁",
      "next": "下一頁",
      "scale": "縮放",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-page-numbers": {
      "hint": "格式支持 {n} 與 {total}。",
      "format": "頁碼格式",
      "fontSize": "字號",
      "startFrom": "起始頁碼",
      "run": "添加頁碼並下載",
      "pos": {
        "bottom-center": "底部居中",
        "bottom-left": "底部靠左",
        "bottom-right": "底部靠右",
        "top-center": "頂部居中"
      },
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-header-footer": {
      "hint": "頁眉/頁腳至少填寫一項。",
      "header": "頁眉",
      "footer": "頁腳",
      "fontSize": "字號",
      "run": "應用並下載",
      "align": {
        "left": "左",
        "center": "中",
        "right": "右"
      },
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-insert-image": {
      "hint": "坐標原點在頁面左下角（PDF 坐標系）。",
      "pdf": "PDF 文件",
      "image": "圖片（PNG/JPG）",
      "allPages": "全部頁面",
      "pages": "頁碼",
      "width": "寬度",
      "run": "插入並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-add-text": {
      "hint": "坐標原點在頁面左下角；復雜 Unicode 可能受限。",
      "text": "文本",
      "allPages": "全部頁面",
      "pages": "頁碼",
      "fontSize": "字號",
      "color": "顏色",
      "run": "添加並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-sign": {
      "hint": "外觀簽名（圖片疊加），不是數字證書簽名。",
      "upload": "上傳簽名圖",
      "draw": "手寫簽名",
      "allPages": "全部頁面",
      "pages": "頁碼",
      "width": "寬度",
      "run": "簽名並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-metadata": {
      "hint": "編輯標題、作者等元資料後下載。",
      "pages": "共 {{n}} 頁",
      "run": "保存並下載",
      "fields": {
        "title": "標題",
        "author": "作者",
        "subject": "主題",
        "keywords": "關鍵詞",
        "creator": "創建者",
        "producer": "制作程序"
      },
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-encrypt": {
      "hint": "設置打開密碼與權限。兼容性因閱讀器而異。",
      "userPassword": "打開密碼",
      "ownerPassword": "所有者密碼",
      "ownerHint": "留空則與打開密碼相同",
      "run": "加密並下載",
      "perm": {
        "printing": "允許打印",
        "copying": "允許復制",
        "modifying": "允許修改",
        "annotating": "允許標注"
      },
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-crop": {
      "hint": "邊距單位為 PDF 點（pt，約 1/72 英寸）。",
      "top": "上",
      "right": "右",
      "bottom": "下",
      "left": "左",
      "run": "裁剪並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-grayscale": {
      "hint": "視覺灰度：逐頁渲圖後重打 PDF，文字將不可再選中編輯。",
      "run": "轉灰度並下載",
      "errors": {
        "EMPTY": "請完善輸入",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "pdf-annotate": {
      "hint": "打開 PDF 後在頁面上直接繪制標注，支持畫筆、高亮、矩形、橢圓、圓、直線與文本。",
      "drop": "拖入 PDF",
      "stroke": "線寬",
      "fontSize": "字號",
      "scale": "縮放",
      "undo": "撤銷",
      "clearPage": "清空本頁",
      "prev": "上一頁",
      "next": "下一頁",
      "count": "已標注 {{n}} 處",
      "textPrompt": "輸入標注文字",
      "needVisitPage": "請先切換到第 {{n}} 頁以完成渲染後再導出",
      "run": "導出標注 PDF",
      "kinds": {
        "pen": "畫筆",
        "highlight": "高亮",
        "rect": "矩形",
        "ellipse": "橢圓",
        "circle": "圓形",
        "line": "直線",
        "text": "文本"
      },
      "errors": {
        "EMPTY": "請先繪制至少一處標注",
        "NOT_PDF": "請上傳 PDF 文件",
        "NOT_IMAGE": "請上傳圖片文件",
        "LOAD_FAILED": "無法讀取 PDF",
        "NO_PAGES": "文檔沒有可用頁面",
        "INVALID_RANGE": "頁碼范圍無效",
        "TOO_LARGE": "文件過大（建議 < 50MB）",
        "ENCRYPT_FAILED": "加密失敗",
        "PROCESS_FAILED": "處理失敗"
      }
    },
    "xsltTransform": {
      "sample": "載入示例",
      "xml": "XML",
      "xmlPlaceholder": "貼上 XML…",
      "xslt": "XSLT",
      "xsltPlaceholder": "貼上 XSLT 樣式表…",
      "output": "輸出",
      "preview": "HTML 預覽",
      "err": {
        "EMPTY_XML": "請輸入 XML",
        "EMPTY_XSLT": "請輸入 XSLT",
        "INVALID_XML": "XML 無效",
        "INVALID_XSLT": "XSLT 無效",
        "TRANSFORM": "轉換失敗"
      }
    }
  }
} satisfies TranslationResources;

export default zhTW;
