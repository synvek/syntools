import type { TranslationResources } from '../types';

/** Japanese translation resources */
const ja = {
  "app": {
    "docTitle": "SynTools · 開発者向けオンラインツールボックス"
  },
  "header": {
    "openMenu": "メニューを開く",
    "searchPlaceholder": "ツールを検索…",
    "searchAria": "ツールを検索",
    "themeAria": "テーマを切り替え",
    "langAria": "言語を切り替え",
    "sourceAria": "ソースコード"
  },
  "sidebar": {
    "nav": "ツールナビゲーション",
    "closeMenu": "メニューを閉じる",
    "filter": "ツールを絞り込み",
    "filterPlaceholder": "絞り込み…",
    "filterEmpty": "一致するツールがありません"
  },
  "home": {
    "title": "開発者向けオンラインツールボックス",
    "tagline": "ローカル優先の処理；データはブラウザ内に留まります（CSP、ゼロ外送）· <1>⌘K</1> または <3>/</3> で検索",
    "favorites": "お気に入り",
    "recent": "最近使用したツール",
    "favoriteAria": "お気に入りに追加",
    "unfavoriteAria": "お気に入りから削除"
  },
  "search": {
    "aria": "ツールを検索",
    "placeholder": "ツールを検索（名前 / キーワード）…",
    "empty": "一致するツールが見つかりません"
  },
  "categories": {
    "encoding": "エンコード",
    "text": "テキスト",
    "formatting": "フォーマット",
    "crypto": "暗号・ハッシュ",
    "datetime": "日付と時刻",
    "generator": "ジェネレーター",
    "network": "ネットワーク",
    "image": "画像",
    "pdf": "PDF",
    "other": "その他"
  },
  "common": {
    "copy": "コピー",
    "copied": "コピーしました",
    "clear": "クリア",
    "swap": "入れ替え",
    "download": "ダウンロード",
    "share": "共有",
    "shareTooLong": "内容が長すぎます（2KB超）。共有リンクを作成できません",
    "retry": "再試行",
    "loading": "読み込み中",
    "operation": "操作",
    "encode": "エンコード",
    "decode": "デコード",
    "result": "結果",
    "rawText": "元のテキスト",
    "input": "入力",
    "output": "出力",
    "text": "テキスト",
    "file": "ファイル",
    "remove": "削除",
    "bytes": "{{size}} バイト"
  },
  "io": {
    "stats": "{{chars}} 文字 / {{bytes}} バイト",
    "warnLarge": "入力が大きいです（> 500KB）。リアルタイム計算が遅くなる場合があります",
    "overflow": "入力が 5MB の上限を超えています。大きな内容にはファイルモードを使用してください"
  },
  "file": {
    "hint": "ファイルをここにドラッグ＆ドロップ、またはクリックして選択",
    "max": "最大 {{size}}",
    "over": "ファイルが {{max}} の上限を超えています（現在 {{size}}）",
    "uploadAria": "ファイルをアップロード",
    "previewAlt": "{{name}} のプレビュー",
    "pages": "{{n}} ページ",
    "encrypted": "暗号化済み"
  },
  "tool": {
    "errorTitle": "ツール実行エラー",
    "localBadge": "ローカルのみ",
    "serverBadge": "サーバーが必要",
    "related": "関連ツール",
    "nextSteps": "次のステップ",
    "openIn": "{{name}} で開く",
    "progress": "進捗 {{current}} / {{total}}"
  },
  "notFound": {
    "message": "ページまたはツールが見つかりません",
    "back": "ホームに戻る"
  },
  "pdf": {
    "password": "PDF パスワード",
    "passwordPlaceholder": "開くパスワードを入力",
    "passwordHint": "この PDF は暗号化されています。続行するにはパスワードを入力してください。",
    "unlock": "ロック解除",
    "errors": {
      "NEED_PASSWORD": "この PDF は暗号化されています。パスワードを入力してください。",
      "WRONG_PASSWORD": "パスワードが正しくありません。もう一度お試しください。"
    }
  },
  "toolsMeta": {
    "base64": {
      "name": "Base64 エンコード / デコード",
      "description": "Unicode 安全なテキストと Base64 の相互変換。URL Safe とファイルモード対応"
    },
    "url-codec": {
      "name": "URL エンコード / デコード",
      "description": "encodeURIComponent / encodeURI モードと不正なパーセントエンコード検出"
    },
    "regex-tester": {
      "name": "正規表現ツール",
      "description": "マッチ強調、置換、キャプチャグループ、プリセット、チートシート"
    },
    "text-diff": {
      "name": "テキスト差分",
      "description": "並列エディタ、行内ハイライト、行番号、空白無視"
    },
    "json-format": {
      "name": "JSON フォーマッタ",
      "description": "整形 / 圧縮 / 検証。2/4 スペースインデントと行・列のエラー位置"
    },
    "json-convert": {
      "name": "JSON コンバータ",
      "description": "JSON を解析して YAML / XML / CSV に変換"
    },
    "timestamp": {
      "name": "タイムスタンプ変換",
      "description": "Unix ⇄ 人間可読時刻。秒/ミリ秒の自動判定とライブ時計"
    },
    "uuid": {
      "name": "UUID ジェネレータ",
      "description": "ランダム v4 / 時系列 v7 UUID。一括出力と書式オプション"
    },
    "hash": {
      "name": "ハッシュ計算",
      "description": "テキストとファイル（ストリーミング）の MD5 / SHA-1 / SHA-256 / SHA-512。hex / base64 出力"
    },
    "jwt-parser": {
      "name": "JWT パーサー",
      "description": "header / payload / signature を解析し、exp などの時刻クレームを表示（読み取り専用、検証なし）"
    },
    "aes-crypto": {
      "name": "AES 暗号化 / 復号",
      "description": "PBKDF2 パスフレーズまたは生キーの AES-GCM。出力は base64(salt|iv|ciphertext)"
    },
    "hmac": {
      "name": "HMAC",
      "description": "HMAC-SHA256 / SHA512。hex / base64 出力"
    },
    "totp": {
      "name": "TOTP",
      "description": "RFC 6238 TOTP：生成 / 検証、6/8 桁、残り秒数"
    },
    "x509-decode": {
      "name": "X.509 証明書デコーダ",
      "description": "PEM を解析：SHA-256/SHA-1 フィンガープリント、種類、DER 長、CN"
    },
    "cidr-calc": {
      "name": "CIDR 計算機",
      "description": "IPv4 CIDR：ネットワーク / ブロードキャスト / ホスト範囲 / マスク / ホスト数"
    },
    "text-lines": {
      "name": "テキスト行ツール",
      "description": "並べ替え / 重複削除 / 逆順 / 番号付け / 空行削除"
    },
    "hex-codec": {
      "name": "Hex エンコード / デコード",
      "description": "Hex ↔ UTF-8 テキスト（スペース任意）"
    },
    "url-query": {
      "name": "URL クエリパーサー",
      "description": "URL の各部とクエリパラメータを解析し、編集後に再構築"
    },
    "json-path": {
      "name": "JSONPath クエリ",
      "description": "a.b[0].c のようなシンプルなパスクエリ"
    },
    "gzip-tool": {
      "name": "Gzip 圧縮",
      "description": "テキストを Gzip して base64 へ / 展開してテキストへ"
    },
    "exif-strip": {
      "name": "EXIF 削除",
      "description": "JPEG の基本 EXIF を読み取り APP1 を削除。クリーンなファイルをダウンロード"
    },
    "fake-data": {
      "name": "ダミーデータ生成",
      "description": "名前 / メール / UUID / lorem を zh/en で生成（1–50 件）"
    },
    "password-gen": {
      "name": "パスワード生成",
      "description": "長さ / 文字セット指定の強力な乱数パスワード。エントロピーと強度評価"
    },
    "entity-codec": {
      "name": "HTML エンコード / デコード",
      "description": "HTML 特殊文字のエンコード/デコード：名前付き / 十進 / hex / \\u エスケープ"
    },
    "cron-parser": {
      "name": "Cron 式パーサー",
      "description": "Cron 式の検証、フィールド説明、次回実行のプレビュー"
    },
    "convert-data": {
      "name": "設定データ形式変換",
      "description": "ロスレスな JS 値を介して YAML ⇄ JSON ⇄ TOML を変換"
    },
    "sql-format": {
      "name": "SQL フォーマッタ",
      "description": "複数方言の SQL を整形。インデントとキーワードの大文字小文字を設定可能"
    },
    "html-format": {
      "name": "HTML 圧縮 / 整形",
      "description": "HTML の圧縮と整形。2/4 スペースインデント"
    },
    "js-format": {
      "name": "JS 圧縮 / 整形",
      "description": "JavaScript の圧縮と整形。2/4 スペースインデント"
    },
    "css-format": {
      "name": "CSS 圧縮 / 整形",
      "description": "CSS の圧縮と整形。2/4 スペースインデント"
    },
    "xml-format": {
      "name": "XML 圧縮 / 整形",
      "description": "XML の整形と圧縮。2/4 スペースインデント。CDATA を保持"
    },
    "xml-json": {
      "name": "XML から JSON",
      "description": "XML を JSON に変換。属性は @_ プレフィックスで保持"
    },
    "qrcode": {
      "name": "QR コード",
      "description": "ECC、サイズ、色、余白オプション付きで QR コードを生成・読み取り"
    },
    "color-converter": {
      "name": "カラー変換",
      "description": "HEX / RGB / HSL の変換とプレビュー"
    },
    "radix-converter": {
      "name": "進数変換",
      "description": "2/8/10/16 進変換と 64 ビット符号付き整数のビット演算可視化"
    },
    "markdown-preview": {
      "name": "Markdown プレビュー",
      "description": "DOMPurify でサニタイズした安全な GFM ライブレンダリング"
    },
    "image-compress": {
      "name": "画像圧縮",
      "description": "クライアント側の画像圧縮と形式変換（PNG / JPEG / WebP）。リサイズと品質指定"
    },
    "unicode-codec": {
      "name": "Unicode コーデック",
      "description": "テキストと \\uXXXX、コードポイント、HTML 実体、UTF-8 バイトの相互変換"
    },
    "html-color-picker": {
      "name": "HTML カラーピッカー",
      "description": "視覚的に色を選び HEX / RGB / HSL と HTML/CSS スニペットを出力"
    },
    "web-color-table": {
      "name": "Web カラー表",
      "description": "CSS 名前付き色。グループ絞り込みと名前 / HEX / RGB のコピー"
    },
    "pinyin": {
      "name": "中国語ピンイン変換",
      "description": "中国語をピンインに変換。声調、区切り、大文字小文字オプション"
    },
    "length-converter": {
      "name": "長さ単位変換",
      "description": "メートル法とヤード・ポンド法の長さ単位（mm, cm, m, km, in, ft など）"
    },
    "zh-convert": {
      "name": "繁简体変換",
      "description": "簡体字と繁体字の相互変換"
    },
    "weight-converter": {
      "name": "重量単位変換",
      "description": "メートル法とヤード・ポンド法の重量単位（mg, g, kg, t, oz, lb, st）"
    },
    "text-counter": {
      "name": "テキストカウンタ",
      "description": "文字、単語、行、段落、CJK 文字、UTF-8 バイト数をカウント"
    },
    "calendar": {
      "name": "カレンダー",
      "description": "月表示。中国語は旧暦/暦注、英語は現地祝日"
    },
    "css-button": {
      "name": "CSS ボタンジェネレータ",
      "description": "スタイルを視覚的に調整し、ボタンの CSS / HTML を生成"
    },
    "random-number": {
      "name": "乱数ジェネレータ",
      "description": "範囲内の整数または小数の乱数。一意値オプションあり"
    },
    "random-string": {
      "name": "ランダム文字列ジェネレータ",
      "description": "長さと文字セット（英数字 / hex / カスタム）でランダム文字列を生成"
    },
    "doodle-board": {
      "name": "お絵かきボード",
      "description": "ブラシ、消しゴム、PNG 書き出し付きのブラウザスケッチパッド"
    },
    "calculator": {
      "name": "電卓",
      "description": "四則演算、累乗、剰余、よく使う関数の安全な式電卓"
    },
    "code-image": {
      "name": "コード画像化",
      "description": "コードをシンタックスハイライト付きカードとして描画し PNG 書き出し"
    },
    "image-color-picker": {
      "name": "画像カラーピッカー",
      "description": "画像をアップロードし、ピクセルをクリックして HEX / RGB を取得"
    },
    "ascii-table": {
      "name": "ASCII 表",
      "description": "ASCII 0–127 一覧。十進、hex、文字で検索"
    },
    "image-watermark": {
      "name": "画像ウォーターマーク",
      "description": "位置、不透明度、回転、タイル配置のテキスト透かし"
    },
    "case-convert": {
      "name": "大文字小文字・命名変換",
      "description": "大文字小文字と命名スタイル（camel / snake / kebab など）を変換"
    },
    "bmi-calculator": {
      "name": "BMI 計算",
      "description": "身長と体重から BMI を計算。WHO 成人カテゴリ付き"
    },
    "placeholder-image": {
      "name": "プレースホルダー画像",
      "description": "サイズ、色、任意テキストでプレースホルダー PNG を生成"
    },
    "image-merge": {
      "name": "画像結合",
      "description": "画像を横・縦・グリッドでつなぎ、1 枚の PNG に"
    },
    "cron-generator": {
      "name": "Crontab ジェネレータ",
      "description": "分/時/日/月/曜日オプションから標準 5 フィールド Cron 式を作成"
    },
    "ua-parser": {
      "name": "User-Agent パーサー",
      "description": "ブラウザ User-Agent をブラウザ、エンジン、OS、デバイスに解析"
    },
    "latex-editor": {
      "name": "LaTeX 数式エディタ",
      "description": "クイック記号と定番数式、KaTeX プレビュー、PNG/JPG/SVG 書き出し"
    },
    "countdown": {
      "name": "カウントダウンタイマー",
      "description": "時・分・秒を設定。一時停止、再開、終了アラート"
    },
    "stopwatch": {
      "name": "ストップウォッチ",
      "description": "開始、一時停止、ラップ、リセット付きオンラインストップウォッチ"
    },
    "svg-to-png": {
      "name": "SVG から PNG",
      "description": "SVG マークアップまたはファイルをスケールと透過付きで PNG に変換"
    },
    "image-frame": {
      "name": "画像枠 / 角丸 / 影",
      "description": "枠線、角丸、影を追加して PNG 書き出し"
    },
    "image-adjust": {
      "name": "画像色調整",
      "description": "明るさ、コントラスト、彩度、色相を調整して PNG 書き出し"
    },
    "gif-frames": {
      "name": "GIF フレーム抽出",
      "description": "GIF を PNG フレームに分割。1 枚またはすべてダウンロード"
    },
    "image-crop": {
      "name": "画像クロップ",
      "description": "自由形または固定アスペクト比で画像を切り抜き PNG へ"
    },
    "mbti-test": {
      "name": "MBTI 性格テスト",
      "description": "24 問の短い MBTI 風クイズ（娯楽用）"
    },
    "text-card": {
      "name": "テキストカード",
      "description": "タイトルと本文をスタイル付きカードにレイアウトし PNG 書き出し"
    },
    "image-card": {
      "name": "画像カード",
      "description": "写真＋タイトル/サブタイトルのカード。背景プリセットまたはグラデーション、PNG 書き出し"
    },
    "code-highlight": {
      "name": "コードハイライター",
      "description": "行番号付きライブシンタックスハイライトと HTML スニペットコピー"
    },
    "image-base64": {
      "name": "画像 ↔ Base64",
      "description": "画像を Base64 / Data URL と相互変換（すべてローカル）"
    },
    "image-ico": {
      "name": "ICO 変換",
      "description": "画像を複数サイズ ICO（favicon）へ、または ICO から PNG を抽出"
    },
    "hsv-cmyk": {
      "name": "HSV / CMYK 変換",
      "description": "RGB、HSV、CMYK、HEX 色空間の変換とプレビュー"
    },
    "ai-prompts": {
      "name": "AI プロンプトライブラリ",
      "description": "カテゴリ別の厳選プロンプト。検索とワンクリックコピー"
    },
    "md-mindmap": {
      "name": "Markdown マインドマップ",
      "description": "Markdown をマインドマップに。テーマ、ズーム、PNG/SVG 書き出し"
    },
    "mermaid-editor": {
      "name": "Mermaid ダイアグラムエディタ",
      "description": "Mermaid をローカル描画。テーマ、ズーム、PNG/SVG 書き出し"
    },
    "css-gradient": {
      "name": "CSS グラデーションジェネレータ",
      "description": "線形 / 放射グラデーションを編集。分類プリセットと CSS コピー"
    },
    "image-to-paper": {
      "name": "画像から用紙 PDF",
      "description": "画像を A3/A4/A5/Letter に合わせて PDF 書き出し"
    },
    "md-to-image": {
      "name": "Markdown から画像",
      "description": "Markdown をスタイル付きカードに描画。フォント、サイズ、幅、色を指定して PNG 書き出し"
    },
    "chart-generator": {
      "name": "チャートジェネレータ",
      "description": "CSV から棒/折れ線/面/円/ドーナツ/散布図を作成。凡例とパレット付き"
    },
    "css3-generator": {
      "name": "CSS3 コードジェネレータ",
      "description": "border-radius、影、transform、filter などを生成"
    },
    "xslt-transform": {
      "name": "XSLT 変換",
      "description": "ブラウザ内で XSLT により XML を HTML に変換"
    },
    "pdf-merge": {
      "name": "PDF 結合",
      "description": "複数の PDF を 1 つのファイルに結合"
    },
    "pdf-split": {
      "name": "PDF 分割",
      "description": "PDF をページごとに分割"
    },
    "pdf-delete-pages": {
      "name": "PDF ページ削除",
      "description": "PDF から選択したページを削除"
    },
    "pdf-extract-pages": {
      "name": "PDF ページ抽出",
      "description": "選択したページを新しい PDF に抽出"
    },
    "pdf-reorder": {
      "name": "PDF ページ並べ替え",
      "description": "PDF 内のページ順を変更"
    },
    "pdf-rotate": {
      "name": "PDF ページ回転",
      "description": "選択またはすべてのページを回転"
    },
    "pdf-to-image": {
      "name": "PDF から画像",
      "description": "PDF ページを JPG/PNG として描画"
    },
    "images-to-pdf": {
      "name": "画像から PDF",
      "description": "画像をまとめて PDF に"
    },
    "pdf-viewer": {
      "name": "PDF ビューア",
      "description": "PDF をローカルで開いて閲覧"
    },
    "pdf-page-numbers": {
      "name": "PDF ページ番号",
      "description": "PDF にページ番号を追加"
    },
    "pdf-header-footer": {
      "name": "PDF ヘッダー & フッター",
      "description": "ヘッダーとフッターのテキストを追加"
    },
    "pdf-insert-image": {
      "name": "PDF に画像を挿入",
      "description": "PDF ページに画像を配置"
    },
    "pdf-add-text": {
      "name": "PDF にテキスト追加",
      "description": "PDF ページにテキストを追加"
    },
    "pdf-sign": {
      "name": "PDF 署名",
      "description": "署名画像を描画またはアップロード（見た目のみ、証明書ではない）"
    },
    "pdf-metadata": {
      "name": "PDF メタデータ",
      "description": "PDF メタデータの表示と編集"
    },
    "pdf-encrypt": {
      "name": "PDF 暗号化",
      "description": "パスワードと権限フラグを設定"
    },
    "pdf-crop": {
      "name": "PDF クロップ",
      "description": "cropBox でページ余白を切り抜き"
    },
    "pdf-grayscale": {
      "name": "PDF グレースケール",
      "description": "PDF を視覚的なグレースケールに変換"
    },
    "pdf-annotate": {
      "name": "PDF 注釈",
      "description": "ハイライト、フリーハンド、図形、テキストを PDF ページに描画"
    }
  },
  "tools": {
    "base64": {
      "direction": {
        "encode": "エンコード（テキスト → Base64）",
        "decode": "デコード（Base64 → テキスト）"
      },
      "urlSafe": "URL Safe（- _、パディングなし）",
      "labels": {
        "rawText": "元のテキスト",
        "base64Input": "Base64 入力",
        "base64Result": "Base64 結果",
        "decodeResult": "デコード結果"
      },
      "placeholders": {
        "encode": "text to encode…を入力",
        "decode": "a Base64 string…を貼り付け"
      },
      "fileNote": "ファイルの Base64 結果を表示中。テキスト入力でクリアされます。",
      "fileMode": "ファイルモード：ファイル → Base64（ArrayBuffer チャンク）",
      "err": {
        "INVALID_PADDING": "位置 {{position}} のパディング \"=\" が無効です",
        "INVALID_CHAR": "位置 {{position}} の無効な文字 \"{{char}}\"",
        "INVALID_LENGTH": "長さが無効：Base64 内容の長さ mod 4 は 1 にできません",
        "DECODE_FAILED": "デコード失敗：有効な Base64 入力ではありません"
      }
    },
    "url": {
      "modes": {
        "component": "component（パラメータ値、予約文字をエンコード）",
        "full": "完全な URL（: / ? & などを保持）"
      },
      "mode": "モード",
      "labels": {
        "rawText": "元のテキスト",
        "encodedText": "エンコード結果"
      },
      "placeholders": {
        "encode": "content to encode…を入力",
        "decode": "percent-encoded content…を貼り付け"
      },
      "err": {
        "ENCODE_FAILED": "エンコード失敗：入力にペアでないサロゲート文字が含まれています",
        "DECODE_FAILED": "デコードに失敗しました：不正なパーセントエンコーディング"
      }
    },
    "regex": {
      "presets": "プリセット",
      "presetPlaceholder": "選択して入力…",
      "expression": "パターン",
      "expressionPlaceholder": "e.g. \\d+",
      "flags": "フラグ",
      "testText": "テストテキスト",
      "testTextPlaceholder": "text to match…を貼り付け",
      "matchCount": "{{count}} 件のマッチ",
      "truncated": "（切り詰め、最初の 1000 件を表示）",
      "position": "インデックス",
      "matchContent": "マッチ",
      "captureGroups": "グループ",
      "emptyMatch": "（空のマッチ）",
      "tableLimit": "最初の {{count}} 行のみ表示",
      "mode": "モード",
      "modes": {
        "match": "マッチ",
        "replace": "置換"
      },
      "replacement": "置換後",
      "replacementPlaceholder": "$1、$& などに対応…",
      "replaceResult": "置換結果",
      "cheatSheet": "チートシート（クリックで挿入）",
      "cheat": {
        "dot": "任意の1文字",
        "digit": "数字",
        "word": "単語文字",
        "space": "空白",
        "start": "行頭",
        "end": "行末",
        "star": "0回以上",
        "plus": "1回以上",
        "question": "0または1",
        "or": "選択",
        "group": "キャプチャグループ",
        "class": "文字クラス",
        "range": "範囲",
        "not": "否定クラス"
      },
      "presetsList": {
        "email": "メール",
        "phoneCn": "電話（中国本土）",
        "idCard": "身分証（18桁）",
        "url": "URL",
        "ipv4": "IPv4 アドレス",
        "date": "日付（yyyy-mm-dd）"
      },
      "err": {
        "EMPTY": "正規表現を空にはできません",
        "COMPILE": "コンパイル失敗：{{message}}",
        "TEXT_TOO_LONG": "テキストが {{limit}}K 文字制限を超過。マッチングを停止（ReDoS / 長時間実行保護）"
      }
    },
    "textDiff": {
      "oldText": "原文",
      "newText": "改訂",
      "swapSides": "左右入れ替え",
      "stats": "+{{added}} 追加 / −{{removed}} 削除 / {{same}} 変更なし",
      "identical": "両方のテキストは同一です",
      "renderLimit": "差分行が多すぎます。最初の {{count}} 行のみ表示します",
      "ignoreWhitespace": "末尾・連続スペースを無視",
      "err": {
        "TOO_LARGE": "結合テキストが {{limit}}K 文字制限を超過。差分を停止（長時間実行保護）"
      }
    },
    "json": {
      "actions": {
        "format": "整形",
        "compress": "圧縮",
        "validate": "検証のみ"
      },
      "indent": "インデント",
      "indent2": "スペース 2",
      "indent4": "スペース 4",
      "inputLabel": "JSON 入力",
      "validateResult": "検証結果",
      "inputPlaceholder": "JSON, e.g. {\"a\": 1}…を貼り付け",
      "valid": "✓ 有効な JSON",
      "err": {
        "EMPTY": "JSON 解析失敗：入力が空です",
        "UNKNOWN": "JSON 解析失敗：不明なエラー",
        "INVALID_LITERAL": "JSON 解析失敗：リテラル \"{{literal}}\" が必要（{{line}} 行、{{column}} 列）",
        "NEWLINE_IN_STRING": "JSON 解析失敗：文字列は改行できません（{{line}} 行、{{column}} 列）",
        "UNEXPECTED_STRING_END": "JSON 解析失敗：文字列が予期せず終了（{{line}} 行、{{column}} 列）",
        "INVALID_UNICODE_ESCAPE": "JSON 解析失敗：無効な \\u エスケープ、16 進 4 桁が必要（{{line}} 行、{{column}} 列）",
        "INVALID_ESCAPE": "JSON 解析失敗：無効なエスケープ \"\\{{char}}\"（{{line}} 行、{{column}} 列）",
        "INVALID_NUMBER": "JSON 解析失敗：無効な数値（{{line}} 行、{{column}} 列）",
        "DECIMAL_NO_DIGITS": "JSON 解析失敗：小数点の後に数字が必要（{{line}} 行、{{column}} 列）",
        "EXPONENT_NO_DIGITS": "JSON 解析失敗：指数に数字が必要（{{line}} 行、{{column}} 列）",
        "UNEXPECTED_END": "JSON 解析失敗：予期しない終端、値がありません（{{line}} 行、{{column}} 列）",
        "INVALID_CHAR": "JSON 解析失敗：無効な文字 \"{{char}}\"（{{line}} 行、{{column}} 列）",
        "TRAILING_COMMA": "JSON 解析失敗：末尾のカンマは不可（{{line}} 行、{{column}} 列）",
        "KEY_MUST_BE_STRING": "JSON 解析失敗：オブジェクトのキーは文字列である必要があります（{{line}} 行、{{column}} 列）",
        "MISSING_COLON": "JSON 解析失敗：オブジェクトキーの後に \":\" がありません（{{line}} 行、{{column}} 列）",
        "MISSING_VALUE": "JSON 解析失敗：値がありません（{{line}} 行、{{column}} 列）",
        "UNCLOSED_OBJECT": "JSON 解析失敗：オブジェクトが閉じていません、\"}\" がありません（{{line}} 行、{{column}} 列）",
        "MISSING_COMMA_OBJECT": "JSON 解析失敗：オブジェクト要素の間に \",\" がありません（{{line}} 行、{{column}} 列）",
        "UNCLOSED_ARRAY": "JSON 解析失敗：配列が閉じていません、\"]\" がありません（{{line}} 行、{{column}} 列）",
        "MISSING_COMMA_ARRAY": "JSON 解析失敗：配列要素の間に \",\" がありません（{{line}} 行、{{column}} 列）",
        "EXTRA_CONTENT": "JSON 解析失敗：値の後に余分な内容（{{line}} 行、{{column}} 列）",
        "UNCLOSED_STRING": "JSON 解析失敗：文字列が閉じていません（{{line}} 行、{{column}} 列）"
      }
    },
    "timestamp": {
      "currentTime": "現在時刻",
      "pauseTick": "時計を一時停止",
      "resumeTick": "時計を再開",
      "second": "秒",
      "millisecond": "ミリ秒",
      "localPrefix": "ローカル：{{local}} · {{utc}}",
      "tsToReadable": "タイムスタンプ → 可読時刻（秒/ミリ秒を自動判定）",
      "fillCurrentSec": "現在を入力（秒）",
      "tsInput": "タイムスタンプ入力",
      "tsPlaceholder": "e.g. 1725000000 or 1725000000000",
      "localTime": "ローカル時刻",
      "relative": "相対（{{unit}} と判定）",
      "unitSeconds": "秒",
      "unitMilliseconds": "ミリ秒",
      "dateToTs": "可読時刻 → タイムスタンプ（空白区切りはローカルタイムゾーン）",
      "dateInput": "日時入力",
      "datePlaceholder": "e.g. 2026-09-01 12:00:00 or 2026-09-01T04:00:00Z",
      "relativeAgo": "{{count}} {{unit}}前",
      "relativeLater": "{{count}} {{unit}}後",
      "units": {
        "second": "秒",
        "minute": "分",
        "hour": "時間",
        "day": "日",
        "year": "年"
      },
      "err": {
        "NOT_NUMERIC": "タイムスタンプは数値である必要があります（負数可）",
        "OUT_OF_RANGE": "タイムスタンプが数値範囲外",
        "TS_TOO_LARGE": "タイムスタンプが表示可能な範囲外です（±275760 年）",
        "DATE_EMPTY": "a date/timeを入力してください",
        "DATE_INVALID": "日付/時刻を解析できません（例：2026-09-01 12:00:00 または ISO 8601）"
      }
    },
    "uuid": {
      "version": "バージョン",
      "versions": {
        "v4": "v4（ランダム）",
        "v7": "v7（時系列）"
      },
      "count": "件数",
      "uppercase": "大文字",
      "hyphens": "ハイフン",
      "braces": "波括弧",
      "generate": "生成",
      "output": "生成結果（1行に1件）",
      "err": {
        "INVALID_COUNT": "件数は 1 以上の整数である必要があります",
        "TOO_MANY": "1 バッチ最大 {{max}} UUID"
      }
    },
    "hash": {
      "algorithm": "アルゴリズム",
      "encoding": "出力",
      "encodings": {
        "hex": "hex（16進）",
        "base64": "base64"
      },
      "source": "ソース",
      "textInput": "テキスト入力",
      "textPlaceholder": "text to hash…を入力",
      "result": "{{algorithm}} 結果",
      "computing": "計算中…",
      "fileHint": "ファイルをここにドラッグ＆ドロップ、またはクリックして選択（MD5 はストリーム。大容量もメモリ安全）",
      "limitHint": "注：MD5 以外はファイル全体をメモリに読み込みます。非常に大きいファイルはメモリ不足になる場合があります",
      "err": {
        "UNSUPPORTED": "ハッシュ失敗：この環境ではアルゴリズムがサポートされていません",
        "FILE_HASH": "ファイルハッシュ失敗：{{message}}",
        "FILE_READ": "read file contentsに失敗しました"
      }
    },
    "jwt": {
      "mode": "モード",
      "modes": {
        "parse": "解析",
        "sign": "署名（HS256）"
      },
      "secretPlaceholder": "HMAC シークレット…",
      "payloadJson": "ペイロード JSON",
      "payloadPlaceholder": "{ \"sub\": \"123\", \"name\": \"Alice\" }",
      "signedToken": "署名済みトークン",
      "signNote": "ブラウザ内で HS256 署名。シークレットは端末外に出ません",
      "inputLabel": "JWT 入力",
      "inputPlaceholder": "JWT を貼り付け（Bearer プレフィックス可）、例：eyJhbGci…",
      "header": "ヘッダー",
      "payload": "ペイロード",
      "signature": "署名",
      "note": "解析のみ、署名検証なし。検証には鍵が必要。すべてブラウザ内で処理",
      "alg": "アルゴリズム",
      "expired": "期限切れ",
      "notExpired": "有効期限内",
      "claims": {
        "exp": "有効期限 exp",
        "nbf": "以前不可 nbf",
        "iat": "発行時刻 iat"
      },
      "err": {
        "EMPTY": "a JWTを貼り付けてください",
        "INVALID_PARTS": "形式が無効：JWT は header.payload.signature で構成されます",
        "INVALID_HEADER": "ヘッダーの解析に失敗：有効な base64url エンコード JSON ではありません",
        "INVALID_PAYLOAD": "ペイロードの解析に失敗：有効な base64url エンコード JSON ではありません",
        "SIGN_FAILED": "署名に失敗しました"
      }
    },
    "aes-crypto": {
      "encrypt": "暗号化",
      "decrypt": "復号",
      "keyMode": "鍵モード",
      "passphrase": "パスフレーズ（PBKDF2）",
      "rawKey": "生キー（hex）",
      "passphrasePlaceholder": "passphrase…を入力",
      "keyHexPlaceholder": "32 または 64 hex 文字（AES-128/256）…",
      "ivPlaceholder": "任意の IV（24 hex 文字 / 12 バイト）。空ならランダム",
      "plaintext": "平文",
      "ciphertext": "暗号文（base64）",
      "inputPlaceholder": "content…を入力",
      "note": "暗号出力：base64(salt|iv|ciphertext+tag)。パスフレーズは PBKDF2-SHA256",
      "err": {
        "EMPTY": "contentを入力してください",
        "INVALID_KEY": "無効な鍵：パスフレーズまたは hex 鍵の長さを確認してください",
        "DECRYPT_FAILED": "復号に失敗しました：鍵が違うかデータが破損しています",
        "INVALID_INPUT": "無効なinput: bad ciphertext or IV"
      }
    },
    "hmac": {
      "algorithm": "アルゴリズム",
      "encoding": "出力",
      "secretPlaceholder": "HMAC シークレット…",
      "message": "メッセージ",
      "messagePlaceholder": "認証するメッセージ…",
      "err": {
        "EMPTY": "a messageを入力してください",
        "INVALID_KEY": "a valid secretを入力してください"
      }
    },
    "totp": {
      "digits": "桁数",
      "secret": "Base32 シークレット",
      "secretPlaceholder": "Authenticator secret (Base32)…を貼り付け",
      "code": "現在のコード",
      "remaining": "残り秒数",
      "verify": "コード検証（任意）",
      "verifyPlaceholder": "6/8-digit code…を入力",
      "verifyOk": "検証成功",
      "verifyFail": "検証失敗",
      "err": {
        "EMPTY": "secret or codeを入力してください",
        "INVALID_SECRET": "シークレットが有効な Base32 ではありません"
      }
    },
    "cidr-calc": {
      "input": "CIDR",
      "placeholder": "e.g. 192.168.1.0/24",
      "fields": {
        "network": "ネットワーク",
        "broadcast": "ブロードキャスト",
        "firstHost": "最初のホスト",
        "lastHost": "最後のホスト",
        "netmask": "ネットマスク",
        "wildcard": "ワイルドカード",
        "prefix": "プレフィックス",
        "hostCount": "ホスト数",
        "totalAddresses": "総アドレス数"
      },
      "err": {
        "EMPTY": "a CIDRを入力してください",
        "INVALID": "無効な CIDR（IPv4/プレフィックス、例：10.0.0.0/8）"
      }
    },
    "text-lines": {
      "placeholder": "1行に1項目…",
      "ops": {
        "sort-asc": "昇順ソート",
        "sort-desc": "降順ソート",
        "unique": "重複削除",
        "reverse": "逆順",
        "number": "行番号",
        "trim-empty": "空行を削除"
      },
      "err": {
        "EMPTY": "textを入力してください"
      }
    },
    "hex-codec": {
      "spaced": "スペース区切りバイト",
      "placeholder": "テキストまたは hex…",
      "err": {
        "EMPTY": "contentを入力してください",
        "INVALID_HEX": "無効なhex (even length, 0-9a-f)"
      }
    },
    "url-query": {
      "input": "URL",
      "placeholder": "https://example.com/path?a=1&b=2",
      "addParam": "パラメータ追加",
      "key": "キー",
      "value": "値",
      "rebuilt": "再構築した URL",
      "parts": {
        "protocol": "プロトコル",
        "hostname": "ホスト",
        "port": "ポート",
        "pathname": "パス",
        "hash": "ハッシュ",
        "origin": "オリジン"
      },
      "err": {
        "EMPTY": "a URLを入力してください",
        "INVALID_URL": "無効な URL"
      }
    },
    "json-path": {
      "pathPlaceholder": "パス、例：a.b[0].c または $.a.b[0]",
      "json": "JSON",
      "jsonPlaceholder": "JSON…を貼り付け",
      "err": {
        "EMPTY": "JSON and a pathを入力してください",
        "INVALID_JSON": "JSON 解析に失敗しました",
        "NOT_FOUND": "パスが見つかりません"
      }
    },
    "gzip-tool": {
      "compress": "圧縮（テキスト → base64）",
      "decompress": "展開（base64 → テキスト）",
      "placeholder": "テキストまたは gzip base64…",
      "err": {
        "EMPTY": "contentを入力してください",
        "INVALID": "無効な入力",
        "DECOMPRESS_FAILED": "展開失敗：有効な gzip データではありません"
      }
    },
    "x509-decode": {
      "input": "PEM 証明書",
      "placeholder": "-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----",
      "fields": {
        "pemType": "種類",
        "derLength": "DER 長",
        "sha256": "SHA-256",
        "sha1": "SHA-1",
        "subject": "Subject CN",
        "issuer": "Issuer CN"
      },
      "err": {
        "EMPTY": "PEMを貼り付けてください",
        "INVALID_PEM": "無効な PEM"
      }
    },
    "exif-strip": {
      "hint": "JPEG のみ：APP1（EXIF）を削除してダウンロード。",
      "drop": "JPEG 画像をドロップ",
      "hasExif": "EXIF あり",
      "orientation": "向き",
      "make": "カメラメーカー",
      "yes": "はい",
      "no": "いいえ",
      "download": "削除済みファイルをダウンロード",
      "err": {
        "EMPTY": "a fileを選択してください",
        "UNSUPPORTED": "JPEG のみ",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "fake-data": {
      "kind": "種類",
      "locale": "ロケール",
      "count": "件数",
      "generate": "生成",
      "kinds": {
        "name": "名前",
        "email": "メール",
        "uuid": "UUID",
        "lorem": "段落"
      },
      "err": {
        "EMPTY": "optionsを完了してください",
        "INVALID_COUNT": "件数は 1〜50 の整数である必要があります"
      }
    },
    "password": {
      "length": "長さ",
      "generate": "生成",
      "lowercase": "小文字（a-z）",
      "uppercase": "大文字（A-Z）",
      "digits": "数字（0-9）",
      "symbols": "記号（!@#$%…）",
      "excludeAmbiguous": "紛らわしい文字を除外（0 O 1 l I など）",
      "ensureEach": "選択した各セットから少なくとも 1 文字を含める",
      "output": "結果",
      "outputPlaceholder": "「生成」をクリックしてパスワードを作成",
      "entropy": "エントロピー ≈ {{bits}} ビット",
      "strength": {
        "weak": "弱い",
        "medium": "中",
        "strong": "強い"
      },
      "err": {
        "NO_SETS": "少なくとも 1 つの文字セットを選択してください",
        "INVALID_LENGTH": "長さは 4〜128 である必要があります"
      }
    },
    "entity": {
      "direction": "方向",
      "encode": "エンコード",
      "decode": "デコード",
      "mode": "整形",
      "modes": {
        "named": "名前付き（&amp;）",
        "decimal": "十進（&#38;）",
        "hex": "Hex（&#x26;）",
        "unicode": "\\u エスケープ（\\u4E2D）"
      },
      "scope": "範囲",
      "scopes": {
        "special": "特殊文字のみ（&、<、> など）",
        "nonascii": "特殊文字 + 非 ASCII"
      },
      "input": "入力",
      "output": "出力",
      "inputEncodePlaceholder": "エンコードするテキスト、例：<b>Hello</b>…",
      "inputDecodePlaceholder": "デコードするテキスト、例：&lt;b&gt;&#20320;&#22909;…",
      "unknown": "未認識の実体（そのまま保持）"
    },
    "cron": {
      "expression": "式",
      "placeholder": "e.g. */5 8-18 * * 1-5 or @daily (5 fields, 6 with seconds)",
      "count": "件数",
      "normalized": "正規化",
      "fieldsTitle": "フィールド内訳",
      "colField": "フィールド",
      "colValue": "値",
      "colMeaning": "意味",
      "nextTitle": "次の {{count}} 回の実行",
      "fieldNames": {
        "second": "秒",
        "minute": "分",
        "hour": "時",
        "day": "日",
        "month": "月",
        "week": "曜日"
      },
      "err": {
        "EMPTY": "a cron expressionを入力してください",
        "INVALID": "解析できません：フィールド数（5 または 6）と範囲（分 0-59 / 時 0-23 / 日 1-31 / 月 1-12 / 曜日 0-7）を確認"
      },
      "desc": {
        "every": {
          "second": "毎秒",
          "minute": "毎分",
          "hour": "毎時",
          "day": "毎日",
          "month": "毎月",
          "week": "毎週の各曜日"
        },
        "step": "{{n}} {{unit}}ごと",
        "at": "{{noun}}{{values}}",
        "range": "{{noun}}{{a}}–{{b}}",
        "rangeStep": "{{noun}}{{a}}–{{b}}, every {{n}}",
        "units": {
          "second": "秒",
          "minute": "分",
          "hour": "時間",
          "day": "日",
          "month": "月",
          "week": "日"
        },
        "nouns": {
          "second": "秒",
          "minute": "分",
          "hour": "時",
          "day": "日",
          "month": "月",
          "week": "曜日"
        },
        "sep": ", ",
        "days": [
          "日曜日",
          "月曜日",
          "火曜日",
          "水曜日",
          "木曜日",
          "金曜日",
          "土曜日"
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
      "from": "から",
      "to": "まで",
      "formats": {
        "yaml": "YAML",
        "json": "JSON",
        "toml": "TOML"
      },
      "input": "入力",
      "output": "出力",
      "placeholder": "content to convert…を貼り付け",
      "err": {
        "PARSE": "入力の解析に失敗しました：構文を確認してください",
        "STRINGIFY": "対象形式に変換できません（例：TOML はトップレベルの配列/スカラー非対応）"
      }
    },
    "sql": {
      "dialect": "方言",
      "indent": "インデント",
      "keywordCase": "キーワードの大文字小文字",
      "cases": {
        "upper": "UPPERCASE",
        "lower": "lowercase",
        "preserve": "保持"
      },
      "languages": {
        "sql": "汎用 SQL",
        "mysql": "MySQL",
        "postgresql": "PostgreSQL",
        "sqlite": "SQLite",
        "mariadb": "MariaDB",
        "transactsql": "SQL Server",
        "plsql": "PL/SQL"
      },
      "input": "SQL 入力",
      "output": "出力",
      "placeholder": "SQL を貼り付け、例：select * from users where id = 1…",
      "err": {
        "INVALID": "この SQL を解析できません：構文を確認してください"
      }
    },
    "html": {
      "actions": {
        "format": "整形",
        "compress": "圧縮"
      },
      "indent": "インデント",
      "indent2": "スペース 2",
      "indent4": "スペース 4",
      "input": "HTML 入力",
      "placeholder": "HTML を貼り付け、例：<div><span>Hello</span></div>…",
      "err": {
        "EMPTY": "HTML contentを入力してください",
        "INVALID": "処理に失敗しました：HTML が有効か確認してください"
      }
    },
    "js": {
      "actions": {
        "format": "整形",
        "compress": "圧縮"
      },
      "indent": "インデント",
      "indent2": "スペース 2",
      "indent4": "スペース 4",
      "input": "JavaScript 入力",
      "placeholder": "JS を貼り付け、例：function hello(){return 1}…",
      "err": {
        "EMPTY": "JavaScript contentを入力してください",
        "INVALID": "処理に失敗しました：構文を確認してください"
      }
    },
    "css": {
      "actions": {
        "format": "整形",
        "compress": "圧縮"
      },
      "indent": "インデント",
      "indent2": "スペース 2",
      "indent4": "スペース 4",
      "input": "CSS 入力",
      "placeholder": "CSS, e.g. .box{color:red}…を貼り付け",
      "err": {
        "EMPTY": "CSS contentを入力してください",
        "INVALID": "処理に失敗しました：CSS が有効か確認してください"
      }
    },
    "qr": {
      "input": "テキスト内容",
      "placeholder": "テキストまたは URL を入力、例：https://example.com…",
      "level": "誤り訂正",
      "size": "サイズ",
      "margin": "余白",
      "foreground": "前景",
      "background": "背景",
      "levels": {
        "L": "L (~7%)",
        "M": "M (~15%)",
        "Q": "Q (~25%)",
        "H": "H (~30%)"
      },
      "preview": "QR コードプレビュー",
      "decodeTitle": "QR コードをデコード",
      "decodeHint": "QR コードを含む画像をドロップまたは選択（PNG / JPG など）",
      "decodeOutput": "デコード結果",
      "err": {
        "EMPTY": "the content to encodeを入力",
        "TOO_LONG": "QR コードには長すぎます。短くするか誤り訂正レベルを下げてください",
        "NOT_FOUND": "画像に QR コードが見つかりません",
        "DECODE": "decode the imageに失敗しました",
        "LOAD": "画像の読み込みに失敗：有効な画像ファイルか確認してください",
        "INVALID_COLOR": "色は #RGB または #RRGGBB である必要があります",
        "INVALID_MARGIN": "余白は 0〜10 の整数（モジュール）である必要があります"
      }
    },
    "color": {
      "input": "色",
      "placeholder": "e.g. #3b82f6, rgb(59,130,246), hsl(217,91%,60%)…",
      "preview": "色プレビュー",
      "supportHint": "HEX / RGB / HSL をサポート（短縮形とパーセント含む）",
      "err": {
        "EMPTY": "a color valueを入力してください",
        "INVALID": "解析できません：HEX、RGB、または HSL 形式を使用してください"
      }
    },
    "radix": {
      "radix": "進数",
      "auto": "自動検出",
      "input": "整数入力",
      "placeholder": "e.g. 255, 0xff, 0b11111111, 0377…",
      "bitPattern": "ビットパターン",
      "twosComplement": "2の補数",
      "bitOps": "ビット演算",
      "operator": "演算子",
      "operandB": "オペランド B",
      "opHint": "オペランド A は上の入力を再利用。結果は 64 ビット符号付き整数範囲内",
      "ops": {
        "and": "AND",
        "or": "OR",
        "xor": "XOR",
        "shl": "<< (shift left)",
        "shr": ">> (shift right)",
        "not": "NOT"
      },
      "err": {
        "EMPTY": "an integerを入力してください",
        "INVALID": "解析できません：進数と数値形式を確認してください",
        "RANGE": "値が 64 ビット符号付き整数の範囲外です（−2⁶³ ~ 2⁶³−1）"
      }
    },
    "markdown": {
      "gfm": "GFM（表 / 取り消し線 / タスクリスト）",
      "breaks": "ソフト改行",
      "input": "Markdown エディタ",
      "placeholder": "Markdown, e.g. # Heading…を入力",
      "preview": "プレビュー",
      "shortcuts": "ショートカット：⌘/Ctrl+B 太字 · ⌘/Ctrl+I 斜体 · ⌘/Ctrl+K リンク · ⌘/Ctrl+E インラインコード",
      "toolbar": {
        "aria": "Markdown 編集ツールバー",
        "bold": "太字（**）",
        "italic": "斜体（*）",
        "strike": "取り消し線（~~）",
        "h1": "見出し 1（#）",
        "h2": "見出し 2（##）",
        "h3": "見出し 3（###）",
        "h4": "見出し 4（####）",
        "h5": "見出し 5（#####）",
        "h6": "見出し 6（######）",
        "quote": "引用（>）",
        "code": "インラインコード（`)",
        "codeBlock": "コードブロック（```）",
        "link": "リンク",
        "image": "画像",
        "ul": "箇条書き",
        "ol": "番号付きリスト",
        "hr": "水平線",
        "table": "表"
      },
      "err": {
        "EMPTY": "Markdown contentを入力してください",
        "PARSE": "描画に失敗しました：Markdown 構文を確認してください"
      }
    },
    "image": {
      "format": "出力形式",
      "quality": "品質",
      "maxDim": "最大寸法",
      "original": "元のサイズ",
      "dropHint": "画像をここにドラッグ＆ドロップ、またはクリックして選択（PNG / JPEG / WebP / GIF など）",
      "before": "原文",
      "after": "出力",
      "saved": "サイズが {{ratio}}% 削減",
      "increased": "サイズが {{ratio}}% 増加",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "ENCODE": "画像エンコード失敗：ブラウザがこの形式をサポートするか、別の画像を試してください"
      }
    },
    "jsonConvert": {
      "target": "出力形式",
      "targets": {
        "yaml": "YAML",
        "xml": "XML",
        "csv": "CSV"
      },
      "input": "JSON 入力",
      "placeholder": "JSON, e.g. [{\"id\":1,\"name\":\"a\"}]…を貼り付け",
      "err": {
        "PARSE": "JSON の解析に失敗しました：構文を確認してください",
        "CONVERT": "対象形式に変換できません（CSV にはオブジェクトの配列が必要）"
      }
    },
    "xml": {
      "actions": {
        "format": "整形",
        "compress": "圧縮"
      },
      "indent": "インデント",
      "indent2": "スペース 2",
      "indent4": "スペース 4",
      "input": "XML 入力",
      "placeholder": "XML を貼り付け、例：<root><item>a</item></root>…",
      "err": {
        "EMPTY": "XML contentを入力してください",
        "INVALID": "処理に失敗しました：XML が有効か確認してください"
      }
    },
    "xmlJson": {
      "indent": "インデント",
      "indent2": "スペース 2",
      "indent4": "スペース 4",
      "input": "XML 入力",
      "output": "JSON 出力",
      "placeholder": "XML を貼り付け、例：<root a=\"1\"><item>x</item></root>…",
      "err": {
        "EMPTY": "XML contentを入力してください",
        "PARSE": "XML の解析に失敗しました：構文を確認してください"
      }
    },
    "unicode": {
      "format": "整形",
      "formats": {
        "js": "JS \\uXXXX",
        "jsBrace": "JS \\u{…}",
        "codePoint": "コードポイント U+",
        "htmlHex": "HTML &#x…;",
        "htmlDec": "HTML &#…;",
        "utf8": "UTF-8 バイト"
      },
      "raw": "プレーンテキスト",
      "encoded": "エンコード結果",
      "placeholderEncode": "text, e.g. 中 / A / 😀…を入力",
      "placeholderDecode": "\\u4e2d、U+4E2D、&#x4E2D;、または E4 B8 AD を入力…",
      "hint": "デコードは混在表記を受け付け、エンコードは選択形式を使用",
      "err": {
        "EMPTY": "contentを入力してください",
        "INVALID": "解析できません：Unicode / UTF-8 表記を確認してください"
      }
    },
    "colorPicker": {
      "picker": "ピッカー",
      "input": "値",
      "placeholder": "#3b82f6 / rgb(59,130,246)…",
      "eyedropper": "画面スポイト",
      "preview": "色プレビュー",
      "fields": {
        "hex": "HEX",
        "rgb": "RGB",
        "hsl": "HSL",
        "cssColor": "CSS 色",
        "cssBg": "CSS 背景",
        "htmlInline": "HTML スタイル"
      },
      "err": {
        "EMPTY": "a colorを入力してください",
        "INVALID": "認識できない色形式"
      }
    },
    "webColorTable": {
      "search": "検索",
      "searchPlaceholder": "名前 / HEX / RGB…",
      "group": "グループ",
      "groups": {
        "all": "すべて",
        "red": "赤",
        "orange": "オレンジ",
        "yellow": "黄",
        "green": "緑",
        "cyan": "シアン",
        "blue": "青",
        "purple": "紫",
        "pink": "ピンク",
        "brown": "茶",
        "white": "白",
        "gray": "グレー",
        "black": "黒"
      },
      "count": "{{n}} / {{total}} 色を表示",
      "empty": "一致する色がありません",
      "swatch": "スウォッチ",
      "name": "名前",
      "hex": "HEX",
      "rgb": "RGB",
      "copyName": "名前",
      "copyHex": "HEX",
      "copyRgb": "RGB",
      "hint": "CSS 名前付き色（Grey エイリアスと RebeccaPurple 含む）。color / background 用。"
    },
    "pinyin": {
      "input": "中国語",
      "output": "Pinyin",
      "placeholder": "Chinese, e.g. 你好世界…を入力",
      "separator": "区切り",
      "separators": {
        "space": "スペース",
        "none": "なし",
        "dash": "ダッシュ -"
      },
      "letterCase": "大文字小文字",
      "cases": {
        "lower": "小文字",
        "upper": "大文字"
      },
      "tone": "声調を付ける",
      "hint": "一般的な読みを使用。多音字はデフォルトの読みを使用",
      "err": {
        "EMPTY": "Chinese textを入力してください"
      }
    },
    "length": {
      "value": "値",
      "from": "単位",
      "placeholder": "e.g. 1.5",
      "units": {
        "mm": "ミリメートル mm",
        "cm": "センチメートル cm",
        "m": "メートル m",
        "km": "キロメートル km",
        "in": "インチ in",
        "ft": "フィート ft",
        "yd": "ヤード yd",
        "mi": "マイル mi",
        "nmi": "海里 nmi"
      },
      "err": {
        "EMPTY": "a numberを入力してください",
        "INVALID": "a valid numberを入力してください"
      }
    },
    "zhConvert": {
      "s2t": "簡体 → 繁体",
      "t2s": "繁体 → 簡体",
      "simplified": "簡体字中国語",
      "traditional": "繁体字中国語",
      "placeholderS2t": "Simplified Chinese…を入力",
      "placeholderT2s": "Traditional Chinese…を入力",
      "hint": "文字単位の変換。固有名詞は OpenCC フレーズ辞書と異なる場合があります",
      "err": {
        "EMPTY": "textを入力してください"
      }
    },
    "weight": {
      "value": "値",
      "from": "単位",
      "placeholder": "e.g. 1.5",
      "units": {
        "mg": "ミリグラム mg",
        "g": "グラム g",
        "kg": "キログラム kg",
        "t": "トン t",
        "oz": "オンス oz",
        "lb": "ポンド lb",
        "st": "ストーン st"
      },
      "err": {
        "EMPTY": "a numberを入力してください",
        "INVALID": "a valid numberを入力してください"
      }
    },
    "textCounter": {
      "input": "テキスト",
      "placeholder": "or type text to count…を貼り付け",
      "emptyHint": "テキスト入力後に統計が表示されます",
      "stats": {
        "chars": "文字数（スペース含む）",
        "charsNoSpace": "文字数（スペース除く）",
        "words": "単語",
        "cjk": "CJK 文字",
        "lines": "行",
        "paragraphs": "段落",
        "spaces": "空白",
        "bytes": "UTF-8 バイト",
        "utf16Length": "UTF-16 長"
      }
    },
    "calendar": {
      "title": "{{year}}-{{month}}",
      "weekStart": "週の開始",
      "weekStarts": {
        "mon": "月曜日",
        "sun": "日曜日"
      },
      "today": "今日",
      "prev": "前月",
      "next": "翌月",
      "selected": "選択日",
      "lunar": "旧暦",
      "ganZhi": "日柱 {{day}}",
      "festivals": "祝日 / 用語",
      "restLabel": "日タイプ",
      "yi": "宜",
      "ji": "忌",
      "legendZh": "赤は週末または祭日。休 = 法定休日、班 = 振替出勤。右側に暦注。",
      "legendEn": "赤い日は週末または祝日。英語は米国の祝日（en-GB は英国の銀行休業日）。",
      "rest": {
        "off": "祝日",
        "work": "平日",
        "weekend": "週末"
      },
      "weekdays": {
        "0": "日",
        "1": "月",
        "2": "火",
        "3": "水",
        "4": "木",
        "5": "金",
        "6": "土"
      },
      "formats": {
        "iso": "ISO",
        "slash": "スラッシュ",
        "locale": "ロケール"
      }
    },
    "cssButton": {
      "label": "ラベル",
      "bg": "背景",
      "color": "テキスト",
      "hoverBg": "ホバー",
      "borderColor": "枠線",
      "radius": "角丸",
      "paddingX": "パディング X",
      "paddingY": "パディング Y",
      "fontSize": "フォントサイズ",
      "borderWidth": "枠線の太さ",
      "fontWeight": "太さ",
      "shadow": "影",
      "fullWidth": "全幅",
      "previewFallback": "ボタン",
      "css": "CSS",
      "html": "HTML"
    },
    "randomNumber": {
      "min": "最小",
      "max": "最大",
      "count": "件数",
      "decimals": "小数桁",
      "unique": "重複削除",
      "generate": "生成",
      "err": {
        "INVALID_RANGE": "範囲が無効：min ≤ max と、一意の場合は十分な幅を確保してください",
        "INVALID_COUNT": "件数は 1〜1000 の整数である必要があります",
        "INVALID_DECIMALS": "小数桁は 0〜10 の整数である必要があります"
      }
    },
    "randomString": {
      "length": "長さ",
      "count": "件数",
      "preset": "文字セット",
      "presets": {
        "alnum": "英数字",
        "alpha": "英字",
        "hex": "Hex",
        "base64": "Base64",
        "custom": "カスタム"
      },
      "custom": "カスタム文字",
      "customPlaceholder": "allowed characters…を入力",
      "generate": "生成",
      "err": {
        "EMPTY_CHARSET": "a non-empty charsetを入力してください",
        "INVALID_LENGTH": "長さは 1〜256 の整数である必要があります",
        "INVALID_COUNT": "件数は 1〜100 の整数である必要があります"
      }
    },
    "doodle": {
      "size": "サイズ",
      "eraser": "消しゴム",
      "clear": "クリア",
      "download": "PNG 書き出し",
      "hint": "キャンバス上でドラッグして描画。マウスとタッチ対応"
    },
    "calculator": {
      "expression": "式",
      "placeholder": "e.g. (1+2)*3 or sqrt(9)+pi",
      "functions": "関数",
      "hint": "+ - * / % ^ () と sqrt/abs/sin/cos/tan/ln/log/floor/ceil/round、および pi と e をサポート",
      "err": {
        "EMPTY": "an expressionを入力してください",
        "SYNTAX": "無効なexpression syntax",
        "DIV_ZERO": "ゼロ除算"
      }
    },
    "codeImage": {
      "language": "言語",
      "theme": "テーマ",
      "themes": {
        "dark": "Dark",
        "light": "Light"
      },
      "lineNumbers": "行番号",
      "padding": "パディング",
      "download": "PNG 書き出し",
      "exporting": "書き出し中…",
      "input": "コード",
      "preview": "プレビュー",
      "placeholder": "code…を貼り付け"
    },
    "imageColor": {
      "dropHint": "画像をドロップまたは選択（PNG / JPEG / WebP / GIF など）",
      "empty": "画像をアップロードし、クリックして色を取得",
      "picked": "選択した色",
      "preview": "色プレビュー",
      "clickHint": "画像上のピクセルをクリックして色を取得",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "LOAD": "load the imageに失敗しました"
      }
    },
    "ascii": {
      "search": "検索",
      "searchPlaceholder": "十進 / hex / 文字 / 名前…",
      "dec": "12月",
      "hex": "Hex",
      "char": "文字",
      "name": "名前",
      "hint": "グリフのない制御文字は · 表示。文字または \\xHH をコピー"
    },
    "watermark": {
      "text": "透かし文字",
      "position": "位置",
      "positions": {
        "top-left": "左上",
        "top-right": "右上",
        "center": "中央",
        "bottom-left": "左下",
        "bottom-right": "右下",
        "tile": "タイル"
      },
      "color": "色",
      "fontSize": "フォントサイズ",
      "opacity": "不透明度",
      "rotate": "回転",
      "gap": "間隔",
      "dropHint": "an image to watermarkをドロップまたは選択",
      "original": "原文",
      "result": "結果",
      "download": "PNG をダウンロード",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "ENCODE": "処理失敗：別の画像を試してください"
      }
    },
    "caseConvert": {
      "mode": "モード",
      "placeholder": "text to convert…を入力",
      "modes": {
        "upper": "UPPER CASE",
        "lower": "lower case",
        "title": "Title Case",
        "sentence": "Sentence case",
        "swap": "sWAP cASE",
        "camel": "camelCase",
        "pascal": "PascalCase",
        "snake": "snake_case",
        "kebab": "kebab-case",
        "constant": "CONSTANT_CASE"
      },
      "err": {
        "EMPTY": "some textを入力してください"
      }
    },
    "bmi": {
      "unit": "単位系",
      "metric": "メートル法（cm / kg）",
      "imperial": "ヤード・ポンド法（in / lb）",
      "heightCm": "身長（cm、または m）",
      "heightIn": "身長（インチ）",
      "weightKg": "体重（kg）",
      "weightLb": "体重（lb）",
      "bmi": "BMI",
      "category": "区分",
      "categories": {
        "underweight": "低体重",
        "normal": "標準",
        "overweight": "過体重",
        "obese": "肥満"
      },
      "hint": "区分は WHO 成人基準の参考のみ — 医学的助言ではありません。",
      "err": {
        "INVALID": "a valid height and weightを入力",
        "RANGE": "値が妥当な範囲外です。単位を確認してください"
      }
    },
    "placeholder": {
      "width": "幅",
      "height": "高さ",
      "bg": "背景",
      "fg": "文字色",
      "text": "テキスト",
      "textPlaceholder": "デフォルトは寸法",
      "download": "PNG をダウンロード",
      "err": {
        "INVALID_SIZE": "サイズは 16〜4000 の整数である必要があります",
        "INVALID_COLOR": "色は #RGB または #RRGGBB である必要があります"
      }
    },
    "imageMerge": {
      "direction": "レイアウト",
      "directions": {
        "horizontal": "横",
        "vertical": "縦",
        "grid": "グリッド"
      },
      "gap": "間隔 (px)",
      "dropHint": "画像を1枚ずつ追加（最大 {{max}}）",
      "download": "結合 PNG をダウンロード",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "TOO_MANY": "画像数の上限に達しました",
        "ENCODE": "結合に失敗しました。再試行してください",
        "EMPTY": "少なくとも 1 枚の画像を追加してください"
      }
    },
    "cronGen": {
      "preset": "プリセット",
      "presetPick": "プリセットを選択…",
      "presets": {
        "everyMinute": "毎分",
        "hourly": "毎時（正時）",
        "daily": "毎日 00:00",
        "weekly": "毎週月曜 00:00",
        "monthly": "毎月1日 00:00"
      },
      "fields": {
        "minute": "分",
        "hour": "時",
        "day": "日（月内）",
        "month": "月",
        "weekday": "曜日"
      },
      "modes": {
        "every": "すべて (*)",
        "value": "特定値",
        "range": "範囲",
        "step": "ステップ",
        "list": "リスト"
      },
      "listPlaceholder": "e.g. 1,3,5",
      "everyHint": "このフィールドのすべての値に一致",
      "expression": "式",
      "openParser": "Cron パーサーでプレビュー",
      "hint": "標準 5 フィールド：分 時 日 月 曜日（0 = 日曜日）",
      "err": {
        "INVALID_FIELD": "フィールド値が無効です。範囲とリストを確認してください"
      }
    },
    "uaParser": {
      "input": "User-Agent",
      "placeholder": "a User-Agent string…を貼り付け",
      "useCurrent": "現在のブラウザを使用",
      "field": "フィールド",
      "name": "名前",
      "version": "バージョン",
      "extra": "その他",
      "fields": {
        "browser": "ブラウザ",
        "engine": "エンジン",
        "os": "OS",
        "device": "デバイス",
        "cpu": "CPU"
      },
      "err": {
        "EMPTY": "a User-Agentを入力してください"
      }
    },
    "latex": {
      "input": "LaTeX",
      "placeholder": "e.g. E = mc^2 or \\frac{a}{b}",
      "preview": "プレビュー",
      "displayMode": "ディスプレイモード",
      "copyHtml": "HTML をコピー",
      "symbols": "クイック記号",
      "formulasTitle": "定番数式",
      "downloadPng": "PNG 書き出し",
      "downloadJpg": "JPG 書き出し",
      "downloadSvg": "SVG 書き出し",
      "exporting": "書き出し中…",
      "empty": "a formula to previewを入力",
      "hint": "記号をクリックしてカーソル位置に挿入。定番数式はエディタを置換。KaTeX 描画。特殊マクロは動作しない場合があります。",
      "categories": {
        "operators": "演算子",
        "relations": "関係",
        "greek": "ギリシャ文字",
        "trig": "三角法",
        "calculus": "微積分",
        "sumprod": "総和と積",
        "set": "集合論",
        "logic": "論理",
        "arrows": "矢印",
        "matrix": "行列とベクトル",
        "special": "特殊"
      },
      "formulas": {
        "einstein": "質量とエネルギー",
        "quadratic": "二次公式",
        "pythagorean": "ピタゴラスの定理",
        "euler": "オイラーの等式",
        "binomial": "二項定理",
        "taylor": "テイラー級数",
        "gaussian": "ガウス積分",
        "cauchySchwarz": "コーシー–シュワルツ",
        "bayes": "ベイズの定理",
        "derivative": "導関数の定義",
        "fourier": "フーリエ変換",
        "navierStokes": "ナビエ–ストークス",
        "maxwell": "マクスウェルの方程式",
        "schrodinger": "シュレーディンガー方程式",
        "normalDist": "正規分布",
        "matrix2x2Det": "2×2 行列式"
      },
      "err": {
        "EMPTY": "a formulaを入力してください",
        "RENDER": "描画失敗：{{message}}"
      }
    },
    "countdown": {
      "hours": "H",
      "minutes": "M",
      "seconds": "S",
      "start": "開始",
      "pause": "一時停止",
      "resume": "再開",
      "reset": "リセット",
      "done": "時間です！",
      "err": {
        "INVALID": "a valid hours / minutes / secondsを入力",
        "ZERO": "時間は 0 より大きい必要があります"
      }
    },
    "stopwatch": {
      "start": "開始",
      "pause": "一時停止",
      "resume": "再開",
      "reset": "リセット",
      "lap": "ラップ",
      "lapIndex": "ラップ",
      "lapTime": "ラップタイム",
      "totalTime": "合計"
    },
    "svgPng": {
      "input": "SVG ソース",
      "placeholder": "SVG markup…を貼り付け",
      "dropHint": "a .svg fileをドロップまたは選択",
      "scale": "スケール",
      "transparent": "透明背景",
      "download": "PNG をダウンロード",
      "sizeHint": "元 {{sw}}×{{sh}} → 出力 {{pw}}×{{ph}}",
      "err": {
        "EMPTY": "SVGを入力してください",
        "INVALID_SVG": "有効な SVG ではありません",
        "INVALID_SIZE": "出力サイズが無効です（スケールを確認；最大辺 8192）",
        "ENCODE": "変換に失敗しました。SVG を確認するかスケールを下げてください"
      }
    },
    "imageFrame": {
      "borderWidth": "枠線の太さ",
      "borderColor": "枠線色",
      "radius": "角丸",
      "shadowBlur": "影のぼかし",
      "shadowOffsetY": "影のオフセット",
      "shadowOpacity": "影の不透明度",
      "dropHint": "an imageをドロップまたは選択",
      "download": "PNG をダウンロード",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "ENCODE": "処理失敗。別の画像を試してください"
      }
    },
    "imageAdjust": {
      "brightness": "明るさ",
      "contrast": "コントラスト",
      "saturate": "彩度",
      "hue": "色相",
      "reset": "リセット",
      "dropHint": "an image to adjustをドロップまたは選択",
      "original": "原文",
      "download": "PNG をダウンロード",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "ENCODE": "処理失敗。別の画像を試してください"
      }
    },
    "gifFrames": {
      "dropHint": "a GIF fileをドロップまたは選択",
      "meta": "{{w}}×{{h}} · {{n}} frames",
      "download": "ダウンロード",
      "downloadAll": "全フレームをダウンロード",
      "err": {
        "NOT_GIF": "a GIF fileを選択してください",
        "EMPTY": "ファイルが空です",
        "PARSE": "parse GIFに失敗しました"
      }
    },
    "imageCrop": {
      "aspect": "アスペクト",
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
      "width": "W",
      "height": "H",
      "dropHint": "an image to cropをドロップまたは選択",
      "hint": "自由モードでドラッグして選択、または下の値を編集",
      "download": "PNG をダウンロード",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "ENCODE": "切り抜きに失敗しました。再試行してください",
        "INVALID": "無効なcrop region"
      }
    },
    "mbti": {
      "progress": "回答済み {{done}} / {{total}}",
      "questionIndex": "質問 {{n}} / {{total}}",
      "prev": "前へ",
      "next": "次へ",
      "submit": "結果を見る",
      "reset": "クリア",
      "retake": "再受験",
      "yourType": "あなたのタイプ傾向",
      "hint": "より当てはまる方を選んでください。すべて回答したら送信。",
      "disclaimer": "娯楽用の簡易クイズです — 臨床的評価ではありません。",
      "dims": {
        "EI": "外向 E / 内向 I",
        "SN": "感覚 S / 直感 N",
        "TF": "思考 T / 感情 F",
        "JP": "判断 J / 知覚 P"
      }
    },
    "textCard": {
      "theme": "テーマ",
      "themes": {
        "slate": "Slate",
        "ocean": "Ocean",
        "sunset": "Sunset",
        "forest": "Forest",
        "mono": "Mono",
        "paper": "Paper"
      },
      "align": "揃え",
      "aligns": {
        "left": "左",
        "center": "中央",
        "right": "右"
      },
      "fontSize": "フォントサイズ",
      "padding": "パディング",
      "width": "幅",
      "title": "タイトル",
      "titlePlaceholder": "任意のタイトル…",
      "body": "本文",
      "bodyPlaceholder": "text for the card…を入力",
      "preview": "プレビュー",
      "empty": "a title or body to previewを入力",
      "download": "PNG 書き出し",
      "exporting": "書き出し中…"
    },
    "imageCard": {
      "shadow": "影",
      "padding": "パディング",
      "radius": "ブロック角丸",
      "width": "幅",
      "textPosition": "キャプション位置",
      "positions": {
        "below": "写真の下",
        "above": "写真の上"
      },
      "align": "揃え",
      "aligns": {
        "left": "左",
        "center": "中央",
        "right": "右"
      },
      "textPadding": "テキスト余白",
      "textBg": "テキスト背景",
      "titleSize": "タイトルサイズ",
      "subtitleSize": "サブタイトルサイズ",
      "rotate": "写真の回転",
      "backdrop": "背景",
      "backdropModes": {
        "preset": "プリセット",
        "color": "単色",
        "gradient": "グラデーション"
      },
      "backdropColor": "背景色",
      "gradientFrom": "から",
      "gradientTo": "まで",
      "gradientAngle": "角度",
      "backdrops": {
        "paper": "Paper",
        "fog": "Fog",
        "night": "Night",
        "mint": "Mint",
        "sand": "Sand",
        "ink": "Ink",
        "sunset": "Sunset",
        "ocean": "Ocean",
        "lavender": "Lavender",
        "peach": "Peach",
        "aurora": "Aurora",
        "charcoal": "Charcoal"
      },
      "title": "タイトル",
      "titlePlaceholder": "カードタイトル…",
      "subtitle": "サブタイトル",
      "subtitlePlaceholder": "補足行…",
      "dropHint": "an image for the cardをドロップまたは選択",
      "empty": "カードをプレビューするには画像をアップロード",
      "download": "PNG 書き出し",
      "exporting": "書き出し中…",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "ENCODE": "書き出し失敗。別の画像を試してください"
      }
    },
    "codeHighlight": {
      "language": "言語",
      "theme": "テーマ",
      "themes": {
        "dark": "Dark",
        "light": "Light"
      },
      "lineNumbers": "行番号",
      "input": "コード",
      "preview": "ハイライトプレビュー",
      "placeholder": "code…を貼り付け",
      "copyCode": "コードをコピー",
      "copyHtml": "HTML をコピー",
      "hint": "Prism 使用。ブログやドキュメント用に HTML スニペットをコピーできます。"
    },
    "imageBase64": {
      "upload": "画像 → Base64",
      "uploadHint": "an imageをドロップまたは選択",
      "copyDataUrl": "Data URL をコピー",
      "base64Out": "Base64",
      "paste": "Base64 → 画像",
      "pastePlaceholder": "a Data URL or raw Base64…を貼り付け",
      "err": {
        "EMPTY": "Base64 or choose an imageを入力",
        "INVALID_BASE64": "無効な Base64",
        "NOT_IMAGE": "an image fileを選択してください"
      }
    },
    "imageIco": {
      "mode": "モード",
      "toIco": "画像 → ICO",
      "fromIco": "ICO → PNG",
      "sizes": "サイズ",
      "uploadImageHint": "a PNG / JPG / WebP imageをドロップまたは選択",
      "uploadIcoHint": "a .ico fileをドロップまたは選択",
      "convert": "ICO を作成",
      "converting": "処理中…",
      "downloadIco": "ICO をダウンロード",
      "downloadPng": "PNG をダウンロード",
      "extracted": "{{name}} から {{n}} サイズを抽出",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "NOT_ICO": "an ICO fileを選択してください",
        "USE_FROM_ICO": "ICO ファイルを開くには「ICO → PNG」に切り替えてください",
        "NO_SIZES": "少なくとも 1 つのサイズを選択してください",
        "EMPTY": "ファイルが空です",
        "INVALID_ICO": "無効なor corrupt ICO file",
        "ENCODE": "変換失敗。別の画像を試してください"
      }
    },
    "hsvCmyk": {
      "preview": "色プレビュー"
    },
    "aiPrompts": {
      "search": "検索",
      "searchPlaceholder": "キーワード…",
      "category": "区分",
      "empty": "一致するプロンプトがありません",
      "cat": {
        "all": "すべて",
        "writing": "執筆",
        "coding": "コーディング",
        "translate": "翻訳",
        "marketing": "マーケティング",
        "learning": "学習",
        "career": "キャリア"
      }
    },
    "mdMindmap": {
      "input": "Markdown",
      "placeholder": "# Topic\n## Branch\n- Point…",
      "preview": "マインドマップ",
      "theme": "テーマ",
      "themes": {
        "sky": "Sky",
        "forest": "Forest",
        "sunset": "Sunset",
        "grape": "Grape",
        "ocean": "Ocean",
        "mono": "Mono"
      },
      "zoomIn": "拡大",
      "zoomOut": "縮小",
      "zoomReset": "ズームをリセット",
      "zoomHint": "Ctrl / ⌘ を押しながらスクロールしてプレビューをズーム",
      "downloadSvg": "SVG 書き出し",
      "downloadPng": "PNG 書き出し",
      "download": "SVG 書き出し",
      "exporting": "書き出し中…",
      "empty": "マップ生成のため Markdown の見出しまたはリストを入力",
      "err": {
        "EMPTY": "Markdownを入力してください"
      }
    },
    "mermaid": {
      "input": "Mermaid",
      "placeholder": "flowchart TD\n  A-->B",
      "preview": "プレビュー",
      "theme": "テーマ",
      "themes": {
        "default": "Default",
        "neutral": "Neutral",
        "forest": "Forest",
        "dark": "Dark",
        "ocean": "Ocean",
        "sunset": "Sunset",
        "mono": "Mono"
      },
      "zoomIn": "拡大",
      "zoomOut": "縮小",
      "zoomReset": "ズームをリセット",
      "zoomHint": "Ctrl / ⌘ を押しながらスクロールしてプレビューをズーム",
      "downloadSvg": "SVG 書き出し",
      "downloadPng": "PNG 書き出し",
      "download": "SVG 書き出し",
      "exporting": "書き出し中…",
      "empty": "Mermaid syntax to renderを入力",
      "rendering": "描画中…",
      "err": {
        "RENDER": "描画失敗：{{message}}"
      }
    },
    "cssGradient": {
      "type": "種類",
      "linear": "線形",
      "radial": "放射",
      "angle": "角度",
      "shape": "形状",
      "preview": "グラデーションプレビュー",
      "stops": "ストップ",
      "addStop": "ストップ追加",
      "position": "位置 %",
      "removeStop": "削除",
      "css": "CSS",
      "presetsTitle": "プリセット",
      "presetCategories": {
        "warm": "Warm",
        "cool": "Cool",
        "nature": "Nature green",
        "pink": "Romantic pink",
        "purple": "Mysterious purple",
        "dark": "Dark",
        "light": "Light",
        "rainbow": "Multicolor",
        "sunset": "Sunset",
        "ocean": "Ocean"
      },
      "presetNames": {
        "warm-golden": "Golden sun",
        "warm-peach": "Peach",
        "warm-coral": "Coral",
        "warm-amber": "Amber",
        "warm-spice": "Spice orange",
        "warm-rose-gold": "Rose gold",
        "warm-papaya": "Papaya cream",
        "warm-flame": "Flame",
        "warm-honey": "Honey gold",
        "warm-terracotta": "Terracotta",
        "warm-mango": "Mango",
        "warm-autumn": "Autumn",
        "warm-cinnamon": "Cinnamon",
        "warm-tangerine": "Tangerine",
        "warm-sunset-orange": "Sunset orange",
        "warm-brick": "Brick red",
        "warm-caramel": "Caramel",
        "warm-radial": "Warm glow",
        "warm-saffron": "Saffron",
        "warm-burnt": "Burnt sienna",
        "warm-apricot": "Apricot",
        "cool-arctic": "Arctic blue",
        "cool-ice": "Ice blue",
        "cool-frost": "Frost",
        "cool-steel": "Steel gray",
        "cool-mint-ice": "Mint ice",
        "cool-glacier": "Glacier",
        "cool-skyline": "Skyline",
        "cool-polar": "Polar glow",
        "cool-nordic": "Nordic gray",
        "cool-periwinkle": "Periwinkle",
        "cool-cobalt": "Cobalt",
        "cool-teal-breeze": "Teal breeze",
        "cool-sapphire": "Sapphire",
        "cool-winter": "Winter",
        "cool-azure": "Azure tri-color",
        "cool-denim": "Denim blue",
        "cool-moonlight": "Moonlight",
        "cool-cyan": "Cyan blue",
        "cool-harbor": "Harbor",
        "cool-iceberg": "Iceberg",
        "nature-forest": "Forest",
        "nature-moss": "Moss",
        "nature-jungle": "Jungle",
        "nature-spring": "Spring",
        "nature-fern": "Fern",
        "nature-matcha": "Matcha",
        "nature-emerald": "Emerald",
        "nature-leaf": "Leaf glow",
        "nature-bamboo": "Bamboo",
        "nature-pine": "Pine forest",
        "nature-sage": "Sage",
        "nature-meadow": "Meadow",
        "nature-rainforest": "Rainforest",
        "nature-olive": "Olive",
        "nature-cypress": "Cypress",
        "nature-mint": "Mint",
        "nature-tea": "Tea garden",
        "nature-canopy": "Canopy",
        "nature-dew": "Morning dew",
        "nature-avocado": "Avocado",
        "pink-blush": "Blush",
        "pink-rose": "Rose",
        "pink-cotton": "Cotton candy",
        "pink-sakura": "Sakura",
        "pink-cherry": "Cherry",
        "pink-bubble": "Bubble gum",
        "pink-dream": "Dream pink",
        "pink-valentine": "Valentine",
        "pink-lotus": "Lotus",
        "pink-peony": "Peony",
        "pink-strawberry": "Strawberry",
        "pink-fairy": "Fairy pink",
        "pink-magnolia": "Magnolia",
        "pink-petal": "Petal",
        "pink-candy": "Candy pink",
        "pink-radial": "Pink glow",
        "pink-rosewater": "Rosewater",
        "pink-ballet": "Ballet pink",
        "purple-galaxy": "Galaxy",
        "purple-mystic": "Mystic purple",
        "purple-amethyst": "Amethyst",
        "purple-velvet": "Velvet purple",
        "purple-neon": "Neon purple",
        "purple-twilight": "Twilight purple",
        "purple-royal": "Royal purple",
        "purple-orb": "Purple orb",
        "purple-lilac": "Lilac",
        "purple-indigo": "Indigo purple",
        "purple-plum": "Plum",
        "purple-cosmic": "Cosmic purple",
        "purple-dusk": "Purple dusk",
        "purple-wine": "Wine purple",
        "purple-iris": "Iris",
        "purple-void": "Void",
        "purple-haze": "Purple haze",
        "purple-orchid": "Orchid",
        "purple-aurora": "Purple aurora",
        "purple-midnight": "Midnight purple",
        "dark-charcoal": "Charcoal",
        "dark-midnight": "Midnight",
        "dark-slate": "Slate",
        "dark-eclipse": "Eclipse",
        "dark-carbon": "Carbon",
        "dark-noir": "Noir",
        "dark-abyss": "Abyss",
        "dark-spotlight": "Spotlight dark",
        "dark-obsidian": "Obsidian",
        "dark-graphite": "Graphite",
        "dark-onyx": "Onyx",
        "dark-storm": "Storm night",
        "dark-ink": "Ink black",
        "dark-vignette": "Vignette",
        "dark-smoke": "Smoke gray",
        "dark-raven": "Raven",
        "dark-void": "Void black",
        "light-cloud": "Cloud",
        "light-pearl": "Pearl",
        "light-mist": "Mist",
        "light-cream": "Cream",
        "light-linen": "Linen",
        "light-sand": "Sand",
        "light-lavender": "Lavender mist",
        "light-glow": "Soft glow",
        "light-ivory": "Ivory",
        "light-snow": "Snow white",
        "light-blush": "Blush",
        "light-morning": "Morning",
        "light-silk": "Silk",
        "light-frost": "Frost white",
        "light-champagne": "Champagne",
        "light-dawn": "Dawn",
        "light-powder": "Powder blue",
        "light-cotton": "Cotton white",
        "rainbow-classic": "Classic rainbow",
        "rainbow-neon": "Neon multicolor",
        "rainbow-candy": "Candy",
        "rainbow-aurora": "Aurora",
        "rainbow-sunset": "Sunset blend",
        "rainbow-pastel": "Pastel",
        "rainbow-vivid": "Vivid tri-color",
        "rainbow-prism": "Prism",
        "rainbow-spectrum": "Spectrum",
        "rainbow-holo": "Holographic",
        "rainbow-pop": "Pop art",
        "rainbow-soda": "Soda pop",
        "rainbow-tropical": "Tropical",
        "rainbow-laser": "Laser",
        "rainbow-universe": "Universe",
        "rainbow-dream": "Dream color",
        "rainbow-galaxy": "Galaxy color",
        "rainbow-confetti": "Confetti",
        "rainbow-cyber": "Cyber",
        "rainbow-retro": "Retro duo",
        "rainbow-synth": "Synthwave",
        "rainbow-cotton": "Cotton candy",
        "rainbow-electric": "Electric",
        "rainbow-sunrise": "Sunrise blend",
        "sunset-dusk": "Dusk",
        "sunset-horizon": "Horizon",
        "sunset-glow": "Afterglow",
        "sunset-beach": "Beach sunset",
        "sunset-desert": "Desert dusk",
        "sunset-evening": "Evening",
        "sunset-fire": "Fire sky",
        "sunset-radial": "Sunset radial",
        "sunset-amber": "Amber dusk",
        "sunset-crimson": "Crimson dusk",
        "sunset-twilight": "Twilight",
        "sunset-mango": "Mango dusk",
        "sunset-ember": "Ember",
        "sunset-sky": "Sky dusk",
        "sunset-sahara": "Sahara",
        "sunset-golden": "Golden dusk",
        "sunset-coast": "Coastal dusk",
        "sunset-violet": "Violet dusk",
        "sunset-radial-glow": "Sun disc glow",
        "sunset-lake": "Lake dusk",
        "ocean-deep": "Deep ocean",
        "ocean-wave": "Ocean wave",
        "ocean-lagoon": "Lagoon",
        "ocean-reef": "Coral reef",
        "ocean-abyss": "Ocean abyss",
        "ocean-tide": "Tide",
        "ocean-coral": "Sea blue",
        "ocean-bubble": "Sea bubble",
        "ocean-marine": "Marine blue",
        "ocean-aqua": "Aqua",
        "ocean-storm": "Storm sea",
        "ocean-seafoam": "Seafoam",
        "ocean-caribbean": "Caribbean",
        "ocean-pacific": "Pacific",
        "ocean-arctic": "Arctic sea",
        "ocean-turquoise": "Turquoise",
        "ocean-depth": "Deep glow",
        "ocean-surf": "Surf",
        "ocean-kelp": "Kelp",
        "ocean-mist": "Sea mist",
        "ocean-pearl": "Sea pearl"
      }
    },
    "imageToPaper": {
      "paper": "Paper",
      "orientation": "向き",
      "portrait": "縦向き",
      "landscape": "横向き",
      "fit": "フィット",
      "contain": "収める",
      "cover": "カバー",
      "margin": "余白 (mm)",
      "uploadHint": "an imageをドロップまたは選択",
      "downloadPng": "PNG をダウンロード",
      "downloadPdf": "PDF 書き出し",
      "exporting": "書き出し中…",
      "err": {
        "NOT_IMAGE": "an image fileを選択してください",
        "INVALID_MARGIN": "無効な余白",
        "INVALID_IMAGE": "無効なimage size"
      }
    },
    "mdToImage": {
      "gfm": "GFM",
      "breaks": "改行 → <br>",
      "font": "フォント",
      "fonts": {
        "sans": "ゴシック",
        "serif": "明朝",
        "mono": "等幅",
        "song": "宋体（セリフ CJK）",
        "hei": "黑体（ゴシック CJK）"
      },
      "fontSize": "フォントサイズ",
      "width": "幅",
      "padding": "パディング",
      "lineHeight": "行間",
      "fg": "文字色",
      "bg": "背景",
      "download": "PNG 書き出し",
      "exporting": "書き出し中…",
      "input": "Markdown",
      "placeholder": "# Title\nBody…",
      "preview": "プレビュー",
      "err": {
        "EMPTY": "Markdownを入力してください",
        "PARSE": "解析に失敗しました",
        "INVALID_COLOR": "色は #RGB または #RRGGBB である必要があります",
        "INVALID_SIZE": "フォントサイズ / 幅 / パディング / 行間が範囲外です",
        "INVALID_FONT": "未対応のフォント"
      }
    },
    "chartGenerator": {
      "type": "種類",
      "types": {
        "bar": "棒グラフ",
        "hbar": "横棒グラフ",
        "line": "折れ線",
        "area": "面グラフ",
        "pie": "円グラフ",
        "doughnut": "ドーナツ",
        "scatter": "散布図"
      },
      "bar": "棒グラフ",
      "line": "折れ線",
      "pie": "円グラフ",
      "title": "タイトル",
      "seriesLabel": "系列ラベル",
      "legend": "凡例",
      "legends": {
        "top": "上",
        "bottom": "下",
        "left": "左",
        "right": "右",
        "none": "非表示"
      },
      "colorScheme": "配色",
      "schemes": {
        "vibrant": "鮮やか",
        "pastel": "Pastel",
        "ocean": "Ocean",
        "sunset": "Sunset",
        "forest": "Forest",
        "mono": "Mono",
        "rainbow": "虹"
      },
      "xLabel": "X 軸ラベル",
      "yLabel": "Y 軸ラベル",
      "xLabelPlaceholder": "e.g. Month",
      "yLabelPlaceholder": "e.g. Sales",
      "color": "色",
      "width": "幅",
      "height": "高さ",
      "data": "データ (CSV)",
      "dataPlaceholder": "label,value\napple,30\nbanana,20",
      "preview": "プレビュー",
      "downloadSvg": "SVG をダウンロード",
      "downloadPng": "PNG をダウンロード",
      "copySvg": "SVG をコピー",
      "err": {
        "EMPTY": "dataを入力してください",
        "INVALID": "無効なdata format",
        "NO_NUMERIC": "数値が見つかりません"
      }
    },
    "css3Generator": {
      "linked": "角を連動",
      "topLeft": "左上",
      "topRight": "右上",
      "bottomRight": "右下",
      "bottomLeft": "左下",
      "offsetX": "オフセット X",
      "offsetY": "オフセット Y",
      "blur": "ぼかし",
      "spread": "拡散",
      "color": "色",
      "inset": "インセット",
      "translateX": "移動 X",
      "translateY": "移動 Y",
      "rotate": "回転",
      "scale": "スケール",
      "skewX": "歪み X",
      "property": "プロパティ",
      "duration": "時間 (秒)",
      "timing": "タイミング",
      "delay": "遅延 (秒)",
      "brightness": "明るさ",
      "contrast": "コントラスト",
      "saturate": "彩度",
      "grayscale": "グレースケール",
      "hueRotate": "色相回転",
      "preview": "プレビュー",
      "previewLabel": "プレビュー",
      "css": "CSS",
      "modules": {
        "borderRadius": "角丸",
        "boxShadow": "ボックスシャドウ",
        "textShadow": "テキストシャドウ",
        "transform": "変形",
        "transition": "トランジション",
        "filter": "フィルター"
      }
    },
    "pdf-merge": {
      "hint": "ローカルで結合 — 何もアップロードしません。50MB 未満推奨。",
      "drop": "複数 PDF をドロップ",
      "run": "Mergeしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-split": {
      "hint": "ページごとに 1 つの PDF に分割してそれぞれダウンロードします。",
      "asZip": "ZIP でダウンロード",
      "drop": "PDF をドロップ",
      "run": "Splitしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-delete-pages": {
      "hint": "削除するページ、例：1,3-5。少なくとも 1 ページ残す必要があります。",
      "pages": "削除するページ",
      "run": "Deleteしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-extract-pages": {
      "hint": "抽出するページ、例：1,3-5。",
      "pages": "抽出するページ",
      "run": "Extractしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-reorder": {
      "hint": "矢印でページを並べ替えてから書き出してください。",
      "pagesUnit": "ページ",
      "pageLabel": "ページ {{n}}",
      "run": "Applyしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-rotate": {
      "hint": "すべてまたは選択したページの角度を選んでください。",
      "allPages": "すべてのページ",
      "pages": "ページ",
      "run": "Rotateしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-to-image": {
      "hint": "ローカルで描画します。大きなファイルは遅くなる場合があります。",
      "scale": "スケール",
      "pages": "ページ（任意）",
      "pagesAll": "空欄で全ページ",
      "run": "画像を書き出し",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "images-to-pdf": {
      "hint": "ピクセルサイズで1ページに1画像。",
      "drop": "画像をドロップ",
      "run": "PDF を作成",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-viewer": {
      "hint": "ローカルプレビュー — 何もアップロードしません。",
      "prev": "前へ",
      "next": "次へ",
      "scale": "スケール",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-page-numbers": {
      "hint": "書式は {n} と {total} をサポート。",
      "format": "整形",
      "fontSize": "フォントサイズ",
      "startFrom": "開始番号",
      "run": "Addしてダウンロード",
      "pos": {
        "bottom-center": "下中央",
        "bottom-left": "左下",
        "bottom-right": "右下",
        "top-center": "上中央"
      },
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-header-footer": {
      "hint": "ヘッダーまたはフッターを少なくとも1つ指定してください。",
      "header": "ヘッダー",
      "footer": "フッター",
      "fontSize": "フォントサイズ",
      "run": "Applyしてダウンロード",
      "align": {
        "left": "左",
        "center": "中央",
        "right": "右"
      },
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-insert-image": {
      "hint": "原点はページ左下です（PDF 座標）。",
      "pdf": "PDF ファイル",
      "image": "画像（PNG/JPG）",
      "allPages": "すべてのページ",
      "pages": "ページ",
      "width": "幅",
      "run": "Insertしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-add-text": {
      "hint": "原点は左下。複雑な Unicode は制限される場合があります。",
      "text": "テキスト",
      "allPages": "すべてのページ",
      "pages": "ページ",
      "fontSize": "フォントサイズ",
      "color": "色",
      "run": "Addしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-sign": {
      "hint": "見た目の署名（画像オーバーレイ）。デジタル証明書ではありません。",
      "upload": "署名をアップロード",
      "draw": "署名を描く",
      "allPages": "すべてのページ",
      "pages": "ページ",
      "width": "幅",
      "run": "Signしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-metadata": {
      "hint": "タイトル、作成者などのメタデータを編集してダウンロード。",
      "pages": "{{n}} ページ",
      "run": "Saveしてダウンロード",
      "fields": {
        "title": "タイトル",
        "author": "作成者",
        "subject": "件名",
        "keywords": "キーワード",
        "creator": "作成者",
        "producer": "プロデューサー"
      },
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-encrypt": {
      "hint": "開くパスワードと権限を設定。リーダーの対応は異なります。",
      "userPassword": "ユーザーパスワード",
      "ownerPassword": "オーナーパスワード",
      "ownerHint": "空の場合はユーザーパスワードを使用",
      "run": "Encryptしてダウンロード",
      "perm": {
        "printing": "印刷を許可",
        "copying": "コピーを許可",
        "modifying": "変更を許可",
        "annotating": "注釈を許可"
      },
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-crop": {
      "hint": "余白は PDF ポイント（pt ≈ 1/72 インチ）。",
      "top": "上",
      "right": "右",
      "bottom": "下",
      "left": "左",
      "run": "Cropしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-grayscale": {
      "hint": "ページ再ラスタ化による見た目のグレースケール。テキストは選択不可になります。",
      "run": "Convertしてダウンロード",
      "errors": {
        "EMPTY": "the inputを完了してください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "pdf-annotate": {
      "hint": "PDF を開き、ページに注釈を描画：ペン、ハイライト、矩形、楕円、円、線、テキスト。",
      "drop": "PDF をドロップ",
      "stroke": "線",
      "fontSize": "フォントサイズ",
      "scale": "ズーム",
      "undo": "元に戻す",
      "clearPage": "ページをクリア",
      "prev": "前へ",
      "next": "次へ",
      "count": "{{n}} 件の注釈",
      "textPrompt": "annotation textを入力",
      "needVisitPage": "書き出し前に描画できるよう、まずページ {{n}} を開いてください",
      "run": "注釈付き PDF を書き出し",
      "kinds": {
        "pen": "ペン",
        "highlight": "ハイライト",
        "rect": "矩形",
        "ellipse": "楕円",
        "circle": "円",
        "line": "折れ線",
        "text": "テキスト"
      },
      "errors": {
        "EMPTY": "先に少なくとも1つの注釈を描いてください",
        "NOT_PDF": "a PDF fileをアップロードしてください",
        "NOT_IMAGE": "an image fileをアップロードしてください",
        "LOAD_FAILED": "load PDFに失敗しました",
        "NO_PAGES": "ドキュメントにページがありません",
        "INVALID_RANGE": "無効なpage range",
        "TOO_LARGE": "ファイルが大きすぎます（50MB 未満推奨）",
        "ENCRYPT_FAILED": "暗号化に失敗しました",
        "PROCESS_FAILED": "処理に失敗しました"
      }
    },
    "xsltTransform": {
      "sample": "サンプル読込",
      "xml": "XML",
      "xmlPlaceholder": "XML…を貼り付け",
      "xslt": "XSLT",
      "xsltPlaceholder": "XSLT stylesheet…を貼り付け",
      "output": "出力",
      "preview": "HTML プレビュー",
      "err": {
        "EMPTY_XML": "XMLを入力してください",
        "EMPTY_XSLT": "XSLTを入力してください",
        "INVALID_XML": "無効な XML",
        "INVALID_XSLT": "無効な XSLT",
        "TRANSFORM": "変換に失敗しました"
      }
    }
  }
} satisfies TranslationResources;

export default ja;
