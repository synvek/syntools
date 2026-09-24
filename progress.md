# Progress

## 2026-09-24

- 完成现状盘点与竞品分析：111 个工具，网络类仅 2 个为最大塌陷区。
- 生成扩充计划（41 个工具 / 3 个新分类），用户确认后开始执行。
- 核实 i18n 加载方式、分类派生链路、体积预算、通用组件契约。
- **基座**：`types.ts` 新增 file/media/cheatsheet 三类；`categories.ts` 追加 order 11/12/13；`Icon.tsx` 补 14 个内联图标；脚本 `inject-tool-locales.mjs` 批量注入 9 语言 `categories.*` 键成功。
- **批次 1（网络 8 个）完成**：ip-calc / mac-address / url-parser / ua-generator / http-headers / http-request / websocket-tester / random-port。core + UI + 单测（59 通过）+ 9 语言 toolMeta/tools 键 + 注册表接入齐全；`tsc -b` 与 `eslint` 零错误。
- 教训：① `CopyButton` 独立模块而非 ActionButtons；② `decodePayload` 需兼容跨 realm 的 ArrayBuffer；③ 文案注入后 `err.*` 会被脚本折叠为 `err: { ... }` 嵌套对象，新增同级键须插在 `err: {` 之前。

- **批次 2（PDF 4 个）完成**：pdf-extract-text / pdf-decrypt / pdf-watermark / pdf-compress。复用 `@/core/pdf`（openPdfjsDoc / loadPdfFromBytes / parsePageSelection / downloadBytes）与 ui 辅助组件；错误码对齐 NOT_PDF/TOO_LARGE/NEED_PASSWORD/WRONG_PASSWORD/LOAD_FAILED/NO_PAGES/PROCESS_FAILED。14 单测通过，tsc/lint 零错误。

- **批次 3（编码 5 个）完成**：base-encoding / morse-code / caesar-cipher / escape-unescape / encoding-rescue。
  - 修复的核心 bug：① base58 解码误用 `String.prototype.split('').takeWhile(...)`（该方法不存在，运行时抛错被 catch 成 INVALID）→ 改为 while 循环统计前导 '1'；② caesar atbash 未保持大小写（A→Z 而非 a→z）；③ rail-fence 加密/解密用的是同一方向置换（非自逆），重写标准栅栏算法并给 UI 补「解密」开关；④ morse 多词分隔符因 `replace(/\s+\//g,' / ')` 在拼接时已带空格而多加一个空格 → 改为 `replace(/\s*\/\s*/g,' / ')`；⑤ encoding-rescue 用 `TextEncoder` 重新 UTF-8 编码导致字节改变无法还原 → 改用 `charCodeAt` 还原原始字节（对应「Latin1 误读」型乱码，最典型可还原场景），测试改为 GBK 字节被 Latin1 误读用例；⑥ escape-unescape 测试对 URL 空格期望写错（应为 `a%20b`）→ 修正。
  - 额外：`Icon.tsx` 补 `code` 内联图标；`caesar-cipher` locale 增 `decrypt` 键（9 语）。
  - 全量门禁：tsc 零错误、eslint 零警告（含 `--max-warnings 0`）、vitest 1012/0、首屏 184.27KB ≤ 185KB。
  - 关键修复：`src/test/setup.ts` 原本未在测试环境锁定语言，i18n 默认 `en`，导致 CopyButton/FileDropZone/IOTextArea/ActionButtons 四个共享组件测试（断言中文）长期失败。已补 `i18n.changeLanguage('zh')`（zh/en 均同步打包，不影响生产构建），4 个文件 17 用例转绿，全量测试自此全绿。

