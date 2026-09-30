import type { ShellResources } from '../types';

/** it 文案资源（外壳 + 工具元数据；`tools.*` 见 it.tools.ts） */
const it = {
  app: {
    docTitle: 'SynTools · Toolbox online',
  },
  header: {
    openMenu: 'Apri menu',
    searchPlaceholder: 'Cerca strumenti…',
    searchAria: 'Cerca strumenti',
    themeAria: 'Cambia tema',
    langAria: 'Cambia lingua',
    downloadAria: "Scarica l'app desktop",
    sourceAria: 'Codice sorgente',
  },
  sidebar: {
    nav: 'Navigazione tra gli strumenti',
    closeMenu: 'Chiudi menu',
    filter: 'Filtra strumenti',
    filterPlaceholder: 'Filtra…',
    filterEmpty: 'Nessuno strumento corrispondente',
    categoryActions: 'Azioni categoria',
    expandAll: 'Espandi tutte le categorie',
    collapseAll: 'Comprimi tutte le categorie',
  },
  home: {
    title: 'Toolbox online',
    tagline:
      'Elaborazione prima locale; i dati rimangono nel browser (CSP, zero uscita) · Premi <1>⌘K</1> o <3>/</3> per cercare',
    favorites: 'Preferiti',
    recent: 'Usati di recente',
    favoriteAria: 'Aggiungi ai preferiti',
    unfavoriteAria: 'Rimuovi dai preferiti',
  },
  search: {
    aria: 'Cerca strumenti',
    placeholder: 'Strumenti di ricerca (nome / parole chiave)...',
    empty: 'Nessuno strumento corrispondente trovato',
  },
  categories: {
    file: 'File',
    media: 'Audio e video',
    cheatsheet: 'Promemoria',
    advanced: 'Documenti e creazione',
    encoding: 'Codifica',
    text: 'Testo',
    formatting: 'Formattazione',
    crypto: 'Crittografia e hash',
    datetime: 'Data e ora',
    generator: 'Generatori',
    network: 'Rete',
    image: 'Immagini',
    pdf: 'PDF',
    other: 'Altro',
  },
  common: {
    copy: 'Copia',
    copied: 'Copiato',
    clear: 'Cancella',
    discardConfirm:
      'Il documento corrente non è salvato. Crearne uno nuovo lo scarterà. Sei sicuro?',
    swap: 'Scambia',
    newDoc: 'Nuovo documento',
    saved: 'Salvato nella bozza locale',
    saving: 'Salvataggio automatico dopo la digitazione',
    download: 'Scarica',
    share: 'Condividi',
    shareTooLong: 'Contenuto troppo lungo (> 2KB), impossibile creare link di condivisione',
    retry: 'Riprova',
    loading: 'Caricamento',
    operation: 'Azione',
    encode: 'Codifica',
    decode: 'Decodifica',
    result: 'Risultato',
    rawText: 'Testo grezzo',
    input: 'Input',
    output: 'Output',
    text: 'Testo',
    file: 'File',
    remove: 'Rimuovi',
    bytes: '{{size}} byte',
  },
  io: {
    stats: '{{chars}} caratteri / {{bytes}} byte',
    warnLarge:
      'Ingresso di grandi dimensioni (> 500 KB), il calcolo in tempo reale potrebbe rallentare',
    overflow:
      "L'input supera il limite di 5 MB; utilizzare la modalità file per contenuti di grandi dimensioni",
  },
  file: {
    hint: 'Rilascia qui I file o fa clic per scegliere',
    max: 'Max {{size}}',
    over: 'File exceeds the {{max}} limit (current {{size}})',
    uploadAria: 'Carica file',
    previewAlt: 'Anteprima di {{name}}',
    pages: '{{n}} pagine',
    encrypted: 'Crittografato',
  },
  pdf: {
    password: 'Password 0***',
    passwordPlaceholder: "È necessario specificare una password per l'accesso all'account email.",
    passwordHint: 'Questo PDF è crittografato. Inserisci la password per continuare.',
    unlock: 'Sblocca',
    errors: {
      NEED_PASSWORD: 'Questo PDF è crittografato. Inserisci la password.',
      WRONG_PASSWORD: 'Password sbagliata. Prova di nuovo',
    },
  },
  tool: {
    errorTitle: 'Run-time',
    localBadge: 'Solo locale',
    serverBadge: 'Ha bisogno di un server',
    related: 'Strumenti correlati',
    nextSteps: 'Prossimi passi',
    openIn: 'Apri in {{name}}',
    progress: 'Avanzamento {{current}} / {{total}}',
  },
  notFound: {
    message: 'Pagina o strumento non trovato',
    back: 'Indietro alla home page',
  },
  toolsMeta: {
    'code-editor': {
      name: 'Editor di codice',
      description:
        'Editor con evidenziazione della sintassi, formattazione per linguaggio, 10 temi ed esportazione sorgente / HTML / immagine',
    },
    'video-convert': {
      name: 'Convertitore video',
      description:
        'Transcodifica video WebCodecs-first (MP4 / WebM / MKV) con fallback automatico a ffmpeg.wasm',
    },
    'video-to-gif': {
      name: 'Video in GIF',
      description: 'Ritaglia un video in GIF animata (tutto nel browser)',
    },
    'audio-convert': {
      name: 'Convertitore audio',
      description:
        'Conversione audio: WAV (nativo) e MP3 / M4A / OGG / FLAC (WebCodecs-first, fallback ffmpeg.wasm)',
    },
    'subtitle-tool': {
      name: 'Convertitore sottotitoli',
      description: 'Converti tra SRT / WebVTT con spostamento temporale',
    },
    'git-cheatsheet': {
      name: 'Cheatsheet Git',
      description: 'Comandi Git comuni per categoria, con ricerca',
    },
    'mime-types': {
      name: 'Tipi MIME',
      description: 'Tabella estensione ↔ tipo MIME, con ricerca',
    },
    'http-status': {
      name: 'Codici HTTP',
      description: 'Riferimento dei codici di stato HTTP con classe, nome e significato',
    },
    'id-photo': {
      name: 'Foto tessera',
      description: 'Ritaglia a formati standard (1”, 2”, passaporto) con sfondo e DPI',
    },
    'image-grid-cut': {
      name: 'Taglia in griglia',
      description: "Dividi un'immagine in griglia (es. 3×3) e scarica ogni riquadro",
    },
    'image-ascii': {
      name: 'Immagine in ASCII',
      description: 'Converti immagini in ASCII art (set di caratteri, larghezza, inversione)',
    },
    'timezone-converter': {
      name: 'Convertitore di fuso',
      description: 'Converti orari tra fusi IANA con offset UTC',
    },
    'tax-loan-calculator': {
      name: 'Prestito / Tasse',
      description: 'Ammortamento (rata costante / quota capitale costante) e stima imposta',
    },
    'unit-converter': {
      name: 'Convertitore di unità',
      description:
        'Converti lunghezza / massa / area / volume / temperatura / velocità / dati / tempo',
    },
    'bulk-rename': {
      name: 'Rinomina in blocco',
      description:
        'Genera nomi con prefisso/suffisso, sostituzione (regex), numerazione, estensione e maiuscole',
    },
    'file-split-merge': {
      name: 'Dividi / Unisci file',
      description: 'Dividi un file per dimensione o numero, o unisci le parti',
    },
    'zip-manager': {
      name: 'Gestore ZIP',
      description: 'Crea un ZIP da più file o estrae singoli elementi (JSZip)',
    },
    barcode: {
      name: 'Generatore barcode',
      description: 'Genera barcode Code 39 / Code 128 / EAN-13 in SVG',
    },
    'id-generator': {
      name: 'Generatore ID',
      description: 'Genera ULID / NanoID / Snowflake / ObjectId MongoDB in blocco',
    },
    'code-minify': {
      name: 'Minificatore',
      description: 'Minifica CSS / HTML / JS / JSON (CSS con csso; JS/HTML conservativo)',
    },
    'csv-tool': {
      name: 'Strumento CSV',
      description: 'Conversione CSV ↔ JSON con delimitatore, intestazione e quoting (RFC 4180)',
    },
    'key-converter': {
      name: 'Convertitore chiavi',
      description: 'Converti chiavi RSA tra PEM / DER / JWK / OpenSSH (WebCrypto)',
    },
    'rsa-crypto': {
      name: 'RSA cifra/decifra',
      description:
        'RSA-OAEP cifratura/decifratura, RSA-PSS firma/verifica e generazione chiavi (WebCrypto)',
    },
    'password-hash': {
      name: 'Hash password (PBKDF2)',
      description: 'Derivazione PBKDF2 via WebCrypto, con salt e iterazioni personalizzati',
    },
    'password-strength': {
      name: 'Forza password',
      description: 'Stima locale della forza: entropia, set di caratteri e pattern deboli',
    },
    checksum: {
      name: 'Checksum',
      description: 'Calcola CRC-32 / Adler-32 / FNV-1a (tutto nel browser)',
    },
    'encoding-rescue': {
      name: 'Riparatore mojibake',
      description: 'Ridecodifica testo corrotto (UTF-8 mal letto) con GBK / Big5 / Shift-JIS',
    },
    'escape-unescape': {
      name: 'Escape / Unescape',
      description: 'Escapa e annulla JSON / JS / HTML / XML / URL',
    },
    'caesar-cipher': {
      name: 'Cesare / ROT13 / Rail',
      description: 'Cifrario di Cesare, ROT13, Atbash e Rail Fence',
    },
    'morse-code': {
      name: 'Codice Morse',
      description: 'Converti testo e codice Morse, con lettere, cifre e spazi',
    },
    'base-encoding': {
      name: 'Codificatore Base',
      description: 'Codifica/decodifica Base16/32/32Hex/58/64/64URL (tutto nel browser)',
    },
    'pdf-compress': {
      name: 'Compressione PDF',
      description: 'Comprimi PDF: flussi di oggetti senza perdita o ricodifica JPEG con perdita',
    },
    'pdf-watermark': {
      name: 'Filigrana PDF',
      description:
        'Aggiunge filigrana testuale al PDF (mosaico, rotazione, opacità, intervallo pagine)',
    },
    'pdf-decrypt': {
      name: 'Sblocco PDF',
      description: 'Carica con password ed esporta un PDF non protetto (come qpdf --decrypt)',
    },
    'pdf-extract-text': {
      name: 'Estrattore testo PDF',
      description:
        'Estrae testo copiabile da tutte le pagine PDF (locale, supporta file crittografati)',
    },
    'random-port': {
      name: 'Porta e indirizzo casuali',
      description: 'Genera porte, IPv4 privata, MAC e IPv6 (deduplica ed evita porte comuni)',
    },
    'websocket-tester': {
      name: 'Tester WebSocket',
      description: 'Connetti a WebSocket, invia/ricevi testo/binario con log live',
    },
    'http-request': {
      name: 'Debugger HTTP',
      description:
        'Invia richieste HTTP nel browser, ispeziona stato, durata, header e body (CORS)',
    },
    'http-headers': {
      name: 'Generatore header di sicurezza',
      description: 'Genera CSP / HSTS / Referrer-Policy (nginx / Apache / Express / Vercel)',
    },
    'ua-generator': {
      name: 'Generatore User-Agent',
      description: 'Genera User-Agent per browser/OS, con libreria UA comune',
    },
    'url-parser': {
      name: 'Parser URL',
      description: "Scompone l'URL in protocollo, host, porta, percorso, parametri e ancoraggio",
    },
    'mac-address': {
      name: 'Strumento MAC',
      description: 'Formattazione MAC, ricerca vendor (OUI), EUI-64 e generazione in massa',
    },
    'ip-calc': {
      name: 'Calcolatore IP',
      description: 'Indirizzamento IPv4/IPv6, subnetting (VLSM), supernet e wildcard mask',
    },
    'flowchart-editor': {
      name: 'Editor di diagrammi',
      description:
        'Crea diagrammi di flusso in locale: nodi, collegamenti, modelli, disposizione auto ed export PNG/SVG',
    },
    'mindmap-editor': {
      name: 'Editor di mappe mentali',
      description:
        'Crea mappe mentali in locale: nodi da tastiera, rami comprimibili, layout, temi ed esportazione PNG/SVG/Markdown',
    },
    'photo-editor': {
      name: 'Editor di foto',
      description:
        'Ritocco foto multistrato nel browser: livelli, selezioni, ritaglio, regolazioni, filtri, pennello e testo, con progetto riapribile',
    },
    base64: {
      name: 'Codifica / Decodifica Base64',
      description:
        'Converti testo e Base64 con codifica Unicode-safe; supportati URL Safe e modalità file',
    },
    'url-codec': {
      name: 'Codifica / Decodifica URL',
      description:
        'Modalità encodeURIComponent / encodeURI con rilevamento di percent-encoding non valido',
    },
    'regex-tester': {
      name: 'Strumento Regex',
      description:
        'Evidenziazione corrispondenze, sostituzione, gruppi di cattura, preset e cheat sheet',
    },
    'text-diff': {
      name: 'Diff testo',
      description: 'Editor affiancati con evidenziazione inline, numeri di riga e ignore spazi',
    },
    'json-format': {
      name: 'Formattatore JSON',
      description:
        'Formatta / minimizza / valida con indentazione a 2/4 spazi e errori riga/colonna',
    },
    'json-convert': {
      name: 'Convertitore JSON',
      description: 'Analizza JSON e convertilo in YAML / XML / CSV',
    },
    timestamp: {
      name: 'Convertitore timestamp',
      description: 'Unix ⇄ ora leggibile con rilevamento auto secondi/ms e orologio live',
    },
    uuid: {
      name: 'Generatore UUID',
      description: 'UUID v4 casuali / v7 ordinati nel tempo con output batch e opzioni di formato',
    },
    hash: {
      name: 'Calcolatore hash',
      description:
        'MD5 / SHA-1 / SHA-256 / SHA-512 per testo e file (streaming), output hex / base64',
    },
    'jwt-parser': {
      name: 'Parser JWT',
      description:
        'Analizza header / payload / signature e leggi exp e altri claim temporali (sola lettura, senza verify)',
    },
    'aes-crypto': {
      name: 'Cifra / Decifra AES',
      description: 'AES-GCM con passphrase PBKDF2 o chiave raw; output base64(salt|iv|ciphertext)',
    },
    hmac: {
      name: 'HMAC',
      description: 'HMAC-SHA256 / SHA512 con output hex / base64',
    },
    totp: {
      name: 'TOTP',
      description: 'TOTP RFC 6238: genera / verifica, 6/8 cifre, secondi rimanenti',
    },
    'x509-decode': {
      name: 'Decoder certificati X.509',
      description: 'Analizza PEM: fingerprint SHA-256/SHA-1, tipo, lunghezza DER, CN',
    },
    'cidr-calc': {
      name: 'Calcolatore CIDR',
      description: 'CIDR IPv4: rete / broadcast / intervallo host / maschera / n. host',
    },
    'text-lines': {
      name: 'Strumenti righe di testo',
      description: 'Ordina / unici / inverti / numera / rimuovi righe vuote',
    },
    'hex-codec': {
      name: 'Codifica / Decodifica hex',
      description: 'Hex ↔ testo UTF-8 con spazi opzionali',
    },
    'url-query': {
      name: 'Parser query URL',
      description: 'Analizza parti URL e parametri query; ricostruisci dopo le modifiche',
    },
    'json-path': {
      name: 'Query JSONPath',
      description: 'Query di percorso semplici come a.b[0].c',
    },
    'gzip-tool': {
      name: 'Compressione Gzip',
      description: 'Comprimi testo in base64 con Gzip / decomprimi di nuovo in testo',
    },
    'exif-strip': {
      name: 'Rimuovi EXIF',
      description: 'Leggi EXIF JPEG di base e rimuovi APP1; scarica il file pulito',
    },
    'fake-data': {
      name: 'Generatore dati fittizi',
      description: 'Genera nomi / email / UUID / lorem in zh/en, 1–50 elementi',
    },
    'password-gen': {
      name: 'Generatore password',
      description:
        'Password casuali forti con opzioni lunghezza / charset, stima entropia e livello',
    },
    'entity-codec': {
      name: 'Codifica / Decodifica HTML',
      description:
        'Codifica/decodifica caratteri speciali HTML: named / decimal / hex / escape \\u',
    },
    'cron-parser': {
      name: 'Parser espressioni Cron',
      description: 'Valida espressioni cron, spiega i campi e anteprima delle prossime esecuzioni',
    },
    'convert-data': {
      name: 'Convertitore formati dati di config',
      description: 'Converti YAML ⇄ JSON ⇄ TOML tramite un valore JS intermedio senza perdite',
    },
    'sql-format': {
      name: 'Formattatore SQL',
      description:
        'Abbellisci SQL su più dialetti con indentazione e case parole chiave configurabili',
    },
    'html-format': {
      name: 'Minify / Beautify HTML',
      description: 'Minimizza e abbellisci HTML con indentazione a 2/4 spazi',
    },
    'js-format': {
      name: 'Minify / Beautify JS',
      description: 'Minimizza e abbellisci JavaScript con indentazione a 2/4 spazi',
    },
    'css-format': {
      name: 'Minify / Beautify CSS',
      description: 'Minimizza e abbellisci CSS con indentazione a 2/4 spazi',
    },
    'xml-format': {
      name: 'Minify / Beautify XML',
      description: 'Abbellisci e minimizza XML con indentazione a 2/4 spazi; CDATA preservato',
    },
    'xml-json': {
      name: 'XML a JSON',
      description: 'Analizza XML in JSON, mantenendo gli attributi con prefisso @_',
    },
    qrcode: {
      name: 'Codice QR',
      description: 'Genera e decodifica codici QR con ECC, dimensione, colori e margine',
    },
    'color-converter': {
      name: 'Convertitore colori',
      description: 'Converti e anteprima formati HEX / RGB / HSL',
    },
    'radix-converter': {
      name: 'Convertitore di basi',
      description: 'Converti basi 2/8/10/16 e visualizza ops bitwise per interi signed a 64 bit',
    },
    'markdown-preview': {
      name: 'Editor Markdown',
      description:
        'Modifica e anteprima in tempo reale, struttura, conteggio parole, apertura/salvataggio .md ed esportazione HTML',
    },
    'image-compress': {
      name: 'Comprimi immagine',
      description:
        'Compressione e conversione immagini lato client (PNG / JPEG / WebP) con resize e qualità',
    },
    'unicode-codec': {
      name: 'Codec Unicode',
      description: 'Converti testo da/a \\uXXXX, code point, entità HTML e byte UTF-8',
    },
    'html-color-picker': {
      name: 'Selettore colore HTML',
      description: 'Scegli colori visivamente ed esporta HEX / RGB / HSL più snippet HTML/CSS',
    },
    'web-color-table': {
      name: 'Tabella colori web',
      description: 'Colori CSS con nome, filtri per gruppo e copia nome / HEX / RGB',
    },
    pinyin: {
      name: 'Cinese a pinyin',
      description: 'Converti cinese in pinyin con toni, separatore e case opzionali',
    },
    'length-converter': {
      name: 'Convertitore lunghezze',
      description:
        'Converti unità di lunghezza metriche e imperiali (mm, cm, m, km, in, ft e altro)',
    },
    'zh-convert': {
      name: 'Convertitore cinese tradizionale',
      description: 'Converti tra cinese semplificato e tradizionale',
    },
    'weight-converter': {
      name: 'Convertitore pesi',
      description: 'Converti unità di peso metriche e imperiali (mg, g, kg, t, oz, lb, st)',
    },
    'text-counter': {
      name: 'Contatore testo',
      description: 'Conta caratteri, parole, righe, paragrafi, caratteri CJK e byte UTF-8',
    },
    calendar: {
      name: 'Calendario',
      description:
        "Vista mensile con lunare/almanacco per il cinese e festività locali per l'inglese",
    },
    'css-button': {
      name: 'Generatore pulsanti CSS',
      description: 'Regola gli stili visivamente e genera CSS / HTML del pulsante',
    },
    'random-number': {
      name: 'Generatore numeri casuali',
      description: 'Genera interi o decimali casuali in un intervallo, con valori unici opzionali',
    },
    'random-string': {
      name: 'Generatore stringhe casuali',
      description: 'Genera stringhe casuali per lunghezza e charset (alnum / hex / personalizzato)',
    },
    'doodle-board': {
      name: 'Lavagna doodle',
      description:
        'Lavagna da disegno nel browser: penna/evidenziatore/gomma, forme e poligoni, contagocce, sposta e zoom, esportazione multipiattaforma',
    },
    calculator: {
      name: 'Calcolatrice',
      description:
        'Calcolatrice di espressioni sicura con aritmetica, potenze, modulo e funzioni comuni',
    },
    'code-image': {
      name: 'Codice a immagine',
      description: 'Renderizza codice come card con syntax highlighting ed esporta PNG',
    },
    'image-color-picker': {
      name: 'Selettore colore da immagine',
      description: "Carica un'immagine e clicca un pixel per campionare HEX / RGB",
    },
    'ascii-table': {
      name: 'Tabella ASCII',
      description: 'Riferimento ASCII 0–127 con ricerca per decimale, hex o carattere',
    },
    'image-watermark': {
      name: 'Filigrana immagine',
      description: 'Aggiungi filigrana di testo con posizione, opacità, rotazione e tiling',
    },
    'case-convert': {
      name: 'Convertitore maiuscole/minuscole',
      description: 'Converti case e stili di naming (camel / snake / kebab, ecc.)',
    },
    'bmi-calculator': {
      name: 'Calcolatore BMI',
      description: 'Calcola il BMI da altezza e peso con categorie WHO per adulti',
    },
    'placeholder-image': {
      name: 'Immagine placeholder',
      description: 'Genera un PNG placeholder per dimensione, colori e testo opzionale',
    },
    'image-merge': {
      name: 'Unisci immagini',
      description: 'Unisci immagini in orizzontale, verticale o griglia in un PNG',
    },
    'cron-generator': {
      name: 'Generatore Crontab',
      description:
        "Crea un'espressione Cron standard a 5 campi da minuto/ora/giorno/mese/giorno settimana",
    },
    'ua-parser': {
      name: 'Parser User-Agent',
      description: 'Analizza un User-Agent del browser in browser, engine, OS e dispositivo',
    },
    'latex-editor': {
      name: 'Editor matematica LaTeX',
      description: 'Simboli rapidi e formule classiche, anteprima KaTeX, export PNG/JPG/SVG',
    },
    countdown: {
      name: 'Timer conto alla rovescia',
      description: 'Imposta ore, minuti e secondi; pausa, ripresa e avviso a fine',
    },
    stopwatch: {
      name: 'Cronometro',
      description: 'Cronometro online con avvio, pausa, giro e reset',
    },
    'svg-to-png': {
      name: 'SVG a PNG',
      description: 'Converti markup o file SVG in PNG con scala e trasparenza',
    },
    'image-frame': {
      name: 'Bordo / raggio / ombra immagine',
      description: 'Aggiungi bordo, angoli arrotondati e ombra, poi esporta PNG',
    },
    'image-adjust': {
      name: 'Regola colori immagine',
      description: 'Regola luminosità, contrasto, saturazione e tonalità, poi esporta PNG',
    },
    'gif-frames': {
      name: 'Estrattore frame GIF',
      description: 'Dividi un GIF in frame PNG; scarica uno o tutti',
    },
    'image-crop': {
      name: 'Ritaglia immagine',
      description: 'Ritaglia immagini a mano libera o con rapporti fissi in PNG',
    },
    'mbti-test': {
      name: 'Test personalità MBTI',
      description: 'Breve quiz stile MBTI a 24 domande (solo intrattenimento)',
    },
    'text-card': {
      name: 'Testo a card',
      description: 'Impagina titolo e corpo in una card stilizzata ed esporta PNG',
    },
    'image-card': {
      name: 'Immagine a card',
      description: 'Card foto + titolo/sottotitolo con sfondi o gradienti, export PNG',
    },
    'code-highlight': {
      name: 'Syntax highlighter',
      description: 'Evidenziazione sintassi live con numeri di riga e copia snippet HTML',
    },
    'image-base64': {
      name: 'Immagine ↔ Base64',
      description: 'Converti immagini in Base64 / Data URL e viceversa, interamente in locale',
    },
    'image-ico': {
      name: 'Convertitore ICO',
      description: 'Converti immagini in ICO multi-size (favicon), o estrai PNG da ICO',
    },
    'hsv-cmyk': {
      name: 'Convertitore HSV / CMYK',
      description: 'Converti e anteprima spazi RGB, HSV, CMYK e HEX',
    },
    'ai-prompts': {
      name: 'Libreria prompt IA',
      description: 'Prompt curati per categoria con ricerca e copia in un clic',
    },
    'md-mindmap': {
      name: 'Mappa mentale Markdown',
      description: 'Trasforma Markdown in mappa mentale con temi, zoom ed export PNG/SVG',
    },
    'mermaid-editor': {
      name: 'Editor diagrammi Mermaid',
      description: 'Renderizza Mermaid in locale con temi, zoom ed export PNG/SVG',
    },
    'css-gradient': {
      name: 'Generatore gradienti CSS',
      description: 'Modifica gradienti lineari / radiali con preset categorizzati e copia CSS',
    },
    'image-to-paper': {
      name: 'Immagine a PDF carta',
      description: 'Adatta immagini a A3/A4/A5/Letter ed esporta PDF',
    },
    'md-to-image': {
      name: 'Markdown a immagine',
      description:
        'Renderizza Markdown in una card stilizzata ed esporta PNG con font, size, larghezza e colori',
    },
    'chart-generator': {
      name: 'Generatore grafici',
      description:
        'Crea grafici barre/linee/aree/torta/ciambella/scatter da CSV con legende e palette',
    },
    'css3-generator': {
      name: 'Generatore codice CSS3',
      description: 'Genera border-radius, ombre, transform, filter e altro',
    },
    'xslt-transform': {
      name: 'Trasformazione XSLT',
      description: 'Trasforma XML in HTML con XSLT nel browser',
    },
    'rich-text-editor': {
      name: 'Elaboratore di testo',
      description:
        'Scrittura locale con import/export Word (.docx) e due modalità di esportazione PDF',
    },
    'slide-editor': {
      name: 'Editor diapositive',
      description:
        'Modifica locale su canvas con import/export PowerPoint (.pptx) e modalità presentazione',
    },
    'spreadsheet-editor': {
      name: 'Editor di fogli di calcolo',
      description: 'Modifica locale con import/export Excel (.xlsx), formule e più fogli',
    },
    'pdf-merge': {
      name: 'Unisci PDF',
      description: 'Unisci più PDF in un unico file',
    },
    'pdf-split': {
      name: 'Dividi PDF',
      description: 'Dividi un PDF in un file per pagina',
    },
    'pdf-delete-pages': {
      name: 'Elimina pagine PDF',
      description: 'Rimuovi le pagine selezionate da un PDF',
    },
    'pdf-extract-pages': {
      name: 'Estrai pagine PDF',
      description: 'Estrai le pagine selezionate in un nuovo PDF',
    },
    'pdf-reorder': {
      name: 'Riordina pagine PDF',
      description: 'Riordina le pagine di un PDF',
    },
    'pdf-rotate': {
      name: 'Ruota pagine PDF',
      description: 'Ruota le pagine selezionate o tutte',
    },
    'pdf-to-image': {
      name: 'PDF a immagine',
      description: 'Renderizza pagine PDF come JPG/PNG',
    },
    'images-to-pdf': {
      name: 'Immagini a PDF',
      description: 'Combina immagini in un PDF',
    },
    'pdf-viewer': {
      name: 'Visualizzatore PDF',
      description: 'Apri e leggi un PDF in locale',
    },
    'pdf-page-numbers': {
      name: 'Numeri di pagina PDF',
      description: 'Aggiungi numeri di pagina a un PDF',
    },
    'pdf-header-footer': {
      name: 'Intestazione e piè PDF',
      description: 'Aggiungi testo di intestazione e piè di pagina',
    },
    'pdf-insert-image': {
      name: 'Inserisci immagine nel PDF',
      description: "Posiziona un'immagine sulle pagine PDF",
    },
    'pdf-add-text': {
      name: 'Aggiungi testo al PDF',
      description: 'Aggiungi testo sulle pagine PDF',
    },
    'pdf-sign': {
      name: 'Firma PDF',
      description: "Disegna o carica un'immagine firma (visiva, non certificato)",
    },
    'pdf-metadata': {
      name: 'Metadati PDF',
      description: 'Visualizza e modifica i metadati PDF',
    },
    'pdf-encrypt': {
      name: 'Cifra PDF',
      description: 'Imposta password e flag di permessi',
    },
    'pdf-crop': {
      name: 'Ritaglia PDF',
      description: 'Ritaglia i margini pagina tramite cropBox',
    },
    'pdf-grayscale': {
      name: 'PDF in scala di grigi',
      description: 'Converti PDF in scala di grigi visuale',
    },
    'pdf-annotate': {
      name: 'Annota PDF',
      description: 'Disegna evidenziazioni, a mano libera, forme e testo sulle pagine PDF',
    },
  },
} satisfies ShellResources;

export default it;
