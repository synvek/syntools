import type { ShellResources } from '../types';

/** de 文案资源（外壳 + 工具元数据；`tools.*` 见 de.tools.ts） */
const de = {
  app: {
    docTitle: 'SynTools · Online-Toolbox',
  },
  header: {
    openMenu: 'Menü öffnen',
    searchPlaceholder: 'Tools suchen…',
    searchAria: 'Tools suchen',
    themeAria: 'Design umschalten',
    langAria: 'Sprache wechseln',
    downloadAria: 'Desktop-App herunterladen',
    sourceAria: 'Quellcode',
  },
  sidebar: {
    nav: 'Tool-Navigation',
    closeMenu: 'Menü schließen',
    filter: 'Tools filtern',
    filterPlaceholder: 'Filtern…',
    filterEmpty: 'Keine passenden Tools',
    categoryActions: 'Kategorieaktionen',
    expandAll: 'Alle Kategorien erweitern',
    collapseAll: 'Alle Kategorien einklappen',
  },
  home: {
    title: 'Online-Toolbox',
    tagline:
      'Lokale Verarbeitung zuerst; Daten bleiben im Browser (CSP, kein Abfluss) · Drücken Sie <1>⌘K</1> oder <3>/</3> zum Suchen',
    favorites: 'Favoriten',
    recent: 'Zuletzt verwendet',
    favoriteAria: 'Zu Favoriten hinzufügen',
    unfavoriteAria: 'Aus Favoriten entfernen',
  },
  search: {
    aria: 'Tools suchen',
    placeholder: 'Tools suchen (Name / Stichwörter)…',
    empty: 'Keine passenden Tools gefunden',
  },
  categories: {
    file: 'Dateien',
    media: 'Audio & Video',
    cheatsheet: 'Spickzettel',
    advanced: 'Dokumente & Kreatives',
    encoding: 'Kodierung',
    text: 'Text',
    formatting: 'Formatierung',
    crypto: 'Krypto & Hash',
    datetime: 'Datum & Zeit',
    generator: 'Generatoren',
    network: 'Netzwerk',
    image: 'Bilder',
    pdf: 'PDF',
    other: 'Sonstiges',
  },
  common: {
    copy: 'Kopieren',
    copied: 'Kopiert',
    clear: 'Leeren',
    discardConfirm:
      'Das aktuelle Dokument ist nicht gespeichert. Ein neues Dokument verwirft es. Sicher?',
    swap: 'Tauschen',
    newDoc: 'Neues Dokument',
    saved: 'Im lokalen Entwurf gespeichert',
    saving: 'Automatische Speicherung nach der Eingabe',
    download: 'Herunterladen',
    share: 'Teilen',
    shareTooLong: 'Inhalt zu lang (> 2 KB), Freigabelink kann nicht erstellt werden',
    retry: 'Erneut versuchen',
    loading: 'Laden',
    operation: 'Aktion',
    encode: 'Kodieren',
    decode: 'Dekodieren',
    result: 'Ergebnis',
    rawText: 'Rohtext',
    input: 'Eingabe',
    output: 'Ausgabe',
    text: 'Text',
    file: 'Datei',
    remove: 'Entfernen',
    bytes: '{{size}} Bytes',
  },
  io: {
    stats: '{{chars}} Zeichen / {{bytes}} Bytes',
    warnLarge: 'Große Eingabe (> 500 KB), Echtzeitberechnung kann langsamer werden',
    overflow: 'Eingabe überschreitet das 5-MB-Limit; für große Inhalte den Dateimodus verwenden',
  },
  file: {
    hint: 'Datei hierher ziehen oder klicken zum Auswählen',
    max: 'Max. {{size}}',
    over: 'Datei überschreitet das Limit von {{max}} (aktuell {{size}})',
    uploadAria: 'Datei hochladen',
    previewAlt: 'Vorschau von {{name}}',
    pages: '{{n}} Seiten',
    encrypted: 'Verschlüsselt',
  },
  tool: {
    errorTitle: 'Laufzeitfehler des Tools',
    localBadge: 'Nur lokal',
    serverBadge: 'Server erforderlich',
    related: 'Verwandte Tools',
    nextSteps: 'Nächste Schritte',
    openIn: 'In {{name}} öffnen',
    progress: 'Fortschritt {{current}} / {{total}}',
  },
  notFound: {
    message: 'Seite oder Tool nicht gefunden',
    back: 'Zurück zur Startseite',
  },
  pdf: {
    password: 'PDF-Passwort',
    passwordPlaceholder: 'Öffnungspasswort eingeben',
    passwordHint: 'Dieses PDF ist verschlüsselt. Geben Sie das Passwort ein, um fortzufahren.',
    unlock: 'Entsperren',
    errors: {
      NEED_PASSWORD: 'Dieses PDF ist verschlüsselt. Bitte geben Sie das Passwort ein.',
      WRONG_PASSWORD: 'Falsches Passwort. Bitte erneut versuchen.',
    },
  },
  toolsMeta: {
    'code-editor': {
      name: 'Code-Editor',
      description:
        'Editor mit Syntax-Highlighting, sprachspezifischer Formatierung, 10 Themes sowie Export als Quellcode / HTML / Bild',
    },
    'video-convert': {
      name: 'Videokonverter',
      description:
        'WebCodecs-first Videotranskodierung (MP4 / WebM / MKV), automatischer ffmpeg.wasm-Fallback',
    },
    'video-to-gif': {
      name: 'Video zu GIF',
      description: 'Videoclip in ein animiertes GIF umwandeln (rein im Browser)',
    },
    'audio-convert': {
      name: 'Audiokonverter',
      description:
        'Audioformat-Konvertierung: WAV (nativ) sowie MP3 / M4A / OGG / FLAC (WebCodecs zuerst, ffmpeg.wasm-Fallback)',
    },
    'subtitle-tool': {
      name: 'Untertitel-Konverter',
      description: 'Zwischen SRT / WebVTT konvertieren, mit Zeitverschiebung',
    },
    'git-cheatsheet': {
      name: 'Git-Spickzettel',
      description: 'Kategorisierte Git-Befehle mit Suche',
    },
    'mime-types': {
      name: 'MIME-Typen',
      description: 'Tabelle Dateiendung ↔ MIME-Typ, durchsuchbar',
    },
    'http-status': {
      name: 'HTTP-Statuscodes',
      description: 'HTTP-Statuscode-Referenz mit Klasse, Name und Bedeutung, durchsuchbar',
    },
    'id-photo': {
      name: 'Passfoto-Ersteller',
      description: 'Auf Standardgrößen zuschneiden (1 Zoll, 2 Zoll, Pass) mit Hintergrund und DPI',
    },
    'image-grid-cut': {
      name: 'Bild-Raster schneiden',
      description: 'Bild in Rasterkacheln schneiden (z. B. 3×3) und einzeln herunterladen',
    },
    'image-ascii': {
      name: 'Bild zu ASCII',
      description: 'Bilder in ASCII-Kunst umwandeln (Zeichensatz, Breite, Invertierung)',
    },
    'timezone-converter': {
      name: 'Zeitzonenrechner',
      description: 'Zeiten zwischen IANA-Zeitzonen mit UTC-Versatz umrechnen',
    },
    'tax-loan-calculator': {
      name: 'Kredit / Steuer',
      description: 'Annuitäten- / Tilgungsdarlehen und Lohnsteuerschätzung',
    },
    'unit-converter': {
      name: 'Einheitenrechner',
      description:
        'Länge / Masse / Fläche / Volumen / Temperatur / Geschwindigkeit / Daten / Zeit umrechnen',
    },
    'bulk-rename': {
      name: 'Stapel-Umbenennung',
      description:
        'Dateinamen per Präfix/Suffix, Ersetzen (Regex), Nummerierung, Endung und Groß-/Kleinschreibung erstellen',
    },
    'file-split-merge': {
      name: 'Datei teilen / zusammenfügen',
      description: 'Große Datei nach Größe oder Anzahl teilen bzw. Teile zusammenfügen',
    },
    'zip-manager': {
      name: 'ZIP-Manager',
      description: 'Mehrere Dateien zu ZIP packen oder Einträge ansehen/herunterladen (JSZip)',
    },
    barcode: {
      name: 'Barcode-Generator',
      description: 'Code 39 / Code 128 / EAN-13 Barcodes als SVG erzeugen',
    },
    'id-generator': {
      name: 'ID-Generator',
      description: 'ULID / NanoID / Snowflake / MongoDB ObjectId stapelweise erzeugen',
    },
    'code-minify': {
      name: 'Code-Minifier',
      description: 'CSS / HTML / JS / JSON minifizieren (CSS über csso; JS/HTML konservativ)',
    },
    'csv-tool': {
      name: 'CSV-Werkzeug',
      description: 'CSV ↔ JSON mit eigenem Trennzeichen, Kopfzeile und Quoting (RFC 4180)',
    },
    'key-converter': {
      name: 'Schlüsselkonverter',
      description: 'Konvertiert RSA-Schlüssel zwischen PEM / DER / JWK / OpenSSH (WebCrypto)',
    },
    'rsa-crypto': {
      name: 'RSA Verschlüsselung',
      description:
        'RSA-OAEP ver-/entschlüsseln, RSA-PSS signieren/prüfen und Schlüssel erzeugen (WebCrypto)',
    },
    'password-hash': {
      name: 'Passworthash (PBKDF2)',
      description: 'PBKDF2-Ableitung über WebCrypto, mit eigenem Salt und Iterationen',
    },
    'password-strength': {
      name: 'Passwortstärke',
      description: 'Schätzt die Passwortstärke lokal: Entropie, Zeichensatz und schwache Muster',
    },
    checksum: {
      name: 'Prüfsumme',
      description: 'Berechnung von CRC-32 / Adler-32 / FNV-1a (rein im Browser)',
    },
    'encoding-rescue': {
      name: 'Mojibake-Reparatur',
      description:
        'Dekodiert Text erneut mit GBK / Big5 / Shift-JIS, der durch UTF-8-Fehlleitung kaputt ist',
    },
    'escape-unescape': {
      name: 'Escapen / Unescapen',
      description: 'Escaped und entescaped JSON / JS / HTML / XML / URL',
    },
    'caesar-cipher': {
      name: 'Caesar / ROT13 / Rail',
      description: 'Caesar-Verschlüsselung, ROT13, Atbash und Rail Fence',
    },
    'morse-code': {
      name: 'Morsecode',
      description: 'Wandelt Text in Morsecode und zurück (Buchstaben, Ziffern, Leerzeichen)',
    },
    'base-encoding': {
      name: 'Base-Kodierer',
      description: 'Kodieren/Dekodieren von Base16/32/32Hex/58/64/64URL (rein im Browser)',
    },
    'pdf-compress': {
      name: 'PDF-Komprimierung',
      description:
        'Komprimiert PDF: verlustfreie Objektströme oder verlustbehaftete JPEG-Neucodierung',
    },
    'pdf-watermark': {
      name: 'PDF-Wasserzeichen',
      description:
        'Fügt PDF ein Text-Wasserzeichen hinzu (Kacheln, Drehung, Transparenz, Seitenbereich)',
    },
    'pdf-decrypt': {
      name: 'PDF entsperren',
      description: 'Mit Passwort laden und ungeschütztes PDF exportieren (wie qpdf --decrypt)',
    },
    'pdf-extract-text': {
      name: 'PDF-Text extrahieren',
      description:
        'Extrahiert kopierbaren Text aus allen PDF-Seiten (lokal, verschlüsselt unterstützt)',
    },
    'random-port': {
      name: 'Zufälliger Port & Adresse',
      description:
        'Erzeugt Ports, private IPv4, MAC und IPv6 (Deduplizierung, meidet gängige Ports)',
    },
    'websocket-tester': {
      name: 'WebSocket-Tester',
      description: 'WebSocket verbinden, Text/Binär senden/empfangen mit Live-Log',
    },
    'http-request': {
      name: 'HTTP-Request-Debugger',
      description:
        'HTTP-Anfragen im Browser senden, Status, Dauer, Header und Body prüfen (CORS beachten)',
    },
    'http-headers': {
      name: 'Sicherheits-Header-Generator',
      description: 'Erzeugt CSP / HSTS / Referrer-Policy (nginx / Apache / Express / Vercel)',
    },
    'ua-generator': {
      name: 'User-Agent-Generator',
      description: 'Erzeugt User-Agent nach Browser/OS, mit gängiger UA-Bibliothek',
    },
    'url-parser': {
      name: 'URL-Parser',
      description: 'Zerlegt die URL in Protokoll, Host, Port, Pfad, Parameter und Anker',
    },
    'mac-address': {
      name: 'MAC-Adressen-Tool',
      description: 'MAC-Formatierung, Hersteller (OUI) suchen, EUI-64 und Massenerzeugung',
    },
    'ip-calc': {
      name: 'IP-Rechner',
      description: 'IPv4/IPv6-Adressierung, Subnetting (VLSM), Supernet und Wildcard-Maske',
    },
    'flowchart-editor': {
      name: 'Flussdiagramm-Editor',
      description:
        'Flussdiagramme lokal erstellen: Knoten, Verbindungen, Vorlagen, Auto-Layout und PNG/SVG-Export',
    },
    'mindmap-editor': {
      name: 'Mindmap-Editor',
      description:
        'Mindmaps lokal erstellen: Bedienung per Tastatur, einklappbare Zweige, Layouts, Themen und PNG/SVG/Markdown-Export',
    },
    'photo-editor': {
      name: 'Foto-Editor',
      description:
        'Mehrschichtige Bildbearbeitung im Browser: Ebenen, Auswahlen, Zuschneiden, Anpassungen, Filter, Pinsel und Text mit weiterbearbeitbarer Projektdatei',
    },
    base64: {
      name: 'Base64 kodieren / dekodieren',
      description: 'Text und Base64 Unicode-sicher umwandeln; URL Safe und Dateimodus unterstützt',
    },
    'url-codec': {
      name: 'URL kodieren / dekodieren',
      description:
        'encodeURIComponent- / encodeURI-Modi mit Erkennung fehlerhafter Prozentkodierung',
    },
    'regex-tester': {
      name: 'Regex-Tool',
      description: 'Trefferhervorhebung, Ersetzen, Fanggruppen, Vorlagen und Spickzettel',
    },
    'text-diff': {
      name: 'Text-Diff',
      description:
        'Nebeneinanderliegende Editoren mit Zeilenhervorhebung, Zeilennummern und Leerraum ignorieren',
    },
    'json-format': {
      name: 'JSON-Formatierer',
      description:
        'Formatieren / minifizieren / validieren mit 2/4-Leerzeichen-Einrückung und Fehlerposition Zeile/Spalte',
    },
    'json-convert': {
      name: 'JSON-Konverter',
      description: 'JSON parsen und nach YAML / XML / CSV konvertieren',
    },
    timestamp: {
      name: 'Zeitstempel-Konverter',
      description: 'Unix ⇄ menschenlesbare Zeit mit Auto-Erkennung Sekunde/ms und Live-Uhr',
    },
    uuid: {
      name: 'UUID-Generator',
      description: 'Zufällige v4- / zeitgeordnete v7-UUIDs mit Stapelausgabe und Formatoptionen',
    },
    hash: {
      name: 'Hash-Rechner',
      description:
        'MD5 / SHA-1 / SHA-256 / SHA-512 für Text und Dateien (Streaming), Ausgabe hex / base64',
    },
    'jwt-parser': {
      name: 'JWT-Parser',
      description:
        'Header / Payload / Signatur parsen und exp sowie andere Zeit-Claims lesen (nur Lesen, keine Prüfung)',
    },
    'aes-crypto': {
      name: 'AES verschlüsseln / entschlüsseln',
      description:
        'AES-GCM mit PBKDF2-Passphrase oder Rohschlüssel; Ausgabe base64(salt|iv|ciphertext)',
    },
    hmac: {
      name: 'HMAC',
      description: 'HMAC-SHA256 / SHA512 mit Ausgabe hex / base64',
    },
    totp: {
      name: 'TOTP',
      description: 'RFC-6238-TOTP: erzeugen / prüfen, 6/8 Ziffern, verbleibende Sekunden',
    },
    'x509-decode': {
      name: 'X.509-Zertifikatsdecoder',
      description: 'PEM parsen: SHA-256/SHA-1-Fingerabdrücke, Typ, DER-Länge, CN',
    },
    'cidr-calc': {
      name: 'CIDR-Rechner',
      description: 'IPv4-CIDR: Netz / Broadcast / Hostbereich / Maske / Hostanzahl',
    },
    'text-lines': {
      name: 'Textzeilen-Tools',
      description: 'Sortieren / Unique / Umkehren / Nummerieren / Leerzeilen entfernen',
    },
    'hex-codec': {
      name: 'Hex kodieren / dekodieren',
      description: 'Hex ↔ UTF-8-Text mit optionalen Leerzeichen',
    },
    'url-query': {
      name: 'URL-Query-Parser',
      description: 'URL-Teile und Query-Parameter parsen; nach Bearbeitung neu aufbauen',
    },
    'json-path': {
      name: 'JSONPath-Abfrage',
      description: 'Einfache Pfadabfragen wie a.b[0].c',
    },
    'gzip-tool': {
      name: 'Gzip-Kompression',
      description: 'Text per Gzip nach base64 / zurück nach Text dekomprimieren',
    },
    'exif-strip': {
      name: 'EXIF entfernen',
      description: 'Basis-JPEG-EXIF lesen und APP1 entfernen; bereinigte Datei herunterladen',
    },
    'fake-data': {
      name: 'Fake-Daten-Generator',
      description: 'Namen / E-Mails / UUIDs / Lorem in zh/en erzeugen, 1–50 Einträge',
    },
    'password-gen': {
      name: 'Passwort-Generator',
      description: 'Starke Zufallspasswörter mit Länge / Zeichensatz, Entropie und Stärke',
    },
    'entity-codec': {
      name: 'HTML kodieren / dekodieren',
      description: 'HTML-Sonderzeichen kodieren/dekodieren: benannt / dezimal / hex / \\u-Escapes',
    },
    'cron-parser': {
      name: 'Cron-Ausdrucksparser',
      description: 'Cron-Ausdrücke prüfen, Felder erklären und nächste Läufe vorschauen',
    },
    'convert-data': {
      name: 'Konfigurationsformat-Konverter',
      description: 'YAML ⇄ JSON ⇄ TOML über einen verlustfreien JS-Wert konvertieren',
    },
    'sql-format': {
      name: 'SQL-Formatierer',
      description:
        'SQL über Dialekte hinweg schön formatieren mit Einrückung und Keyword-Großschreibung',
    },
    'html-format': {
      name: 'HTML minifizieren / verschönern',
      description: 'HTML minifizieren und verschönern mit 2/4-Leerzeichen-Einrückung',
    },
    'js-format': {
      name: 'JS minifizieren / verschönern',
      description: 'JavaScript minifizieren und verschönern mit 2/4-Leerzeichen-Einrückung',
    },
    'css-format': {
      name: 'CSS minifizieren / verschönern',
      description: 'CSS minifizieren und verschönern mit 2/4-Leerzeichen-Einrückung',
    },
    'xml-format': {
      name: 'XML minifizieren / verschönern',
      description:
        'XML verschönern und minifizieren mit 2/4-Leerzeichen-Einrückung; CDATA bleibt erhalten',
    },
    'xml-json': {
      name: 'XML nach JSON',
      description: 'XML nach JSON parsen und Attribute mit @_-Präfix behalten',
    },
    qrcode: {
      name: 'QR-Code',
      description: 'QR-Codes erzeugen und dekodieren mit ECC, Größe, Farben und Rand',
    },
    'color-converter': {
      name: 'Farbkonverter',
      description: 'HEX- / RGB- / HSL-Formate konvertieren und vorschauen',
    },
    'radix-converter': {
      name: 'Zahlensystem-Konverter',
      description:
        'Basen 2/8/10/16 konvertieren und bitweise Ops für 64-Bit-Ganzzahlen visualisieren',
    },
    'markdown-preview': {
      name: 'Markdown-Editor',
      description:
        'Live-Hervorhebung und Vorschau, Gliederung, Wortzählung, .md öffnen/speichern und HTML exportieren',
    },
    'image-compress': {
      name: 'Bildkompression',
      description:
        'Clientseitige Bildkompression und Formatkonvertierung (PNG / JPEG / WebP) mit Größe und Qualität',
    },
    'unicode-codec': {
      name: 'Unicode-Codec',
      description: 'Text ↔ \\uXXXX, Codepoints, HTML-Entities und UTF-8-Bytes konvertieren',
    },
    'html-color-picker': {
      name: 'HTML-Farbwähler',
      description: 'Farben visuell wählen und HEX / RGB / HSL plus HTML/CSS-Snippets exportieren',
    },
    'web-color-table': {
      name: 'Web-Farbtabelle',
      description: 'CSS-Benannte Farben mit Gruppenfiltern und Kopieren von Name / HEX / RGB',
    },
    pinyin: {
      name: 'Chinesisch nach Pinyin',
      description: 'Chinesisch nach Pinyin mit optionalen Tönen, Trenner und Groß-/Kleinschreibung',
    },
    'length-converter': {
      name: 'Längenkonverter',
      description: 'Metrische und imperiale Längeneinheiten (mm, cm, m, km, in, ft u. a.)',
    },
    'zh-convert': {
      name: 'Traditionelles Chinesisch-Konverter',
      description: 'Zwischen vereinfachtem und traditionellem Chinesisch konvertieren',
    },
    'weight-converter': {
      name: 'Gewichtskonverter',
      description: 'Metrische und imperiale Gewichtseinheiten (mg, g, kg, t, oz, lb, st)',
    },
    'text-counter': {
      name: 'Textzähler',
      description: 'Zeichen, Wörter, Zeilen, Absätze, CJK-Zeichen und UTF-8-Bytes zählen',
    },
    calendar: {
      name: 'Kalender',
      description:
        'Monatsansicht mit Mondkalender/Almanach für Chinesisch und lokalen Feiertagen für Englisch',
    },
    'css-button': {
      name: 'CSS-Button-Generator',
      description: 'Styles visuell anpassen und Button-CSS / -HTML erzeugen',
    },
    'random-number': {
      name: 'Zufallszahlengenerator',
      description: 'Zufällige Ganz- oder Dezimalzahlen in einem Bereich, optional eindeutig',
    },
    'random-string': {
      name: 'Zufallsstring-Generator',
      description: 'Zufallsstrings nach Länge und Zeichensatz (alnum / hex / benutzerdefiniert)',
    },
    'doodle-board': {
      name: 'Skizzenbrett',
      description:
        'Zeichenbrett im Browser: Stift/Textmarker/Radierer, Formen und Vielecke, Pipette, Verschieben und Zoom, Export in mehreren Formaten',
    },
    calculator: {
      name: 'Taschenrechner',
      description:
        'Sicherer Ausdrucksrechner mit Arithmetik, Potenz, Modulo und gängigen Funktionen',
    },
    'code-image': {
      name: 'Code als Bild',
      description: 'Code als Syntax-Highlight-Karte rendern und als PNG exportieren',
    },
    'image-color-picker': {
      name: 'Bild-Farbpipette',
      description: 'Bild hochladen und Pixel anklicken für HEX / RGB',
    },
    'ascii-table': {
      name: 'ASCII-Tabelle',
      description: 'ASCII 0–127 Referenz mit Suche nach Dezimal, Hex oder Zeichen',
    },
    'image-watermark': {
      name: 'Bild-Wasserzeichen',
      description: 'Textwasserzeichen mit Position, Decität, Rotation und Kachelung',
    },
    'case-convert': {
      name: 'Groß-/Kleinschreibung-Konverter',
      description: 'Schreibweise und Namensstile (camel / snake / kebab usw.) umwandeln',
    },
    'bmi-calculator': {
      name: 'BMI-Rechner',
      description: 'BMI aus Größe und Gewicht mit WHO-Erwachsenenkategorien',
    },
    'placeholder-image': {
      name: 'Platzhalterbild',
      description: 'Platzhalter-PNG nach Größe, Farben und optionalem Text erzeugen',
    },
    'image-merge': {
      name: 'Bilder zusammenfügen',
      description: 'Bilder horizontal, vertikal oder im Raster zu einem PNG verbinden',
    },
    'cron-generator': {
      name: 'Crontab-Generator',
      description: 'Standard-5-Feld-Cron-Ausdruck aus Minute/Stunde/Tag/Monat/Wochentag bauen',
    },
    'ua-parser': {
      name: 'User-Agent-Parser',
      description: 'Browser-User-Agent in Browser, Engine, OS und Gerät zerlegen',
    },
    'latex-editor': {
      name: 'LaTeX-Mathe-Editor',
      description: 'Schnellsymbole und klassische Formeln, KaTeX-Vorschau, Export PNG/JPG/SVG',
    },
    countdown: {
      name: 'Countdown-Timer',
      description: 'Stunden, Minuten und Sekunden setzen; Pause, Fortsetzen und Endalarm',
    },
    stopwatch: {
      name: 'Stoppuhr',
      description: 'Online-Stoppuhr mit Start, Pause, Zwischenzeit und Reset',
    },
    'svg-to-png': {
      name: 'SVG nach PNG',
      description: 'SVG-Markup oder -Dateien nach PNG mit Skalierung und Transparenz',
    },
    'image-frame': {
      name: 'Bildrahmen / Radius / Schatten',
      description: 'Rahmen, abgerundete Ecken und Schatten hinzufügen, dann PNG exportieren',
    },
    'image-adjust': {
      name: 'Bildfarben anpassen',
      description: 'Helligkeit, Kontrast, Sättigung und Farbton anpassen, dann PNG exportieren',
    },
    'gif-frames': {
      name: 'GIF-Frame-Extraktor',
      description: 'GIF in PNG-Frames zerlegen; eines oder alle herunterladen',
    },
    'image-crop': {
      name: 'Bild zuschneiden',
      description: 'Bilder frei oder mit festen Seitenverhältnissen nach PNG zuschneiden',
    },
    'mbti-test': {
      name: 'MBTI-Persönlichkeitstest',
      description: 'Kurzer 24-Fragen-MBTI-Quiz (nur zur Unterhaltung)',
    },
    'text-card': {
      name: 'Text als Karte',
      description: 'Titel und Text als gestylte Karte layouten und als PNG exportieren',
    },
    'image-card': {
      name: 'Bild als Karte',
      description:
        'Foto + Titel/Untertitel-Karte mit Hintergrund-Presets oder Verläufen, PNG-Export',
    },
    'code-highlight': {
      name: 'Code-Highlighter',
      description: 'Live-Syntax-Highlighting mit Zeilennummern und HTML-Snippet-Kopie',
    },
    'image-base64': {
      name: 'Bild ↔ Base64',
      description: 'Bilder ↔ Base64 / Data-URL konvertieren, vollständig lokal',
    },
    'image-ico': {
      name: 'ICO-Konverter',
      description: 'Bilder in Multi-Size-ICO (Favicon) oder PNG aus ICO extrahieren',
    },
    'hsv-cmyk': {
      name: 'HSV- / CMYK-Konverter',
      description: 'RGB, HSV, CMYK und HEX umwandeln und vorschauen',
    },
    'ai-prompts': {
      name: 'KI-Prompt-Bibliothek',
      description: 'Kuratierte Prompts nach Kategorie mit Suche und Ein-Klick-Kopie',
    },
    'md-mindmap': {
      name: 'Markdown-Mindmap',
      description: 'Markdown zur Mindmap mit Themes, Zoom und PNG/SVG-Export',
    },
    'mermaid-editor': {
      name: 'Mermaid-Diagramm-Editor',
      description: 'Mermaid lokal rendern mit Themes, Zoom und PNG/SVG-Export',
    },
    'css-gradient': {
      name: 'CSS-Verlauf-Generator',
      description:
        'Lineare / radiale Verläufe bearbeiten mit kategorisierten Presets und CSS-Kopie',
    },
    'image-to-paper': {
      name: 'Bild zu Papier-PDF',
      description: 'Bilder auf A3/A4/A5/Letter anpassen und als PDF exportieren',
    },
    'md-to-image': {
      name: 'Markdown zu Bild',
      description:
        'Markdown als gestylte Karte rendern und PNG mit Schrift, Größe, Breite und Farben exportieren',
    },
    'chart-generator': {
      name: 'Diagramm-Generator',
      description:
        'Balken-/Linien-/Flächen-/Kreis-/Donut-/Streudiagramme aus CSV mit Legenden und Paletten',
    },
    'css3-generator': {
      name: 'CSS3-Code-Generator',
      description: 'border-radius, Schatten, transform, filter und mehr erzeugen',
    },
    'xslt-transform': {
      name: 'XSLT-Transformation',
      description: 'XML mit XSLT im Browser nach HTML transformieren',
    },
    'rich-text-editor': {
      name: 'Textverarbeitung',
      description: 'Lokale Texterstellung mit Word-Import/Export (.docx) und zwei PDF-Exportmodi',
    },
    'slide-editor': {
      name: 'Präsentations-Editor',
      description:
        'Folien lokal bearbeiten mit PowerPoint-Import/Export (.pptx) und Präsentationsmodus',
    },
    'spreadsheet-editor': {
      name: 'Tabellen-Editor',
      description:
        'Lokale Bearbeitung mit Excel-Import/Export (.xlsx), Formeln und mehreren Blättern',
    },
    'pdf-merge': {
      name: 'PDF zusammenfügen',
      description: 'Mehrere PDFs zu einer Datei zusammenfügen',
    },
    'pdf-split': {
      name: 'PDF teilen',
      description: 'PDF in eine Datei pro Seite teilen',
    },
    'pdf-delete-pages': {
      name: 'PDF-Seiten löschen',
      description: 'Ausgewählte Seiten aus einem PDF entfernen',
    },
    'pdf-extract-pages': {
      name: 'PDF-Seiten extrahieren',
      description: 'Ausgewählte Seiten in ein neues PDF extrahieren',
    },
    'pdf-reorder': {
      name: 'PDF-Seiten neu ordnen',
      description: 'Seitenreihenfolge in einem PDF ändern',
    },
    'pdf-rotate': {
      name: 'PDF-Seiten drehen',
      description: 'Ausgewählte oder alle Seiten drehen',
    },
    'pdf-to-image': {
      name: 'PDF zu Bild',
      description: 'PDF-Seiten als JPG/PNG rendern',
    },
    'images-to-pdf': {
      name: 'Bilder zu PDF',
      description: 'Bilder zu einem PDF kombinieren',
    },
    'pdf-viewer': {
      name: 'PDF-Viewer',
      description: 'PDF lokal öffnen und lesen',
    },
    'pdf-page-numbers': {
      name: 'PDF-Seitenzahlen',
      description: 'Seitenzahlen zu einem PDF hinzufügen',
    },
    'pdf-header-footer': {
      name: 'PDF-Kopf- und Fußzeile',
      description: 'Kopf- und Fußzeilentext hinzufügen',
    },
    'pdf-insert-image': {
      name: 'Bild in PDF einfügen',
      description: 'Bild auf PDF-Seiten platzieren',
    },
    'pdf-add-text': {
      name: 'Text zu PDF hinzufügen',
      description: 'Text auf PDF-Seiten hinzufügen',
    },
    'pdf-sign': {
      name: 'PDF unterschreiben',
      description: 'Unterschriftsbild zeichnen oder hochladen (visuell, kein Zertifikat)',
    },
    'pdf-metadata': {
      name: 'PDF-Metadaten',
      description: 'PDF-Metadaten anzeigen und bearbeiten',
    },
    'pdf-encrypt': {
      name: 'PDF verschlüsseln',
      description: 'Passwort und Berechtigungsflags setzen',
    },
    'pdf-crop': {
      name: 'PDF zuschneiden',
      description: 'Seitenränder über cropBox zuschneiden',
    },
    'pdf-grayscale': {
      name: 'PDF Graustufen',
      description: 'PDF in visuelle Graustufen umwandeln',
    },
    'pdf-annotate': {
      name: 'PDF annotieren',
      description: 'Hervorhebungen, Freihand, Formen und Text auf PDF-Seiten zeichnen',
    },
  },
} satisfies ShellResources;

export default de;
