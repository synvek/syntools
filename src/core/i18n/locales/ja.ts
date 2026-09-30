import type { ShellResources } from '../types';

/** ja 文案资源（外壳 + 工具元数据；`tools.*` 见 ja.tools.ts） */
const ja = {
  app: {
    docTitle: 'SynTools · オンラインツールボックス',
  },
  header: {
    openMenu: 'メニューを開く',
    searchPlaceholder: 'ツールを検索…',
    searchAria: 'ツールを検索',
    themeAria: 'テーマを切り替え',
    langAria: '言語を切り替え',
    downloadAria: 'デスクトップ版をダウンロード',
    sourceAria: 'ソースコード',
  },
  sidebar: {
    nav: 'ツールナビゲーション',
    closeMenu: 'メニューを閉じる',
    filter: 'ツールを絞り込み',
    filterPlaceholder: '絞り込み…',
    filterEmpty: '一致するツールがありません',
    categoryActions: 'カテゴリ操作',
    expandAll: 'すべてのカテゴリを展開',
    collapseAll: 'すべてのカテゴリを折りたたむ',
  },
  home: {
    title: 'オンラインツールボックス',
    tagline:
      'ローカル優先の処理；データはブラウザ内に留まります（CSP、ゼロ外送）· <1>⌘K</1> または <3>/</3> で検索',
    favorites: 'お気に入り',
    recent: '最近使用したツール',
    favoriteAria: 'お気に入りに追加',
    unfavoriteAria: 'お気に入りから削除',
  },
  search: {
    aria: 'ツールを検索',
    placeholder: 'ツールを検索（名前 / キーワード）…',
    empty: '一致するツールが見つかりません',
  },
  categories: {
    file: 'ファイル',
    media: '音声・動画',
    cheatsheet: 'チートシート',
    advanced: 'ドキュメントと制作',
    encoding: 'エンコード',
    text: 'テキスト',
    formatting: 'フォーマット',
    crypto: '暗号・ハッシュ',
    datetime: '日付と時刻',
    generator: 'ジェネレーター',
    network: 'ネットワーク',
    image: '画像',
    pdf: 'PDF',
    other: 'その他',
  },
  common: {
    copy: 'コピー',
    copied: 'コピーしました',
    clear: 'クリア',
    discardConfirm:
      '現在のドキュメントは保存されていません。新規作成すると破棄されます。よろしいですか？',
    swap: '入れ替え',
    newDoc: '新規ドキュメント',
    saved: 'ローカル下書きに保存しました',
    saving: '入力を止めると自動保存します',
    download: 'ダウンロード',
    share: '共有',
    shareTooLong: '内容が長すぎます（2KB超）。共有リンクを作成できません',
    retry: '再試行',
    loading: '読み込み中',
    operation: '操作',
    encode: 'エンコード',
    decode: 'デコード',
    result: '結果',
    rawText: '元のテキスト',
    input: '入力',
    output: '出力',
    text: 'テキスト',
    file: 'ファイル',
    remove: '削除',
    bytes: '{{size}} バイト',
  },
  io: {
    stats: '{{chars}} 文字 / {{bytes}} バイト',
    warnLarge: '入力が大きいです（> 500KB）。リアルタイム計算が遅くなる場合があります',
    overflow: '入力が 5MB の上限を超えています。大きな内容にはファイルモードを使用してください',
  },
  file: {
    hint: 'ファイルをここにドラッグ＆ドロップ、またはクリックして選択',
    max: '最大 {{size}}',
    over: 'ファイルが {{max}} の上限を超えています（現在 {{size}}）',
    uploadAria: 'ファイルをアップロード',
    previewAlt: '{{name}} のプレビュー',
    pages: '{{n}} ページ',
    encrypted: '暗号化済み',
  },
  tool: {
    errorTitle: 'ツール実行エラー',
    localBadge: 'ローカルのみ',
    serverBadge: 'サーバーが必要',
    related: '関連ツール',
    nextSteps: '次のステップ',
    openIn: '{{name}} で開く',
    progress: '進捗 {{current}} / {{total}}',
  },
  notFound: {
    message: 'ページまたはツールが見つかりません',
    back: 'ホームに戻る',
  },
  pdf: {
    password: 'PDF パスワード',
    passwordPlaceholder: '開くパスワードを入力',
    passwordHint: 'この PDF は暗号化されています。続行するにはパスワードを入力してください。',
    unlock: 'ロック解除',
    errors: {
      NEED_PASSWORD: 'この PDF は暗号化されています。パスワードを入力してください。',
      WRONG_PASSWORD: 'パスワードが正しくありません。もう一度お試しください。',
    },
  },
  toolsMeta: {
    'code-editor': {
      name: 'コードエディタ',
      description:
        'シンタックスハイライト付きの編集可能なエディタ。言語別フォーマット、10 種のテーマ、ソース / HTML / 画像書き出しに対応',
    },
    'video-convert': {
      name: '動画トランスコード',
      description:
        'WebCodecs 優先の動画変換（MP4 / WebM / MKV）、非対応時は ffmpeg.wasm に自動フォールバック',
    },
    'video-to-gif': {
      name: '動画 → GIF',
      description: '動画の一部を GIF アニメに変換（フロントエンド完結の GIF エンコーダ）',
    },
    'audio-convert': {
      name: '音声トランスコード',
      description:
        'ブラウザで再生可能な音声を WAV に変換（サンプルレート・チャンネル・ビット深度）',
    },
    'subtitle-tool': {
      name: '字幕変換',
      description: 'SRT / WebVTT 字幕の相互変換と時間軸シフト',
    },
    'git-cheatsheet': {
      name: 'Git コマンド一覧',
      description: 'カテゴリ別のよく使う Git コマンド集（検索対応）',
    },
    'mime-types': {
      name: 'MIME タイプ',
      description: '拡張子と MIME タイプの対応表（検索対応）',
    },
    'http-status': {
      name: 'HTTP ステータスコード',
      description: 'HTTP ステータスコード一覧（分類・名称・意味、検索対応）',
    },
    'id-photo': {
      name: '証明写真作成',
      description: '1 寸 / 2 寸 / パスポートなど標準サイズで切り抜き、背景色と DPI を設定',
    },
    'image-grid-cut': {
      name: '画像グリッド分割',
      description: '画像を行列で分割し、各タイルをダウンロード',
    },
    'image-ascii': {
      name: '画像 → ASCII',
      description: '画像を ASCII アートに変換（文字セット・幅・反転）',
    },
    'timezone-converter': {
      name: 'タイムゾーン変換',
      description: '複数の IANA タイムゾーン間で時刻を変換し、UTC オフセットを表示',
    },
    'tax-loan-calculator': {
      name: 'ローン / 税計算',
      description: '元利均等 / 元金均等返済と給与所得税の概算',
    },
    'unit-converter': {
      name: '単位変換',
      description: '長さ・質量・面積・体積・温度・速度・データ・時間の単位変換',
    },
    'bulk-rename': {
      name: '一括リネーム',
      description: '前後辞・置換（正規表現）・連番・拡張子・大文字小文字でファイル名を一括生成',
    },
    'file-split-merge': {
      name: 'ファイル分割 / 結合',
      description: '大きなファイルをサイズまたは数で分割、または名前順で結合',
    },
    'zip-manager': {
      name: 'ZIP マネージャー',
      description: '複数ファイルを ZIP にまとめる、または展開して個別ファイルを取得（JSZip）',
    },
    barcode: {
      name: 'バーコード生成',
      description: 'Code 39 / Code 128 / EAN-13 バーコードを SVG で生成',
    },
    'id-generator': {
      name: 'ID 生成',
      description: 'ULID / NanoID / Snowflake / MongoDB ObjectId を一括生成',
    },
    'code-minify': {
      name: 'コード圧縮',
      description: 'CSS / HTML / JS / JSON の圧縮（CSS は csso、JS/HTML は保守的）',
    },
    'csv-tool': {
      name: 'CSV ツール',
      description: 'CSV ↔ JSON 変換。区切り文字・ヘッダー・引用符に対応（RFC 4180）',
    },
    'key-converter': {
      name: '鍵フォーマット変換',
      description: 'RSA 鍵を PEM / DER / JWK / OpenSSH 間で変換（WebCrypto）',
    },
    'rsa-crypto': {
      name: 'RSA 暗号化',
      description: 'RSA-OAEP 暗号化/復号、RSA-PSS 署名/検証と鍵生成（WebCrypto）',
    },
    'password-hash': {
      name: 'パスワードハッシュ (PBKDF2)',
      description: 'WebCrypto による PBKDF2 派生ハッシュ（salt と反復回数を指定可）',
    },
    'password-strength': {
      name: 'パスワード強度',
      description: 'パスワード強度をローカル推定：エントロピー・文字種・弱いパターンの検出',
    },
    checksum: {
      name: 'チェックサム',
      description: 'CRC-32 / Adler-32 / FNV-1a チェックサム計算（フロントエンド完結）',
    },
    'encoding-rescue': {
      name: '文字化け修復',
      description: 'UTF-8 の誤読で生じた文字化けを GBK / Big5 / Shift-JIS 等で再解釈',
    },
    'escape-unescape': {
      name: 'エスケープ / 解除',
      description: 'JSON / JS / HTML / XML / URL のエスケープと解除',
    },
    'caesar-cipher': {
      name: 'シーザー / ROT13 / 柵',
      description: 'シーザー暗号、ROT13、Atbash、欄栅暗号の暗号化・復号',
    },
    'morse-code': {
      name: 'モールス信号',
      description: 'テキストとモールス信号の相互変換（文字・数字・空白対応）',
    },
    'base-encoding': {
      name: 'Base エンコーダ',
      description: 'Base16/32/32Hex/58/64/64URL のエンコード・デコード（フロントエンド完結）',
    },
    'pdf-compress': {
      name: 'PDF 圧縮',
      description:
        'PDF を圧縮：オブジェクトストリームの可逆、または各ページ JPEG 再エンコードの非可逆',
    },
    'pdf-watermark': {
      name: 'PDF ウォーターマーク',
      description: 'PDF にテキスト透かしを追加（タイル・回転・透明度・ページ範囲対応）',
    },
    'pdf-decrypt': {
      name: 'PDF パスワード解除',
      description: 'パスワードで読み込み、保護なし PDF を書き出し（qpdf --decrypt 同等、ローカル）',
    },
    'pdf-extract-text': {
      name: 'PDF テキスト抽出',
      description: 'PDF 全ページからコピー可能なテキストを抽出（ローカル、暗号化対応）',
    },
    'random-port': {
      name: 'ランダムポートとアドレス',
      description:
        'ランダムポート・プライベート IPv4・MAC・IPv6 を生成（重複排除・定番ポート回避可）',
    },
    'websocket-tester': {
      name: 'WebSocket テスター',
      description: 'WebSocket に接続し、テキスト/バイナリ送受信とリアルタイムログ',
    },
    'http-request': {
      name: 'HTTP リクエストデバッガー',
      description:
        'ブラウザ内で HTTP を送信し、ステータス・時間・ヘッダ・本文を確認（CORS に注意）',
    },
    'http-headers': {
      name: 'セキュリティヘッダ生成',
      description:
        'CSP / HSTS / Referrer-Policy などのヘッダを生成（nginx / Apache / Express / Vercel）',
    },
    'ua-generator': {
      name: 'User-Agent ジェネレーター',
      description: 'ブラウザ/OS の組み合わせで UA を生成、定番ライブラリ付き',
    },
    'url-parser': {
      name: 'URL パーサー',
      description: 'URL をプロトコル・ホスト・ポート・パス・クエリ・ハッシュに分解',
    },
    'mac-address': {
      name: 'MAC アドレス ツール',
      description: 'MAC の整形、ベンダー（OUI）検索、EUI-64 と一括乱数生成',
    },
    'ip-calc': {
      name: 'IP 計算機',
      description:
        'IPv4/IPv6 のアドレス、サブネット分割（VLSM）、スーパーネット、ワイルドカードマスク',
    },
    'flowchart-editor': {
      name: 'フローチャートエディタ',
      description:
        'ローカルでフローチャートを作成：ノード接続、テンプレート、自動配置、PNG/SVG 書き出し',
    },
    'mindmap-editor': {
      name: 'マインドマップエディタ',
      description:
        'ローカルでマインドマップを作成：キーボード操作、ブランチの折りたたみ、レイアウトとテーマ、PNG/SVG/Markdown 書き出し',
    },
    'photo-editor': {
      name: '写真エディタ',
      description:
        'ブラウザ内で完結する多レイヤー写真編集：レイヤー、選択範囲、トリミング、補正とフィルター、ブラシとテキスト、プロジェクトの再編集に対応',
    },
    base64: {
      name: 'Base64 エンコード / デコード',
      description: 'Unicode 安全なテキストと Base64 の相互変換。URL Safe とファイルモード対応',
    },
    'url-codec': {
      name: 'URL エンコード / デコード',
      description: 'encodeURIComponent / encodeURI モードと不正なパーセントエンコード検出',
    },
    'regex-tester': {
      name: '正規表現ツール',
      description: 'マッチ強調、置換、キャプチャグループ、プリセット、チートシート',
    },
    'text-diff': {
      name: 'テキスト差分',
      description: '並列エディタ、行内ハイライト、行番号、空白無視',
    },
    'json-format': {
      name: 'JSON フォーマッタ',
      description: '整形 / 圧縮 / 検証。2/4 スペースインデントと行・列のエラー位置',
    },
    'json-convert': {
      name: 'JSON コンバータ',
      description: 'JSON を解析して YAML / XML / CSV に変換',
    },
    timestamp: {
      name: 'タイムスタンプ変換',
      description: 'Unix ⇄ 人間可読時刻。秒/ミリ秒の自動判定とライブ時計',
    },
    uuid: {
      name: 'UUID ジェネレータ',
      description: 'ランダム v4 / 時系列 v7 UUID。一括出力と書式オプション',
    },
    hash: {
      name: 'ハッシュ計算',
      description:
        'テキストとファイル（ストリーミング）の MD5 / SHA-1 / SHA-256 / SHA-512。hex / base64 出力',
    },
    'jwt-parser': {
      name: 'JWT パーサー',
      description:
        'header / payload / signature を解析し、exp などの時刻クレームを表示（読み取り専用、検証なし）',
    },
    'aes-crypto': {
      name: 'AES 暗号化 / 復号',
      description: 'PBKDF2 パスフレーズまたは生キーの AES-GCM。出力は base64(salt|iv|ciphertext)',
    },
    hmac: {
      name: 'HMAC',
      description: 'HMAC-SHA256 / SHA512。hex / base64 出力',
    },
    totp: {
      name: 'TOTP',
      description: 'RFC 6238 TOTP：生成 / 検証、6/8 桁、残り秒数',
    },
    'x509-decode': {
      name: 'X.509 証明書デコーダ',
      description: 'PEM を解析：SHA-256/SHA-1 フィンガープリント、種類、DER 長、CN',
    },
    'cidr-calc': {
      name: 'CIDR 計算機',
      description: 'IPv4 CIDR：ネットワーク / ブロードキャスト / ホスト範囲 / マスク / ホスト数',
    },
    'text-lines': {
      name: 'テキスト行ツール',
      description: '並べ替え / 重複削除 / 逆順 / 番号付け / 空行削除',
    },
    'hex-codec': {
      name: 'Hex エンコード / デコード',
      description: 'Hex ↔ UTF-8 テキスト（スペース任意）',
    },
    'url-query': {
      name: 'URL クエリパーサー',
      description: 'URL の各部とクエリパラメータを解析し、編集後に再構築',
    },
    'json-path': {
      name: 'JSONPath クエリ',
      description: 'a.b[0].c のようなシンプルなパスクエリ',
    },
    'gzip-tool': {
      name: 'Gzip 圧縮',
      description: 'テキストを Gzip して base64 へ / 展開してテキストへ',
    },
    'exif-strip': {
      name: 'EXIF 削除',
      description: 'JPEG の基本 EXIF を読み取り APP1 を削除。クリーンなファイルをダウンロード',
    },
    'fake-data': {
      name: 'ダミーデータ生成',
      description: '名前 / メール / UUID / lorem を zh/en で生成（1–50 件）',
    },
    'password-gen': {
      name: 'パスワード生成',
      description: '長さ / 文字セット指定の強力な乱数パスワード。エントロピーと強度評価',
    },
    'entity-codec': {
      name: 'HTML エンコード / デコード',
      description: 'HTML 特殊文字のエンコード/デコード：名前付き / 十進 / hex / \\u エスケープ',
    },
    'cron-parser': {
      name: 'Cron 式パーサー',
      description: 'Cron 式の検証、フィールド説明、次回実行のプレビュー',
    },
    'convert-data': {
      name: '設定データ形式変換',
      description: 'ロスレスな JS 値を介して YAML ⇄ JSON ⇄ TOML を変換',
    },
    'sql-format': {
      name: 'SQL フォーマッタ',
      description: '複数方言の SQL を整形。インデントとキーワードの大文字小文字を設定可能',
    },
    'html-format': {
      name: 'HTML 圧縮 / 整形',
      description: 'HTML の圧縮と整形。2/4 スペースインデント',
    },
    'js-format': {
      name: 'JS 圧縮 / 整形',
      description: 'JavaScript の圧縮と整形。2/4 スペースインデント',
    },
    'css-format': {
      name: 'CSS 圧縮 / 整形',
      description: 'CSS の圧縮と整形。2/4 スペースインデント',
    },
    'xml-format': {
      name: 'XML 圧縮 / 整形',
      description: 'XML の整形と圧縮。2/4 スペースインデント。CDATA を保持',
    },
    'xml-json': {
      name: 'XML から JSON',
      description: 'XML を JSON に変換。属性は @_ プレフィックスで保持',
    },
    qrcode: {
      name: 'QR コード',
      description: 'ECC、サイズ、色、余白オプション付きで QR コードを生成・読み取り',
    },
    'color-converter': {
      name: 'カラー変換',
      description: 'HEX / RGB / HSL の変換とプレビュー',
    },
    'radix-converter': {
      name: '進数変換',
      description: '2/8/10/16 進変換と 64 ビット符号付き整数のビット演算可視化',
    },
    'markdown-preview': {
      name: 'Markdown エディター',
      description:
        'リアルタイムのハイライト編集とプレビュー、アウトライン、文字数カウント、.md の開閉と HTML 書き出し',
    },
    'image-compress': {
      name: '画像圧縮',
      description: 'クライアント側の画像圧縮と形式変換（PNG / JPEG / WebP）。リサイズと品質指定',
    },
    'unicode-codec': {
      name: 'Unicode コーデック',
      description: 'テキストと \\uXXXX、コードポイント、HTML 実体、UTF-8 バイトの相互変換',
    },
    'html-color-picker': {
      name: 'HTML カラーピッカー',
      description: '視覚的に色を選び HEX / RGB / HSL と HTML/CSS スニペットを出力',
    },
    'web-color-table': {
      name: 'Web カラー表',
      description: 'CSS 名前付き色。グループ絞り込みと名前 / HEX / RGB のコピー',
    },
    pinyin: {
      name: '中国語ピンイン変換',
      description: '中国語をピンインに変換。声調、区切り、大文字小文字オプション',
    },
    'length-converter': {
      name: '長さ単位変換',
      description: 'メートル法とヤード・ポンド法の長さ単位（mm, cm, m, km, in, ft など）',
    },
    'zh-convert': {
      name: '繁简体変換',
      description: '簡体字と繁体字の相互変換',
    },
    'weight-converter': {
      name: '重量単位変換',
      description: 'メートル法とヤード・ポンド法の重量単位（mg, g, kg, t, oz, lb, st）',
    },
    'text-counter': {
      name: 'テキストカウンタ',
      description: '文字、単語、行、段落、CJK 文字、UTF-8 バイト数をカウント',
    },
    calendar: {
      name: 'カレンダー',
      description: '月表示。中国語は旧暦/暦注、英語は現地祝日',
    },
    'css-button': {
      name: 'CSS ボタンジェネレータ',
      description: 'スタイルを視覚的に調整し、ボタンの CSS / HTML を生成',
    },
    'random-number': {
      name: '乱数ジェネレータ',
      description: '範囲内の整数または小数の乱数。一意値オプションあり',
    },
    'random-string': {
      name: 'ランダム文字列ジェネレータ',
      description: '長さと文字セット（英数字 / hex / カスタム）でランダム文字列を生成',
    },
    'doodle-board': {
      name: 'お絵かきボード',
      description:
        'ブラウザのお絵かきボード：ペン/マーカー/消しゴム、図形と多角形、スポイト、移動とズーム、各種形式で書き出し',
    },
    calculator: {
      name: '電卓',
      description: '四則演算、累乗、剰余、よく使う関数の安全な式電卓',
    },
    'code-image': {
      name: 'コード画像化',
      description: 'コードをシンタックスハイライト付きカードとして描画し PNG 書き出し',
    },
    'image-color-picker': {
      name: '画像カラーピッカー',
      description: '画像をアップロードし、ピクセルをクリックして HEX / RGB を取得',
    },
    'ascii-table': {
      name: 'ASCII 表',
      description: 'ASCII 0–127 一覧。十進、hex、文字で検索',
    },
    'image-watermark': {
      name: '画像ウォーターマーク',
      description: '位置、不透明度、回転、タイル配置のテキスト透かし',
    },
    'case-convert': {
      name: '大文字小文字・命名変換',
      description: '大文字小文字と命名スタイル（camel / snake / kebab など）を変換',
    },
    'bmi-calculator': {
      name: 'BMI 計算',
      description: '身長と体重から BMI を計算。WHO 成人カテゴリ付き',
    },
    'placeholder-image': {
      name: 'プレースホルダー画像',
      description: 'サイズ、色、任意テキストでプレースホルダー PNG を生成',
    },
    'image-merge': {
      name: '画像結合',
      description: '画像を横・縦・グリッドでつなぎ、1 枚の PNG に',
    },
    'cron-generator': {
      name: 'Crontab ジェネレータ',
      description: '分/時/日/月/曜日オプションから標準 5 フィールド Cron 式を作成',
    },
    'ua-parser': {
      name: 'User-Agent パーサー',
      description: 'ブラウザ User-Agent をブラウザ、エンジン、OS、デバイスに解析',
    },
    'latex-editor': {
      name: 'LaTeX 数式エディタ',
      description: 'クイック記号と定番数式、KaTeX プレビュー、PNG/JPG/SVG 書き出し',
    },
    countdown: {
      name: 'カウントダウンタイマー',
      description: '時・分・秒を設定。一時停止、再開、終了アラート',
    },
    stopwatch: {
      name: 'ストップウォッチ',
      description: '開始、一時停止、ラップ、リセット付きオンラインストップウォッチ',
    },
    'svg-to-png': {
      name: 'SVG から PNG',
      description: 'SVG マークアップまたはファイルをスケールと透過付きで PNG に変換',
    },
    'image-frame': {
      name: '画像枠 / 角丸 / 影',
      description: '枠線、角丸、影を追加して PNG 書き出し',
    },
    'image-adjust': {
      name: '画像色調整',
      description: '明るさ、コントラスト、彩度、色相を調整して PNG 書き出し',
    },
    'gif-frames': {
      name: 'GIF フレーム抽出',
      description: 'GIF を PNG フレームに分割。1 枚またはすべてダウンロード',
    },
    'image-crop': {
      name: '画像クロップ',
      description: '自由形または固定アスペクト比で画像を切り抜き PNG へ',
    },
    'mbti-test': {
      name: 'MBTI 性格テスト',
      description: '24 問の短い MBTI 風クイズ（娯楽用）',
    },
    'text-card': {
      name: 'テキストカード',
      description: 'タイトルと本文をスタイル付きカードにレイアウトし PNG 書き出し',
    },
    'image-card': {
      name: '画像カード',
      description:
        '写真＋タイトル/サブタイトルのカード。背景プリセットまたはグラデーション、PNG 書き出し',
    },
    'code-highlight': {
      name: 'コードハイライター',
      description: '行番号付きライブシンタックスハイライトと HTML スニペットコピー',
    },
    'image-base64': {
      name: '画像 ↔ Base64',
      description: '画像を Base64 / Data URL と相互変換（すべてローカル）',
    },
    'image-ico': {
      name: 'ICO 変換',
      description: '画像を複数サイズ ICO（favicon）へ、または ICO から PNG を抽出',
    },
    'hsv-cmyk': {
      name: 'HSV / CMYK 変換',
      description: 'RGB、HSV、CMYK、HEX 色空間の変換とプレビュー',
    },
    'ai-prompts': {
      name: 'AI プロンプトライブラリ',
      description: 'カテゴリ別の厳選プロンプト。検索とワンクリックコピー',
    },
    'md-mindmap': {
      name: 'Markdown マインドマップ',
      description: 'Markdown をマインドマップに。テーマ、ズーム、PNG/SVG 書き出し',
    },
    'mermaid-editor': {
      name: 'Mermaid ダイアグラムエディタ',
      description: 'Mermaid をローカル描画。テーマ、ズーム、PNG/SVG 書き出し',
    },
    'css-gradient': {
      name: 'CSS グラデーションジェネレータ',
      description: '線形 / 放射グラデーションを編集。分類プリセットと CSS コピー',
    },
    'image-to-paper': {
      name: '画像から用紙 PDF',
      description: '画像を A3/A4/A5/Letter に合わせて PDF 書き出し',
    },
    'md-to-image': {
      name: 'Markdown から画像',
      description:
        'Markdown をスタイル付きカードに描画。フォント、サイズ、幅、色を指定して PNG 書き出し',
    },
    'chart-generator': {
      name: 'チャートジェネレータ',
      description: 'CSV から棒/折れ線/面/円/ドーナツ/散布図を作成。凡例とパレット付き',
    },
    'css3-generator': {
      name: 'CSS3 コードジェネレータ',
      description: 'border-radius、影、transform、filter などを生成',
    },
    'xslt-transform': {
      name: 'XSLT 変換',
      description: 'ブラウザ内で XSLT により XML を HTML に変換',
    },
    'rich-text-editor': {
      name: 'ワープロ',
      description:
        'ブラウザ内で編集し、Word(.docx) の読み込み／書き出しと 2 種類の PDF 書き出しに対応',
    },
    'slide-editor': {
      name: 'スライドエディター',
      description:
        'ブラウザ内でスライドを編集し、PowerPoint(.pptx) の読み込み／書き出しとスライドショーに対応',
    },
    'spreadsheet-editor': {
      name: 'スプレッドシートエディター',
      description:
        'Excel(.xlsx) の読み込み／書き出しに対応したローカル表計算（数式・複数シート対応）',
    },
    'pdf-merge': {
      name: 'PDF 結合',
      description: '複数の PDF を 1 つのファイルに結合',
    },
    'pdf-split': {
      name: 'PDF 分割',
      description: 'PDF をページごとに分割',
    },
    'pdf-delete-pages': {
      name: 'PDF ページ削除',
      description: 'PDF から選択したページを削除',
    },
    'pdf-extract-pages': {
      name: 'PDF ページ抽出',
      description: '選択したページを新しい PDF に抽出',
    },
    'pdf-reorder': {
      name: 'PDF ページ並べ替え',
      description: 'PDF 内のページ順を変更',
    },
    'pdf-rotate': {
      name: 'PDF ページ回転',
      description: '選択またはすべてのページを回転',
    },
    'pdf-to-image': {
      name: 'PDF から画像',
      description: 'PDF ページを JPG/PNG として描画',
    },
    'images-to-pdf': {
      name: '画像から PDF',
      description: '画像をまとめて PDF に',
    },
    'pdf-viewer': {
      name: 'PDF ビューア',
      description: 'PDF をローカルで開いて閲覧',
    },
    'pdf-page-numbers': {
      name: 'PDF ページ番号',
      description: 'PDF にページ番号を追加',
    },
    'pdf-header-footer': {
      name: 'PDF ヘッダー & フッター',
      description: 'ヘッダーとフッターのテキストを追加',
    },
    'pdf-insert-image': {
      name: 'PDF に画像を挿入',
      description: 'PDF ページに画像を配置',
    },
    'pdf-add-text': {
      name: 'PDF にテキスト追加',
      description: 'PDF ページにテキストを追加',
    },
    'pdf-sign': {
      name: 'PDF 署名',
      description: '署名画像を描画またはアップロード（見た目のみ、証明書ではない）',
    },
    'pdf-metadata': {
      name: 'PDF メタデータ',
      description: 'PDF メタデータの表示と編集',
    },
    'pdf-encrypt': {
      name: 'PDF 暗号化',
      description: 'パスワードと権限フラグを設定',
    },
    'pdf-crop': {
      name: 'PDF クロップ',
      description: 'cropBox でページ余白を切り抜き',
    },
    'pdf-grayscale': {
      name: 'PDF グレースケール',
      description: 'PDF を視覚的なグレースケールに変換',
    },
    'pdf-annotate': {
      name: 'PDF 注釈',
      description: 'ハイライト、フリーハンド、図形、テキストを PDF ページに描画',
    },
  },
} satisfies ShellResources;

export default ja;
