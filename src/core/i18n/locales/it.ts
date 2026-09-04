import type { TranslationResources } from '../types';

/** Italian translation resources */
const it = {
  "app": {
    "docTitle": "SynTools · Toolbox online per sviluppatori"
  },
  "header": {
    "openMenu": "Apri menu",
    "searchPlaceholder": "Cerca strumenti…",
    "searchAria": "Cerca strumenti",
    "themeAria": "Cambia tema",
    "langAria": "Cambia lingua",
    "sourceAria": "Codice sorgente"
  },
  "sidebar": {
    "nav": "Navigazione tra gli strumenti",
    "closeMenu": "Chiudi menu",
    "filter": "Filtra strumenti",
    "filterPlaceholder": "Filtra…",
    "filterEmpty": "Nessuno strumento corrispondente"
  },
  "home": {
    "title": "Toolbox online per sviluppatori",
    "tagline": "Elaborazione prima locale; i dati rimangono nel browser (CSP, zero uscita) · Premi <1>⌘K</1> o <3>/</3> per cercare",
    "favorites": "Preferiti",
    "recent": "Usati di recente",
    "favoriteAria": "Aggiungi ai preferiti",
    "unfavoriteAria": "Rimuovi dai preferiti"
  },
  "search": {
    "aria": "Cerca strumenti",
    "placeholder": "Strumenti di ricerca (nome / parole chiave)...",
    "empty": "Nessuno strumento corrispondente trovato"
  },
  "categories": {
    "encoding": "Codifica",
    "text": "Testo",
    "formatting": "Formattazione",
    "crypto": "Crittografia e hash",
    "datetime": "Data e ora",
    "generator": "Generatori",
    "network": "Rete",
    "image": "Immagini",
    "pdf": "PDF",
    "other": "Altro"
  },
  "common": {
    "copy": "Copia",
    "copied": "Copiato",
    "clear": "Cancella",
    "swap": "Scambia",
    "download": "Scarica",
    "share": "Condividi",
    "shareTooLong": "Contenuto troppo lungo (> 2KB), impossibile creare link di condivisione",
    "retry": "Riprova",
    "loading": "Caricamento",
    "operation": "Azione",
    "encode": "Codifica",
    "decode": "Decodifica",
    "result": "Risultato",
    "rawText": "Testo grezzo",
    "input": "Input",
    "output": "Output",
    "text": "Testo",
    "file": "File",
    "remove": "Rimuovi",
    "bytes": "{{size}} byte"
  },
  "io": {
    "stats": "{{chars}} caratteri / {{bytes}} byte",
    "warnLarge": "Ingresso di grandi dimensioni (> 500 KB), il calcolo in tempo reale potrebbe rallentare",
    "overflow": "L'input supera il limite di 5 MB; utilizzare la modalità file per contenuti di grandi dimensioni"
  },
  "file": {
    "hint": "Rilascia qui I file o fa clic per scegliere",
    "max": "Max {{size}}",
    "over": "File exceeds the {{max}} limit (current {{size}})",
    "uploadAria": "Carica file",
    "previewAlt": "Anteprima di {{name}}",
    "pages": "{{n}} pagine",
    "encrypted": "Crittografato"
  },
  "pdf": {
    "password": "Password 0***",
    "passwordPlaceholder": "È necessario specificare una password per l'accesso all'account email.",
    "passwordHint": "Questo PDF è crittografato. Inserisci la password per continuare.",
    "unlock": "Sblocca",
    "errors": {
      "NEED_PASSWORD": "Questo PDF è crittografato. Inserisci la password.",
      "WRONG_PASSWORD": "Password sbagliata. Prova di nuovo"
    }
  },
  "tool": {
    "errorTitle": "Run-time",
    "localBadge": "Solo locale",
    "serverBadge": "Ha bisogno di un server",
    "related": "Strumenti correlati",
    "nextSteps": "Prossimi passi",
    "openIn": "Apri in {{name}}",
    "progress": "Avanzamento {{current}} / {{total}}"
  },
  "notFound": {
    "message": "Pagina o strumento non trovato",
    "back": "Indietro alla home page"
  },
  "toolsMeta": {
    "base64": {
      "name": "Codifica / Decodifica Base64",
      "description": "Converti testo e Base64 con codifica Unicode-safe; supportati URL Safe e modalità file"
    },
    "url-codec": {
      "name": "Codifica / Decodifica URL",
      "description": "Modalità encodeURIComponent / encodeURI con rilevamento di percent-encoding non valido"
    },
    "regex-tester": {
      "name": "Strumento Regex",
      "description": "Evidenziazione corrispondenze, sostituzione, gruppi di cattura, preset e cheat sheet"
    },
    "text-diff": {
      "name": "Diff testo",
      "description": "Editor affiancati con evidenziazione inline, numeri di riga e ignore spazi"
    },
    "json-format": {
      "name": "Formattatore JSON",
      "description": "Formatta / minimizza / valida con indentazione a 2/4 spazi e errori riga/colonna"
    },
    "json-convert": {
      "name": "Convertitore JSON",
      "description": "Analizza JSON e convertilo in YAML / XML / CSV"
    },
    "timestamp": {
      "name": "Convertitore timestamp",
      "description": "Unix ⇄ ora leggibile con rilevamento auto secondi/ms e orologio live"
    },
    "uuid": {
      "name": "Generatore UUID",
      "description": "UUID v4 casuali / v7 ordinati nel tempo con output batch e opzioni di formato"
    },
    "hash": {
      "name": "Calcolatore hash",
      "description": "MD5 / SHA-1 / SHA-256 / SHA-512 per testo e file (streaming), output hex / base64"
    },
    "jwt-parser": {
      "name": "Parser JWT",
      "description": "Analizza header / payload / signature e leggi exp e altri claim temporali (sola lettura, senza verify)"
    },
    "aes-crypto": {
      "name": "Cifra / Decifra AES",
      "description": "AES-GCM con passphrase PBKDF2 o chiave raw; output base64(salt|iv|ciphertext)"
    },
    "hmac": {
      "name": "HMAC",
      "description": "HMAC-SHA256 / SHA512 con output hex / base64"
    },
    "totp": {
      "name": "TOTP",
      "description": "TOTP RFC 6238: genera / verifica, 6/8 cifre, secondi rimanenti"
    },
    "x509-decode": {
      "name": "Decoder certificati X.509",
      "description": "Analizza PEM: fingerprint SHA-256/SHA-1, tipo, lunghezza DER, CN"
    },
    "cidr-calc": {
      "name": "Calcolatore CIDR",
      "description": "CIDR IPv4: rete / broadcast / intervallo host / maschera / n. host"
    },
    "text-lines": {
      "name": "Strumenti righe di testo",
      "description": "Ordina / unici / inverti / numera / rimuovi righe vuote"
    },
    "hex-codec": {
      "name": "Codifica / Decodifica hex",
      "description": "Hex ↔ testo UTF-8 con spazi opzionali"
    },
    "url-query": {
      "name": "Parser query URL",
      "description": "Analizza parti URL e parametri query; ricostruisci dopo le modifiche"
    },
    "json-path": {
      "name": "Query JSONPath",
      "description": "Query di percorso semplici come a.b[0].c"
    },
    "gzip-tool": {
      "name": "Compressione Gzip",
      "description": "Comprimi testo in base64 con Gzip / decomprimi di nuovo in testo"
    },
    "exif-strip": {
      "name": "Rimuovi EXIF",
      "description": "Leggi EXIF JPEG di base e rimuovi APP1; scarica il file pulito"
    },
    "fake-data": {
      "name": "Generatore dati fittizi",
      "description": "Genera nomi / email / UUID / lorem in zh/en, 1–50 elementi"
    },
    "password-gen": {
      "name": "Generatore password",
      "description": "Password casuali forti con opzioni lunghezza / charset, stima entropia e livello"
    },
    "entity-codec": {
      "name": "Codifica / Decodifica HTML",
      "description": "Codifica/decodifica caratteri speciali HTML: named / decimal / hex / escape \\u"
    },
    "cron-parser": {
      "name": "Parser espressioni Cron",
      "description": "Valida espressioni cron, spiega i campi e anteprima delle prossime esecuzioni"
    },
    "convert-data": {
      "name": "Convertitore formati dati di config",
      "description": "Converti YAML ⇄ JSON ⇄ TOML tramite un valore JS intermedio senza perdite"
    },
    "sql-format": {
      "name": "Formattatore SQL",
      "description": "Abbellisci SQL su più dialetti con indentazione e case parole chiave configurabili"
    },
    "html-format": {
      "name": "Minify / Beautify HTML",
      "description": "Minimizza e abbellisci HTML con indentazione a 2/4 spazi"
    },
    "js-format": {
      "name": "Minify / Beautify JS",
      "description": "Minimizza e abbellisci JavaScript con indentazione a 2/4 spazi"
    },
    "css-format": {
      "name": "Minify / Beautify CSS",
      "description": "Minimizza e abbellisci CSS con indentazione a 2/4 spazi"
    },
    "xml-format": {
      "name": "Minify / Beautify XML",
      "description": "Abbellisci e minimizza XML con indentazione a 2/4 spazi; CDATA preservato"
    },
    "xml-json": {
      "name": "XML a JSON",
      "description": "Analizza XML in JSON, mantenendo gli attributi con prefisso @_"
    },
    "qrcode": {
      "name": "Codice QR",
      "description": "Genera e decodifica codici QR con ECC, dimensione, colori e margine"
    },
    "color-converter": {
      "name": "Convertitore colori",
      "description": "Converti e anteprima formati HEX / RGB / HSL"
    },
    "radix-converter": {
      "name": "Convertitore di basi",
      "description": "Converti basi 2/8/10/16 e visualizza ops bitwise per interi signed a 64 bit"
    },
    "markdown-preview": {
      "name": "Anteprima Markdown",
      "description": "Rendering GFM live con sanitizzazione DOMPurify per anteprima sicura"
    },
    "image-compress": {
      "name": "Comprimi immagine",
      "description": "Compressione e conversione immagini lato client (PNG / JPEG / WebP) con resize e qualità"
    },
    "unicode-codec": {
      "name": "Codec Unicode",
      "description": "Converti testo da/a \\uXXXX, code point, entità HTML e byte UTF-8"
    },
    "html-color-picker": {
      "name": "Selettore colore HTML",
      "description": "Scegli colori visivamente ed esporta HEX / RGB / HSL più snippet HTML/CSS"
    },
    "web-color-table": {
      "name": "Tabella colori web",
      "description": "Colori CSS con nome, filtri per gruppo e copia nome / HEX / RGB"
    },
    "pinyin": {
      "name": "Cinese a pinyin",
      "description": "Converti cinese in pinyin con toni, separatore e case opzionali"
    },
    "length-converter": {
      "name": "Convertitore lunghezze",
      "description": "Converti unità di lunghezza metriche e imperiali (mm, cm, m, km, in, ft e altro)"
    },
    "zh-convert": {
      "name": "Convertitore cinese tradizionale",
      "description": "Converti tra cinese semplificato e tradizionale"
    },
    "weight-converter": {
      "name": "Convertitore pesi",
      "description": "Converti unità di peso metriche e imperiali (mg, g, kg, t, oz, lb, st)"
    },
    "text-counter": {
      "name": "Contatore testo",
      "description": "Conta caratteri, parole, righe, paragrafi, caratteri CJK e byte UTF-8"
    },
    "calendar": {
      "name": "Calendario",
      "description": "Vista mensile con lunare/almanacco per il cinese e festività locali per l'inglese"
    },
    "css-button": {
      "name": "Generatore pulsanti CSS",
      "description": "Regola gli stili visivamente e genera CSS / HTML del pulsante"
    },
    "random-number": {
      "name": "Generatore numeri casuali",
      "description": "Genera interi o decimali casuali in un intervallo, con valori unici opzionali"
    },
    "random-string": {
      "name": "Generatore stringhe casuali",
      "description": "Genera stringhe casuali per lunghezza e charset (alnum / hex / personalizzato)"
    },
    "doodle-board": {
      "name": "Lavagna doodle",
      "description": "Blocco disegno nel browser con pennello, gomma ed export PNG"
    },
    "calculator": {
      "name": "Calcolatrice",
      "description": "Calcolatrice di espressioni sicura con aritmetica, potenze, modulo e funzioni comuni"
    },
    "code-image": {
      "name": "Codice a immagine",
      "description": "Renderizza codice come card con syntax highlighting ed esporta PNG"
    },
    "image-color-picker": {
      "name": "Selettore colore da immagine",
      "description": "Carica un'immagine e clicca un pixel per campionare HEX / RGB"
    },
    "ascii-table": {
      "name": "Tabella ASCII",
      "description": "Riferimento ASCII 0–127 con ricerca per decimale, hex o carattere"
    },
    "image-watermark": {
      "name": "Filigrana immagine",
      "description": "Aggiungi filigrana di testo con posizione, opacità, rotazione e tiling"
    },
    "case-convert": {
      "name": "Convertitore maiuscole/minuscole",
      "description": "Converti case e stili di naming (camel / snake / kebab, ecc.)"
    },
    "bmi-calculator": {
      "name": "Calcolatore BMI",
      "description": "Calcola il BMI da altezza e peso con categorie WHO per adulti"
    },
    "placeholder-image": {
      "name": "Immagine placeholder",
      "description": "Genera un PNG placeholder per dimensione, colori e testo opzionale"
    },
    "image-merge": {
      "name": "Unisci immagini",
      "description": "Unisci immagini in orizzontale, verticale o griglia in un PNG"
    },
    "cron-generator": {
      "name": "Generatore Crontab",
      "description": "Crea un'espressione Cron standard a 5 campi da minuto/ora/giorno/mese/giorno settimana"
    },
    "ua-parser": {
      "name": "Parser User-Agent",
      "description": "Analizza un User-Agent del browser in browser, engine, OS e dispositivo"
    },
    "latex-editor": {
      "name": "Editor matematica LaTeX",
      "description": "Simboli rapidi e formule classiche, anteprima KaTeX, export PNG/JPG/SVG"
    },
    "countdown": {
      "name": "Timer conto alla rovescia",
      "description": "Imposta ore, minuti e secondi; pausa, ripresa e avviso a fine"
    },
    "stopwatch": {
      "name": "Cronometro",
      "description": "Cronometro online con avvio, pausa, giro e reset"
    },
    "svg-to-png": {
      "name": "SVG a PNG",
      "description": "Converti markup o file SVG in PNG con scala e trasparenza"
    },
    "image-frame": {
      "name": "Bordo / raggio / ombra immagine",
      "description": "Aggiungi bordo, angoli arrotondati e ombra, poi esporta PNG"
    },
    "image-adjust": {
      "name": "Regola colori immagine",
      "description": "Regola luminosità, contrasto, saturazione e tonalità, poi esporta PNG"
    },
    "gif-frames": {
      "name": "Estrattore frame GIF",
      "description": "Dividi un GIF in frame PNG; scarica uno o tutti"
    },
    "image-crop": {
      "name": "Ritaglia immagine",
      "description": "Ritaglia immagini a mano libera o con rapporti fissi in PNG"
    },
    "mbti-test": {
      "name": "Test personalità MBTI",
      "description": "Breve quiz stile MBTI a 24 domande (solo intrattenimento)"
    },
    "text-card": {
      "name": "Testo a card",
      "description": "Impagina titolo e corpo in una card stilizzata ed esporta PNG"
    },
    "image-card": {
      "name": "Immagine a card",
      "description": "Card foto + titolo/sottotitolo con sfondi o gradienti, export PNG"
    },
    "code-highlight": {
      "name": "Syntax highlighter",
      "description": "Evidenziazione sintassi live con numeri di riga e copia snippet HTML"
    },
    "image-base64": {
      "name": "Immagine ↔ Base64",
      "description": "Converti immagini in Base64 / Data URL e viceversa, interamente in locale"
    },
    "image-ico": {
      "name": "Convertitore ICO",
      "description": "Converti immagini in ICO multi-size (favicon), o estrai PNG da ICO"
    },
    "hsv-cmyk": {
      "name": "Convertitore HSV / CMYK",
      "description": "Converti e anteprima spazi RGB, HSV, CMYK e HEX"
    },
    "ai-prompts": {
      "name": "Libreria prompt IA",
      "description": "Prompt curati per categoria con ricerca e copia in un clic"
    },
    "md-mindmap": {
      "name": "Mappa mentale Markdown",
      "description": "Trasforma Markdown in mappa mentale con temi, zoom ed export PNG/SVG"
    },
    "mermaid-editor": {
      "name": "Editor diagrammi Mermaid",
      "description": "Renderizza Mermaid in locale con temi, zoom ed export PNG/SVG"
    },
    "css-gradient": {
      "name": "Generatore gradienti CSS",
      "description": "Modifica gradienti lineari / radiali con preset categorizzati e copia CSS"
    },
    "image-to-paper": {
      "name": "Immagine a PDF carta",
      "description": "Adatta immagini a A3/A4/A5/Letter ed esporta PDF"
    },
    "md-to-image": {
      "name": "Markdown a immagine",
      "description": "Renderizza Markdown in una card stilizzata ed esporta PNG con font, size, larghezza e colori"
    },
    "chart-generator": {
      "name": "Generatore grafici",
      "description": "Crea grafici barre/linee/aree/torta/ciambella/scatter da CSV con legende e palette"
    },
    "css3-generator": {
      "name": "Generatore codice CSS3",
      "description": "Genera border-radius, ombre, transform, filter e altro"
    },
    "xslt-transform": {
      "name": "Trasformazione XSLT",
      "description": "Trasforma XML in HTML con XSLT nel browser"
    },
    "pdf-merge": {
      "name": "Unisci PDF",
      "description": "Unisci più PDF in un unico file"
    },
    "pdf-split": {
      "name": "Dividi PDF",
      "description": "Dividi un PDF in un file per pagina"
    },
    "pdf-delete-pages": {
      "name": "Elimina pagine PDF",
      "description": "Rimuovi le pagine selezionate da un PDF"
    },
    "pdf-extract-pages": {
      "name": "Estrai pagine PDF",
      "description": "Estrai le pagine selezionate in un nuovo PDF"
    },
    "pdf-reorder": {
      "name": "Riordina pagine PDF",
      "description": "Riordina le pagine di un PDF"
    },
    "pdf-rotate": {
      "name": "Ruota pagine PDF",
      "description": "Ruota le pagine selezionate o tutte"
    },
    "pdf-to-image": {
      "name": "PDF a immagine",
      "description": "Renderizza pagine PDF come JPG/PNG"
    },
    "images-to-pdf": {
      "name": "Immagini a PDF",
      "description": "Combina immagini in un PDF"
    },
    "pdf-viewer": {
      "name": "Visualizzatore PDF",
      "description": "Apri e leggi un PDF in locale"
    },
    "pdf-page-numbers": {
      "name": "Numeri di pagina PDF",
      "description": "Aggiungi numeri di pagina a un PDF"
    },
    "pdf-header-footer": {
      "name": "Intestazione e piè PDF",
      "description": "Aggiungi testo di intestazione e piè di pagina"
    },
    "pdf-insert-image": {
      "name": "Inserisci immagine nel PDF",
      "description": "Posiziona un'immagine sulle pagine PDF"
    },
    "pdf-add-text": {
      "name": "Aggiungi testo al PDF",
      "description": "Aggiungi testo sulle pagine PDF"
    },
    "pdf-sign": {
      "name": "Firma PDF",
      "description": "Disegna o carica un'immagine firma (visiva, non certificato)"
    },
    "pdf-metadata": {
      "name": "Metadati PDF",
      "description": "Visualizza e modifica i metadati PDF"
    },
    "pdf-encrypt": {
      "name": "Cifra PDF",
      "description": "Imposta password e flag di permessi"
    },
    "pdf-crop": {
      "name": "Ritaglia PDF",
      "description": "Ritaglia i margini pagina tramite cropBox"
    },
    "pdf-grayscale": {
      "name": "PDF in scala di grigi",
      "description": "Converti PDF in scala di grigi visuale"
    },
    "pdf-annotate": {
      "name": "Annota PDF",
      "description": "Disegna evidenziazioni, a mano libera, forme e testo sulle pagine PDF"
    }
  },
  "tools": {
    "base64": {
      "direction": {
        "encode": "Encode (testo → Base64)",
        "decode": "Decodifica (Base64 → testo)"
      },
      "urlSafe": "URL Sicuro (- _ senza imbottitura)",
      "labels": {
        "rawText": "Testo grezzo",
        "base64Input": "Ingresso 0",
        "base64Result": "Base64 risultato",
        "decodeResult": "Risultato decodificato"
      },
      "placeholders": {
        "encode": "Inserisci il testo da codificare...",
        "decode": "Paste a Base64 string…"
      },
      "fileNote": "Visualizzazione di un file Base64 risultato; la digitazione del testo lo cancellerà.",
      "fileMode": "Modalità file: file → Base64 (blocchi ArrayBuffer)",
      "err": {
        "INVALID_PADDING": "Padding non valido \"=\" in posizione {{position}}",
        "INVALID_CHAR": "Carattere \" {{char}} \" non valido nella posizione {{position}}",
        "INVALID_LENGTH": "Invalid length: Base64 content length mod 4 cannot be 1",
        "DECODE_FAILED": "Decode failed: not valid Base64 input"
      }
    },
    "url": {
      "modes": {
        "component": "componente (valore param, codifica caratteri riservati)",
        "full": "Full URL (keeps : / ? & etc.)"
      },
      "mode": "Modalità",
      "labels": {
        "rawText": "Testo grezzo",
        "encodedText": "Testo codificato"
      },
      "placeholders": {
        "encode": "Inserisci il contenuto da codificare...",
        "decode": "Incolla contenuto codificato in percentuale..."
      },
      "err": {
        "ENCODE_FAILED": "Codifica non riuscita: l'input contiene caratteri surrogati non accoppiati",
        "DECODE_FAILED": "Decodifica non riuscita: codifica percentuale non corretta"
      }
    },
    "regex": {
      "presets": "Preimpostazioni",
      "presetPlaceholder": "Scegli di compilare...",
      "expression": "Pattern",
      "expressionPlaceholder": "ad es. \\d+",
      "flags": "Flag",
      "testText": "Testo di prova",
      "testTextPlaceholder": "Incolla il testo per abbinarlo...",
      "matchCount": "{{count}} match(es)",
      "truncated": "(troncato, mostra i primi 1000)",
      "position": "Indice",
      "matchContent": "Match",
      "captureGroups": "Gruppi",
      "emptyMatch": "(corrispondenza vuota)",
      "tableLimit": "Showing first {{count}} rows only",
      "mode": "Modalità",
      "modes": {
        "match": "Match",
        "replace": "Sostituisci"
      },
      "replacement": "Sostituisci con",
      "replacementPlaceholder": "Supporta $1, $&,...",
      "replaceResult": "Sostituisci risultato",
      "cheatSheet": "Cheat sheet (clicca per inserire)",
      "cheat": {
        "dot": "Qualsiasi carattere",
        "digit": "Cifra",
        "word": "Word char",
        "space": "Spazio vuoto",
        "start": "Inizio riga",
        "end": "Fine della riga",
        "star": "0 o più",
        "plus": "1",
        "question": "0 o 1",
        "or": "Alternanza",
        "group": "Gruppo di acquisizione",
        "class": "una classe di caratteri",
        "range": "Intervallo",
        "not": "Classe negata"
      },
      "presetsList": {
        "email": "E-mail",
        "phoneCn": "Telefono (Cina continentale)",
        "idCard": "Carta d'identità (18 cifre)",
        "url": "URL",
        "ipv4": "Indirizzo 0",
        "date": "Data (AAAA-MM-GG)"
      },
      "err": {
        "EMPTY": "L'espressione regolare non può essere vuota",
        "COMPILE": "Compilazione non riuscita: {{message}}",
        "TEXT_TOO_LONG": "Il testo supera il limite di {{limit}} K caratteri; corrispondenza interrotta (ReDoS/protezione a lungo termine)"
      }
    },
    "textDiff": {
      "oldText": "Originale",
      "newText": "Revisionato",
      "swapSides": "Inverti lati",
      "stats": "+{{added}} added / −{{removed}} removed / {{same}} unchanged",
      "identical": "Entrambi i testi sono identici",
      "renderLimit": "Too many diff rows; rendering first {{count}} only",
      "ignoreWhitespace": "Ignora spazi finali / ripetuti",
      "err": {
        "TOO_LARGE": "Il testo combinato supera il limite di {{limit}} K caratteri; diff interrotto (protezione a lungo termine)"
      }
    },
    "json": {
      "actions": {
        "format": "Formato",
        "compress": "Minify",
        "validate": "Solo convalida"
      },
      "indent": "Rientro",
      "indent2": "2 spazi",
      "indent4": "4 spazi",
      "inputLabel": "Ingresso 0",
      "validateResult": "Risultato convalida",
      "inputPlaceholder": "Incolla JSON, ad esempio {\"a\": 1}...",
      "valid": "✓ Valido JSON",
      "err": {
        "EMPTY": "JSON analisi non riuscita: l'input è vuoto",
        "UNKNOWN": "JSON analisi non riuscita: errore sconosciuto",
        "INVALID_LITERAL": "JSON analisi non riuscita: letterale previsto \" {{literal}} \" (riga {{line}} , colonna {{column}} )",
        "NEWLINE_IN_STRING": "JSON analisi non riuscita: la stringa non può estendersi sulle righe (riga {{line}} , colonna {{column}} )",
        "UNEXPECTED_STRING_END": "JSON analisi non riuscita: stringa terminata inaspettatamente (riga {{line}} , colonna {{column}} )",
        "INVALID_UNICODE_ESCAPE": "JSON analisi non riuscita: escape non valido \\u, sono necessarie 4 cifre esadecimali (riga {{line}} , colonna {{column}} )",
        "INVALID_ESCAPE": "JSON analisi non riuscita: escape non valido \"\\ {{char}} \" (riga {{line}} , colonna {{column}} )",
        "INVALID_NUMBER": "JSON analisi non riuscita: numero non valido (riga {{line}} , colonna {{column}} )",
        "DECIMAL_NO_DIGITS": "JSON analisi non riuscita: cifre richieste dopo la virgola decimale (riga {{line}} , colonna {{column}} )",
        "EXPONENT_NO_DIGITS": "JSON analisi non riuscita: cifre richieste nell'esponente (riga {{line}} , colonna {{column}} )",
        "UNEXPECTED_END": "JSON analisi non riuscita: fine imprevista, valore mancante (riga {{line}} , colonna {{column}} )",
        "INVALID_CHAR": "JSON analisi non riuscita: carattere \" {{char}} \" non valido (riga {{line}} , colonna {{column}} )",
        "TRAILING_COMMA": "JSON analisi non riuscita: virgola finale non consentita (riga {{line}} , colonna {{column}} )",
        "KEY_MUST_BE_STRING": "JSON analisi non riuscita: la chiave dell'oggetto deve essere una stringa (riga {{line}} , colonna {{column}} )",
        "MISSING_COLON": "JSON analisi non riuscita: manca \":\" dopo la chiave dell'oggetto (riga {{line}} , colonna {{column}} )",
        "MISSING_VALUE": "JSON analisi non riuscita: valore mancante (riga {{line}} , colonna {{column}} )",
        "UNCLOSED_OBJECT": "JSON analisi non riuscita: oggetto non chiuso, \"}\" mancante (riga {{line}} , colonna {{column}} )",
        "MISSING_COMMA_OBJECT": "JSON analisi non riuscita: manca \",\" tra i membri dell'oggetto (riga {{line}} , colonna {{column}} )",
        "UNCLOSED_ARRAY": "JSON analisi non riuscita: matrice non chiusa, manca \"]\" (riga {{line}} , colonna {{column}} )",
        "MISSING_COMMA_ARRAY": "JSON analisi non riuscita: manca \",\" tra gli elementi dell'array (riga {{line}} , colonna {{column}} )",
        "EXTRA_CONTENT": "JSON analisi non riuscita: contenuto extra dopo il valore (riga {{line}} , colonna {{column}} )",
        "UNCLOSED_STRING": "JSON analisi non riuscita: stringa non chiusa (riga {{line}} , colonna {{column}} )"
      }
    },
    "timestamp": {
      "currentTime": "Ora corrente",
      "pauseTick": "Metti in pausa l'orologio",
      "resumeTick": "Riattiva orologio",
      "second": "Secondi",
      "millisecond": "Millisecondi",
      "localPrefix": "Locale: {{local}} · {{utc}}",
      "tsToReadable": "Timestamp tempo → leggibile (rilevamento automatico secondi / ms)",
      "fillCurrentSec": "Corrente di riempimento (secondi)",
      "tsInput": "Inserimento marca temporale",
      "tsPlaceholder": "es. 1725000000 o 1725000000000",
      "localTime": "Ora locale",
      "relative": "Relativo (rilevato come {{unit}} )",
      "unitSeconds": " secondi",
      "unitMilliseconds": "millisecondi",
      "dateToTs": "→ Timestamp leggibile (lo spazio separato utilizza il fuso orario locale)",
      "dateInput": "Inserimento data/ora",
      "datePlaceholder": "es. 2026-09-01 12:00:00 o 2026-09-01T04:00:00Z",
      "relativeAgo": "{{count}} {{unit}} fa",
      "relativeLater": "{{count}} {{unit}} da adesso",
      "units": {
        "second": " secondi",
        "minute": "minuti",
        "hour": "ore",
        "day": "giorni",
        "year": "anni"
      },
      "err": {
        "NOT_NUMERIC": "La marca temporale deve essere numerica (consentita negativa)",
        "OUT_OF_RANGE": "Timestamp fuori dall'intervallo numerico",
        "TS_TOO_LARGE": "Timestamp fuori intervallo rappresentabile (±275760 anni)",
        "DATE_EMPTY": "Inserisci una data",
        "DATE_INVALID": "Impossibile analizzare data/ora (ad es. 2026-09-01 12:00:00 o ISO 8601)"
      }
    },
    "uuid": {
      "version": "Versione",
      "versions": {
        "v4": "v4 (random)",
        "v7": "v7 (time-ordered)"
      },
      "count": "Conteggio",
      "uppercase": "Maiuscolo",
      "hyphens": "Sillabazioni",
      "braces": "Bretelle",
      "generate": "Genera",
      "output": "Generato (uno per riga)",
      "err": {
        "INVALID_COUNT": "Il conteggio deve essere un numero intero ≥ 1",
        "TOO_MANY": "Massimo {{max}} UUID per lotto"
      }
    },
    "hash": {
      "algorithm": "Algoritmo",
      "encoding": "Output",
      "encodings": {
        "hex": "esadecimale",
        "base64": "Base64"
      },
      "source": "Sorgente/ fonte",
      "textInput": "Input di testo",
      "textPlaceholder": "Inserisci il testo da hash...",
      "result": "{{algorithm}} risultato",
      "computing": "Informatica",
      "fileHint": "Trascina e rilascia un file qui o fai clic per scegliere (MD5 flussi; i file di grandi dimensioni rimangono sicuri per la memoria)",
      "limitHint": "Note: non-MD5 algorithms load the whole file into memory; very large files may run out of memory",
      "err": {
        "UNSUPPORTED": "Hash non riuscito: algoritmo non supportato in questo ambiente",
        "FILE_HASH": "Hash del file non riuscito: {{message}}",
        "FILE_READ": "Impossibile leggere i contenuti del file!"
      }
    },
    "jwt": {
      "mode": "Modalità",
      "modes": {
        "parse": "Analizza",
        "sign": "Cartello (HS256)"
      },
      "secretPlaceholder": "Segreto",
      "payloadJson": "Carico utile",
      "payloadPlaceholder": "{ \"sub\": \"123\", \"name\": \"Alice\" }",
      "signedToken": "Token firmato",
      "signNote": "Segni con HS256 nel browser; il segreto non lascia mai il dispositivo",
      "inputLabel": "Ingresso 0",
      "inputPlaceholder": "Incolla uno JWT (prefisso del portatore supportato), ad es. eyJhbGci...",
      "header": "Intestazione",
      "payload": "Carico utile",
      "signature": "Firma",
      "note": "Solo analisi, nessuna verifica della firma: la verifica richiede una chiave; tutte le elaborazioni rimangono nel browser",
      "alg": "Algoritmo",
      "expired": "scaduta",
      "notExpired": "Non scaduto",
      "claims": {
        "exp": "Scadenza EXP",
        "nbf": "Non prima",
        "iat": "Emesso a"
      },
      "err": {
        "EMPTY": "Incollare uno JWT",
        "INVALID_PARTS": "Formato non valido: uno JWT è costituito da header.payload.signature",
        "INVALID_HEADER": "Failed to parse header: not valid base64url-encoded JSON",
        "INVALID_PAYLOAD": "Failed to parse payload: not valid base64url-encoded JSON",
        "SIGN_FAILED": "Firma non riuscita"
      }
    },
    "aes-crypto": {
      "encrypt": "Criptare",
      "decrypt": "Decifra",
      "keyMode": "Modalità chiave",
      "passphrase": "Passphrase (PBKDF2)",
      "rawKey": "Chiave grezza (esadecimale)",
      "passphrasePlaceholder": "Inserire la passphrase",
      "keyHexPlaceholder": "32 o 64 caratteri esadecimali (AES-128/256)...",
      "ivPlaceholder": "Facoltativo IV (24 caratteri esadecimali/ 12 byte); casuale se vuoto",
      "plaintext": "Plaintext",
      "ciphertext": "Testo cifrato (base64)",
      "inputPlaceholder": "Immettere contenuto.",
      "note": "Crittografare l'output: base64(salt|iv|ciphertext+tag); la passphrase utilizza PBKDF2-SHA256",
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "INVALID_KEY": "Chiave non valida: controlla la passphrase o la lunghezza della chiave esadecimale",
        "DECRYPT_FAILED": "Decrittografia non riuscita: chiave errata o dati danneggiati",
        "INVALID_INPUT": "Input non valido: testo cifrato errato o IV"
      }
    },
    "hmac": {
      "algorithm": "Algoritmo",
      "encoding": "Output",
      "secretPlaceholder": "Segreto",
      "message": "Messaggio",
      "messagePlaceholder": "Messaggio da autenticare...",
      "err": {
        "EMPTY": "Inserisci un messaggio",
        "INVALID_KEY": "Inserire un codice valido"
      }
    },
    "totp": {
      "digits": "Ignora",
      "secret": "Base32 Secret",
      "secretPlaceholder": "Incolla Authenticator secret (Base32)...",
      "code": "Codice in vigore",
      "remaining": "secondi rimasti",
      "verify": "Codice di verifica (facoltativo)",
      "verifyPlaceholder": "Inserisci il codice a 6 cifre",
      "verifyOk": "Verifica effettuata",
      "verifyFail": "Verifica non riuscita",
      "err": {
        "EMPTY": "Inserisci la chiave segreta",
        "INVALID_SECRET": "Il segreto non è valido Base32"
      }
    },
    "cidr-calc": {
      "input": "CIDR",
      "placeholder": "ad es .: 192.168.1.0/24",
      "fields": {
        "network": "Rete",
        "broadcast": "Trasmetti",
        "firstHost": "Primo host",
        "lastHost": "Ultimo host",
        "netmask": "子网掩码",
        "wildcard": "Jolly",
        "prefix": "Prefisso",
        "hostCount": "Conteggio degli host",
        "totalAddresses": "Totale indirizzi IP"
      },
      "err": {
        "EMPTY": "Per favore inserisci un",
        "INVALID": "CIDR (IPv4/prefisso non valido, ad es. 10.0.0.0/8)"
      }
    },
    "text-lines": {
      "placeholder": "Un articolo per riga...",
      "ops": {
        "sort-asc": "Crescente",
        "sort-desc": "Decrescente",
        "unique": "Unico",
        "reverse": "Retromarcia",
        "number": "Numero righe",
        "trim-empty": "Taglia righe vuote"
      },
      "err": {
        "EMPTY": "Si prega di inserire il testo"
      }
    },
    "hex-codec": {
      "spaced": "Byte separati da spazi",
      "placeholder": "Testo o esadecimale...",
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "INVALID_HEX": "Hex non valido (lunghezza pari, 0-9a-f)"
      }
    },
    "url-query": {
      "input": "URL",
      "placeholder": "https://example.com/path?a=1&b=2",
      "addParam": "Aggiungi parametro",
      "key": "Legenda",
      "value": "Valore",
      "rebuilt": "Ricostruito",
      "parts": {
        "protocol": "Protocollo",
        "hostname": "Host",
        "port": "Porta",
        "pathname": "Percorso",
        "hash": "Hash",
        "origin": "Provenienza"
      },
      "err": {
        "EMPTY": "Per favore inserisci un",
        "INVALID_URL": "{0} non valido.&#x0D;"
      }
    },
    "json-path": {
      "pathPlaceholder": "Percorso, ad esempio a.b[0].c o $.a.b[0]",
      "json": "JSON",
      "jsonPlaceholder": "Incolla",
      "err": {
        "EMPTY": "Inserisci JSON e un percorso",
        "INVALID_JSON": "Parse fallito!",
        "NOT_FOUND": "Impossibile trovare il percorso"
      }
    },
    "gzip-tool": {
      "compress": "Comprimi (testo → base64)",
      "decompress": "Decomprimi (→testo base64)",
      "placeholder": "Testo o gzip base64...",
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "INVALID": "Input non valido",
        "DECOMPRESS_FAILED": "Decompressione non riuscita: dati gzip non validi"
      }
    },
    "x509-decode": {
      "input": "Certificato PEM",
      "placeholder": "-----CERTIFICATO BEGINE-----\n…\n-----CERTIFICATO END-----",
      "fields": {
        "pemType": "Type",
        "derLength": "DER LENGTH",
        "sha256": "SHA-256",
        "sha1": "SHA-1",
        "subject": "Soggetto CN",
        "issuer": "CN emittente"
      },
      "err": {
        "EMPTY": "Si prega di incollare PEM",
        "INVALID_PEM": "PEM non valido"
      }
    },
    "exif-strip": {
      "hint": "JPEG only: strip APP1 (EXIF) and download.",
      "drop": "Drop a JPEG image",
      "hasExif": "Ha EXIF",
      "orientation": "Orientamento",
      "make": "Marca fotocamera",
      "yes": "Sì",
      "no": "No",
      "download": "Scarica il file rimosso",
      "err": {
        "EMPTY": "Per favore scegli un file",
        "UNSUPPORTED": "solo 0",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "fake-data": {
      "kind": "Tipo",
      "locale": "Impostazioni locali",
      "count": "Conteggio",
      "generate": "Genera",
      "kinds": {
        "name": "Nome",
        "email": "E-mail",
        "uuid": "UUID",
        "lorem": "Paragrafo"
      },
      "err": {
        "EMPTY": "Completa le opzioni",
        "INVALID_COUNT": "Il conteggio deve essere un numero intero compreso tra 1 e 50"
      }
    },
    "password": {
      "length": "Lung.",
      "generate": "Genera",
      "lowercase": "Minuscole (a-z)",
      "uppercase": "Lettere maiuscole dalla A alla Z",
      "digits": "Cifre (0-9)",
      "symbols": "Simbologia",
      "excludeAmbiguous": "Escludi caratteri ambigui (0 O 1 l I ecc.)",
      "ensureEach": "Includi almeno un carattere da ciascun set selezionato",
      "output": "Risultato",
      "outputPlaceholder": "Fai clic su \"Genera\" per creare una password",
      "entropy": "Entropia ≈ {{bits}} bit",
      "strength": {
        "weak": "Debole",
        "medium": "Medio",
        "strong": "Forte"
      },
      "err": {
        "NO_SETS": "Seleziona almeno un set di caratteri",
        "INVALID_LENGTH": "La lunghezza deve essere compresa tra 4 e 128"
      }
    },
    "entity": {
      "direction": "Direzione",
      "encode": "Codifica",
      "decode": "Decodifica",
      "mode": "Formato",
      "modes": {
        "named": "Con nome (&amp;)",
        "decimal": "Decimale (&)",
        "hex": "Esagonale (&)",
        "unicode": "\\u escape (\\u4E2D)"
      },
      "scope": "Ambito",
      "scopes": {
        "special": "Solo caratteri speciali (&, <, > ecc.)",
        "nonascii": "Caratteri speciali + non ASCII"
      },
      "input": "Input",
      "output": "Output",
      "inputEncodePlaceholder": "Testo da codificare, ad es. <b>Ciao</b>...",
      "inputDecodePlaceholder": "Testo da decodificare, ad esempio &lt;b&gt;&#20320;&#22909;...",
      "unknown": "Entità non riconosciute (mantenute così come sono)"
    },
    "cron": {
      "expression": "Espressione",
      "placeholder": "es. */5 8-18 * * 1-5 o @daily (5 campi, 6 con secondi)",
      "count": "Conteggio",
      "normalized": "Normalizzato",
      "fieldsTitle": "Analisi dettagliata del campo",
      "colField": "Campo",
      "colValue": "Valore",
      "colMeaning": "Significato",
      "nextTitle": "Prossime {{count}} corse",
      "fieldNames": {
        "second": "Secondo",
        "minute": "Minuto",
        "hour": "Ora",
        "day": "Giorno",
        "month": "Mese",
        "week": "Giorno lavorativo"
      },
      "err": {
        "EMPTY": "Inserisci un'espressione cron",
        "INVALID": "Impossibile analizzare: controllare il conteggio dei campi (5 o 6) e gli intervalli (min 0-59 / ora 0-23 / giorno 1-31 / mese 1-12 / giorno feriale 0-7)"
      },
      "desc": {
        "every": {
          "second": "ogni attimo,",
          "minute": "ogni minuto",
          "hour": "ogni ora",
          "day": "ogni giorno",
          "month": "ogni mese",
          "week": "ogni giorno della settimana"
        },
        "step": "ogni {{n}} {{unit}}",
        "at": "{{noun}}{{values}}",
        "range": "{{noun}}{{a}}–{{b}}",
        "rangeStep": "{{noun}} {{a}} – {{b}} , ogni {{n}}",
        "units": {
          "second": " secondi",
          "minute": "minuti",
          "hour": "ore",
          "day": "giorni",
          "month": "mesi",
          "week": "giorni"
        },
        "nouns": {
          "second": "secondo",
          "minute": "minuto",
          "hour": "ora",
          "day": "giorno",
          "month": "mese ",
          "week": "giorno della settimana"
        },
        "sep": ", ",
        "days": [
          "Domenica",
          "Lunedì",
          "Martedì",
          "Mercoledì",
          "Giovedì",
          "Venerdì",
          "Sabato"
        ],
        "months": [
          "Gen",
          "Feb",
          "Mar",
          "Apr",
          "Maggio",
          "Giù",
          "Lug",
          "ago",
          "Set",
          "Ott",
          "Nov",
          "Dic"
        ]
      }
    },
    "convert": {
      "from": "Da",
      "to": "A",
      "formats": {
        "yaml": "YAML",
        "json": "JSON",
        "toml": "TOML"
      },
      "input": "Input",
      "output": "Output",
      "placeholder": "Incolla il contenuto da convertire...",
      "err": {
        "PARSE": "Impossibile analizzare l'input: controllare la sintassi",
        "STRINGIFY": "Impossibile convertire nel formato di destinazione (ad es. TOML non supporta array/scalari di primo livello)"
      }
    },
    "sql": {
      "dialect": "dialettale",
      "indent": "Rientro",
      "keywordCase": "Keyword case",
      "cases": {
        "upper": "MAIUSCOLE",
        "lower": "minuscolo",
        "preserve": "Conservare"
      },
      "languages": {
        "sql": "Generale",
        "mysql": "Mysql",
        "postgresql": "PostgreSQL",
        "sqlite": "(SQLITE).",
        "mariadb": "MariaDB",
        "transactsql": "SQL Server",
        "plsql": "PL/SQL"
      },
      "input": "Input SQL",
      "output": "Output",
      "placeholder": "Incolla SQL, ad esempio seleziona * dagli utenti dove id = 1...",
      "err": {
        "INVALID": "Impossibile analizzare questo SQL: controlla la sintassi"
      }
    },
    "html": {
      "actions": {
        "format": "Abbellisci",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 spazi",
      "indent4": "4 spazi",
      "input": "Ingresso 0",
      "placeholder": "Incolla HTML, ad es. <div><span>Ciao</span></div>…",
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "INVALID": "Elaborazione non riuscita: controlla se lo HTML è valido"
      }
    },
    "js": {
      "actions": {
        "format": "Abbellisci",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 spazi",
      "indent4": "4 spazi",
      "input": "Input JavaScript",
      "placeholder": "Incolla JS, ad es. funzione hello(){return 1}...",
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "INVALID": "Elaborazione non riuscita: controllare la sintassi"
      }
    },
    "css": {
      "actions": {
        "format": "Abbellisci",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 spazi",
      "indent4": "4 spazi",
      "input": "Ingresso 0",
      "placeholder": "Incolla CSS, ad es. .box{color:red}...",
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "INVALID": "Elaborazione non riuscita: controlla se lo CSS è valido"
      }
    },
    "qr": {
      "input": "Contenuti testuali",
      "placeholder": "Inserisci testo o URL, ad es. https://example.com...",
      "level": "Correzione dell'errore",
      "size": "Dimensioni",
      "margin": "Margine",
      "foreground": "Primo piano",
      "background": "Sfondo",
      "levels": {
        "L": "L/7",
        "M": "M 15",
        "Q": "d25",
        "H": "H : 30"
      },
      "preview": "QR code preview",
      "decodeTitle": "Decode QR code",
      "decodeHint": "Drop or choose an image containing a QR code (PNG / JPG, etc.)",
      "decodeOutput": "Risultato decodificato",
      "err": {
        "EMPTY": "Inserisci il contenuto da codificare",
        "TOO_LONG": "Content is too long for a QR code: shorten it or lower the error correction level",
        "NOT_FOUND": "No QR code found in the image",
        "DECODE": "Impossibile decodificare l'immagine",
        "LOAD": "Impossibile caricare l'immagine: assicurati che sia un file immagine valido",
        "INVALID_COLOR": "Il colore deve essere #RGB o #RRGGBB",
        "INVALID_MARGIN": "Il margine deve essere un numero intero da 0 a 10 (moduli)"
      }
    },
    "color": {
      "input": "Colore",
      "placeholder": "ad esempio # 3b82f6, rgb(59.130.246), hsl(217,91%,60%)...",
      "preview": "Anteprima colore",
      "supportHint": "Supporta HEX / RGB / HSL (inclusi stenografia e percentuali)",
      "err": {
        "EMPTY": "Inserisci un valore di colore valido.",
        "INVALID": "Impossibile analizzare: utilizzare il formato HEX, RGB o HSL"
      }
    },
    "radix": {
      "radix": "Radix",
      "auto": "Rilevamento automatico",
      "input": "Ingresso intero",
      "placeholder": "ad esempio 255, 0xff, 0b11111111, 0377...",
      "bitPattern": "schema di bit",
      "twosComplement": "complemento a due",
      "bitOps": "Operazioni bit per bit",
      "operator": "Addetto alla conduzione",
      "operandB": "Operando B",
      "opHint": "L'operando A riutilizza l'input di cui sopra; i risultati rimangono all'interno dell'intervallo di numeri interi con segno a 64 bit",
      "ops": {
        "and": "E",
        "or": "OPPURE",
        "xor": "XOR",
        "shl": "<< (shift left)",
        "shr": "Sposta a destra",
        "not": "NON"
      },
      "err": {
        "EMPTY": "Immettere un numero intero positivo.",
        "INVALID": "Impossibile analizzare: controllare il formato RADIX e numero",
        "RANGE": "Il valore è al di fuori dell'intervallo di numeri interi con segno a 64 bit (-2,3 ~2,3-1)"
      }
    },
    "markdown": {
      "gfm": "GFM (tabelle / barrato /elenchi attività)",
      "breaks": "Interruzioni riga",
      "input": "Editor ribassi",
      "placeholder": "Inserisci Markdown, ad es. # Heading...",
      "preview": "Anteprima",
      "shortcuts": "Scorciatoie: + Ctrl+B grassetto · + Ctrl+I corsivo · + Ctrl+K link · + Ctrl+E codice inline",
      "toolbar": {
        "aria": "Barra degli strumenti di modifica dei ribassi",
        "bold": "Grassetto",
        "italic": "Corsivo",
        "strike": "Barrato",
        "h1": "Intestazione 1",
        "h2": "Intestazione 2",
        "h3": "Intestazione 3",
        "h4": "Intestazione 4",
        "h5": "Intestazione 5",
        "h6": "Intestazione 6",
        "quote": "Preventivo",
        "code": "Codice inline (`)",
        "codeBlock": "Blocco di codice",
        "link": "Link",
        "image": "Immagine",
        "ul": "Elenco delle pallottole",
        "ol": "Elenco numerato",
        "hr": "Elemento HTML",
        "table": "Tavola"
      },
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "PARSE": "Rendering non riuscito: controlla la sintassi di Markdown"
      }
    },
    "image": {
      "format": "Formato output",
      "quality": "Qualità",
      "maxDim": "MAx dimensione",
      "original": "Dimensione Originale",
      "dropHint": "Trascina e rilascia un'immagine qui o fai clic per scegliere (PNG/JPEG/WebP/GIF, ecc.)",
      "before": "Originale",
      "after": "Output",
      "saved": "Size reduced by {{ratio}}%",
      "increased": "Dimensioni aumentate dello {{ratio}} %",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "ENCODE": "Codifica immagine non riuscita: assicurati che il browser supporti questo formato o prova un'altra immagine"
      }
    },
    "jsonConvert": {
      "target": "Formato dati di destinazione",
      "targets": {
        "yaml": "YAML",
        "xml": "XML",
        "csv": "CSV"
      },
      "input": "Ingresso 0",
      "placeholder": "Incolla JSON, ad esempio [{\"id\":1,\"name\":\"a\"}]...",
      "err": {
        "PARSE": "JSON analisi non riuscita: controllare la sintassi",
        "CONVERT": "Impossibile convertire nel formato di destinazione (CSV richiede una matrice di oggetti)"
      }
    },
    "xml": {
      "actions": {
        "format": "Abbellisci",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 spazi",
      "indent4": "4 spazi",
      "input": "Ingresso 0",
      "placeholder": "Incolla XML, ad esempio <root><item>un</item></root>...",
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "INVALID": "Elaborazione non riuscita: controlla se lo XML è valido"
      }
    },
    "xmlJson": {
      "indent": "Rientro",
      "indent2": "2 spazi",
      "indent4": "4 spazi",
      "input": "Ingresso 0",
      "output": "JSON output",
      "placeholder": "Incolla XML, ad es. <root a=\"1\"><item>x</item></root>...",
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "PARSE": "XML analisi non riuscita: controllare la sintassi"
      }
    },
    "unicode": {
      "format": "Formato",
      "formats": {
        "js": "JS \\uXXXX",
        "jsBrace": "JS \\u{…}",
        "codePoint": "Codice punto U+",
        "htmlHex": "0 X",
        "htmlDec": "HTML &#…;",
        "utf8": "0 byte"
      },
      "raw": "Testo normale",
      "encoded": "Testo codificato",
      "placeholderEncode": "Inserisci il testo, ad es.中/ A /😀...",
      "placeholderDecode": "Immettere \\u4e2d&#x4E2D;, U +4E2D o E4 B8 AD...",
      "hint": "Decode accetta notazioni miste; Encode utilizza il formato selezionato",
      "err": {
        "EMPTY": "Inserisci il contenuto",
        "INVALID": "Cannot parse: check the Unicode / UTF-8 representation"
      }
    },
    "colorPicker": {
      "picker": "Addetto al picking",
      "input": "Valore",
      "placeholder": "#3b82f6 / rgb(59.130.246)...",
      "eyedropper": "Contagocce per schermo",
      "preview": "Anteprima colore",
      "fields": {
        "hex": "HEX",
        "rgb": "RGB",
        "hsl": "HSL",
        "cssColor": "CSS colore",
        "cssBg": "Origini",
        "htmlInline": "HTML stile"
      },
      "err": {
        "EMPTY": "Inserire un colore valido",
        "INVALID": "Formato colore non riconosciuto"
      }
    },
    "webColorTable": {
      "search": "Ricerca",
      "searchPlaceholder": "Nome / HEX / RGB…",
      "group": "Group",
      "groups": {
        "all": "Tutte",
        "red": "Rosso",
        "orange": "Arancia",
        "yellow": "Giallo",
        "green": "Fagiolini",
        "cyan": "Ciano",
        "blue": "Blu",
        "purple": "Viola",
        "pink": "Rosa",
        "brown": "Marrone",
        "white": "Bianco",
        "gray": "Gray",
        "black": "Nero"
      },
      "count": "Mostra {{n}} / {{total}} colori",
      "empty": "Nessun colore corrispondente",
      "swatch": "Swatch",
      "name": "Nome",
      "hex": "HEX",
      "rgb": "RGB",
      "copyName": "Nome",
      "copyHex": "HEX",
      "copyRgb": "RGB",
      "hint": "CSS named colors (including Grey aliases and RebeccaPurple) for color / background use."
    },
    "pinyin": {
      "input": "Cinese",
      "output": "Pinyin",
      "placeholder": "Inserisci il cinese, ad esempio你好世界...",
      "separator": "Separatore",
      "separators": {
        "space": "Spazio",
        "none": "Nessuna",
        "dash": "Dash"
      },
      "letterCase": "Caso",
      "cases": {
        "lower": "Minuscolo",
        "upper": "Maiuscolo"
      },
      "tone": "Abilita toni",
      "hint": "Utilizza letture comuni; i caratteri polifonici utilizzano la lettura predefinita",
      "err": {
        "EMPTY": "Inserisci il testo cinese"
      }
    },
    "length": {
      "value": "Valore",
      "from": "U.d.m.",
      "placeholder": "es. 1,5",
      "units": {
        "mm": "Millimetri (mm)",
        "cm": "Centimetri (cm)",
        "m": "Metri (m):",
        "km": "Chilometri (km):",
        "in": "pollici (in)",
        "ft": "Piede ft",
        "yd": "Cortile iarda",
        "mi": "Mile mi",
        "nmi": "Miglio nautico"
      },
      "err": {
        "EMPTY": "Inserisci un numero",
        "INVALID": "Inserire un numero valido"
      }
    },
    "zhConvert": {
      "s2t": "→ Tradizionale semplificato",
      "t2s": "Tradizionale → semplificato",
      "simplified": "Simplified Chinese",
      "traditional": "Cinese tradizionale",
      "placeholderS2t": "Inserisci il cinese semplificato...",
      "placeholderT2s": "Inserisci il cinese tradizionale...",
      "hint": "Mappatura a livello di carattere; i nomi propri possono differire dai dizionari di frasi OpenCC",
      "err": {
        "EMPTY": "Si prega di inserire il testo"
      }
    },
    "weight": {
      "value": "Valore",
      "from": "U.d.m.",
      "placeholder": "es. 1,5",
      "units": {
        "mg": "Milligrammo - mg",
        "g": "Grammo - g",
        "kg": "Chilogrammo (kg)",
        "t": "Tonnellata t",
        "oz": "Oncia oz",
        "lb": "Libbra libbra",
        "st": "Stone st"
      },
      "err": {
        "EMPTY": "Inserisci un numero",
        "INVALID": "Inserire un numero valido"
      }
    },
    "textCounter": {
      "input": "Testo",
      "placeholder": "Incolla o digita il testo da contare...",
      "emptyHint": "Le statistiche appariranno dopo aver inserito il testo",
      "stats": {
        "chars": "Caratteri (spazi inclusi)",
        "charsNoSpace": "Caratteri (senza spazi)",
        "words": "Lettere",
        "cjk": "Caratteri CJK",
        "lines": "Linee",
        "paragraphs": "Paragrafi",
        "spaces": "Spazio vuoto",
        "bytes": "0 byte",
        "utf16Length": "Lunghezza UTF-16"
      }
    },
    "calendar": {
      "title": "{{year}}-{{month}}",
      "weekStart": "Giorno di inizio della settimana",
      "weekStarts": {
        "mon": "Lunedì",
        "sun": "Domenica"
      },
      "today": "Oggi",
      "prev": "Mese precedente",
      "next": "Mese successivo",
      "selected": "Data selezionata",
      "lunar": "Data lunare",
      "ganZhi": "Giorno pilastro {{day}}",
      "festivals": "Ferie / termini",
      "restLabel": "Tipo di giorno",
      "yi": "Adatto",
      "ji": "Evitare",
      "legendZh": "Il rosso segna i fine settimana o le feste; 休 = riposo legale, 班 = giorno lavorativo di trucco. Punte dell'almanacco a destra.",
      "legendEn": "I giorni rossi sono fine settimana o festivi. L'inglese utilizza i giorni festivi statunitensi (en-GB utilizza i giorni festivi del Regno Unito).",
      "rest": {
        "off": "Festivo",
        "work": "Workday",
        "weekend": "Fine settimana"
      },
      "weekdays": {
        "0": "Dom",
        "1": "Lun",
        "2": "Mar",
        "3": "Mer",
        "4": "Gio",
        "5": "Ven",
        "6": "Sab"
      },
      "formats": {
        "iso": "ISO",
        "slash": "<g id=\"MIFDocuments.YellowBackgroundColor\">Slash</g>",
        "locale": "Impostazioni locali"
      }
    },
    "cssButton": {
      "label": "Label",
      "bg": "Sfondo",
      "color": "Testo",
      "hoverBg": "Passaggio del mouse",
      "borderColor": "Bordo",
      "radius": "Raggio",
      "paddingX": "Bombatura X",
      "paddingY": "Bombatura Y",
      "fontSize": "Dimensioni font",
      "borderWidth": "Larghezza del Bordo",
      "fontWeight": "Peso",
      "shadow": "Ombra",
      "fullWidth": "A tutto schermo",
      "previewFallback": "Pulsante",
      "css": "CSS",
      "html": "HTML"
    },
    "randomNumber": {
      "min": "Min",
      "max": "Max",
      "count": "Conteggio",
      "decimals": "N° decimali",
      "unique": "Unico",
      "generate": "Genera",
      "err": {
        "INVALID_RANGE": "Intervallo non valido: garantire min ≤ max e spazio sufficiente quando unico",
        "INVALID_COUNT": "Il conteggio deve essere un numero intero compreso tra 1 e 1000",
        "INVALID_DECIMALS": "I decimali devono essere un numero intero compreso tra 0 e 10"
      }
    },
    "randomString": {
      "length": "Lung.",
      "count": "Conteggio",
      "preset": "Codifica di caratteri",
      "presets": {
        "alnum": "Alfanumerico",
        "alpha": "Lettere",
        "hex": "Hex",
        "base64": "Base64",
        "custom": "Personalizzata"
      },
      "custom": "Caratteri personalizzati",
      "customPlaceholder": "Inserisci i caratteri consentiti...",
      "generate": "Genera",
      "err": {
        "EMPTY_CHARSET": "Fornisci un set di caratteri non vuoto",
        "INVALID_LENGTH": "La lunghezza deve essere un numero intero compreso tra 1 e 256",
        "INVALID_COUNT": "Il conteggio deve essere un numero intero compreso tra 1 e 100"
      }
    },
    "doodle": {
      "size": "Dimensioni",
      "eraser": "Gomma per cancellare",
      "clear": "Cancella",
      "download": "Esporta '{0}'",
      "hint": "Trascina sulla tela per disegnare; mouse e tocco supportati"
    },
    "calculator": {
      "expression": "Espressione",
      "placeholder": "es. (1+2)*3 o sqrt(9)+pi",
      "functions": "Funzioni",
      "hint": "Supporta + - * / % ^ () e sqrt/abs/sin/cos/tan/ln/log/floor/ceil/round, più pi ed e",
      "err": {
        "EMPTY": "Inserisci un'espressione",
        "SYNTAX": "Sintassi dell'espressione non valida",
        "DIV_ZERO": "Divisione per zero"
      }
    },
    "codeImage": {
      "language": "Lingua",
      "theme": "Tema",
      "themes": {
        "dark": "Scuro",
        "light": "Chiaro"
      },
      "lineNumbers": "Numeri di riga:",
      "padding": "Imbottiture",
      "download": "Esporta '{0}'",
      "exporting": "Esportazione…",
      "input": "Codice",
      "preview": "Anteprima",
      "placeholder": " Incolla codice"
    },
    "imageColor": {
      "dropHint": "Rilasciare o scegliere un'immagine (PNG/JPEG/WebP/GIF, ecc.)",
      "empty": "Carica un'immagine, quindi fai clic per campionare un colore",
      "picked": "Colore prelevato",
      "preview": "Anteprima colore",
      "clickHint": "Fai clic su un pixel sull'immagine per campionare",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "LOAD": "Il percorso del file contenente i dati dell'immagine"
      }
    },
    "ascii": {
      "search": "Ricerca",
      "searchPlaceholder": "Decimale / esadecimale / carattere / nome...",
      "dec": "Dic",
      "hex": "Hex",
      "char": "Salmerino",
      "name": "Nome",
      "hint": "I caratteri di controllo senza glifi vengono visualizzati come ·; copiare il carattere o \\xHH"
    },
    "watermark": {
      "text": "Testo filigrana",
      "position": "Posizione",
      "positions": {
        "top-left": "Sinistra in alto",
        "top-right": "Destra in alto",
        "center": "Centro",
        "bottom-left": "Sinistra in basso",
        "bottom-right": "Destra in basso",
        "tile": "Piastrella"
      },
      "color": "Colore",
      "fontSize": "Dimensioni font",
      "opacity": "Opacità",
      "rotate": "Ruotare",
      "gap": "Distanza",
      "dropHint": "Rilascia o scegli un'immagine per la filigrana",
      "original": "Originale",
      "result": "Risultato",
      "download": "Download PNG",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "ENCODE": "Elaborazione non riuscita: prova un'altra immagine"
      }
    },
    "caseConvert": {
      "mode": "Modalità",
      "placeholder": "Inserisci il testo da convertire...",
      "modes": {
        "upper": "CASSA SUPERIORE",
        "lower": "lettera minuscola",
        "title": "Iniziali maiuscole",
        "sentence": "Maiuscole/minuscole nella frase",
        "swap": "sWAP cASE",
        "camel": "Notazione a cammello",
        "pascal": "PascalCase",
        "snake": "snake_case",
        "kebab": "kebab-case",
        "constant": "CONSTANT_CASE"
      },
      "err": {
        "EMPTY": "Inserisca alcune parole"
      }
    },
    "bmi": {
      "unit": "Sistema di unità di misura",
      "metric": "Metrico (cm, kg)",
      "imperial": "Imperiale (in / lb)",
      "heightCm": "Altezza (cm o metri)",
      "heightIn": "Statura (centimetri)",
      "weightKg": "Peso (kg)",
      "weightLb": "Peso (libbre)",
      "bmi": "BMI",
      "category": "Categoria",
      "categories": {
        "underweight": "Sotto Peso",
        "normal": "Normale",
        "overweight": "Sovrappeso",
        "obese": "Obeso"
      },
      "hint": "Le categorie SEGUONO i cutoff per adulti dell'OMS solo per riferimento — non per consulenza medica.",
      "err": {
        "INVALID": "Inserisci un'altezza e un peso validi",
        "RANGE": "I valori sono fuori da un intervallo ragionevole; controllare le unità"
      }
    },
    "placeholder": {
      "width": "Larghezza",
      "height": "Altezza",
      "bg": "Sfondo",
      "fg": "Colore del testo",
      "text": "Testo",
      "textPlaceholder": "Impostazioni predefinite per le dimensioni",
      "download": "Download PNG",
      "err": {
        "INVALID_SIZE": "La dimensione deve essere un numero intero compreso tra 16 e 4000",
        "INVALID_COLOR": "Il colore deve essere #RGB o #RRGGBB"
      }
    },
    "imageMerge": {
      "direction": "Layout",
      "directions": {
        "horizontal": "Orizzontali",
        "vertical": "Verticali",
        "grid": "Griglia"
      },
      "gap": "Spaziatura (px)",
      "dropHint": "Aggiungi le immagini una per una (fino a {{max}} )",
      "download": "Download unito PNG",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "TOO_MANY": "Limite immagine raggiunto",
        "ENCODE": "Unione non riuscita; riprova",
        "EMPTY": "Aggiungi almeno un'immagine"
      }
    },
    "cronGen": {
      "preset": "Preimpostazioni",
      "presetPick": "Selezionare un preset",
      "presets": {
        "everyMinute": "ogni minuto",
        "hourly": "Ogni ora (all'ora)",
        "daily": "Tutti i giorni alle 00:00",
        "weekly": "Lun settimanale 00:00",
        "monthly": "Mensile il giorno 1 alle 00:00"
      },
      "fields": {
        "minute": "Minuto",
        "hour": "Ora",
        "day": "Giorno del mese",
        "month": "Mese",
        "weekday": "Giorno della settimana"
      },
      "modes": {
        "every": "Ogni ",
        "value": "valore specifiche",
        "range": "Intervallo",
        "step": "Passaggio",
        "list": "Elenco"
      },
      "listPlaceholder": "es. 1,3,5",
      "everyHint": "Corrisponde a ogni valore in questo campo",
      "expression": "Espressione",
      "openParser": "Anteprima in Cron parser",
      "hint": "Standard 5 campi: minuto ora giorno mese giorno feriale (0 = domenica)",
      "err": {
        "INVALID_FIELD": "Valore del campo non valido; intervalli ed elenchi di controllo"
      }
    },
    "uaParser": {
      "input": "Agente utente",
      "placeholder": "Incolla una stringa User-Agent...",
      "useCurrent": "Usa il browser attuale",
      "field": "Campo",
      "name": "Nome",
      "version": "Versione",
      "extra": "Extra",
      "fields": {
        "browser": "Browser",
        "engine": "Motore",
        "os": "Sistema operativo",
        "device": "Dispositivo",
        "cpu": "CPU"
      },
      "err": {
        "EMPTY": "Inserisci un User-Agent"
      }
    },
    "latex": {
      "input": "LaTeX",
      "placeholder": "ad es. E = mc^2 o \\frac{a}{b}",
      "preview": "Anteprima",
      "displayMode": "Modalità di visualizzazione",
      "copyHtml": "Copia {0}",
      "symbols": "Simboli rapidi",
      "formulasTitle": "Formule classiche",
      "downloadPng": "Esporta '{0}'",
      "downloadJpg": "Esporta '{0}'",
      "downloadSvg": "Esporta '{0}'",
      "exporting": "Esportazione…",
      "empty": "Inserisci una formula per visualizzare l'anteprima",
      "hint": "Fare clic su un simbolo da inserire con il cursore; le formule classiche sostituiscono l'editor. Renderizzato da KaTeX; le macro esotiche potrebbero non funzionare.",
      "categories": {
        "operators": "Operatori",
        "relations": "internazionali",
        "greek": "Lettere greche",
        "trig": "Trigonometria",
        "calculus": "Analisi",
        "sumprod": "Somme & prodotti",
        "set": "Teoria degli insiemi",
        "logic": "Logica",
        "arrows": "Frecce",
        "matrix": "Matrici e vettori",
        "special": "Particolare"
      },
      "formulas": {
        "einstein": "Massa-energia",
        "quadratic": "2. Formula quadratica",
        "pythagorean": "Teorema di Pitagora",
        "euler": "Identità di Eulero",
        "binomial": "Teorema binomiale",
        "taylor": "Serie di Taylor.",
        "gaussian": "Integrale gaussiano",
        "cauchySchwarz": "Cauchy–Schwarz",
        "bayes": "Teorema di Bayes",
        "derivative": "Definizione dei derivati",
        "fourier": "Trasformata di Fourier",
        "navierStokes": "Navier–Stokes",
        "maxwell": "Equazione di Maxwell",
        "schrodinger": "L'equazione di Schrödinger",
        "normalDist": "Distribuzione normale ",
        "matrix2x2Det": "Determinante 2×2"
      },
      "err": {
        "EMPTY": "Inserire una formula valida",
        "RENDER": "Rendering non riuscito: {{message}}"
      }
    },
    "countdown": {
      "hours": "H",
      "minutes": "M",
      "seconds": "S",
      "start": "Inizia",
      "pause": "Metti in pausa",
      "resume": "Riprendi",
      "reset": "Reimposta",
      "done": "Il tempo è scaduto!",
      "err": {
        "INVALID": "Inserisci ore / minuti / secondi validi",
        "ZERO": "La durata deve essere maggiore di 0"
      }
    },
    "stopwatch": {
      "start": "Inizia",
      "pause": "Metti in pausa",
      "resume": "Riprendi",
      "reset": "Reimposta",
      "lap": "Giro",
      "lapIndex": "Giro",
      "lapTime": "Tempo di esecuzione",
      "totalTime": "Totale"
    },
    "svgPng": {
      "input": "SVG source",
      "placeholder": "Incolla SVG markup...",
      "dropHint": "Trascina o scegli un file .svg",
      "scale": "Scala",
      "transparent": "Sfondo trasparente",
      "download": "Download PNG",
      "sizeHint": "Sorgente {{sw}} × {{sh}} → uscita {{pw}} × {{ph}}",
      "err": {
        "EMPTY": "Inserisci SVG",
        "INVALID_SVG": "Not a valid SVG",
        "INVALID_SIZE": "Dimensione di uscita non valida (scala di controllo; bordo massimo 8192)",
        "ENCODE": "Conversione non riuscita; controllare lo SVG o ridurre la scala"
      }
    },
    "imageFrame": {
      "borderWidth": "Larghezza del Bordo",
      "borderColor": "Colore bordo",
      "radius": "Raggio",
      "shadowBlur": "Sfocatura ombra:",
      "shadowOffsetY": "Spostamento X ombra",
      "shadowOpacity": "Opacità ombra",
      "dropHint": "Rilascia o scegli un'immagine",
      "download": "Download PNG",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "ENCODE": "Elaborazione non riuscita; prova un'altra immagine"
      }
    },
    "imageAdjust": {
      "brightness": "Luminosità",
      "contrast": "Contrasto",
      "saturate": "Saturazione",
      "hue": "Tonalità",
      "reset": "Reimposta",
      "dropHint": "Rilascia o scegli un'immagine da regolare",
      "original": "Originale",
      "download": "Download PNG",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "ENCODE": "Elaborazione non riuscita; prova un'altra immagine"
      }
    },
    "gifFrames": {
      "dropHint": "Drop or choose a GIF file",
      "meta": "{{w}} × {{h}} · {{n}} fotogrammi",
      "download": "Scarica",
      "downloadAll": "Scarica tutti i frame",
      "err": {
        "NOT_GIF": "Per favore scegli un file",
        "EMPTY": "File vuoto",
        "PARSE": "Failed to parse GIF"
      }
    },
    "imageCrop": {
      "aspect": "Aspetto",
      "aspects": {
        "free": "Gratis",
        "1_1": "1:1",
        "4_3": "4:3",
        "3_4": "3:4",
        "16_9": "16:9",
        "9_16": "9:16"
      },
      "x": "X",
      "y": "Si",
      "width": "W",
      "height": "H",
      "dropHint": "Rilascia o scegli un'immagine da ritagliare",
      "hint": "Trascina per selezionare in modalità libera o modifica i valori qui sotto",
      "download": "Download PNG",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "ENCODE": "Ritaglio non riuscito; riprova",
        "INVALID": "Regione di coltura non valida"
      }
    },
    "mbti": {
      "progress": "Risposto {{done}} / {{total}}",
      "questionIndex": "Domanda {{n}} / {{total}}",
      "prev": "Precedente",
      "next": "Avanti",
      "submit": "vedi risultati",
      "reset": "Cancella",
      "retake": "Ripeti",
      "yourType": "Tendenza del tuo tipo",
      "hint": "Scegli l'opzione più adatta a te; invia quando hai risposto a tutti.",
      "disclaimer": "Questo è un quiz semplificato solo per intrattenimento, non una valutazione clinica.",
      "dims": {
        "EI": "Estroversione E / Introversione I",
        "SN": "Sensing S / Intuition N",
        "TF": "Thinking T / Feeling F",
        "JP": "Giudizio J / Percezione P"
      }
    },
    "textCard": {
      "theme": "Tema",
      "themes": {
        "slate": "Ardesia",
        "ocean": "Mare",
        "sunset": "TRAMONTO",
        "forest": "Foresta",
        "mono": "Mono",
        "paper": "Carta"
      },
      "align": "Allinea",
      "aligns": {
        "left": "Sx",
        "center": "Centro",
        "right": "Destra"
      },
      "fontSize": "Dimensioni font",
      "padding": "Imbottiture",
      "width": "Larghezza",
      "title": "Titolo",
      "titlePlaceholder": "Titolo opzionale…",
      "body": "Corpo",
      "bodyPlaceholder": "Inserisci il testo per la carta...",
      "preview": "Anteprima",
      "empty": "Inserisci un titolo o un corpo per visualizzare l'anteprima",
      "download": "Esporta '{0}'",
      "exporting": "Esportazione…"
    },
    "imageCard": {
      "shadow": "Ombra",
      "padding": "Imbottiture",
      "radius": "Raggio di blocco",
      "width": "Larghezza",
      "textPosition": "Posizione didascalia",
      "positions": {
        "below": "Foto sotto",
        "above": "Sopra la foto"
      },
      "align": "Allinea",
      "aligns": {
        "left": "Sx",
        "center": "Centro",
        "right": "Destra"
      },
      "textPadding": "<code>Padding</code> del testo.",
      "textBg": "Sfondo testo",
      "titleSize": "Dimensione titolo",
      "subtitleSize": "Dimensione del sottotitolo",
      "rotate": "Rotazione foto",
      "backdrop": "Sfondo",
      "backdropModes": {
        "preset": "Preimpostazione",
        "color": "Solid",
        "gradient": "Gradiente"
      },
      "backdropColor": "Colore sfondo",
      "gradientFrom": "Da",
      "gradientTo": "A",
      "gradientAngle": "Smerigliatrice",
      "backdrops": {
        "paper": "Carta",
        "fog": "Nebbia",
        "night": "Notte",
        "mint": "Menta",
        "sand": "Sabbia",
        "ink": "Inchiostro",
        "sunset": "TRAMONTO",
        "ocean": "Mare",
        "lavender": "Lavanda",
        "peach": "Pesca ",
        "aurora": "Aurora",
        "charcoal": "Carbone"
      },
      "title": "Titolo",
      "titlePlaceholder": "Titolo della carta...",
      "subtitle": "Titoletto",
      "subtitlePlaceholder": "Linea di supporto...",
      "dropHint": "Rilascia o scegli un'immagine per la carta",
      "empty": "Carica un'immagine per visualizzare l'anteprima della carta",
      "download": "Esporta '{0}'",
      "exporting": "Esportazione…",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "ENCODE": "Esportazione non riuscita; prova un'altra immagine"
      }
    },
    "codeHighlight": {
      "language": "Lingua",
      "theme": "Tema",
      "themes": {
        "dark": "Scuro",
        "light": "Chiaro"
      },
      "lineNumbers": "Numeri di riga:",
      "input": "Codice",
      "preview": "Anteprima evidenziata",
      "placeholder": " Incolla codice",
      "copyCode": "Copiare codice",
      "copyHtml": "Copia {0}",
      "hint": "Powered by Prism; copy the HTML snippet for blogs and docs."
    },
    "imageBase64": {
      "upload": "Immagine 0",
      "uploadHint": "Rilascia o scegli un'immagine",
      "copyDataUrl": "Copia dei dati",
      "base64Out": "Base64",
      "paste": "Immagine 0",
      "pastePlaceholder": "Incolla un dato URL o RAW Base64...",
      "err": {
        "EMPTY": "Inserisci Base64 o scegli un'immagine",
        "INVALID_BASE64": "{0} non valido.&#x0D;",
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC"
      }
    },
    "imageIco": {
      "mode": "Modalità",
      "toIco": "Immagine → ICO",
      "fromIco": "ICO",
      "sizes": "Misure",
      "uploadImageHint": "Drop or choose a PNG / JPG / WebP image",
      "uploadIcoHint": "Trascina o scegli un file .ico",
      "convert": "Crea ICO",
      "converting": "Al lavoro...",
      "downloadIco": "Scarica ICO",
      "downloadPng": "Download PNG",
      "extracted": "Estratto {{n}} taglie da {{name}}",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "NOT_ICO": "Scegli un file ICO",
        "USE_FROM_ICO": "Passa a \"ICO → PNG\" per aprire un file ICO",
        "NO_SIZES": "selezionare almeno un'opzione",
        "EMPTY": "File vuoto",
        "INVALID_ICO": "\"File danneggiato o non valido\"",
        "ENCODE": "Conversione non riuscita; prova un'altra immagine"
      }
    },
    "hsvCmyk": {
      "preview": "Anteprima colore"
    },
    "aiPrompts": {
      "search": "Ricerca",
      "searchPlaceholder": "Parole chiave",
      "category": "Categoria",
      "empty": "Nessuna richiesta corrispondente",
      "cat": {
        "all": "Tutte",
        "writing": "Scrittura",
        "coding": "Programmazione",
        "translate": "Traduci",
        "marketing": "Obiettivi",
        "learning": "Apprendimento",
        "career": "Carriera"
      }
    },
    "mdMindmap": {
      "input": "Markdown",
      "placeholder": "# Topic\n## Filiale\n- Punto…",
      "preview": "Mappa mentale",
      "theme": "Tema",
      "themes": {
        "sky": "Sky",
        "forest": "Foresta",
        "sunset": "TRAMONTO",
        "grape": "Uva",
        "ocean": "Mare",
        "mono": "Mono"
      },
      "zoomIn": "Ingrandisci",
      "zoomOut": "Riduci",
      "zoomReset": "Reimposta zoom",
      "zoomHint": "Tieni premuto CTRL /e scorri per ingrandire l'anteprima",
      "downloadSvg": "Esporta '{0}'",
      "downloadPng": "Esporta '{0}'",
      "download": "Esporta '{0}'",
      "exporting": "Esportazione…",
      "empty": "Inserisci intestazioni o elenchi Markdown per generare una mappa",
      "err": {
        "EMPTY": "Inserisci un ribasso"
      }
    },
    "mermaid": {
      "input": "Sirena",
      "placeholder": "diagramma di flusso TD\n A-->B",
      "preview": "Anteprima",
      "theme": "Tema",
      "themes": {
        "default": "Valore predefinito",
        "neutral": "Indifferente",
        "forest": "Foresta",
        "dark": "Scuro",
        "ocean": "Mare",
        "sunset": "TRAMONTO",
        "mono": "Mono"
      },
      "zoomIn": "Ingrandisci",
      "zoomOut": "Riduci",
      "zoomReset": "Reimposta zoom",
      "zoomHint": "Tieni premuto CTRL /e scorri per ingrandire l'anteprima",
      "downloadSvg": "Esporta '{0}'",
      "downloadPng": "Esporta '{0}'",
      "download": "Esporta '{0}'",
      "exporting": "Esportazione…",
      "empty": "Inserisci la sintassi della sirena per eseguire il rendering",
      "rendering": "Rendering…",
      "err": {
        "RENDER": "Rendering non riuscito: {{message}}"
      }
    },
    "cssGradient": {
      "type": "Type",
      "linear": "Lineare",
      "radial": "Segni",
      "angle": "Smerigliatrice",
      "shape": "Forma",
      "preview": "Anteprima sfumatura",
      "stops": "Arresti",
      "addStop": "Aggiungi fermata",
      "position": "Posizione %",
      "removeStop": "Rimuovi",
      "css": "CSS",
      "presetsTitle": "Preimpostazioni",
      "presetCategories": {
        "warm": "Premuroso/a",
        "cool": "Freddo",
        "nature": "Nature Green",
        "pink": "Rosa romantico",
        "purple": "Viola misterioso",
        "dark": "Scuro",
        "light": "Chiaro",
        "rainbow": "Multicolore",
        "sunset": "TRAMONTO",
        "ocean": "Mare"
      },
      "presetNames": {
        "warm-golden": "sole d'oro",
        "warm-peach": "Pesca ",
        "warm-coral": "Rosso corallo",
        "warm-amber": "Ambra",
        "warm-spice": "Arancia speziata",
        "warm-rose-gold": "Oro rosa",
        "warm-papaya": "Crema di papaya",
        "warm-flame": "Fiamma",
        "warm-honey": "Oro miele",
        "warm-terracotta": "Terracotta",
        "warm-mango": "Mango",
        "warm-autumn": "AUTUNNO",
        "warm-cinnamon": "Cannella",
        "warm-tangerine": "Mandarino ",
        "warm-sunset-orange": "Arancione",
        "warm-brick": "Rosso mattone ",
        "warm-caramel": "Caramello",
        "warm-radial": "Bagliore caldo",
        "warm-saffron": "Zafferano",
        "warm-burnt": "Siena bruciata",
        "warm-apricot": "Albicocche",
        "cool-arctic": "Arctic Blue",
        "cool-ice": "Azzurro ghiaccio",
        "cool-frost": "Gelo",
        "cool-steel": "Grigio in acciaio",
        "cool-mint-ice": "Gelato di menta",
        "cool-glacier": "ghiacciai.",
        "cool-skyline": "Orizzonte",
        "cool-polar": "Polare",
        "cool-nordic": "Grigio nordico",
        "cool-periwinkle": "Pervinca",
        "cool-cobalt": "Co (simbolo)",
        "cool-teal-breeze": "Teal breeze",
        "cool-sapphire": "Zaffiro",
        "cool-winter": "INVERNO",
        "cool-azure": "Azzurro tricolore",
        "cool-denim": "Blu denim",
        "cool-moonlight": "MOONLIGHT",
        "cool-cyan": "Blu ciano",
        "cool-harbor": "Porto",
        "cool-iceberg": "Iceberg",
        "nature-forest": "Foresta",
        "nature-moss": "Muschio",
        "nature-jungle": "Giungla",
        "nature-spring": "Molla",
        "nature-fern": "Fern",
        "nature-matcha": "Matcha",
        "nature-emerald": "Smeraldo",
        "nature-leaf": "Bagliore fogliare",
        "nature-bamboo": "Bambù",
        "nature-pine": "Pineta",
        "nature-sage": "Salvia",
        "nature-meadow": "Prato",
        "nature-rainforest": "Foresta pluviale",
        "nature-olive": "Verde oliva",
        "nature-cypress": "Cipresso",
        "nature-mint": "Menta",
        "nature-tea": "giardino",
        "nature-canopy": "Calotta",
        "nature-dew": "(Rugiada del Mattino)",
        "nature-avocado": "Avocado",
        "pink-blush": "Fard",
        "pink-rose": "Rosa",
        "pink-cotton": "Zucchero filato",
        "pink-sakura": "Sakura",
        "pink-cherry": "Ciliegia",
        "pink-bubble": "Bubble Gum",
        "pink-dream": "Dream Pink",
        "pink-valentine": "Valentine",
        "pink-lotus": "Loto",
        "pink-peony": "Peonia",
        "pink-strawberry": "Fragola",
        "pink-fairy": "Rosa fata",
        "pink-magnolia": "Magnolia",
        "pink-petal": "Petalo",
        "pink-candy": "Rosa candy",
        "pink-radial": "Pink Glow",
        "pink-rosewater": "Acqua di rose",
        "pink-ballet": "Ballet",
        "purple-galaxy": "Galassia",
        "purple-mystic": "Viola mistico",
        "purple-amethyst": "Ametista",
        "purple-velvet": "Porpora vellutato",
        "purple-neon": "FLUO PORPORA",
        "purple-twilight": "Viola crepuscolare",
        "purple-royal": "ROYAL PURPLE",
        "purple-orb": "Sfera viola",
        "purple-lilac": "Lillà",
        "purple-indigo": "Viola indaco",
        "purple-plum": "Lilla carico",
        "purple-cosmic": "Viola cosmico",
        "purple-dusk": "Crepuscolo viola",
        "purple-wine": "Viola vino",
        "purple-iris": "Iris",
        "purple-void": "Storno",
        "purple-haze": "Purple Haze",
        "purple-orchid": "Violetto chiaro",
        "purple-aurora": "Aurora viola",
        "purple-midnight": "Midnight Purple",
        "dark-charcoal": "Carbone",
        "dark-midnight": "Mezzanotte",
        "dark-slate": "Ardesia",
        "dark-eclipse": "Eclissi",
        "dark-carbon": "Carbon",
        "dark-noir": "Noir",
        "dark-abyss": "Abisso",
        "dark-spotlight": "Riflettore scuro",
        "dark-obsidian": "nera",
        "dark-graphite": "Grafite",
        "dark-onyx": "Onice",
        "dark-storm": "Notte di tempesta",
        "dark-ink": "Nero inchiostro",
        "dark-vignette": "Immagini",
        "dark-smoke": "Grigio fumo",
        "dark-raven": "Corvo",
        "dark-void": "Vuoto nero",
        "light-cloud": "Cloud",
        "light-pearl": "CAB",
        "light-mist": "Nebbia",
        "light-cream": "Formaggio",
        "light-linen": "Lino",
        "light-sand": "Sabbia",
        "light-lavender": "nebbia di lavanda",
        "light-glow": "Soft glow",
        "light-ivory": "Avorio",
        "light-snow": "Biancaneve",
        "light-blush": "Fard",
        "light-morning": "Mattina",
        "light-silk": "Seta",
        "light-frost": "Bianco brina",
        "light-champagne": "Champagne",
        "light-dawn": "Alba",
        "light-powder": "Blu polvere",
        "light-cotton": "Cotton white (Cotone bianco)",
        "rainbow-classic": "Arcobaleno classico",
        "rainbow-neon": "Neon multicolor",
        "rainbow-candy": "Caramella",
        "rainbow-aurora": "Aurora",
        "rainbow-sunset": "Miscela tramonto",
        "rainbow-pastel": "Pastello",
        "rainbow-vivid": "Tricolore vivace",
        "rainbow-prism": "Prisma",
        "rainbow-spectrum": "Spettro atomico",
        "rainbow-holo": "Olografia",
        "rainbow-pop": "POP Art",
        "rainbow-soda": "Soda pop",
        "rainbow-tropical": "Tropicale",
        "rainbow-laser": "Laser",
        "rainbow-universe": "Universo",
        "rainbow-dream": "Colore da sogno",
        "rainbow-galaxy": "Colore della galassia",
        "rainbow-confetti": "coriandoli",
        "rainbow-cyber": "Cyber",
        "rainbow-retro": "Retro duo",
        "rainbow-synth": "Synthwave",
        "rainbow-cotton": "Zucchero filato",
        "rainbow-electric": "Elettrico",
        "rainbow-sunrise": "Miscela Sunrise",
        "sunset-dusk": "Tramonto",
        "sunset-horizon": "Orizzonte",
        "sunset-glow": "incandescenza residua",
        "sunset-beach": "SPIAGGIA - TRAMONTO",
        "sunset-desert": "Crepuscolo del deserto",
        "sunset-evening": "Sera",
        "sunset-fire": "Cielo di fuoco",
        "sunset-radial": "Tramonto radiale",
        "sunset-amber": "Crepuscolo ambrato",
        "sunset-crimson": "Crepuscolo cremisi",
        "sunset-twilight": "Crepuscolo",
        "sunset-mango": "Crepuscolo di mango",
        "sunset-ember": "Brace",
        "sunset-sky": "Sky Dusk",
        "sunset-sahara": "Sahara",
        "sunset-golden": "Crepuscolo d'oro",
        "sunset-coast": "Crepuscolo costiero",
        "sunset-violet": "Crepuscolo viola",
        "sunset-radial-glow": "Sun disc Glow",
        "sunset-lake": "Crepuscolo del lago",
        "ocean-deep": "nel profondo oceano,",
        "ocean-wave": "onda oceanica<g id=\"1\"> </g>",
        "ocean-lagoon": "Laguna",
        "ocean-reef": "Barriera corallina",
        "ocean-abyss": "Abisso oceanico",
        "ocean-tide": "Marea",
        "ocean-coral": "Taupe",
        "ocean-bubble": "Bolla marina",
        "ocean-marine": "Blu marino",
        "ocean-aqua": "Azzurro",
        "ocean-storm": "Mare IN tempesta",
        "ocean-seafoam": "Seafoam",
        "ocean-caribbean": "Indie Occidentali",
        "ocean-pacific": "Pacific",
        "ocean-arctic": "Mar Artico.",
        "ocean-turquoise": "Ciano",
        "ocean-depth": "Bagliore profondo",
        "ocean-surf": "Surf",
        "ocean-kelp": "Kelp",
        "ocean-mist": "Nebbia marina",
        "ocean-pearl": "Perla marina"
      }
    },
    "imageToPaper": {
      "paper": "Carta",
      "orientation": "Orientamento",
      "portrait": "Ritratto",
      "landscape": "Orizzontale",
      "fit": "Fit",
      "contain": "Contiene",
      "cover": "Coperchio",
      "margin": "Margine (mm)",
      "uploadHint": "Rilascia o scegli un'immagine",
      "downloadPng": "Download PNG",
      "downloadPdf": "Esporta '{0}'",
      "exporting": "Esportazione…",
      "err": {
        "NOT_IMAGE": "Scegli un'immagine dal tuo PC",
        "INVALID_MARGIN": "Margine superiore non valido.",
        "INVALID_IMAGE": "Dimensione dell'immagine non valido"
      }
    },
    "mdToImage": {
      "gfm": "GFM",
      "breaks": "Interruzioni riga",
      "font": "Font",
      "fonts": {
        "sans": "Sans-serif",
        "serif": "Serif",
        "mono": "Monospace",
        "song": "Canzone (serif CJK)",
        "hei": "Hei (senza CJK)"
      },
      "fontSize": "Dimensioni font",
      "width": "Larghezza",
      "padding": "Imbottiture",
      "lineHeight": "Altezza della linea",
      "fg": "Colore del testo",
      "bg": "Sfondo",
      "download": "Esporta '{0}'",
      "exporting": "Esportazione…",
      "input": "Markdown",
      "placeholder": "# Title\nCorpo…",
      "preview": "Anteprima",
      "err": {
        "EMPTY": "Inserisci un ribasso",
        "PARSE": "Parse fallito!",
        "INVALID_COLOR": "Il colore deve essere #RGB o #RRGGBB",
        "INVALID_SIZE": "Dimensione / larghezza/imbottitura /altezza della linea del carattere fuori dall'intervallo",
        "INVALID_FONT": "Carattere non supportato"
      }
    },
    "chartGenerator": {
      "type": "Type",
      "types": {
        "bar": "Bar",
        "hbar": "Barra orizzontale",
        "line": "Line",
        "area": "Area",
        "pie": "Dolce",
        "doughnut": "Ciambella",
        "scatter": "Dispersione"
      },
      "bar": "Bar",
      "line": "Line",
      "pie": "Dolce",
      "title": "Titolo",
      "seriesLabel": "Etichetta serie",
      "legend": "Legend",
      "legends": {
        "top": "Top",
        "bottom": "In basso",
        "left": "Sx",
        "right": "Destra",
        "none": "Nascosto"
      },
      "colorScheme": "Schema colori",
      "schemes": {
        "vibrant": "vibrante",
        "pastel": "Pastello",
        "ocean": "Mare",
        "sunset": "TRAMONTO",
        "forest": "Foresta",
        "mono": "Mono",
        "rainbow": "raiNbow"
      },
      "xLabel": "Etichetta Asse X",
      "yLabel": "Etichetta Asse Y",
      "xLabelPlaceholder": "es: mese",
      "yLabelPlaceholder": "ad es. Vendite",
      "color": "Colore",
      "width": "Larghezza",
      "height": "Altezza",
      "data": "DATI 0",
      "dataPlaceholder": "etichetta,valore\nmela,30\nbanana,20",
      "preview": "Anteprima",
      "downloadSvg": "Download SVG",
      "downloadPng": "Download PNG",
      "copySvg": "Copia {0}",
      "err": {
        "EMPTY": "Inserire tutti i dati",
        "INVALID": "Formato dati non valido",
        "NO_NUMERIC": "Nessun valore numerico trovato"
      }
    },
    "css3Generator": {
      "linked": "Collega gli angoli",
      "topLeft": "Sinistra in alto",
      "topRight": "Destra in alto",
      "bottomRight": "Destra in basso",
      "bottomLeft": "Sinistra in basso",
      "offsetX": "Offset X",
      "offsetY": "Offset Y",
      "blur": "Sfocatura ",
      "spread": "Differenziale",
      "color": "Colore",
      "inset": "Inset",
      "translateX": "Trasla X",
      "translateY": "Trasla Y",
      "rotate": "Ruotare",
      "scale": "Scala",
      "skewX": "Inclinazione X:",
      "property": "Proprietà",
      "duration": "Durata (s)",
      "timing": "Tempi",
      "delay": "Ritardo/i",
      "brightness": "Luminosità",
      "contrast": "Contrasto",
      "saturate": "Satura",
      "grayscale": "Scala di grigi",
      "hueRotate": "Tinta-Rotazione",
      "preview": "Anteprima",
      "previewLabel": "Anteprima",
      "css": "CSS",
      "modules": {
        "borderRadius": "Raggio",
        "boxShadow": "Ombreggiatura riquadro",
        "textShadow": "Ombra testo",
        "transform": "Trasforma",
        "transition": "Cambio",
        "filter": "Filtro"
      }
    },
    "pdf-merge": {
      "hint": "Unisce localmente — non viene caricato nulla. Preferisci file < 50 MB.",
      "drop": "Rilascia più PDF",
      "run": "Unisci e scarica",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-split": {
      "hint": "Si divide in uno PDF per pagina e scarica ciascuno.",
      "asZip": "Scarica come ZIP",
      "drop": "Lascia uno PDF",
      "run": "Dividi e scarica",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-delete-pages": {
      "hint": "Pagine da eliminare, ad esempio 1,3-5. Deve rimanere almeno una pagina.",
      "pages": "Pagine da eliminare",
      "run": "Elimina scaricamento",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-extract-pages": {
      "hint": "Pagine da estrarre, ad esempio 1,3-5.",
      "pages": "Pagine da estrarre",
      "run": "Estrai e scarica",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-reorder": {
      "hint": "Utilizzare le frecce per riordinare le pagine, quindi esportare.",
      "pagesUnit": "pagine",
      "pageLabel": "Page {{n}}",
      "run": "Applica e scarica",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-rotate": {
      "hint": "Scegli un angolo per tutte le pagine o per quelle selezionate.",
      "allPages": "Tutte le pagine",
      "pages": "Pages",
      "run": "Ruota e scarica",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-to-image": {
      "hint": "Esegue il rendering localmente; i file di grandi dimensioni potrebbero essere lenti.",
      "scale": "Scala",
      "pages": "Pagine (facoltativo)",
      "pagesAll": "Lasciare vuoto per tutti",
      "run": "Esportare Immagini",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "images-to-pdf": {
      "hint": "Un'immagine per pagina in formato pixel.",
      "drop": "Trascina qui le immagini",
      "run": "Crea {0}",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-viewer": {
      "hint": "Anteprima locale — non viene caricato nulla.",
      "prev": "Prec.",
      "next": "Avanti",
      "scale": "Scala",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-page-numbers": {
      "hint": "Il formato supporta {n} e {total}.",
      "format": "Formato",
      "fontSize": "Dimensioni font",
      "startFrom": "Inizia da",
      "run": "Aggiungi Download",
      "pos": {
        "bottom-center": "Centro inferiore",
        "bottom-left": "Sinistra in basso",
        "bottom-right": "Destra in basso",
        "top-center": "Centro in alto"
      },
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-header-footer": {
      "hint": "Fornire almeno un'intestazione o un piè di pagina.",
      "header": "Intestazione",
      "footer": "Fondo",
      "fontSize": "Dimensioni font",
      "run": "Applica e scarica",
      "align": {
        "left": "Sx",
        "center": "Centro",
        "right": "Destra"
      },
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-insert-image": {
      "hint": "L'origine è in basso a sinistra della pagina (PDF corde).",
      "pdf": "PDF file",
      "image": "Immagine (PNG/JPG)",
      "allPages": "Tutte le pagine",
      "pages": "Pages",
      "width": "Larghezza",
      "run": "Inserisci Download",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-add-text": {
      "hint": "L'origine è in basso a sinistra; il complesso Unicode può essere limitato.",
      "text": "Testo",
      "allPages": "Tutte le pagine",
      "pages": "Pages",
      "fontSize": "Dimensioni font",
      "color": "Colore",
      "run": "Aggiungi Download",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-sign": {
      "hint": "Firma visiva (immagine sovrapposta), non certificato digitale.",
      "upload": "Carica firma",
      "draw": "Disegna la firma",
      "allPages": "Tutte le pagine",
      "pages": "Pages",
      "width": "Larghezza",
      "run": "Firma e scarica",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-metadata": {
      "hint": "Modifica titolo, autore e altri metadati, quindi scarica.",
      "pages": "{{n}} pagine",
      "run": "Salva e scarica",
      "fields": {
        "title": "Titolo",
        "author": "Autore",
        "subject": "Disciplina",
        "keywords": "Keywords",
        "creator": "Creatore",
        "producer": "Produttore"
      },
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-encrypt": {
      "hint": "Imposta password e autorizzazioni di apertura. Il supporto del lettore varia.",
      "userPassword": "Password utente",
      "ownerPassword": "Proprietario Password",
      "ownerHint": "L'impostazione predefinita è la password utente se vuota",
      "run": "Crittografa e scarica",
      "perm": {
        "printing": "Consenti stampa",
        "copying": "Consenti copia",
        "modifying": "Consenti modifica",
        "annotating": "Consenti annotazione"
      },
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-crop": {
      "hint": "Margini in PDF punti (pt ≈ 1/72 pollici).",
      "top": "Top",
      "right": "Destra",
      "bottom": "In basso",
      "left": "Sx",
      "run": "Ritaglia e scarica",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-grayscale": {
      "hint": "Scala di grigi visiva tramite la ri-rasterizzazione delle pagine; il testo non rimarrà selezionabile.",
      "run": "Converti e scarica",
      "errors": {
        "EMPTY": "Si prega di completare l'input",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "pdf-annotate": {
      "hint": "Apri uno PDF e disegna annotazioni sulla pagina: penna, evidenziazione, rettangolo, ellisse, cerchio, linea e testo.",
      "drop": "Lascia uno PDF",
      "stroke": "Corsa",
      "fontSize": "Dimensioni font",
      "scale": "Zoom",
      "undo": "Annulla",
      "clearPage": "Cancellare pagina nodo",
      "prev": "Prec.",
      "next": "Avanti",
      "count": "{{n}} annotazioni",
      "textPrompt": "Inserisci il testo dell'annotazione",
      "needVisitPage": "Open page {{n}} first so it can be rendered before export",
      "run": "Esporta annotati PDF",
      "kinds": {
        "pen": "Penna",
        "highlight": "Evidenzia",
        "rect": "Rettangolo",
        "ellipse": "Ellisse",
        "circle": "Circonferenza",
        "line": "Line",
        "text": "Testo"
      },
      "errors": {
        "EMPTY": "Disegna prima almeno un'annotazione",
        "NOT_PDF": "Si prega di caricare un file",
        "NOT_IMAGE": "Si prega di caricare un'immagine.",
        "LOAD_FAILED": "Impossibile caricare",
        "NO_PAGES": "Il documento non ha pagine",
        "INVALID_RANGE": "Intervallo pagine non valido.",
        "TOO_LARGE": "File troppo grande (consigliato < 50MB)",
        "ENCRYPT_FAILED": "Cifratura non riuscita",
        "PROCESS_FAILED": "Elaborazione non riuscita. "
      }
    },
    "xsltTransform": {
      "sample": "Carica esempio",
      "xml": "XML",
      "xmlPlaceholder": "Incolla",
      "xslt": "XSLT",
      "xsltPlaceholder": "Incolla foglio di stile XSLT...",
      "output": "Output",
      "preview": "Anteprima: {0}",
      "err": {
        "EMPTY_XML": "Inserisci XML",
        "EMPTY_XSLT": "Per favore inserisci",
        "INVALID_XML": "{0} non valido.&#x0D;",
        "INVALID_XSLT": "XSLT non valido",
        "TRANSFORM": "Trasformazione non riuscita"
      }
    }
  }
} satisfies TranslationResources;

export default it;
