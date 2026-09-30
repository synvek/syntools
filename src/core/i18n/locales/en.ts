import type { ShellResources } from '../types';

/** en 文案资源（外壳 + 工具元数据；`tools.*` 见 en.tools.ts） */
const en = {
  app: {
    docTitle: 'SynTools · Online Toolkit',
  },
  header: {
    openMenu: 'Open menu',
    searchPlaceholder: 'Search tools…',
    searchAria: 'Search tools',
    themeAria: 'Toggle theme',
    langAria: 'Switch language',
    downloadAria: 'Download desktop app',
    sourceAria: 'Source code',
  },
  sidebar: {
    nav: 'Tool navigation',
    closeMenu: 'Close menu',
    filter: 'Filter tools',
    filterPlaceholder: 'Filter…',
    filterEmpty: 'No matching tools',
    categoryActions: 'Category actions',
    expandAll: 'Expand all categories',
    collapseAll: 'Collapse all categories',
  },
  home: {
    title: 'Online Toolkit',
    tagline:
      'Local-first processing; data stays in your browser (CSP, zero egress) · Press <1>⌘K</1> or <3>/</3> to search',
    favorites: 'Favorites',
    recent: 'Recently used',
    favoriteAria: 'Add to favorites',
    unfavoriteAria: 'Remove from favorites',
  },
  search: {
    aria: 'Search tools',
    placeholder: 'Search tools (name / keywords)…',
    empty: 'No matching tools found',
  },
  categories: {
    file: 'Files',
    media: 'Audio & Video',
    cheatsheet: 'Cheat Sheets',
    advanced: 'Documents & Creative',
    encoding: 'Encoding',
    text: 'Text',
    formatting: 'Formatting',
    crypto: 'Crypto & Hash',
    datetime: 'Date & Time',
    generator: 'Generators',
    network: 'Network',
    image: 'Images',
    pdf: 'PDF',
    other: 'Other',
  },
  common: {
    copy: 'Copy',
    copied: 'Copied',
    clear: 'Clear',
    discardConfirm:
      'The current document is not saved. Creating a new one will discard it. Are you sure?',
    swap: 'Swap',
    newDoc: 'New document',
    saved: 'Saved to local draft',
    saving: 'Auto-saves after you stop typing',
    download: 'Download',
    share: 'Share',
    shareTooLong: 'Content too long (> 2KB), cannot create share link',
    retry: 'Retry',
    loading: 'Loading',
    operation: 'Action',
    encode: 'Encode',
    decode: 'Decode',
    result: 'Result',
    rawText: 'Raw text',
    input: 'Input',
    output: 'Output',
    text: 'Text',
    file: 'File',
    remove: 'Remove',
    bytes: '{{size}} bytes',
  },
  io: {
    stats: '{{chars}} chars / {{bytes}} bytes',
    warnLarge: 'Large input (> 500KB), real-time compute may slow down',
    overflow: 'Input exceeds the 5MB limit; use file mode for large content',
  },
  file: {
    hint: 'Drag & drop a file here, or click to choose',
    max: 'Max {{size}}',
    over: 'File exceeds the {{max}} limit (current {{size}})',
    uploadAria: 'Upload file',
    previewAlt: 'Preview of {{name}}',
    pages: '{{n}} pages',
    encrypted: 'Encrypted',
  },
  pdf: {
    password: 'PDF password',
    passwordPlaceholder: 'Enter the open password',
    passwordHint: 'This PDF is encrypted. Enter the password to continue.',
    unlock: 'Unlock',
    errors: {
      NEED_PASSWORD: 'This PDF is encrypted. Please enter the password.',
      WRONG_PASSWORD: 'Incorrect password. Please try again.',
    },
  },
  tool: {
    errorTitle: 'Tool runtime error',
    localBadge: 'Local only',
    serverBadge: 'Needs server',
    related: 'Related tools',
    nextSteps: 'Next steps',
    openIn: 'Open in {{name}}',
    progress: 'Progress {{current}} / {{total}}',
  },
  notFound: {
    message: 'Page or tool not found',
    back: 'Back to home',
  },
  toolsMeta: {
    'code-editor': {
      name: 'Code Editor',
      description:
        'Editable syntax highlighting with per-language formatting, 10 themes and source / HTML / image export',
    },
    'video-convert': {
      name: 'Video Converter',
      description:
        'WebCodecs-first video transcoding (MP4 / WebM / MKV) with automatic ffmpeg.wasm fallback',
    },
    'video-to-gif': {
      name: 'Video to GIF',
      description: 'Trim a video clip into an animated GIF (pure frontend, built-in GIF encoder)',
    },
    'audio-convert': {
      name: 'Audio Converter',
      description:
        'Audio format conversion: WAV (native) plus MP3 / M4A / OGG / FLAC (WebCodecs-first, ffmpeg.wasm fallback)',
    },
    'subtitle-tool': {
      name: 'Subtitle Converter',
      description: 'Convert between SRT / WebVTT subtitles with time shifting',
    },
    'git-cheatsheet': {
      name: 'Git Cheatsheet',
      description: 'Categorized common Git commands with search',
    },
    'mime-types': {
      name: 'MIME Types',
      description: 'Common file extension to MIME type reference, searchable',
    },
    'http-status': {
      name: 'HTTP Status Codes',
      description: 'HTTP status code reference with class, name and meaning, searchable',
    },
    'id-photo': {
      name: 'ID Photo Maker',
      description:
        'Crop photos to standard ID sizes (1-inch, 2-inch, passport) with background and DPI',
    },
    'image-grid-cut': {
      name: 'Image Grid Cut',
      description: 'Slice an image into a grid of tiles (e.g. 3×3) and download each',
    },
    'image-ascii': {
      name: 'Image to ASCII',
      description: 'Convert images into ASCII art with charset, width and invert options',
    },
    'timezone-converter': {
      name: 'Time Zone Converter',
      description: 'Convert times across IANA time zones with local time and UTC offset',
    },
    'tax-loan-calculator': {
      name: 'Loan / Tax Calculator',
      description:
        'Mortgage amortization (equal payment / equal principal) and salary income tax estimate',
    },
    'unit-converter': {
      name: 'Unit Converter',
      description:
        'Convert length / mass / area / volume / temperature / speed / data / time units',
    },
    'bulk-rename': {
      name: 'Bulk Rename',
      description:
        'Batch-generate new filenames via prefix/suffix, find-replace (regex), numbering, extension and case rules',
    },
    'file-split-merge': {
      name: 'File Split / Merge',
      description: 'Split a large file by size or count, or merge parts back in name order',
    },
    'zip-manager': {
      name: 'ZIP Manager',
      description:
        'Pack multiple files into a ZIP, or inspect and download individual entries (JSZip)',
    },
    barcode: {
      name: 'Barcode Generator',
      description: 'Generate Code 39 / Code 128 / EAN-13 barcodes as SVG (pure frontend)',
    },
    'id-generator': {
      name: 'ID Generator',
      description: 'Generate ULID / NanoID / Snowflake / MongoDB ObjectId in batch',
    },
    'code-minify': {
      name: 'Code Minifier',
      description: 'Minify CSS / HTML / JS / JSON (CSS via csso; JS/HTML conservative)',
    },
    'csv-tool': {
      name: 'CSV Tool',
      description: 'CSV ↔ JSON conversion with custom delimiter, header and quoting (RFC 4180)',
    },
    'key-converter': {
      name: 'Key Format Converter',
      description: 'Convert RSA keys between PEM / DER / JWK / OpenSSH (WebCrypto)',
    },
    'rsa-crypto': {
      name: 'RSA Encrypt/Decrypt',
      description: 'RSA-OAEP encrypt/decrypt, RSA-PSS sign/verify and key generation (WebCrypto)',
    },
    'password-hash': {
      name: 'Password Hash (PBKDF2)',
      description: 'PBKDF2 password hashing via WebCrypto, with custom salt and iterations',
    },
    'password-strength': {
      name: 'Password Strength',
      description:
        'Estimate password strength locally: entropy, charset coverage and weak-pattern hints',
    },
    checksum: {
      name: 'Checksum',
      description: 'Compute CRC-32 / Adler-32 / FNV-1a checksums (pure frontend, zero dependency)',
    },
    'encoding-rescue': {
      name: 'Mojibake Fixer',
      description: 'Re-decode garbled text caused by UTF-8 misreading with GBK / Big5 / Shift-JIS',
    },
    'escape-unescape': {
      name: 'Escape / Unescape',
      description: 'Escape and unescape JSON / JS / HTML / XML / URL',
    },
    'caesar-cipher': {
      name: 'Caesar / ROT13 / Rail',
      description: 'Caesar cipher, ROT13, Atbash and Rail Fence encryption/decryption',
    },
    'morse-code': {
      name: 'Morse Code',
      description: 'Convert text to/from Morse code, with letter, digit and space support',
    },
    'base-encoding': {
      name: 'Base Encoder',
      description: 'Encode/decode Base16/32/32Hex/58/64/64URL (pure frontend, zero dependency)',
    },
    'pdf-compress': {
      name: 'PDF Compressor',
      description: 'Compress PDF: lossless object-stream or lossy per-page JPEG re-encoding',
    },
    'pdf-watermark': {
      name: 'PDF Watermark',
      description:
        'Add text watermarks to PDF with tiling, rotation, opacity and page range (local)',
    },
    'pdf-decrypt': {
      name: 'PDF Unlock',
      description:
        'Load with password then export an unprotected PDF (like qpdf --decrypt, fully local)',
    },
    'pdf-extract-text': {
      name: 'PDF Text Extractor',
      description: 'Extract copyable text from all PDF pages (local, supports encrypted files)',
    },
    'random-port': {
      name: 'Random Port & Address',
      description:
        'Generate random ports, private IPv4, MAC and IPv6 (optional dedupe and avoid common ports)',
    },
    'websocket-tester': {
      name: 'WebSocket Tester',
      description: 'Connect to WebSocket, send/receive text/binary messages with live log',
    },
    'http-request': {
      name: 'HTTP Request Debugger',
      description:
        'Send HTTP requests in-browser, inspect status, timing, headers and body (mind CORS)',
    },
    'http-headers': {
      name: 'Security Headers Generator',
      description:
        'Generate CSP / HSTS / Referrer-Policy headers (nginx / Apache / Express / Vercel)',
    },
    'ua-generator': {
      name: 'User-Agent Generator',
      description: 'Generate User-Agent by browser/OS combo, with a common UA library',
    },
    'url-parser': {
      name: 'URL Parser',
      description: 'Break down URL into protocol, host, port, path, query params and hash',
    },
    'mac-address': {
      name: 'MAC Address Tool',
      description: 'MAC formatting, vendor (OUI) lookup, EUI-64 and bulk random generation',
    },
    'ip-calc': {
      name: 'IP Calculator',
      description: 'IPv4/IPv6 addressing, subnetting (VLSM), supernet and wildcard mask',
    },
    'flowchart-editor': {
      name: 'Flowchart Editor',
      description:
        'Draw flowcharts locally: nodes, connectors, templates, auto-layout and PNG/SVG export',
    },
    'mindmap-editor': {
      name: 'Mind Map Editor',
      description:
        'Draw mind maps locally: keyboard-first nodes, collapsible branches, layouts, themes and PNG/SVG/Markdown export',
    },
    'photo-editor': {
      name: 'Photo Editor',
      description:
        'Multi-layer photo editing in your browser: layers, selections, crop, adjustments, filters, brush and text, with re-editable project files',
    },
    base64: {
      name: 'Base64 Encode / Decode',
      description:
        'Convert text and Base64 with Unicode-safe encoding; URL Safe and file mode supported',
    },
    'url-codec': {
      name: 'URL Encode / Decode',
      description: 'encodeURIComponent / encodeURI modes with malformed percent-encoding detection',
    },
    'regex-tester': {
      name: 'Regex Tool',
      description: 'Match highlighting, replace, capture groups, presets, and cheat sheet',
    },
    'text-diff': {
      name: 'Text Diff',
      description:
        'Side-by-side editors with inline line highlights, line numbers, and whitespace ignore',
    },
    'json-format': {
      name: 'JSON Formatter',
      description:
        'Format / minify / validate with 2/4-space indent and line/column error locations',
    },
    'json-convert': {
      name: 'JSON Converter',
      description: 'Parse JSON and convert it to YAML / XML / CSV',
    },
    timestamp: {
      name: 'Timestamp Converter',
      description: 'Unix ⇄ human-readable time with auto second/ms detection and live clock',
    },
    uuid: {
      name: 'UUID Generator',
      description: 'Random v4 / time-ordered v7 UUIDs with batch output and formatting options',
    },
    hash: {
      name: 'Hash Calculator',
      description:
        'MD5 / SHA-1 / SHA-256 / SHA-512 for text and files (streaming), hex / base64 output',
    },
    'jwt-parser': {
      name: 'JWT Parser',
      description:
        'Parse header / payload / signature and read exp and other time claims (read-only, no verify)',
    },
    'aes-crypto': {
      name: 'AES Encrypt / Decrypt',
      description: 'AES-GCM with PBKDF2 passphrase or raw key; output base64(salt|iv|ciphertext)',
    },
    hmac: {
      name: 'HMAC',
      description: 'HMAC-SHA256 / SHA512 with hex / base64 output',
    },
    totp: {
      name: 'TOTP',
      description: 'RFC 6238 TOTP: generate / verify, 6/8 digits, remaining seconds',
    },
    'x509-decode': {
      name: 'X.509 Certificate Decoder',
      description: 'Parse PEM: SHA-256/SHA-1 fingerprints, type, DER length, CN',
    },
    'cidr-calc': {
      name: 'CIDR Calculator',
      description: 'IPv4 CIDR: network / broadcast / host range / mask / host count',
    },
    'text-lines': {
      name: 'Text Line Tools',
      description: 'Sort / unique / reverse / number / trim empty lines',
    },
    'hex-codec': {
      name: 'Hex Encode / Decode',
      description: 'Hex ↔ UTF-8 text with optional spaces',
    },
    'url-query': {
      name: 'URL Query Parser',
      description: 'Parse URL parts and query params; rebuild after edits',
    },
    'json-path': {
      name: 'JSONPath Query',
      description: 'Simple path queries like a.b[0].c',
    },
    'gzip-tool': {
      name: 'Gzip Compress',
      description: 'Gzip text to base64 / decompress back to text',
    },
    'exif-strip': {
      name: 'Strip EXIF',
      description: 'Read basic JPEG EXIF and strip APP1; download cleaned file',
    },
    'fake-data': {
      name: 'Fake Data Generator',
      description: 'Generate names / emails / UUIDs / lorem in zh/en, 1–50 items',
    },
    'password-gen': {
      name: 'Password Generator',
      description:
        'Strong random passwords with length / charset options, entropy estimate and strength rating',
    },
    'entity-codec': {
      name: 'HTML Encode / Decode',
      description: 'Encode/decode HTML special characters: named / decimal / hex / \\u escapes',
    },
    'cron-parser': {
      name: 'Cron Expression Parser',
      description: 'Validate cron expressions, explain fields, and preview upcoming runs',
    },
    'convert-data': {
      name: 'Config Data Format Converter',
      description: 'Convert YAML ⇄ JSON ⇄ TOML via a lossless JS value intermediate',
    },
    'sql-format': {
      name: 'SQL Formatter',
      description: 'Beautify SQL across dialects with configurable indent and keyword case',
    },
    'html-format': {
      name: 'HTML Minify / Beautify',
      description: 'Minify and beautify HTML with 2/4-space indent options',
    },
    'js-format': {
      name: 'JS Minify / Beautify',
      description: 'Minify and beautify JavaScript with 2/4-space indent options',
    },
    'css-format': {
      name: 'CSS Minify / Beautify',
      description: 'Minify and beautify CSS with 2/4-space indent options',
    },
    'xml-format': {
      name: 'XML Minify / Beautify',
      description: 'Beautify and minify XML with 2/4-space indent; CDATA preserved',
    },
    'xml-json': {
      name: 'XML to JSON',
      description: 'Parse XML into JSON, keeping attributes with the @_ prefix',
    },
    qrcode: {
      name: 'QR Code',
      description: 'Generate and decode QR codes with ECC, size, colors, and margin options',
    },
    'color-converter': {
      name: 'Color Converter',
      description: 'Convert and preview HEX / RGB / HSL color formats',
    },
    'radix-converter': {
      name: 'Radix Converter',
      description: 'Convert base 2/8/10/16 and visualize bitwise ops for 64-bit signed integers',
    },
    'markdown-preview': {
      name: 'Markdown Editor',
      description:
        'Live highlighted editing and preview, outline navigation, word count, open/save .md and export HTML',
    },
    'image-compress': {
      name: 'Image Compress',
      description:
        'Client-side image compression and format conversion (PNG / JPEG / WebP) with resize and quality',
    },
    'unicode-codec': {
      name: 'Unicode Codec',
      description: 'Convert text to/from \\uXXXX, code points, HTML entities, and UTF-8 bytes',
    },
    'html-color-picker': {
      name: 'HTML Color Picker',
      description: 'Pick colors visually and export HEX / RGB / HSL plus HTML/CSS snippets',
    },
    'web-color-table': {
      name: 'Web Color Table',
      description: 'CSS named colors with group filters and copy name / HEX / RGB',
    },
    pinyin: {
      name: 'Chinese to Pinyin',
      description: 'Convert Chinese to pinyin with optional tones, separator, and case',
    },
    'length-converter': {
      name: 'Length Converter',
      description: 'Convert metric and imperial length units (mm, cm, m, km, in, ft, and more)',
    },
    'zh-convert': {
      name: 'Traditional Chinese Converter',
      description: 'Convert between Simplified and Traditional Chinese',
    },
    'weight-converter': {
      name: 'Weight Converter',
      description: 'Convert metric and imperial weight units (mg, g, kg, t, oz, lb, st)',
    },
    'text-counter': {
      name: 'Text Counter',
      description: 'Count characters, words, lines, paragraphs, CJK chars, and UTF-8 bytes',
    },
    calendar: {
      name: 'Calendar',
      description: 'Month view with lunar/almanac for Chinese and local holidays for English',
    },
    'css-button': {
      name: 'CSS Button Generator',
      description: 'Visually tweak styles and generate button CSS / HTML',
    },
    'random-number': {
      name: 'Random Number Generator',
      description: 'Generate random integers or decimals in a range, with optional unique values',
    },
    'random-string': {
      name: 'Random String Generator',
      description: 'Generate random strings by length and charset (alnum / hex / custom)',
    },
    'doodle-board': {
      name: 'Doodle Board',
      description:
        'Browser doodle board: pen/highlighter/eraser, shapes and polygons, eyedropper, move and zoom, multi-format export',
    },
    calculator: {
      name: 'Calculator',
      description:
        'Safe expression calculator with arithmetic, power, modulo, and common functions',
    },
    'code-image': {
      name: 'Code to Image',
      description: 'Render code as a syntax-highlighted card and export PNG',
    },
    'image-color-picker': {
      name: 'Image Color Picker',
      description: 'Upload an image and click a pixel to sample HEX / RGB',
    },
    'ascii-table': {
      name: 'ASCII Table',
      description: 'ASCII 0–127 reference with search by decimal, hex, or character',
    },
    'image-watermark': {
      name: 'Image Watermark',
      description: 'Add a text watermark with position, opacity, rotation, and tiling',
    },
    'case-convert': {
      name: 'Case Converter',
      description: 'Convert case and naming styles (camel / snake / kebab, etc.)',
    },
    'bmi-calculator': {
      name: 'BMI Calculator',
      description: 'Compute BMI from height and weight with WHO adult categories',
    },
    'placeholder-image': {
      name: 'Placeholder Image',
      description: 'Generate a placeholder PNG by size, colors, and optional text',
    },
    'image-merge': {
      name: 'Image Merge',
      description: 'Stitch images horizontally, vertically, or in a grid into one PNG',
    },
    'cron-generator': {
      name: 'Crontab Generator',
      description:
        'Build a standard 5-field Cron expression from minute/hour/day/month/weekday options',
    },
    'ua-parser': {
      name: 'User-Agent Parser',
      description: 'Parse a browser User-Agent into browser, engine, OS, and device',
    },
    'latex-editor': {
      name: 'LaTeX Math Editor',
      description: 'Quick symbols and classic formulas, KaTeX preview, export PNG/JPG/SVG',
    },
    countdown: {
      name: 'Countdown Timer',
      description: 'Set hours, minutes, and seconds; pause, resume, and finish alert',
    },
    stopwatch: {
      name: 'Stopwatch',
      description: 'Online stopwatch with start, pause, lap, and reset',
    },
    'svg-to-png': {
      name: 'SVG to PNG',
      description: 'Convert SVG markup or files to PNG with scale and transparency',
    },
    'image-frame': {
      name: 'Image Border / Radius / Shadow',
      description: 'Add border, rounded corners, and shadow, then export PNG',
    },
    'image-adjust': {
      name: 'Image Color Adjust',
      description: 'Adjust brightness, contrast, saturation, and hue, then export PNG',
    },
    'gif-frames': {
      name: 'GIF Frame Extractor',
      description: 'Split a GIF into PNG frames; download one or all',
    },
    'image-crop': {
      name: 'Image Crop',
      description: 'Crop images freeform or with fixed aspect ratios to PNG',
    },
    'mbti-test': {
      name: 'MBTI Personality Test',
      description: 'A short 24-question MBTI-style quiz (for entertainment only)',
    },
    'text-card': {
      name: 'Text to Card',
      description: 'Layout a title and body into a styled card and export PNG',
    },
    'image-card': {
      name: 'Image to Card',
      description: 'Photo + title/subtitle card with backdrop presets or gradients, export PNG',
    },
    'code-highlight': {
      name: 'Code Highlighter',
      description: 'Live syntax highlighting with line numbers and HTML snippet copy',
    },
    'image-base64': {
      name: 'Image ↔ Base64',
      description: 'Convert images to Base64 / Data URL and back, entirely locally',
    },
    'image-ico': {
      name: 'ICO Converter',
      description: 'Convert images to multi-size ICO (favicon), or extract PNG from ICO',
    },
    'hsv-cmyk': {
      name: 'HSV / CMYK Converter',
      description: 'Convert and preview RGB, HSV, CMYK, and HEX color spaces',
    },
    'ai-prompts': {
      name: 'AI Prompt Library',
      description: 'Curated prompts by category with search and one-click copy',
    },
    'md-mindmap': {
      name: 'Markdown Mind Map',
      description: 'Turn Markdown into a mind map with themes, zoom, and PNG/SVG export',
    },
    'mermaid-editor': {
      name: 'Mermaid Diagram Editor',
      description: 'Render Mermaid locally with themes, zoom, and PNG/SVG export',
    },
    'css-gradient': {
      name: 'CSS Gradient Generator',
      description: 'Edit linear / radial gradients with categorized presets and copy CSS',
    },
    'image-to-paper': {
      name: 'Image to Paper PDF',
      description: 'Fit images to A3/A4/A5/Letter and export PDF',
    },
    'md-to-image': {
      name: 'Markdown to Image',
      description:
        'Render Markdown to a styled card and export PNG with font, size, width, and colors',
    },
    'chart-generator': {
      name: 'Chart Generator',
      description:
        'Build bar/line/area/pie/doughnut/scatter charts from CSV with legends and palettes',
    },
    'css3-generator': {
      name: 'CSS3 Code Generator',
      description: 'Generate border-radius, shadows, transform, filter, and more',
    },
    'xslt-transform': {
      name: 'XSLT Transform',
      description: 'Transform XML to HTML with XSLT in the browser',
    },
    'rich-text-editor': {
      name: 'Word Processor',
      description: 'Write locally with Word (.docx) import/export and two PDF export modes',
    },
    'slide-editor': {
      name: 'Slides Editor',
      description: 'Edit slides locally with PowerPoint (.pptx) import/export and slideshow',
    },
    'spreadsheet-editor': {
      name: 'Spreadsheet Editor',
      description: 'Edit sheets locally with Excel (.xlsx) import/export, formulas and multi-sheet',
    },
    'pdf-merge': { name: 'Merge PDF', description: 'Merge multiple PDFs into one file' },
    'pdf-split': { name: 'Split PDF', description: 'Split a PDF into one file per page' },
    'pdf-delete-pages': {
      name: 'Delete PDF Pages',
      description: 'Remove selected pages from a PDF',
    },
    'pdf-extract-pages': {
      name: 'Extract PDF Pages',
      description: 'Extract selected pages into a new PDF',
    },
    'pdf-reorder': { name: 'Reorder PDF Pages', description: 'Reorder pages in a PDF' },
    'pdf-rotate': { name: 'Rotate PDF Pages', description: 'Rotate selected or all pages' },
    'pdf-to-image': { name: 'PDF to Image', description: 'Render PDF pages as JPG/PNG' },
    'images-to-pdf': { name: 'Images to PDF', description: 'Combine images into a PDF' },
    'pdf-viewer': { name: 'PDF Viewer', description: 'Open and read a PDF locally' },
    'pdf-page-numbers': { name: 'PDF Page Numbers', description: 'Add page numbers to a PDF' },
    'pdf-header-footer': { name: 'PDF Header & Footer', description: 'Add header and footer text' },
    'pdf-insert-image': {
      name: 'Insert Image into PDF',
      description: 'Place an image on PDF pages',
    },
    'pdf-add-text': { name: 'Add Text to PDF', description: 'Add text onto PDF pages' },
    'pdf-sign': {
      name: 'Sign PDF',
      description: 'Draw or upload a signature image (visual, not certificate)',
    },
    'pdf-metadata': { name: 'PDF Metadata', description: 'View and edit PDF metadata' },
    'pdf-encrypt': { name: 'Encrypt PDF', description: 'Set password and permission flags' },
    'pdf-crop': { name: 'Crop PDF', description: 'Crop page margins via cropBox' },
    'pdf-grayscale': { name: 'PDF Grayscale', description: 'Convert PDF to visual grayscale' },
    'pdf-annotate': {
      name: 'Annotate PDF',
      description: 'Draw highlights, freehand, shapes, and text on PDF pages',
    },
  },
} satisfies ShellResources;

export default en;