- **批次 4（crypto 5 个）完成**：checksum / password-strength / password-hash / rsa-crypto / key-converter。全部零新增依赖（checksum、password-strength 纯 JS；其余基于原生 WebCrypto）。
  - checksum：CRC-32 / Adler-32 / FNV-1a(32/64) 表驱动自实现；`computeChecksum` 返回裸字符串，`checksum` 包装 ToolResult（UI 直接用裸值，避免 ToolResult 取 value 的类型问题）。
  - password-strength：基于字符集熵 + 顺序/重复/常见弱口令惩罚，返回 score/label/issues 供 9 语言渲染。
  - password-hash：PBKDF2（SHA-256/512）通过 `crypto.subtle.deriveBits`，支持自定义 hex 盐与迭代次数，输出 `pbkdf2$<hash>$<iters>$<salt>$<hash>` 通用串。
  - rsa-crypto：RSA-OAEP 加解密 + RSA-PSS 签名验签 + 密钥对生成；PEM(SPKI/PKCS#8/PKCS#1) 解析；同一密钥材料在验签时按 RSA-PSS 重新 import（WebCrypto 密钥与算法绑定，故加解密用 OAEP import、签名验签用 PSS import）。
  - key-converter：PEM / DER(base64) / JWK / OpenSSH 互转；OpenSSH 为 RSA 公钥自实现（SSH string/mpint 编码）；**关键坑**：`parseToJwk` 要 exportKey('jwk')，所有 importKey 必须 `extractable=true`，否则报 `InvalidAccessException: key is not extractable`。
  - **TS 坑**：TS 的 `crypto.subtle.importKey` 类型不含 `'pkcs1'`（浏览器/Node 运行时支持），需 `format as 'spki' | 'pkcs8'` 断言。
  - **测试坑**：`generateRsaKeyPair` 返回 `ToolResult`，测试须取 `kp.value.publicKey`；FNV-1a-64("hello") 正确常量为 `A430D84680AABD0B`；密码强度测试样例含 `klm` 会命中顺序惩罚，改用 `Pm5#Vb2@Kx9Qz7`。
  - 新增 `Icon.tsx` 内联图标：`view` / `view-off`。
  - 全量门禁：vitest 161 files / 1052 tests 全绿、tsc 零错误、eslint 全量零警告、首屏 184.27KB ≤ 185KB。

- **批次 5（格式化与生成器 4 个）完成**：csv-tool / code-minify / id-generator / barcode。全部零新增依赖。
  - csv-tool：RFC4180 解析（引号、双引号转义、CRLF、可配置分隔符）+ CSV↔JSON。
  - code-minify：CSS 走已存在的 `csso`（动态 import 保持懒加载）；HTML/JS 为保守实现（仅去注释与多余空白，**保留换行避免 ASI**）；JSON 走 `JSON.stringify(JSON.parse)`。`stripJsComments` 正确处理字符串/模板/正则字面量（区分除号与正则起始），修掉了「正则含 `//` 被误当注释」的隐患。
  - id-generator：ULID（Crockford base32，48+80 bit，含时间解析）、NanoID（64 字符表，位掩码无偏）、Snowflake（41+10+12，BigInt）、ObjectId（4+5+3 字节，含时间解析）。与既有 `uuid`（仅 v4/v7）互补。
  - barcode：Code 39 / Code 128B / EAN-13 编码表自实现 → SVG（`renderSvg` 输出 rect）；EAN-13 含校验位计算与校验；UI 用 data URL `<img>` 预览并可下载 SVG。
  - 复用：`ShareButton` + `readSharedState`（uuid 同款）、`common.download` 等共享 key。
  - 全量门禁：vitest 165 files / 1093 tests 全绿、tsc 零错误、eslint 批次零警告、首屏 184.27KB ≤ 185KB。

- **批次 6（文件工具 3 个）完成**：zip-manager / file-split-merge / bulk-rename。新增 `src/core/lib/download.ts`（`downloadBlob` / `downloadText`，二进制下载复用）。
  - zip-manager：基于既有依赖 `jszip`（懒加载 chunk 29KB ✅）。`createZip` 返回 **Uint8Array**（不用 `type:'blob'`，jsdom 下不可靠）；**关键坑**：jsdom 里测试用 `TextEncoder` 产生的 `Uint8Array` 与 jszip 的 `instanceof` 跨 realm 失败 → 报 "Can't read the data"，需 `new Uint8Array(file.data)` 复制到当前 realm。列目录用 `_data.uncompressedSize` 读尺寸。
  - file-split-merge：纯函数 `splitBytes`（按大小/数量均分）与 `mergeBytes`，合并按文件名自然排序。
  - bulk-rename：前后缀 / 查找替换（可选正则）/ 大小写 / 编号（起始+补零+前后位置）/ 扩展名；含重名检测。
  - 新增 `Icon.tsx` 内联图标：`file`。
  - 全量门禁：vitest 168 files / 1118 tests 全绿、tsc 零错误、eslint 全量零警告、首屏 184.27KB ≤ 185KB。jszip 懒加载 29.23KB ✅。

- **批次 7（图片补齐 + 日常 + 速查表 9 个）完成**：image-grid-cut / id-photo / image-ascii / unit-converter / timezone-converter / tax-loan-calculator / http-status / mime-types / git-cheatsheet。全部零新增依赖。
  - image-base 三个：`computeGrid`（网格分块纯函数，gap 支持，单块 <1px 报 TOO_MANY）、`targetPixels`+`coverCrop`（证件照标准尺寸 mm→px、覆盖式居中裁剪）、`imageDataToAscii`（RGBA→ASCII，字符集/宽度/反色；**保留矩形网格不移除行尾空格**以便断言）。
  - unit-converter：长度/质量/面积/体积/温度/速度/数据/时间，温度走偏移换算，数据区分十进制与二进制。
  - timezone-converter：基于 `Intl.DateTimeFormat`，实现 `getZoneOffsetMs` 与 `wallTimeToUtc`（墙上时间→UTC，两次偏移校正处理 DST）。
  - tax-loan-calculator：等额本息/等额本金还款计划 + 工资个税月度速算扣除数估算。
  - 三个 cheatsheet：http-status（48 条，按码/名/描述过滤）、mime-types（50+ 条，扩展名↔MIME）、git-cheatsheet（8 大类命令）。数据为英文标准术语，UI 与 meta 走 9 语言。
  - 全量门禁：vitest 177 files / 1178 tests 全绿、tsc 零错误、eslint 全量零警告、首屏 184.27KB ≤ 185KB。

- **批次 8（音视频 3 个）完成**：subtitle-tool / audio-convert / video-to-gif。**全部零新增依赖**（未引入 ffmpeg.wasm，规避 COOP/COEP 与 2MB 体积风险）。
  - subtitle-tool：SRT / WebVTT 解析（容错 CRLF/BOM/多行文本）+ 互转 + 时间轴平移（`formatTimestamp` 兼容 srt 逗号与 vtt 点）。
  - audio-convert：`AudioContext.decodeAudioData` 解码 → 纯 JS `encodeWav`（8/16/32bit PCM，RIFF 头）+ `resample` 线性插值 + `downmix` 混音。
  - video-to-gif：`<video>`+canvas 逐帧抽取 → **自实现 GIF89a 编码**（216 色 web-safe 量化 + LZW + Netscape 循环块），无需任何编码库。
  - 修正：video-to-gif 预览改用缓存的 object URL（避免每次渲染新建 URL 泄漏）；gif 预览/下载统一用缓存 blob。
  - **工具总数**：计划书假设基线 111 + 41 = 152，实际基线为 110 + 41 = **151**（41 个新工具全部注册，已逐个校验无缺失）。此差异需在 README 中如实标注。
  - 全量门禁：vitest 180 files / 1200 tests 全绿、tsc 零错误、eslint 全量零警告、首屏 184.27KB ≤ 185KB。

- **批次 9（发布与文档）完成**：
  - README.md / README.zh-CN.md：工具数量 110+ → 150+，工具分类表补齐编码/加密/格式化/生成器/PDF/网络新增能力，并新增 **File（文件）/ Media（音视频）/ Cheatsheet（速查表）** 三个分类行；已通过 prettier。
  - prerender：`scripts/prerender.ts` 从 `@/core/registry` 的 `mod.tools` 派生所有工具页与 sitemap，新增 41 个工具自动收录，无需手工维护路由清单。
  - 最终门禁：`tsc -b --noEmit` 零错误、`eslint . --max-warnings 0` 零警告、`vitest run` 180 files / 1200 tests 全绿、`pnpm size` 首屏 184.27KB ≤ 185KB。
  - 依赖政策核对：8 个批次全部零新增依赖（复用已有 jszip / csso / pdfjs-dist / @cantoo/pdf-lib 等），未引入 ffmpeg.wasm，故无需调整 `vercel.json` CSP 与 2MB 豁免规则。
