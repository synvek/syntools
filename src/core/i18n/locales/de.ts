import type { TranslationResources } from '../types';

/** German translation resources */
const de = {
  "app": {
    "docTitle": "SynTools · Online-Toolbox für Entwickler"
  },
  "header": {
    "openMenu": "Menü öffnen",
    "searchPlaceholder": "Tools suchen…",
    "searchAria": "Tools suchen",
    "themeAria": "Design umschalten",
    "langAria": "Sprache wechseln",
    "sourceAria": "Quellcode"
  },
  "sidebar": {
    "nav": "Tool-Navigation",
    "closeMenu": "Menü schließen",
    "filter": "Tools filtern",
    "filterPlaceholder": "Filtern…",
    "filterEmpty": "Keine passenden Tools"
  },
  "home": {
    "title": "Online-Toolbox für Entwickler",
    "tagline": "Lokale Verarbeitung zuerst; Daten bleiben im Browser (CSP, kein Abfluss) · Drücken Sie <1>⌘K</1> oder <3>/</3> zum Suchen",
    "favorites": "Favoriten",
    "recent": "Zuletzt verwendet",
    "favoriteAria": "Zu Favoriten hinzufügen",
    "unfavoriteAria": "Aus Favoriten entfernen"
  },
  "search": {
    "aria": "Tools suchen",
    "placeholder": "Tools suchen (Name / Stichwörter)…",
    "empty": "Keine passenden Tools gefunden"
  },
  "categories": {
    "encoding": "Kodierung",
    "text": "Text",
    "formatting": "Formatierung",
    "crypto": "Krypto & Hash",
    "datetime": "Datum & Zeit",
    "generator": "Generatoren",
    "network": "Netzwerk",
    "image": "Bilder",
    "pdf": "PDF",
    "other": "Sonstiges"
  },
  "common": {
    "copy": "Kopieren",
    "copied": "Kopiert",
    "clear": "Leeren",
    "swap": "Tauschen",
    "download": "Herunterladen",
    "share": "Teilen",
    "shareTooLong": "Inhalt zu lang (> 2 KB), Freigabelink kann nicht erstellt werden",
    "retry": "Erneut versuchen",
    "loading": "Laden",
    "operation": "Aktion",
    "encode": "Kodieren",
    "decode": "Dekodieren",
    "result": "Ergebnis",
    "rawText": "Rohtext",
    "input": "Eingabe",
    "output": "Ausgabe",
    "text": "Text",
    "file": "Datei",
    "remove": "Entfernen",
    "bytes": "{{size}} Bytes"
  },
  "io": {
    "stats": "{{chars}} Zeichen / {{bytes}} Bytes",
    "warnLarge": "Große Eingabe (> 500 KB), Echtzeitberechnung kann langsamer werden",
    "overflow": "Eingabe überschreitet das 5-MB-Limit; für große Inhalte den Dateimodus verwenden"
  },
  "file": {
    "hint": "Datei hierher ziehen oder klicken zum Auswählen",
    "max": "Max. {{size}}",
    "over": "Datei überschreitet das Limit von {{max}} (aktuell {{size}})",
    "uploadAria": "Datei hochladen",
    "previewAlt": "Vorschau von {{name}}",
    "pages": "{{n}} Seiten",
    "encrypted": "Verschlüsselt"
  },
  "tool": {
    "errorTitle": "Laufzeitfehler des Tools",
    "localBadge": "Nur lokal",
    "serverBadge": "Server erforderlich",
    "related": "Verwandte Tools",
    "nextSteps": "Nächste Schritte",
    "openIn": "In {{name}} öffnen",
    "progress": "Fortschritt {{current}} / {{total}}"
  },
  "notFound": {
    "message": "Seite oder Tool nicht gefunden",
    "back": "Zurück zur Startseite"
  },
  "pdf": {
    "password": "PDF-Passwort",
    "passwordPlaceholder": "Öffnungspasswort eingeben",
    "passwordHint": "Dieses PDF ist verschlüsselt. Geben Sie das Passwort ein, um fortzufahren.",
    "unlock": "Entsperren",
    "errors": {
      "NEED_PASSWORD": "Dieses PDF ist verschlüsselt. Bitte geben Sie das Passwort ein.",
      "WRONG_PASSWORD": "Falsches Passwort. Bitte erneut versuchen."
    }
  },
  "toolsMeta": {
    "base64": {
      "name": "Base64 kodieren / dekodieren",
      "description": "Text und Base64 Unicode-sicher umwandeln; URL Safe und Dateimodus unterstützt"
    },
    "url-codec": {
      "name": "URL kodieren / dekodieren",
      "description": "encodeURIComponent- / encodeURI-Modi mit Erkennung fehlerhafter Prozentkodierung"
    },
    "regex-tester": {
      "name": "Regex-Tool",
      "description": "Trefferhervorhebung, Ersetzen, Fanggruppen, Vorlagen und Spickzettel"
    },
    "text-diff": {
      "name": "Text-Diff",
      "description": "Nebeneinanderliegende Editoren mit Zeilenhervorhebung, Zeilennummern und Leerraum ignorieren"
    },
    "json-format": {
      "name": "JSON-Formatierer",
      "description": "Formatieren / minifizieren / validieren mit 2/4-Leerzeichen-Einrückung und Fehlerposition Zeile/Spalte"
    },
    "json-convert": {
      "name": "JSON-Konverter",
      "description": "JSON parsen und nach YAML / XML / CSV konvertieren"
    },
    "timestamp": {
      "name": "Zeitstempel-Konverter",
      "description": "Unix ⇄ menschenlesbare Zeit mit Auto-Erkennung Sekunde/ms und Live-Uhr"
    },
    "uuid": {
      "name": "UUID-Generator",
      "description": "Zufällige v4- / zeitgeordnete v7-UUIDs mit Stapelausgabe und Formatoptionen"
    },
    "hash": {
      "name": "Hash-Rechner",
      "description": "MD5 / SHA-1 / SHA-256 / SHA-512 für Text und Dateien (Streaming), Ausgabe hex / base64"
    },
    "jwt-parser": {
      "name": "JWT-Parser",
      "description": "Header / Payload / Signatur parsen und exp sowie andere Zeit-Claims lesen (nur Lesen, keine Prüfung)"
    },
    "aes-crypto": {
      "name": "AES verschlüsseln / entschlüsseln",
      "description": "AES-GCM mit PBKDF2-Passphrase oder Rohschlüssel; Ausgabe base64(salt|iv|ciphertext)"
    },
    "hmac": {
      "name": "HMAC",
      "description": "HMAC-SHA256 / SHA512 mit Ausgabe hex / base64"
    },
    "totp": {
      "name": "TOTP",
      "description": "RFC-6238-TOTP: erzeugen / prüfen, 6/8 Ziffern, verbleibende Sekunden"
    },
    "x509-decode": {
      "name": "X.509-Zertifikatsdecoder",
      "description": "PEM parsen: SHA-256/SHA-1-Fingerabdrücke, Typ, DER-Länge, CN"
    },
    "cidr-calc": {
      "name": "CIDR-Rechner",
      "description": "IPv4-CIDR: Netz / Broadcast / Hostbereich / Maske / Hostanzahl"
    },
    "text-lines": {
      "name": "Textzeilen-Tools",
      "description": "Sortieren / Unique / Umkehren / Nummerieren / Leerzeilen entfernen"
    },
    "hex-codec": {
      "name": "Hex kodieren / dekodieren",
      "description": "Hex ↔ UTF-8-Text mit optionalen Leerzeichen"
    },
    "url-query": {
      "name": "URL-Query-Parser",
      "description": "URL-Teile und Query-Parameter parsen; nach Bearbeitung neu aufbauen"
    },
    "json-path": {
      "name": "JSONPath-Abfrage",
      "description": "Einfache Pfadabfragen wie a.b[0].c"
    },
    "gzip-tool": {
      "name": "Gzip-Kompression",
      "description": "Text per Gzip nach base64 / zurück nach Text dekomprimieren"
    },
    "exif-strip": {
      "name": "EXIF entfernen",
      "description": "Basis-JPEG-EXIF lesen und APP1 entfernen; bereinigte Datei herunterladen"
    },
    "fake-data": {
      "name": "Fake-Daten-Generator",
      "description": "Namen / E-Mails / UUIDs / Lorem in zh/en erzeugen, 1–50 Einträge"
    },
    "password-gen": {
      "name": "Passwort-Generator",
      "description": "Starke Zufallspasswörter mit Länge / Zeichensatz, Entropie und Stärke"
    },
    "entity-codec": {
      "name": "HTML kodieren / dekodieren",
      "description": "HTML-Sonderzeichen kodieren/dekodieren: benannt / dezimal / hex / \\u-Escapes"
    },
    "cron-parser": {
      "name": "Cron-Ausdrucksparser",
      "description": "Cron-Ausdrücke prüfen, Felder erklären und nächste Läufe vorschauen"
    },
    "convert-data": {
      "name": "Konfigurationsformat-Konverter",
      "description": "YAML ⇄ JSON ⇄ TOML über einen verlustfreien JS-Wert konvertieren"
    },
    "sql-format": {
      "name": "SQL-Formatierer",
      "description": "SQL über Dialekte hinweg schön formatieren mit Einrückung und Keyword-Großschreibung"
    },
    "html-format": {
      "name": "HTML minifizieren / verschönern",
      "description": "HTML minifizieren und verschönern mit 2/4-Leerzeichen-Einrückung"
    },
    "js-format": {
      "name": "JS minifizieren / verschönern",
      "description": "JavaScript minifizieren und verschönern mit 2/4-Leerzeichen-Einrückung"
    },
    "css-format": {
      "name": "CSS minifizieren / verschönern",
      "description": "CSS minifizieren und verschönern mit 2/4-Leerzeichen-Einrückung"
    },
    "xml-format": {
      "name": "XML minifizieren / verschönern",
      "description": "XML verschönern und minifizieren mit 2/4-Leerzeichen-Einrückung; CDATA bleibt erhalten"
    },
    "xml-json": {
      "name": "XML nach JSON",
      "description": "XML nach JSON parsen und Attribute mit @_-Präfix behalten"
    },
    "qrcode": {
      "name": "QR-Code",
      "description": "QR-Codes erzeugen und dekodieren mit ECC, Größe, Farben und Rand"
    },
    "color-converter": {
      "name": "Farbkonverter",
      "description": "HEX- / RGB- / HSL-Formate konvertieren und vorschauen"
    },
    "radix-converter": {
      "name": "Zahlensystem-Konverter",
      "description": "Basen 2/8/10/16 konvertieren und bitweise Ops für 64-Bit-Ganzzahlen visualisieren"
    },
    "markdown-preview": {
      "name": "Markdown-Vorschau",
      "description": "Live-GFM-Rendering mit DOMPurify-Bereinigung für sichere Vorschau"
    },
    "image-compress": {
      "name": "Bildkompression",
      "description": "Clientseitige Bildkompression und Formatkonvertierung (PNG / JPEG / WebP) mit Größe und Qualität"
    },
    "unicode-codec": {
      "name": "Unicode-Codec",
      "description": "Text ↔ \\uXXXX, Codepoints, HTML-Entities und UTF-8-Bytes konvertieren"
    },
    "html-color-picker": {
      "name": "HTML-Farbwähler",
      "description": "Farben visuell wählen und HEX / RGB / HSL plus HTML/CSS-Snippets exportieren"
    },
    "web-color-table": {
      "name": "Web-Farbtabelle",
      "description": "CSS-Benannte Farben mit Gruppenfiltern und Kopieren von Name / HEX / RGB"
    },
    "pinyin": {
      "name": "Chinesisch nach Pinyin",
      "description": "Chinesisch nach Pinyin mit optionalen Tönen, Trenner und Groß-/Kleinschreibung"
    },
    "length-converter": {
      "name": "Längenkonverter",
      "description": "Metrische und imperiale Längeneinheiten (mm, cm, m, km, in, ft u. a.)"
    },
    "zh-convert": {
      "name": "Traditionelles Chinesisch-Konverter",
      "description": "Zwischen vereinfachtem und traditionellem Chinesisch konvertieren"
    },
    "weight-converter": {
      "name": "Gewichtskonverter",
      "description": "Metrische und imperiale Gewichtseinheiten (mg, g, kg, t, oz, lb, st)"
    },
    "text-counter": {
      "name": "Textzähler",
      "description": "Zeichen, Wörter, Zeilen, Absätze, CJK-Zeichen und UTF-8-Bytes zählen"
    },
    "calendar": {
      "name": "Kalender",
      "description": "Monatsansicht mit Mondkalender/Almanach für Chinesisch und lokalen Feiertagen für Englisch"
    },
    "css-button": {
      "name": "CSS-Button-Generator",
      "description": "Styles visuell anpassen und Button-CSS / -HTML erzeugen"
    },
    "random-number": {
      "name": "Zufallszahlengenerator",
      "description": "Zufällige Ganz- oder Dezimalzahlen in einem Bereich, optional eindeutig"
    },
    "random-string": {
      "name": "Zufallsstring-Generator",
      "description": "Zufallsstrings nach Länge und Zeichensatz (alnum / hex / benutzerdefiniert)"
    },
    "doodle-board": {
      "name": "Skizzenbrett",
      "description": "Browser-Zeichenfläche mit Pinsel, Radierer und PNG-Export"
    },
    "calculator": {
      "name": "Taschenrechner",
      "description": "Sicherer Ausdrucksrechner mit Arithmetik, Potenz, Modulo und gängigen Funktionen"
    },
    "code-image": {
      "name": "Code als Bild",
      "description": "Code als Syntax-Highlight-Karte rendern und als PNG exportieren"
    },
    "image-color-picker": {
      "name": "Bild-Farbpipette",
      "description": "Bild hochladen und Pixel anklicken für HEX / RGB"
    },
    "ascii-table": {
      "name": "ASCII-Tabelle",
      "description": "ASCII 0–127 Referenz mit Suche nach Dezimal, Hex oder Zeichen"
    },
    "image-watermark": {
      "name": "Bild-Wasserzeichen",
      "description": "Textwasserzeichen mit Position, Decität, Rotation und Kachelung"
    },
    "case-convert": {
      "name": "Groß-/Kleinschreibung-Konverter",
      "description": "Schreibweise und Namensstile (camel / snake / kebab usw.) umwandeln"
    },
    "bmi-calculator": {
      "name": "BMI-Rechner",
      "description": "BMI aus Größe und Gewicht mit WHO-Erwachsenenkategorien"
    },
    "placeholder-image": {
      "name": "Platzhalterbild",
      "description": "Platzhalter-PNG nach Größe, Farben und optionalem Text erzeugen"
    },
    "image-merge": {
      "name": "Bilder zusammenfügen",
      "description": "Bilder horizontal, vertikal oder im Raster zu einem PNG verbinden"
    },
    "cron-generator": {
      "name": "Crontab-Generator",
      "description": "Standard-5-Feld-Cron-Ausdruck aus Minute/Stunde/Tag/Monat/Wochentag bauen"
    },
    "ua-parser": {
      "name": "User-Agent-Parser",
      "description": "Browser-User-Agent in Browser, Engine, OS und Gerät zerlegen"
    },
    "latex-editor": {
      "name": "LaTeX-Mathe-Editor",
      "description": "Schnellsymbole und klassische Formeln, KaTeX-Vorschau, Export PNG/JPG/SVG"
    },
    "countdown": {
      "name": "Countdown-Timer",
      "description": "Stunden, Minuten und Sekunden setzen; Pause, Fortsetzen und Endalarm"
    },
    "stopwatch": {
      "name": "Stoppuhr",
      "description": "Online-Stoppuhr mit Start, Pause, Zwischenzeit und Reset"
    },
    "svg-to-png": {
      "name": "SVG nach PNG",
      "description": "SVG-Markup oder -Dateien nach PNG mit Skalierung und Transparenz"
    },
    "image-frame": {
      "name": "Bildrahmen / Radius / Schatten",
      "description": "Rahmen, abgerundete Ecken und Schatten hinzufügen, dann PNG exportieren"
    },
    "image-adjust": {
      "name": "Bildfarben anpassen",
      "description": "Helligkeit, Kontrast, Sättigung und Farbton anpassen, dann PNG exportieren"
    },
    "gif-frames": {
      "name": "GIF-Frame-Extraktor",
      "description": "GIF in PNG-Frames zerlegen; eines oder alle herunterladen"
    },
    "image-crop": {
      "name": "Bild zuschneiden",
      "description": "Bilder frei oder mit festen Seitenverhältnissen nach PNG zuschneiden"
    },
    "mbti-test": {
      "name": "MBTI-Persönlichkeitstest",
      "description": "Kurzer 24-Fragen-MBTI-Quiz (nur zur Unterhaltung)"
    },
    "text-card": {
      "name": "Text als Karte",
      "description": "Titel und Text als gestylte Karte layouten und als PNG exportieren"
    },
    "image-card": {
      "name": "Bild als Karte",
      "description": "Foto + Titel/Untertitel-Karte mit Hintergrund-Presets oder Verläufen, PNG-Export"
    },
    "code-highlight": {
      "name": "Code-Highlighter",
      "description": "Live-Syntax-Highlighting mit Zeilennummern und HTML-Snippet-Kopie"
    },
    "image-base64": {
      "name": "Bild ↔ Base64",
      "description": "Bilder ↔ Base64 / Data-URL konvertieren, vollständig lokal"
    },
    "image-ico": {
      "name": "ICO-Konverter",
      "description": "Bilder in Multi-Size-ICO (Favicon) oder PNG aus ICO extrahieren"
    },
    "hsv-cmyk": {
      "name": "HSV- / CMYK-Konverter",
      "description": "RGB, HSV, CMYK und HEX umwandeln und vorschauen"
    },
    "ai-prompts": {
      "name": "KI-Prompt-Bibliothek",
      "description": "Kuratierte Prompts nach Kategorie mit Suche und Ein-Klick-Kopie"
    },
    "md-mindmap": {
      "name": "Markdown-Mindmap",
      "description": "Markdown zur Mindmap mit Themes, Zoom und PNG/SVG-Export"
    },
    "mermaid-editor": {
      "name": "Mermaid-Diagramm-Editor",
      "description": "Mermaid lokal rendern mit Themes, Zoom und PNG/SVG-Export"
    },
    "css-gradient": {
      "name": "CSS-Verlauf-Generator",
      "description": "Lineare / radiale Verläufe bearbeiten mit kategorisierten Presets und CSS-Kopie"
    },
    "image-to-paper": {
      "name": "Bild zu Papier-PDF",
      "description": "Bilder auf A3/A4/A5/Letter anpassen und als PDF exportieren"
    },
    "md-to-image": {
      "name": "Markdown zu Bild",
      "description": "Markdown als gestylte Karte rendern und PNG mit Schrift, Größe, Breite und Farben exportieren"
    },
    "chart-generator": {
      "name": "Diagramm-Generator",
      "description": "Balken-/Linien-/Flächen-/Kreis-/Donut-/Streudiagramme aus CSV mit Legenden und Paletten"
    },
    "css3-generator": {
      "name": "CSS3-Code-Generator",
      "description": "border-radius, Schatten, transform, filter und mehr erzeugen"
    },
    "xslt-transform": {
      "name": "XSLT-Transformation",
      "description": "XML mit XSLT im Browser nach HTML transformieren"
    },
    "pdf-merge": {
      "name": "PDF zusammenfügen",
      "description": "Mehrere PDFs zu einer Datei zusammenfügen"
    },
    "pdf-split": {
      "name": "PDF teilen",
      "description": "PDF in eine Datei pro Seite teilen"
    },
    "pdf-delete-pages": {
      "name": "PDF-Seiten löschen",
      "description": "Ausgewählte Seiten aus einem PDF entfernen"
    },
    "pdf-extract-pages": {
      "name": "PDF-Seiten extrahieren",
      "description": "Ausgewählte Seiten in ein neues PDF extrahieren"
    },
    "pdf-reorder": {
      "name": "PDF-Seiten neu ordnen",
      "description": "Seitenreihenfolge in einem PDF ändern"
    },
    "pdf-rotate": {
      "name": "PDF-Seiten drehen",
      "description": "Ausgewählte oder alle Seiten drehen"
    },
    "pdf-to-image": {
      "name": "PDF zu Bild",
      "description": "PDF-Seiten als JPG/PNG rendern"
    },
    "images-to-pdf": {
      "name": "Bilder zu PDF",
      "description": "Bilder zu einem PDF kombinieren"
    },
    "pdf-viewer": {
      "name": "PDF-Viewer",
      "description": "PDF lokal öffnen und lesen"
    },
    "pdf-page-numbers": {
      "name": "PDF-Seitenzahlen",
      "description": "Seitenzahlen zu einem PDF hinzufügen"
    },
    "pdf-header-footer": {
      "name": "PDF-Kopf- und Fußzeile",
      "description": "Kopf- und Fußzeilentext hinzufügen"
    },
    "pdf-insert-image": {
      "name": "Bild in PDF einfügen",
      "description": "Bild auf PDF-Seiten platzieren"
    },
    "pdf-add-text": {
      "name": "Text zu PDF hinzufügen",
      "description": "Text auf PDF-Seiten hinzufügen"
    },
    "pdf-sign": {
      "name": "PDF unterschreiben",
      "description": "Unterschriftsbild zeichnen oder hochladen (visuell, kein Zertifikat)"
    },
    "pdf-metadata": {
      "name": "PDF-Metadaten",
      "description": "PDF-Metadaten anzeigen und bearbeiten"
    },
    "pdf-encrypt": {
      "name": "PDF verschlüsseln",
      "description": "Passwort und Berechtigungsflags setzen"
    },
    "pdf-crop": {
      "name": "PDF zuschneiden",
      "description": "Seitenränder über cropBox zuschneiden"
    },
    "pdf-grayscale": {
      "name": "PDF Graustufen",
      "description": "PDF in visuelle Graustufen umwandeln"
    },
    "pdf-annotate": {
      "name": "PDF annotieren",
      "description": "Hervorhebungen, Freihand, Formen und Text auf PDF-Seiten zeichnen"
    }
  },
  "tools": {
    "base64": {
      "direction": {
        "encode": "Kodieren (Text → Base64)",
        "decode": "Dekodieren (Base64 → Text)"
      },
      "urlSafe": "URL Safe (- _ ohne Padding)",
      "labels": {
        "rawText": "Rohtext",
        "base64Input": "Base64-Eingabe",
        "base64Result": "Base64-Ergebnis",
        "decodeResult": "Dekodiertes Ergebnis"
      },
      "placeholders": {
        "encode": "text to encode… eingeben",
        "decode": "a Base64 string… einfügen"
      },
      "fileNote": "Datei-Base64-Ergebnis wird angezeigt; Texteingabe löscht es.",
      "fileMode": "Dateimodus: Datei → Base64 (ArrayBuffer-Chunks)",
      "err": {
        "INVALID_PADDING": "Ungültiges Padding „=“ an Position {{position}}",
        "INVALID_CHAR": "Ungültiges Zeichen „{{char}}“ an Position {{position}}",
        "INVALID_LENGTH": "Ungültige Länge: Base64-Länge mod 4 darf nicht 1 sein",
        "DECODE_FAILED": "Dekodierung fehlgeschlagen: ungültige Base64-Eingabe"
      }
    },
    "url": {
      "modes": {
        "component": "component (Parameternwert, kodiert reservierte Zeichen)",
        "full": "Vollständige URL (behält : / ? & usw.)"
      },
      "mode": "Modus",
      "labels": {
        "rawText": "Rohtext",
        "encodedText": "Kodierter Text"
      },
      "placeholders": {
        "encode": "content to encode… eingeben",
        "decode": "percent-encoded content… einfügen"
      },
      "err": {
        "ENCODE_FAILED": "Kodierung fehlgeschlagen: Eingabe enthält ungepaarte Surrogate",
        "DECODE_FAILED": "Dekodierung fehlgeschlagen: fehlerhafte Prozentkodierung"
      }
    },
    "regex": {
      "presets": "Vorlagen",
      "presetPlaceholder": "Zum Ausfüllen wählen…",
      "expression": "Muster",
      "expressionPlaceholder": "e.g. \\d+",
      "flags": "Flags",
      "testText": "Testtext",
      "testTextPlaceholder": "text to match… einfügen",
      "matchCount": "{{count}} Treffer",
      "truncated": " (gekürzt, erste 1000 angezeigt)",
      "position": "Index",
      "matchContent": "Treffer",
      "captureGroups": "Gruppen",
      "emptyMatch": "(leerer Treffer)",
      "tableLimit": "Nur die ersten {{count}} Zeilen werden angezeigt",
      "mode": "Modus",
      "modes": {
        "match": "Treffer",
        "replace": "Ersetzen"
      },
      "replacement": "Ersetzen durch",
      "replacementPlaceholder": "Unterstützt $1, $&, …",
      "replaceResult": "Ergebnis der Ersetzung",
      "cheatSheet": "Spickzettel (klicken zum Einfügen)",
      "cheat": {
        "dot": "Beliebiges Zeichen",
        "digit": "Ziffer",
        "word": "Wortzeichen",
        "space": "Leerzeichen",
        "start": "Zeilenanfang",
        "end": "Zeilenende",
        "star": "0 oder mehr",
        "plus": "1 oder mehr",
        "question": "0 oder 1",
        "or": "Alternative",
        "group": "Fanggruppe",
        "class": "Zeichenklasse",
        "range": "Bereich",
        "not": "Negierte Klasse"
      },
      "presetsList": {
        "email": "E-Mail",
        "phoneCn": "Telefon (Festlandchina)",
        "idCard": "Personalausweis (18 Ziffern)",
        "url": "URL",
        "ipv4": "IPv4-Adresse",
        "date": "Datum (yyyy-mm-dd)"
      },
      "err": {
        "EMPTY": "Regulärer Ausdruck darf nicht leer sein",
        "COMPILE": "Kompilierung fehlgeschlagen: {{message}}",
        "TEXT_TOO_LONG": "Text überschreitet {{limit}}K-Zeichenlimit; Matching gestoppt (ReDoS-/Langlaufschutz)"
      }
    },
    "textDiff": {
      "oldText": "Original",
      "newText": "Überarbeitet",
      "swapSides": "Seiten tauschen",
      "stats": "+{{added}} hinzugefügt / −{{removed}} entfernt / {{same}} unverändert",
      "identical": "Beide Texte sind identisch",
      "renderLimit": "Zu viele Diff-Zeilen; nur die ersten {{count}} werden gerendert",
      "ignoreWhitespace": "Nachgestellte / wiederholte Leerzeichen ignorieren",
      "err": {
        "TOO_LARGE": "Kombinierter Text überschreitet {{limit}}K-Zeichenlimit; Diff gestoppt (Langlaufschutz)"
      }
    },
    "json": {
      "actions": {
        "format": "Formatieren",
        "compress": "Minifizieren",
        "validate": "Nur validieren"
      },
      "indent": "Einrückung",
      "indent2": "2 Leerzeichen",
      "indent4": "4 Leerzeichen",
      "inputLabel": "JSON-Eingabe",
      "validateResult": "Validierungsergebnis",
      "inputPlaceholder": "JSON, e.g. {\"a\": 1}… einfügen",
      "valid": "✓ Gültiges JSON",
      "err": {
        "EMPTY": "JSON-Parsing fehlgeschlagen: Eingabe ist leer",
        "UNKNOWN": "JSON-Parsing fehlgeschlagen: unbekannter Fehler",
        "INVALID_LITERAL": "JSON-Parsing fehlgeschlagen: Literal „{{literal}}“ erwartet (Zeile {{line}}, Spalte {{column}})",
        "NEWLINE_IN_STRING": "JSON-Parsing fehlgeschlagen: Zeichenkette darf keine Zeilenumbrüche haben (Zeile {{line}}, Spalte {{column}})",
        "UNEXPECTED_STRING_END": "JSON-Parsing fehlgeschlagen: Zeichenkette endete unerwartet (Zeile {{line}}, Spalte {{column}})",
        "INVALID_UNICODE_ESCAPE": "JSON-Parsing fehlgeschlagen: ungültiges \\u-Escape, 4 Hex-Ziffern nötig (Zeile {{line}}, Spalte {{column}})",
        "INVALID_ESCAPE": "JSON-Parsing fehlgeschlagen: ungültiges Escape „\\{{char}}“ (Zeile {{line}}, Spalte {{column}})",
        "INVALID_NUMBER": "JSON-Parsing fehlgeschlagen: ungültige Zahl (Zeile {{line}}, Spalte {{column}})",
        "DECIMAL_NO_DIGITS": "JSON-Parsing fehlgeschlagen: Ziffern nach Dezimalpunkt erforderlich (Zeile {{line}}, Spalte {{column}})",
        "EXPONENT_NO_DIGITS": "JSON-Parsing fehlgeschlagen: Ziffern im Exponenten erforderlich (Zeile {{line}}, Spalte {{column}})",
        "UNEXPECTED_END": "JSON-Parsing fehlgeschlagen: unerwartetes Ende, Wert fehlt (Zeile {{line}}, Spalte {{column}})",
        "INVALID_CHAR": "JSON-Parsing fehlgeschlagen: ungültiges Zeichen „{{char}}“ (Zeile {{line}}, Spalte {{column}})",
        "TRAILING_COMMA": "JSON-Parsing fehlgeschlagen: nachgestelltes Komma nicht erlaubt (Zeile {{line}}, Spalte {{column}})",
        "KEY_MUST_BE_STRING": "JSON-Parsing fehlgeschlagen: Objektschlüssel muss eine Zeichenkette sein (Zeile {{line}}, Spalte {{column}})",
        "MISSING_COLON": "JSON-Parsing fehlgeschlagen: „:“ nach Objektschlüssel fehlt (Zeile {{line}}, Spalte {{column}})",
        "MISSING_VALUE": "JSON-Parsing fehlgeschlagen: Wert fehlt (Zeile {{line}}, Spalte {{column}})",
        "UNCLOSED_OBJECT": "JSON-Parsing fehlgeschlagen: Objekt nicht geschlossen, „}“ fehlt (Zeile {{line}}, Spalte {{column}})",
        "MISSING_COMMA_OBJECT": "JSON-Parsing fehlgeschlagen: „,“ zwischen Objektmitgliedern fehlt (Zeile {{line}}, Spalte {{column}})",
        "UNCLOSED_ARRAY": "JSON-Parsing fehlgeschlagen: Array nicht geschlossen, „]“ fehlt (Zeile {{line}}, Spalte {{column}})",
        "MISSING_COMMA_ARRAY": "JSON-Parsing fehlgeschlagen: „,“ zwischen Array-Elementen fehlt (Zeile {{line}}, Spalte {{column}})",
        "EXTRA_CONTENT": "JSON-Parsing fehlgeschlagen: zusätzlicher Inhalt nach dem Wert (Zeile {{line}}, Spalte {{column}})",
        "UNCLOSED_STRING": "JSON-Parsing fehlgeschlagen: nicht geschlossene Zeichenkette (Zeile {{line}}, Spalte {{column}})"
      }
    },
    "timestamp": {
      "currentTime": "Aktuelle Zeit",
      "pauseTick": "Uhr pausieren",
      "resumeTick": "Uhr fortsetzen",
      "second": "Sekunden",
      "millisecond": "Millisekunden",
      "localPrefix": "Lokal: {{local}} · {{utc}}",
      "tsToReadable": "Zeitstempel → lesbare Zeit (Auto-Erkennung Sekunden / ms)",
      "fillCurrentSec": "Aktuell einfüllen (Sekunden)",
      "tsInput": "Zeitstempel-Eingabe",
      "tsPlaceholder": "e.g. 1725000000 or 1725000000000",
      "localTime": "Ortszeit",
      "relative": "Relativ (erkannt als {{unit}})",
      "unitSeconds": "Sekunden",
      "unitMilliseconds": "Millisekunden",
      "dateToTs": "Lesbare Zeit → Zeitstempel (Leerzeichen-getrennt = lokale Zeitzone)",
      "dateInput": "Datum/Uhrzeit-Eingabe",
      "datePlaceholder": "e.g. 2026-09-01 12:00:00 or 2026-09-01T04:00:00Z",
      "relativeAgo": "vor {{count}} {{unit}}",
      "relativeLater": "in {{count}} {{unit}}",
      "units": {
        "second": "Sekunden",
        "minute": "Minuten",
        "hour": "Stunden",
        "day": "Tage",
        "year": "Jahre"
      },
      "err": {
        "NOT_NUMERIC": "Zeitstempel muss numerisch sein (Negativwerte erlaubt)",
        "OUT_OF_RANGE": "Zeitstempel außerhalb des Zahlenbereichs",
        "TS_TOO_LARGE": "Zeitstempel außerhalb des darstellbaren Bereichs (±275760 Jahre)",
        "DATE_EMPTY": "Bitte a date/time eingeben",
        "DATE_INVALID": "Datum/Uhrzeit kann nicht geparst werden (z. B. 2026-09-01 12:00:00 oder ISO 8601)"
      }
    },
    "uuid": {
      "version": "Version",
      "versions": {
        "v4": "v4 (zufällig)",
        "v7": "v7 (zeitgeordnet)"
      },
      "count": "Anzahl",
      "uppercase": "Großbuchstaben",
      "hyphens": "Bindestriche",
      "braces": "Geschweifte Klammern",
      "generate": "Erzeugen",
      "output": "Erzeugt (eines pro Zeile)",
      "err": {
        "INVALID_COUNT": "Anzahl muss eine Ganzzahl ≥ 1 sein",
        "TOO_MANY": "Maximal {{max}} UUIDs pro Stapel"
      }
    },
    "hash": {
      "algorithm": "Algorithmus",
      "encoding": "Ausgabe",
      "encodings": {
        "hex": "hex (hexadezimal)",
        "base64": "base64"
      },
      "source": "Quelle",
      "textInput": "Texteingabe",
      "textPlaceholder": "text to hash… eingeben",
      "result": "{{algorithm}}-Ergebnis",
      "computing": "Berechnung…",
      "fileHint": "Datei hierher ziehen oder klicken (MD5 streamt; große Dateien speichersicher)",
      "limitHint": "Hinweis: Nicht-MD5-Algorithmen laden die ganze Datei in den Speicher; sehr große Dateien können Speicherknappheit verursachen",
      "err": {
        "UNSUPPORTED": "Hash fehlgeschlagen: Algorithmus in dieser Umgebung nicht unterstützt",
        "FILE_HASH": "Datei-Hash fehlgeschlagen: {{message}}",
        "FILE_READ": "Fehlgeschlagen: read file contents"
      }
    },
    "jwt": {
      "mode": "Modus",
      "modes": {
        "parse": "Parsen",
        "sign": "Signieren (HS256)"
      },
      "secretPlaceholder": "HMAC-Geheimnis…",
      "payloadJson": "Payload-JSON",
      "payloadPlaceholder": "{ \"sub\": \"123\", \"name\": \"Alice\" }",
      "signedToken": "Signiertes Token",
      "signNote": "Signiert mit HS256 im Browser; das Geheimnis verlässt das Gerät nie",
      "inputLabel": "JWT-Eingabe",
      "inputPlaceholder": "JWT einfügen (Bearer-Präfix unterstützt), z. B. eyJhbGci…",
      "header": "Header",
      "payload": "Payload",
      "signature": "Signatur",
      "note": "Nur Parsen, keine Signaturprüfung: Prüfung braucht einen Schlüssel; alles bleibt im Browser",
      "alg": "Algorithmus",
      "expired": "Abgelaufen",
      "notExpired": "Nicht abgelaufen",
      "claims": {
        "exp": "Ablauf exp",
        "nbf": "Nicht vor nbf",
        "iat": "Ausgestellt um iat"
      },
      "err": {
        "EMPTY": "Bitte a JWT einfügen",
        "INVALID_PARTS": "Ungültiges Format: ein JWT besteht aus header.payload.signature",
        "INVALID_HEADER": "Header-Parsing fehlgeschlagen: kein gültiges base64url-kodiertes JSON",
        "INVALID_PAYLOAD": "Payload-Parsing fehlgeschlagen: kein gültiges base64url-kodiertes JSON",
        "SIGN_FAILED": "Signierung fehlgeschlagen"
      }
    },
    "aes-crypto": {
      "encrypt": "Verschlüsseln",
      "decrypt": "Entschlüsseln",
      "keyMode": "Schlüsselmodus",
      "passphrase": "Passphrase (PBKDF2)",
      "rawKey": "Rohschlüssel (hex)",
      "passphrasePlaceholder": "passphrase… eingeben",
      "keyHexPlaceholder": "32 oder 64 Hex-Zeichen (AES-128/256)…",
      "ivPlaceholder": "Optionaler IV (24 Hex-Zeichen / 12 Bytes); zufällig wenn leer",
      "plaintext": "Klartext",
      "ciphertext": "Ciphertext (base64)",
      "inputPlaceholder": "content… eingeben",
      "note": "Verschlüsselungsausgabe: base64(salt|iv|ciphertext+tag); Passphrase nutzt PBKDF2-SHA256",
      "err": {
        "EMPTY": "Bitte content eingeben",
        "INVALID_KEY": "Ungültiger Schlüssel: Passphrase oder Hex-Schlüssellänge prüfen",
        "DECRYPT_FAILED": "Entschlüsselung fehlgeschlagen: falscher Schlüssel oder beschädigte Daten",
        "INVALID_INPUT": "Ungültig: input: bad ciphertext or IV"
      }
    },
    "hmac": {
      "algorithm": "Algorithmus",
      "encoding": "Ausgabe",
      "secretPlaceholder": "HMAC-Geheimnis…",
      "message": "Nachricht",
      "messagePlaceholder": "Zu authentifizierende Nachricht…",
      "err": {
        "EMPTY": "Bitte a message eingeben",
        "INVALID_KEY": "Bitte a valid secret eingeben"
      }
    },
    "totp": {
      "digits": "Ziffern",
      "secret": "Base32-Geheimnis",
      "secretPlaceholder": "Authenticator secret (Base32)… einfügen",
      "code": "Aktueller Code",
      "remaining": "Verbleibende Sekunden",
      "verify": "Code prüfen (optional)",
      "verifyPlaceholder": "6/8-digit code… eingeben",
      "verifyOk": "Verifiziert",
      "verifyFail": "Verifizierung fehlgeschlagen",
      "err": {
        "EMPTY": "Bitte secret or code eingeben",
        "INVALID_SECRET": "Geheimnis ist kein gültiges Base32"
      }
    },
    "cidr-calc": {
      "input": "CIDR",
      "placeholder": "e.g. 192.168.1.0/24",
      "fields": {
        "network": "Netzwerk",
        "broadcast": "Broadcast",
        "firstHost": "Erster Host",
        "lastHost": "Letzter Host",
        "netmask": "Netzmaske",
        "wildcard": "Wildcard",
        "prefix": "Präfix",
        "hostCount": "Hostanzahl",
        "totalAddresses": "Adressen gesamt"
      },
      "err": {
        "EMPTY": "Bitte a CIDR eingeben",
        "INVALID": "Ungültiges CIDR (IPv4/Präfix, z. B. 10.0.0.0/8)"
      }
    },
    "text-lines": {
      "placeholder": "Ein Eintrag pro Zeile…",
      "ops": {
        "sort-asc": "Aufsteigend sortieren",
        "sort-desc": "Absteigend sortieren",
        "unique": "Eindeutig",
        "reverse": "Umkehren",
        "number": "Zeilen nummerieren",
        "trim-empty": "Leerzeilen entfernen"
      },
      "err": {
        "EMPTY": "Bitte text eingeben"
      }
    },
    "hex-codec": {
      "spaced": "Leerzeichengetrennte Bytes",
      "placeholder": "Text oder hex…",
      "err": {
        "EMPTY": "Bitte content eingeben",
        "INVALID_HEX": "Ungültig: hex (even length, 0-9a-f)"
      }
    },
    "url-query": {
      "input": "URL",
      "placeholder": "https://example.com/path?a=1&b=2",
      "addParam": "Parameter hinzufügen",
      "key": "Schlüssel",
      "value": "Wert",
      "rebuilt": "Neu aufgebaute URL",
      "parts": {
        "protocol": "Protokoll",
        "hostname": "Host",
        "port": "Port",
        "pathname": "Pfad",
        "hash": "Hash",
        "origin": "Ursprung"
      },
      "err": {
        "EMPTY": "Bitte a URL eingeben",
        "INVALID_URL": "Ungültige URL"
      }
    },
    "json-path": {
      "pathPlaceholder": "Pfad, z. B. a.b[0].c oder $.a.b[0]",
      "json": "JSON",
      "jsonPlaceholder": "JSON… einfügen",
      "err": {
        "EMPTY": "Bitte JSON and a path eingeben",
        "INVALID_JSON": "JSON-Parsing fehlgeschlagen",
        "NOT_FOUND": "Pfad nicht gefunden"
      }
    },
    "gzip-tool": {
      "compress": "Komprimieren (Text → base64)",
      "decompress": "Dekomprimieren (base64 → Text)",
      "placeholder": "Text oder gzip-base64…",
      "err": {
        "EMPTY": "Bitte content eingeben",
        "INVALID": "Ungültige Eingabe",
        "DECOMPRESS_FAILED": "Dekomprimierung fehlgeschlagen: ungültige gzip-Daten"
      }
    },
    "x509-decode": {
      "input": "PEM-Zertifikat",
      "placeholder": "-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----",
      "fields": {
        "pemType": "Typ",
        "derLength": "DER-Länge",
        "sha256": "SHA-256",
        "sha1": "SHA-1",
        "subject": "Subject CN",
        "issuer": "Issuer CN"
      },
      "err": {
        "EMPTY": "Bitte PEM einfügen",
        "INVALID_PEM": "Ungültiges PEM"
      }
    },
    "exif-strip": {
      "hint": "Nur JPEG: APP1 (EXIF) entfernen und herunterladen.",
      "drop": "JPEG-Bild ablegen",
      "hasExif": "Enthält EXIF",
      "orientation": "Ausrichtung",
      "make": "Kameramarke",
      "yes": "Ja",
      "no": "Nein",
      "download": "Bereinigte Datei herunterladen",
      "err": {
        "EMPTY": "Bitte a file wählen",
        "UNSUPPORTED": "Nur JPEG",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "fake-data": {
      "kind": "Art",
      "locale": "Locale",
      "count": "Anzahl",
      "generate": "Erzeugen",
      "kinds": {
        "name": "Name",
        "email": "E-Mail",
        "uuid": "UUID",
        "lorem": "Absatz"
      },
      "err": {
        "EMPTY": "Bitte options vervollständigen",
        "INVALID_COUNT": "Anzahl muss eine Ganzzahl von 1 bis 50 sein"
      }
    },
    "password": {
      "length": "Länge",
      "generate": "Erzeugen",
      "lowercase": "Kleinbuchstaben (a-z)",
      "uppercase": "Großbuchstaben (A-Z)",
      "digits": "Ziffern (0-9)",
      "symbols": "Symbole (!@#$%…)",
      "excludeAmbiguous": "Mehrdeutige Zeichen ausschließen (0 O 1 l I usw.)",
      "ensureEach": "Mindestens ein Zeichen aus jedem gewählten Satz einschließen",
      "output": "Ergebnis",
      "outputPlaceholder": "„Erzeugen“ klicken, um ein Passwort zu erstellen",
      "entropy": "Entropie ≈ {{bits}} Bits",
      "strength": {
        "weak": "Schwach",
        "medium": "Mittel",
        "strong": "Stark"
      },
      "err": {
        "NO_SETS": "Bitte mindestens einen Zeichensatz wählen",
        "INVALID_LENGTH": "Länge muss zwischen 4 und 128 liegen"
      }
    },
    "entity": {
      "direction": "Richtung",
      "encode": "Kodieren",
      "decode": "Dekodieren",
      "mode": "Formatieren",
      "modes": {
        "named": "Benannt (&amp;)",
        "decimal": "Dezimal (&#38;)",
        "hex": "Hex (&#x26;)",
        "unicode": "\\u-Escape (\\u4E2D)"
      },
      "scope": "Umfang",
      "scopes": {
        "special": "Nur Sonderzeichen (&, <, > usw.)",
        "nonascii": "Sonderzeichen + Nicht-ASCII"
      },
      "input": "Eingabe",
      "output": "Ausgabe",
      "inputEncodePlaceholder": "Zu kodierender Text, z. B. <b>Hello</b>…",
      "inputDecodePlaceholder": "Zu dekodierender Text, z. B. &lt;b&gt;&#20320;&#22909;…",
      "unknown": "Unbekannte Entities (unverändert belassen)"
    },
    "cron": {
      "expression": "Ausdruck",
      "placeholder": "e.g. */5 8-18 * * 1-5 or @daily (5 fields, 6 with seconds)",
      "count": "Anzahl",
      "normalized": "Normalisiert",
      "fieldsTitle": "Feldaufschlüsselung",
      "colField": "Feld",
      "colValue": "Wert",
      "colMeaning": "Bedeutung",
      "nextTitle": "Nächste {{count}} Ausführungen",
      "fieldNames": {
        "second": "Sekunde",
        "minute": "Minute",
        "hour": "Stunde",
        "day": "Tag",
        "month": "Monat",
        "week": "Wochentag"
      },
      "err": {
        "EMPTY": "Bitte a cron expression eingeben",
        "INVALID": "Kann nicht geparst werden: Feldanzahl (5 oder 6) und Bereiche prüfen (Min 0-59 / Stunde 0-23 / Tag 1-31 / Monat 1-12 / Wochentag 0-7)"
      },
      "desc": {
        "every": {
          "second": "jede Sekunde",
          "minute": "jede Minute",
          "hour": "jede Stunde",
          "day": "jeden Tag",
          "month": "jeden Monat",
          "week": "jeden Wochentag"
        },
        "step": "alle {{n}} {{unit}}",
        "at": "{{noun}}{{values}}",
        "range": "{{noun}}{{a}}–{{b}}",
        "rangeStep": "{{noun}}{{a}}–{{b}}, every {{n}}",
        "units": {
          "second": "Sekunden",
          "minute": "Minuten",
          "hour": "Stunden",
          "day": "Tage",
          "month": "Monate",
          "week": "Tage"
        },
        "nouns": {
          "second": "Sekunde ",
          "minute": "Minute ",
          "hour": "Stunde ",
          "day": "Tag ",
          "month": "Monat ",
          "week": "Wochentag "
        },
        "sep": ", ",
        "days": [
          "Sonntag",
          "Montag",
          "Dienstag",
          "Mittwoch",
          "Donnerstag",
          "Freitag",
          "Samstag"
        ],
        "months": [
          "Jan",
          "Feb",
          "Mär",
          "Apr",
          "Mai",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Okt",
          "Nov",
          "Dez"
        ]
      }
    },
    "convert": {
      "from": "Von",
      "to": "Bis",
      "formats": {
        "yaml": "YAML",
        "json": "JSON",
        "toml": "TOML"
      },
      "input": "Eingabe",
      "output": "Ausgabe",
      "placeholder": "content to convert… einfügen",
      "err": {
        "PARSE": "Eingabe konnte nicht geparst werden: bitte Syntax prüfen",
        "STRINGIFY": "Kann nicht ins Zielformat konvertieren (z. B. TOML unterstützt keine Top-Level-Arrays/Skalare)"
      }
    },
    "sql": {
      "dialect": "Dialekt",
      "indent": "Einrückung",
      "keywordCase": "Keyword-Großschreibung",
      "cases": {
        "upper": "UPPERCASE",
        "lower": "lowercase",
        "preserve": "Beibehalten"
      },
      "languages": {
        "sql": "Generisches SQL",
        "mysql": "MySQL",
        "postgresql": "PostgreSQL",
        "sqlite": "SQLite",
        "mariadb": "MariaDB",
        "transactsql": "SQL Server",
        "plsql": "PL/SQL"
      },
      "input": "SQL-Eingabe",
      "output": "Ausgabe",
      "placeholder": "SQL einfügen, z. B. select * from users where id = 1…",
      "err": {
        "INVALID": "Dieses SQL kann nicht geparst werden: bitte Syntax prüfen"
      }
    },
    "html": {
      "actions": {
        "format": "Verschönern",
        "compress": "Minifizieren"
      },
      "indent": "Einrückung",
      "indent2": "2 Leerzeichen",
      "indent4": "4 Leerzeichen",
      "input": "HTML-Eingabe",
      "placeholder": "HTML einfügen, z. B. <div><span>Hello</span></div>…",
      "err": {
        "EMPTY": "Bitte HTML content eingeben",
        "INVALID": "Verarbeitung fehlgeschlagen: bitte prüfen, ob das HTML gültig ist"
      }
    },
    "js": {
      "actions": {
        "format": "Verschönern",
        "compress": "Minifizieren"
      },
      "indent": "Einrückung",
      "indent2": "2 Leerzeichen",
      "indent4": "4 Leerzeichen",
      "input": "JavaScript-Eingabe",
      "placeholder": "JS einfügen, z. B. function hello(){return 1}…",
      "err": {
        "EMPTY": "Bitte JavaScript content eingeben",
        "INVALID": "Verarbeitung fehlgeschlagen: bitte Syntax prüfen"
      }
    },
    "css": {
      "actions": {
        "format": "Verschönern",
        "compress": "Minifizieren"
      },
      "indent": "Einrückung",
      "indent2": "2 Leerzeichen",
      "indent4": "4 Leerzeichen",
      "input": "CSS-Eingabe",
      "placeholder": "CSS, e.g. .box{color:red}… einfügen",
      "err": {
        "EMPTY": "Bitte CSS content eingeben",
        "INVALID": "Verarbeitung fehlgeschlagen: bitte prüfen, ob das CSS gültig ist"
      }
    },
    "qr": {
      "input": "Textinhalt",
      "placeholder": "Text oder URL eingeben, z. B. https://example.com…",
      "level": "Fehlerkorrektur",
      "size": "Größe",
      "margin": "Rand",
      "foreground": "Vordergrund",
      "background": "Hintergrund",
      "levels": {
        "L": "L (~7%)",
        "M": "M (~15%)",
        "Q": "Q (~25%)",
        "H": "H (~30%)"
      },
      "preview": "QR-Code-Vorschau",
      "decodeTitle": "QR-Code dekodieren",
      "decodeHint": "Bild mit QR-Code ablegen oder wählen (PNG / JPG usw.)",
      "decodeOutput": "Dekodiertes Ergebnis",
      "err": {
        "EMPTY": "the content to encode eingeben",
        "TOO_LONG": "Inhalt zu lang für einen QR-Code: kürzen oder Fehlerkorrekturstufe senken",
        "NOT_FOUND": "Kein QR-Code im Bild gefunden",
        "DECODE": "Fehlgeschlagen: decode the image",
        "LOAD": "Bild konnte nicht geladen werden: bitte gültige Bilddatei sicherstellen",
        "INVALID_COLOR": "Farbe muss #RGB oder #RRGGBB sein",
        "INVALID_MARGIN": "Rand muss eine Ganzzahl von 0 bis 10 (Module) sein"
      }
    },
    "color": {
      "input": "Farbe",
      "placeholder": "e.g. #3b82f6, rgb(59,130,246), hsl(217,91%,60%)…",
      "preview": "Farbvorschau",
      "supportHint": "Unterstützt HEX / RGB / HSL (inkl. Kurzform und Prozentwerte)",
      "err": {
        "EMPTY": "Bitte a color value eingeben",
        "INVALID": "Kann nicht geparst werden: HEX-, RGB- oder HSL-Format verwenden"
      }
    },
    "radix": {
      "radix": "Basis",
      "auto": "Auto-Erkennung",
      "input": "Ganzzahl-Eingabe",
      "placeholder": "e.g. 255, 0xff, 0b11111111, 0377…",
      "bitPattern": "Bitmuster",
      "twosComplement": "Zweierkomplement",
      "bitOps": "Bitweise Operationen",
      "operator": "Operator",
      "operandB": "Operand B",
      "opHint": "Operand A nutzt die Eingabe oben; Ergebnisse bleiben im 64-Bit-Ganzzahlbereich",
      "ops": {
        "and": "AND",
        "or": "OR",
        "xor": "XOR",
        "shl": "<< (shift left)",
        "shr": ">> (shift right)",
        "not": "NOT"
      },
      "err": {
        "EMPTY": "Bitte an integer eingeben",
        "INVALID": "Kann nicht geparst werden: Basis und Zahlenformat prüfen",
        "RANGE": "Wert außerhalb des 64-Bit-Ganzzahlbereichs (−2⁶³ ~ 2⁶³−1)"
      }
    },
    "markdown": {
      "gfm": "GFM (Tabellen / Durchstreichung / Aufgabenlisten)",
      "breaks": "Weiche Zeilenumbrüche",
      "input": "Markdown-Editor",
      "placeholder": "Markdown, e.g. # Heading… eingeben",
      "preview": "Vorschau",
      "shortcuts": "Shortcuts: ⌘/Strg+B fett · ⌘/Strg+I kursiv · ⌘/Strg+K Link · ⌘/Strg+E Inline-Code",
      "toolbar": {
        "aria": "Markdown-Bearbeitungsleiste",
        "bold": "Fett (**)",
        "italic": "Kursiv (*)",
        "strike": "Durchgestrichen (~~)",
        "h1": "Überschrift 1 (#)",
        "h2": "Überschrift 2 (##)",
        "h3": "Überschrift 3 (###)",
        "h4": "Überschrift 4 (####)",
        "h5": "Überschrift 5 (#####)",
        "h6": "Überschrift 6 (######)",
        "quote": "Zitat (>)",
        "code": "Inline-Code (`)",
        "codeBlock": "Codeblock (```)",
        "link": "Link",
        "image": "Bild",
        "ul": "Aufzählung",
        "ol": "Nummerierte Liste",
        "hr": "Horizontale Linie",
        "table": "Tabelle"
      },
      "err": {
        "EMPTY": "Bitte Markdown content eingeben",
        "PARSE": "Rendering fehlgeschlagen: bitte Markdown-Syntax prüfen"
      }
    },
    "image": {
      "format": "Ausgabeformat",
      "quality": "Qualität",
      "maxDim": "Max. Abmessung",
      "original": "Originalgröße",
      "dropHint": "Bild hierher ziehen oder klicken zum Auswählen (PNG / JPEG / WebP / GIF usw.)",
      "before": "Original",
      "after": "Ausgabe",
      "saved": "Größe um {{ratio}} % reduziert",
      "increased": "Größe um {{ratio}} % erhöht",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "ENCODE": "Bildkodierung fehlgeschlagen: Browser-Unterstützung prüfen oder anderes Bild versuchen"
      }
    },
    "jsonConvert": {
      "target": "Zielformat",
      "targets": {
        "yaml": "YAML",
        "xml": "XML",
        "csv": "CSV"
      },
      "input": "JSON-Eingabe",
      "placeholder": "JSON, e.g. [{\"id\":1,\"name\":\"a\"}]… einfügen",
      "err": {
        "PARSE": "JSON-Parsing fehlgeschlagen: bitte Syntax prüfen",
        "CONVERT": "Kann nicht ins Zielformat konvertieren (CSV erfordert ein Objekt-Array)"
      }
    },
    "xml": {
      "actions": {
        "format": "Verschönern",
        "compress": "Minifizieren"
      },
      "indent": "Einrückung",
      "indent2": "2 Leerzeichen",
      "indent4": "4 Leerzeichen",
      "input": "XML-Eingabe",
      "placeholder": "XML einfügen, z. B. <root><item>a</item></root>…",
      "err": {
        "EMPTY": "Bitte XML content eingeben",
        "INVALID": "Verarbeitung fehlgeschlagen: bitte prüfen, ob das XML gültig ist"
      }
    },
    "xmlJson": {
      "indent": "Einrückung",
      "indent2": "2 Leerzeichen",
      "indent4": "4 Leerzeichen",
      "input": "XML-Eingabe",
      "output": "JSON-Ausgabe",
      "placeholder": "XML einfügen, z. B. <root a=\"1\"><item>x</item></root>…",
      "err": {
        "EMPTY": "Bitte XML content eingeben",
        "PARSE": "XML-Parsing fehlgeschlagen: bitte Syntax prüfen"
      }
    },
    "unicode": {
      "format": "Formatieren",
      "formats": {
        "js": "JS \\uXXXX",
        "jsBrace": "JS \\u{…}",
        "codePoint": "Codepoint U+",
        "htmlHex": "HTML &#x…;",
        "htmlDec": "HTML &#…;",
        "utf8": "UTF-8-Bytes"
      },
      "raw": "Klartext",
      "encoded": "Kodierter Text",
      "placeholderEncode": "text, e.g. 中 / A / 😀… eingeben",
      "placeholderDecode": "\\u4e2d, U+4E2D, &#x4E2D; oder E4 B8 AD eingeben…",
      "hint": "Dekodierung akzeptiert gemischte Notationen; Kodierung nutzt das gewählte Format",
      "err": {
        "EMPTY": "Bitte content eingeben",
        "INVALID": "Kann nicht geparst werden: Unicode-/UTF-8-Darstellung prüfen"
      }
    },
    "colorPicker": {
      "picker": "Auswahl",
      "input": "Wert",
      "placeholder": "#3b82f6 / rgb(59,130,246)…",
      "eyedropper": "Bildschirm-Pipette",
      "preview": "Farbvorschau",
      "fields": {
        "hex": "HEX",
        "rgb": "RGB",
        "hsl": "HSL",
        "cssColor": "CSS-Farbe",
        "cssBg": "CSS-Hintergrund",
        "htmlInline": "HTML-Style"
      },
      "err": {
        "EMPTY": "Bitte a color eingeben",
        "INVALID": "Unbekanntes Farbformat"
      }
    },
    "webColorTable": {
      "search": "Suchen",
      "searchPlaceholder": "Name / HEX / RGB…",
      "group": "Gruppe",
      "groups": {
        "all": "Alle",
        "red": "Rot",
        "orange": "Orange",
        "yellow": "Gelb",
        "green": "Grün",
        "cyan": "Cyan",
        "blue": "Blau",
        "purple": "Lila",
        "pink": "Pink",
        "brown": "Braun",
        "white": "Weiß",
        "gray": "Grau",
        "black": "Schwarz"
      },
      "count": "{{n}} / {{total}} Farben werden angezeigt",
      "empty": "Keine passenden Farben",
      "swatch": "Farbfeld",
      "name": "Name",
      "hex": "HEX",
      "rgb": "RGB",
      "copyName": "Name",
      "copyHex": "HEX",
      "copyRgb": "RGB",
      "hint": "CSS-Benannte Farben (inkl. Grey-Aliase und RebeccaPurple) für color / background."
    },
    "pinyin": {
      "input": "Chinesisch",
      "output": "Pinyin",
      "placeholder": "Chinese, e.g. 你好世界… eingeben",
      "separator": "Trennzeichen",
      "separators": {
        "space": "Leerzeichen",
        "none": "Keine",
        "dash": "Bindestrich -"
      },
      "letterCase": "Schreibweise",
      "cases": {
        "lower": "Kleinbuchstaben",
        "upper": "Großbuchstaben"
      },
      "tone": "Töne aktivieren",
      "hint": "Verwende gängige Lesungen; polyphone Zeichen nutzen die Standardlesung",
      "err": {
        "EMPTY": "Bitte Chinese text eingeben"
      }
    },
    "length": {
      "value": "Wert",
      "from": "Einheit",
      "placeholder": "e.g. 1.5",
      "units": {
        "mm": "Millimeter mm",
        "cm": "Zentimeter cm",
        "m": "Meter m",
        "km": "Kilometer km",
        "in": "Zoll in",
        "ft": "Fuß ft",
        "yd": "Yard yd",
        "mi": "Meile mi",
        "nmi": "Seemeile nmi"
      },
      "err": {
        "EMPTY": "Bitte a number eingeben",
        "INVALID": "Bitte a valid number eingeben"
      }
    },
    "zhConvert": {
      "s2t": "Vereinfacht → Traditionell",
      "t2s": "Traditionell → Vereinfacht",
      "simplified": "Vereinfachtes Chinesisch",
      "traditional": "Traditionelles Chinesisch",
      "placeholderS2t": "Simplified Chinese… eingeben",
      "placeholderT2s": "Traditional Chinese… eingeben",
      "hint": "Zeichenweise Abbildung; Eigennamen können von OpenCC-Phrasenwörterbüchern abweichen",
      "err": {
        "EMPTY": "Bitte text eingeben"
      }
    },
    "weight": {
      "value": "Wert",
      "from": "Einheit",
      "placeholder": "e.g. 1.5",
      "units": {
        "mg": "Milligramm mg",
        "g": "Gramm g",
        "kg": "Kilogramm kg",
        "t": "Tonne t",
        "oz": "Unze oz",
        "lb": "Pfund lb",
        "st": "Stone st"
      },
      "err": {
        "EMPTY": "Bitte a number eingeben",
        "INVALID": "Bitte a valid number eingeben"
      }
    },
    "textCounter": {
      "input": "Text",
      "placeholder": "or type text to count… einfügen",
      "emptyHint": "Statistiken erscheinen nach Texteingabe",
      "stats": {
        "chars": "Zeichen (mit Leerzeichen)",
        "charsNoSpace": "Zeichen (ohne Leerzeichen)",
        "words": "Wörter",
        "cjk": "CJK-Zeichen",
        "lines": "Zeilen",
        "paragraphs": "Absätze",
        "spaces": "Leerzeichen",
        "bytes": "UTF-8-Bytes",
        "utf16Length": "UTF-16-Länge"
      }
    },
    "calendar": {
      "title": "{{year}}-{{month}}",
      "weekStart": "Wochenbeginn",
      "weekStarts": {
        "mon": "Montag",
        "sun": "Sonntag"
      },
      "today": "Heute",
      "prev": "Vorheriger Monat",
      "next": "Nächster Monat",
      "selected": "Ausgewähltes Datum",
      "lunar": "Monddatum",
      "ganZhi": "Tagessäule {{day}}",
      "festivals": "Feiertage / Begriffe",
      "restLabel": "Tagestyp",
      "yi": "Geeignet",
      "ji": "Vermeiden",
      "legendZh": "Rot markiert Wochenenden oder Feste; 休 = gesetzlicher Ruhetag, 班 = Nachholarbeitstag. Almanach rechts.",
      "legendEn": "Rote Tage sind Wochenenden oder Feiertage. Englisch nutzt US-Feiertage (en-GB nutzt UK-Bankfeiertage).",
      "rest": {
        "off": "Feiertag",
        "work": "Werktag",
        "weekend": "Wochenende"
      },
      "weekdays": {
        "0": "So",
        "1": "Mo",
        "2": "Di",
        "3": "Mi",
        "4": "Do",
        "5": "Fr",
        "6": "Sa"
      },
      "formats": {
        "iso": "ISO",
        "slash": "Schrägstrich",
        "locale": "Locale"
      }
    },
    "cssButton": {
      "label": "Bezeichnung",
      "bg": "Hintergrund",
      "color": "Text",
      "hoverBg": "Hover",
      "borderColor": "Rahmen",
      "radius": "Radius",
      "paddingX": "Innenabstand X",
      "paddingY": "Innenabstand Y",
      "fontSize": "Schriftgröße",
      "borderWidth": "Rahmenbreite",
      "fontWeight": "Stärke",
      "shadow": "Schatten",
      "fullWidth": "Volle Breite",
      "previewFallback": "Schaltfläche",
      "css": "CSS",
      "html": "HTML"
    },
    "randomNumber": {
      "min": "Min",
      "max": "Max",
      "count": "Anzahl",
      "decimals": "Dezimalstellen",
      "unique": "Eindeutig",
      "generate": "Erzeugen",
      "err": {
        "INVALID_RANGE": "Ungültiger Bereich: min ≤ max und genug Spielraum bei Eindeutigkeit",
        "INVALID_COUNT": "Anzahl muss eine Ganzzahl von 1 bis 1000 sein",
        "INVALID_DECIMALS": "Dezimalstellen müssen eine Ganzzahl von 0 bis 10 sein"
      }
    },
    "randomString": {
      "length": "Länge",
      "count": "Anzahl",
      "preset": "Zeichensatz",
      "presets": {
        "alnum": "Alphanumerisch",
        "alpha": "Buchstaben",
        "hex": "Hex",
        "base64": "Base64",
        "custom": "Benutzerdefiniert"
      },
      "custom": "Benutzerdefinierte Zeichen",
      "customPlaceholder": "allowed characters… eingeben",
      "generate": "Erzeugen",
      "err": {
        "EMPTY_CHARSET": "Bitte a non-empty charset eingeben",
        "INVALID_LENGTH": "Länge muss eine Ganzzahl von 1 bis 256 sein",
        "INVALID_COUNT": "Anzahl muss eine Ganzzahl von 1 bis 100 sein"
      }
    },
    "doodle": {
      "size": "Größe",
      "eraser": "Radierer",
      "clear": "Leeren",
      "download": "PNG exportieren",
      "hint": "Auf der Leinwand ziehen zum Zeichnen; Maus und Touch unterstützt"
    },
    "calculator": {
      "expression": "Ausdruck",
      "placeholder": "e.g. (1+2)*3 or sqrt(9)+pi",
      "functions": "Funktionen",
      "hint": "Unterstützt + - * / % ^ () und sqrt/abs/sin/cos/tan/ln/log/floor/ceil/round sowie pi und e",
      "err": {
        "EMPTY": "Bitte an expression eingeben",
        "SYNTAX": "Ungültig: expression syntax",
        "DIV_ZERO": "Division durch Null"
      }
    },
    "codeImage": {
      "language": "Sprache",
      "theme": "Theme",
      "themes": {
        "dark": "Dark",
        "light": "Light"
      },
      "lineNumbers": "Zeilennummern",
      "padding": "Innenabstand",
      "download": "PNG exportieren",
      "exporting": "Exportiere…",
      "input": "Code",
      "preview": "Vorschau",
      "placeholder": "code… einfügen"
    },
    "imageColor": {
      "dropHint": "Bild ablegen oder wählen (PNG / JPEG / WebP / GIF usw.)",
      "empty": "Bild hochladen, dann klicken zum Farbproben",
      "picked": "Gewählte Farbe",
      "preview": "Farbvorschau",
      "clickHint": "Pixel auf dem Bild klicken zum Probieren",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "LOAD": "Fehlgeschlagen: load the image"
      }
    },
    "ascii": {
      "search": "Suchen",
      "searchPlaceholder": "Dezimal / hex / Zeichen / Name…",
      "dec": "Dez",
      "hex": "Hex",
      "char": "Zeichen",
      "name": "Name",
      "hint": "Steuerzeichen ohne Glyphen als ·; Zeichen oder \\xHH kopieren"
    },
    "watermark": {
      "text": "Wasserzeichentext",
      "position": "Position",
      "positions": {
        "top-left": "Oben links",
        "top-right": "Oben rechts",
        "center": "Mitte",
        "bottom-left": "Unten links",
        "bottom-right": "Unten rechts",
        "tile": "Kachel"
      },
      "color": "Farbe",
      "fontSize": "Schriftgröße",
      "opacity": "Deckkraft",
      "rotate": "Drehen",
      "gap": "Abstand",
      "dropHint": "an image to watermark ablegen oder wählen",
      "original": "Original",
      "result": "Ergebnis",
      "download": "PNG herunterladen",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "ENCODE": "Verarbeitung fehlgeschlagen: anderes Bild versuchen"
      }
    },
    "caseConvert": {
      "mode": "Modus",
      "placeholder": "text to convert… eingeben",
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
        "EMPTY": "Bitte some text eingeben"
      }
    },
    "bmi": {
      "unit": "Einheitensystem",
      "metric": "Metrisch (cm / kg)",
      "imperial": "Imperial (in / lb)",
      "heightCm": "Größe (cm oder Meter)",
      "heightIn": "Größe (Zoll)",
      "weightKg": "Gewicht (kg)",
      "weightLb": "Gewicht (lb)",
      "bmi": "BMI",
      "category": "Kategorie",
      "categories": {
        "underweight": "Untergewicht",
        "normal": "Normal",
        "overweight": "Übergewicht",
        "obese": "Adipositas"
      },
      "hint": "Kategorien folgen WHO-Erwachsenengrenzwerten nur als Referenz — keine medizinische Beratung.",
      "err": {
        "INVALID": "a valid height and weight eingeben",
        "RANGE": "Werte außerhalb eines sinnvollen Bereichs; Einheiten prüfen"
      }
    },
    "placeholder": {
      "width": "Breite",
      "height": "Höhe",
      "bg": "Hintergrund",
      "fg": "Textfarbe",
      "text": "Text",
      "textPlaceholder": "Standard: Abmessungen",
      "download": "PNG herunterladen",
      "err": {
        "INVALID_SIZE": "Größe muss eine Ganzzahl zwischen 16 und 4000 sein",
        "INVALID_COLOR": "Farbe muss #RGB oder #RRGGBB sein"
      }
    },
    "imageMerge": {
      "direction": "Layout",
      "directions": {
        "horizontal": "Horizontal",
        "vertical": "Vertikal",
        "grid": "Raster"
      },
      "gap": "Abstand (px)",
      "dropHint": "Bilder einzeln hinzufügen (bis {{max}})",
      "download": "Zusammengefügtes PNG herunterladen",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "TOO_MANY": "Bildlimit erreicht",
        "ENCODE": "Zusammenfügen fehlgeschlagen; bitte erneut versuchen",
        "EMPTY": "Mindestens ein Bild hinzufügen"
      }
    },
    "cronGen": {
      "preset": "Vorlagen",
      "presetPick": "Voreinstellung wählen…",
      "presets": {
        "everyMinute": "Jede Minute",
        "hourly": "Stündlich (zur vollen Stunde)",
        "daily": "Täglich um 00:00",
        "weekly": "Wöchentlich Mo 00:00",
        "monthly": "Monatlich am 1. um 00:00"
      },
      "fields": {
        "minute": "Minute",
        "hour": "Stunde",
        "day": "Tag des Monats",
        "month": "Monat",
        "weekday": "Wochentag"
      },
      "modes": {
        "every": "Alle (*)",
        "value": "Spezifischer Wert",
        "range": "Bereich",
        "step": "Schritt",
        "list": "Liste"
      },
      "listPlaceholder": "e.g. 1,3,5",
      "everyHint": "Stimmt mit jedem Wert in diesem Feld überein",
      "expression": "Ausdruck",
      "openParser": "Vorschau im Cron-Parser",
      "hint": "Standard 5 Felder: Minute Stunde Tag Monat Wochentag (0 = Sonntag)",
      "err": {
        "INVALID_FIELD": "Ungültiger Feldwert; Bereiche und Listen prüfen"
      }
    },
    "uaParser": {
      "input": "User-Agent",
      "placeholder": "a User-Agent string… einfügen",
      "useCurrent": "Aktuellen Browser verwenden",
      "field": "Feld",
      "name": "Name",
      "version": "Version",
      "extra": "Extra",
      "fields": {
        "browser": "Browser",
        "engine": "Engine",
        "os": "OS",
        "device": "Gerät",
        "cpu": "CPU"
      },
      "err": {
        "EMPTY": "Bitte a User-Agent eingeben"
      }
    },
    "latex": {
      "input": "LaTeX",
      "placeholder": "e.g. E = mc^2 or \\frac{a}{b}",
      "preview": "Vorschau",
      "displayMode": "Anzeigemodus",
      "copyHtml": "HTML kopieren",
      "symbols": "Schnellsymbole",
      "formulasTitle": "Klassische Formeln",
      "downloadPng": "PNG exportieren",
      "downloadJpg": "JPG exportieren",
      "downloadSvg": "SVG exportieren",
      "exporting": "Exportiere…",
      "empty": "a formula to preview eingeben",
      "hint": "Symbol klicken zum Einfügen an der Cursorposition; klassische Formeln ersetzen den Editor. Gerendert von KaTeX; exotische Makros funktionieren ggf. nicht.",
      "categories": {
        "operators": "Operatoren",
        "relations": "Relationen",
        "greek": "Griechische Buchstaben",
        "trig": "Trigonometrie",
        "calculus": "Analysis",
        "sumprod": "Summen & Produkte",
        "set": "Mengenlehre",
        "logic": "Logik",
        "arrows": "Pfeile",
        "matrix": "Matrizen & Vektoren",
        "special": "Spezial"
      },
      "formulas": {
        "einstein": "Masse–Energie",
        "quadratic": "Quadratische Formel",
        "pythagorean": "Satz des Pythagoras",
        "euler": "Eulersche Identität",
        "binomial": "Binomischer Lehrsatz",
        "taylor": "Taylorreihe",
        "gaussian": "Gaußsches Integral",
        "cauchySchwarz": "Cauchy–Schwarz",
        "bayes": "Satz von Bayes",
        "derivative": "Ableitungsdefinition",
        "fourier": "Fourier-Transformation",
        "navierStokes": "Navier–Stokes",
        "maxwell": "Maxwell-Gleichung",
        "schrodinger": "Schrödinger-Gleichung",
        "normalDist": "Normalverteilung",
        "matrix2x2Det": "2×2-Determinante"
      },
      "err": {
        "EMPTY": "Bitte a formula eingeben",
        "RENDER": "Rendering fehlgeschlagen: {{message}}"
      }
    },
    "countdown": {
      "hours": "H",
      "minutes": "M",
      "seconds": "S",
      "start": "Start",
      "pause": "Pause",
      "resume": "Fortsetzen",
      "reset": "Zurücksetzen",
      "done": "Zeit ist um!",
      "err": {
        "INVALID": "a valid hours / minutes / seconds eingeben",
        "ZERO": "Dauer muss größer als 0 sein"
      }
    },
    "stopwatch": {
      "start": "Start",
      "pause": "Pause",
      "resume": "Fortsetzen",
      "reset": "Zurücksetzen",
      "lap": "Runde",
      "lapIndex": "Runde",
      "lapTime": "Rundenzeit",
      "totalTime": "Gesamt"
    },
    "svgPng": {
      "input": "SVG-Quelle",
      "placeholder": "SVG markup… einfügen",
      "dropHint": "a .svg file ablegen oder wählen",
      "scale": "Skalierung",
      "transparent": "Transparenter Hintergrund",
      "download": "PNG herunterladen",
      "sizeHint": "Quelle {{sw}}×{{sh}} → Ausgabe {{pw}}×{{ph}}",
      "err": {
        "EMPTY": "Bitte SVG eingeben",
        "INVALID_SVG": "Kein gültiges SVG",
        "INVALID_SIZE": "Ungültige Ausgabegröße (Skalierung prüfen; max. Kante 8192)",
        "ENCODE": "Konvertierung fehlgeschlagen; SVG prüfen oder Skalierung verringern"
      }
    },
    "imageFrame": {
      "borderWidth": "Rahmenbreite",
      "borderColor": "Rahmenfarbe",
      "radius": "Radius",
      "shadowBlur": "Schattenunschärfe",
      "shadowOffsetY": "Schattenversatz",
      "shadowOpacity": "Schattendeckkraft",
      "dropHint": "an image ablegen oder wählen",
      "download": "PNG herunterladen",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "ENCODE": "Verarbeitung fehlgeschlagen; anderes Bild versuchen"
      }
    },
    "imageAdjust": {
      "brightness": "Helligkeit",
      "contrast": "Kontrast",
      "saturate": "Sättigung",
      "hue": "Farbton",
      "reset": "Zurücksetzen",
      "dropHint": "an image to adjust ablegen oder wählen",
      "original": "Original",
      "download": "PNG herunterladen",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "ENCODE": "Verarbeitung fehlgeschlagen; anderes Bild versuchen"
      }
    },
    "gifFrames": {
      "dropHint": "a GIF file ablegen oder wählen",
      "meta": "{{w}}×{{h}} · {{n}} frames",
      "download": "Herunterladen",
      "downloadAll": "Alle Frames herunterladen",
      "err": {
        "NOT_GIF": "Bitte a GIF file wählen",
        "EMPTY": "Datei ist leer",
        "PARSE": "Fehlgeschlagen: parse GIF"
      }
    },
    "imageCrop": {
      "aspect": "Seitenverhältnis",
      "aspects": {
        "free": "Frei",
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
      "dropHint": "an image to crop ablegen oder wählen",
      "hint": "Im Freimodus ziehen zum Auswählen, oder Werte unten bearbeiten",
      "download": "PNG herunterladen",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "ENCODE": "Zuschneiden fehlgeschlagen; bitte erneut versuchen",
        "INVALID": "Ungültig: crop region"
      }
    },
    "mbti": {
      "progress": "Beantwortet {{done}} / {{total}}",
      "questionIndex": "Frage {{n}} / {{total}}",
      "prev": "Zurück",
      "next": "Weiter",
      "submit": "Ergebnis ansehen",
      "reset": "Leeren",
      "retake": "Wiederholen",
      "yourType": "Ihre Typ-Tendenz",
      "hint": "Wählen Sie die passendere Option; absenden, wenn alle beantwortet sind.",
      "disclaimer": "Vereinfachtes Quiz nur zur Unterhaltung — keine klinische Bewertung.",
      "dims": {
        "EI": "Extraversion E / Introversion I",
        "SN": "Sensing S / Intuition N",
        "TF": "Thinking T / Feeling F",
        "JP": "Judging J / Perceiving P"
      }
    },
    "textCard": {
      "theme": "Theme",
      "themes": {
        "slate": "Slate",
        "ocean": "Ocean",
        "sunset": "Sunset",
        "forest": "Forest",
        "mono": "Mono",
        "paper": "Paper"
      },
      "align": "Ausrichtung",
      "aligns": {
        "left": "Links",
        "center": "Mitte",
        "right": "Rechts"
      },
      "fontSize": "Schriftgröße",
      "padding": "Innenabstand",
      "width": "Breite",
      "title": "Titel",
      "titlePlaceholder": "Optionaler Titel…",
      "body": "Textkörper",
      "bodyPlaceholder": "text for the card… eingeben",
      "preview": "Vorschau",
      "empty": "a title or body to preview eingeben",
      "download": "PNG exportieren",
      "exporting": "Exportiere…"
    },
    "imageCard": {
      "shadow": "Schatten",
      "padding": "Innenabstand",
      "radius": "Block-Radius",
      "width": "Breite",
      "textPosition": "Beschriftungsposition",
      "positions": {
        "below": "Unter dem Foto",
        "above": "Über dem Foto"
      },
      "align": "Ausrichtung",
      "aligns": {
        "left": "Links",
        "center": "Mitte",
        "right": "Rechts"
      },
      "textPadding": "Text-Innenabstand",
      "textBg": "Texthintergrund",
      "titleSize": "Titelgröße",
      "subtitleSize": "Untertitelgröße",
      "rotate": "Fotodrehung",
      "backdrop": "Hintergrund",
      "backdropModes": {
        "preset": "Voreinstellung",
        "color": "Einfarbig",
        "gradient": "Verlauf"
      },
      "backdropColor": "Hintergrundfarbe",
      "gradientFrom": "Von",
      "gradientTo": "Bis",
      "gradientAngle": "Winkel",
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
      "title": "Titel",
      "titlePlaceholder": "Kartentitel…",
      "subtitle": "Untertitel",
      "subtitlePlaceholder": "Unterstützende Zeile…",
      "dropHint": "an image for the card ablegen oder wählen",
      "empty": "Bild hochladen, um die Karte vorzuschauen",
      "download": "PNG exportieren",
      "exporting": "Exportiere…",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "ENCODE": "Export fehlgeschlagen; anderes Bild versuchen"
      }
    },
    "codeHighlight": {
      "language": "Sprache",
      "theme": "Theme",
      "themes": {
        "dark": "Dark",
        "light": "Light"
      },
      "lineNumbers": "Zeilennummern",
      "input": "Code",
      "preview": "Hervorgehobene Vorschau",
      "placeholder": "code… einfügen",
      "copyCode": "Code kopieren",
      "copyHtml": "HTML kopieren",
      "hint": "Powered by Prism; HTML-Snippet für Blogs und Docs kopieren."
    },
    "imageBase64": {
      "upload": "Bild → Base64",
      "uploadHint": "an image ablegen oder wählen",
      "copyDataUrl": "Data-URL kopieren",
      "base64Out": "Base64",
      "paste": "Base64 → Bild",
      "pastePlaceholder": "a Data URL or raw Base64… einfügen",
      "err": {
        "EMPTY": "Base64 or choose an image eingeben",
        "INVALID_BASE64": "Ungültiges Base64",
        "NOT_IMAGE": "Bitte an image file wählen"
      }
    },
    "imageIco": {
      "mode": "Modus",
      "toIco": "Bild → ICO",
      "fromIco": "ICO → PNG",
      "sizes": "Größen",
      "uploadImageHint": "a PNG / JPG / WebP image ablegen oder wählen",
      "uploadIcoHint": "a .ico file ablegen oder wählen",
      "convert": "ICO erstellen",
      "converting": "Arbeitet…",
      "downloadIco": "ICO herunterladen",
      "downloadPng": "PNG herunterladen",
      "extracted": "{{n}} Größen aus {{name}} extrahiert",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "NOT_ICO": "Bitte an ICO file wählen",
        "USE_FROM_ICO": "Für ICO-Dateien auf „ICO → PNG“ umschalten",
        "NO_SIZES": "Mindestens eine Größe auswählen",
        "EMPTY": "Datei ist leer",
        "INVALID_ICO": "Ungültig: or corrupt ICO file",
        "ENCODE": "Konvertierung fehlgeschlagen; anderes Bild versuchen"
      }
    },
    "hsvCmyk": {
      "preview": "Farbvorschau"
    },
    "aiPrompts": {
      "search": "Suchen",
      "searchPlaceholder": "Schlüsselwörter…",
      "category": "Kategorie",
      "empty": "Keine passenden Prompts",
      "cat": {
        "all": "Alle",
        "writing": "Schreiben",
        "coding": "Coding",
        "translate": "Übersetzen",
        "marketing": "Marketing",
        "learning": "Lernen",
        "career": "Karriere"
      }
    },
    "mdMindmap": {
      "input": "Markdown",
      "placeholder": "# Topic\n## Branch\n- Point…",
      "preview": "Mindmap",
      "theme": "Theme",
      "themes": {
        "sky": "Sky",
        "forest": "Forest",
        "sunset": "Sunset",
        "grape": "Grape",
        "ocean": "Ocean",
        "mono": "Mono"
      },
      "zoomIn": "Vergrößern",
      "zoomOut": "Verkleinern",
      "zoomReset": "Zoom zurücksetzen",
      "zoomHint": "Strg / ⌘ halten und scrollen zum Zoomen der Vorschau",
      "downloadSvg": "SVG exportieren",
      "downloadPng": "PNG exportieren",
      "download": "SVG exportieren",
      "exporting": "Exportiere…",
      "empty": "Markdown-Überschriften oder -Listen eingeben, um eine Map zu erzeugen",
      "err": {
        "EMPTY": "Bitte Markdown eingeben"
      }
    },
    "mermaid": {
      "input": "Mermaid",
      "placeholder": "flowchart TD\n  A-->B",
      "preview": "Vorschau",
      "theme": "Theme",
      "themes": {
        "default": "Default",
        "neutral": "Neutral",
        "forest": "Forest",
        "dark": "Dark",
        "ocean": "Ocean",
        "sunset": "Sunset",
        "mono": "Mono"
      },
      "zoomIn": "Vergrößern",
      "zoomOut": "Verkleinern",
      "zoomReset": "Zoom zurücksetzen",
      "zoomHint": "Strg / ⌘ halten und scrollen zum Zoomen der Vorschau",
      "downloadSvg": "SVG exportieren",
      "downloadPng": "PNG exportieren",
      "download": "SVG exportieren",
      "exporting": "Exportiere…",
      "empty": "Mermaid syntax to render eingeben",
      "rendering": "Rendern…",
      "err": {
        "RENDER": "Rendering fehlgeschlagen: {{message}}"
      }
    },
    "cssGradient": {
      "type": "Typ",
      "linear": "Linear",
      "radial": "Radial",
      "angle": "Winkel",
      "shape": "Form",
      "preview": "Verlaufsvorschau",
      "stops": "Stops",
      "addStop": "Stop hinzufügen",
      "position": "Position %",
      "removeStop": "Entfernen",
      "css": "CSS",
      "presetsTitle": "Vorlagen",
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
      "orientation": "Ausrichtung",
      "portrait": "Hochformat",
      "landscape": "Querformat",
      "fit": "Einpassen",
      "contain": "Enthalten",
      "cover": "Abdecken",
      "margin": "Rand (mm)",
      "uploadHint": "an image ablegen oder wählen",
      "downloadPng": "PNG herunterladen",
      "downloadPdf": "PDF exportieren",
      "exporting": "Exportiere…",
      "err": {
        "NOT_IMAGE": "Bitte an image file wählen",
        "INVALID_MARGIN": "Ungültiger Rand",
        "INVALID_IMAGE": "Ungültig: image size"
      }
    },
    "mdToImage": {
      "gfm": "GFM",
      "breaks": "Zeilenumbrüche → <br>",
      "font": "Schrift",
      "fonts": {
        "sans": "Sans-serif",
        "serif": "Serif",
        "mono": "Monospace",
        "song": "Song (Serif CJK)",
        "hei": "Hei (Sans CJK)"
      },
      "fontSize": "Schriftgröße",
      "width": "Breite",
      "padding": "Innenabstand",
      "lineHeight": "Zeilenhöhe",
      "fg": "Textfarbe",
      "bg": "Hintergrund",
      "download": "PNG exportieren",
      "exporting": "Exportiere…",
      "input": "Markdown",
      "placeholder": "# Title\nBody…",
      "preview": "Vorschau",
      "err": {
        "EMPTY": "Bitte Markdown eingeben",
        "PARSE": "Parsing fehlgeschlagen",
        "INVALID_COLOR": "Farbe muss #RGB oder #RRGGBB sein",
        "INVALID_SIZE": "Schriftgröße / Breite / Innenabstand / Zeilenhöhe außerhalb des Bereichs",
        "INVALID_FONT": "Nicht unterstützte Schrift"
      }
    },
    "chartGenerator": {
      "type": "Typ",
      "types": {
        "bar": "Balken",
        "hbar": "Horizontale Balken",
        "line": "Linie",
        "area": "Fläche",
        "pie": "Kreis",
        "doughnut": "Donut",
        "scatter": "Streudiagramm"
      },
      "bar": "Balken",
      "line": "Linie",
      "pie": "Kreis",
      "title": "Titel",
      "seriesLabel": "Serienbezeichnung",
      "legend": "Legende",
      "legends": {
        "top": "Oben",
        "bottom": "Unten",
        "left": "Links",
        "right": "Rechts",
        "none": "Ausgeblendet"
      },
      "colorScheme": "Farbschema",
      "schemes": {
        "vibrant": "Lebendig",
        "pastel": "Pastel",
        "ocean": "Ocean",
        "sunset": "Sunset",
        "forest": "Forest",
        "mono": "Mono",
        "rainbow": "Regenbogen"
      },
      "xLabel": "X-Achsenbeschriftung",
      "yLabel": "Y-Achsenbeschriftung",
      "xLabelPlaceholder": "e.g. Month",
      "yLabelPlaceholder": "e.g. Sales",
      "color": "Farbe",
      "width": "Breite",
      "height": "Höhe",
      "data": "Daten (CSV)",
      "dataPlaceholder": "label,value\napple,30\nbanana,20",
      "preview": "Vorschau",
      "downloadSvg": "SVG herunterladen",
      "downloadPng": "PNG herunterladen",
      "copySvg": "SVG kopieren",
      "err": {
        "EMPTY": "Bitte data eingeben",
        "INVALID": "Ungültig: data format",
        "NO_NUMERIC": "Keine numerischen Werte gefunden"
      }
    },
    "css3Generator": {
      "linked": "Ecken verknüpfen",
      "topLeft": "Oben links",
      "topRight": "Oben rechts",
      "bottomRight": "Unten rechts",
      "bottomLeft": "Unten links",
      "offsetX": "Versatz X",
      "offsetY": "Versatz Y",
      "blur": "Unschärfe",
      "spread": "Streuung",
      "color": "Farbe",
      "inset": "Inset",
      "translateX": "Translation X",
      "translateY": "Translation Y",
      "rotate": "Drehen",
      "scale": "Skalierung",
      "skewX": "Schräg X",
      "property": "Eigenschaft",
      "duration": "Dauer (s)",
      "timing": "Timing",
      "delay": "Verzögerung (s)",
      "brightness": "Helligkeit",
      "contrast": "Kontrast",
      "saturate": "Sättigung",
      "grayscale": "Graustufen",
      "hueRotate": "Farbton drehen",
      "preview": "Vorschau",
      "previewLabel": "Vorschau",
      "css": "CSS",
      "modules": {
        "borderRadius": "Radius",
        "boxShadow": "Box-Schatten",
        "textShadow": "Textschatten",
        "transform": "Transform",
        "transition": "Transition",
        "filter": "Filter"
      }
    },
    "pdf-merge": {
      "hint": "Lokal zusammengefügt — nichts wird hochgeladen. Dateien < 50 MB bevorzugt.",
      "drop": "Mehrere PDFs ablegen",
      "run": "Merge & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-split": {
      "hint": "Teilt in ein PDF pro Seite und lädt jedes herunter.",
      "asZip": "Als ZIP herunterladen",
      "drop": "PDF ablegen",
      "run": "Split & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-delete-pages": {
      "hint": "Zu löschende Seiten, z. B. 1,3-5. Mindestens eine Seite muss bleiben.",
      "pages": "Zu löschende Seiten",
      "run": "Delete & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-extract-pages": {
      "hint": "Zu extrahierende Seiten, z. B. 1,3-5.",
      "pages": "Zu extrahierende Seiten",
      "run": "Extract & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-reorder": {
      "hint": "Mit Pfeilen Seiten neu ordnen, dann exportieren.",
      "pagesUnit": "Seiten",
      "pageLabel": "Seite {{n}}",
      "run": "Apply & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-rotate": {
      "hint": "Winkel für alle oder ausgewählte Seiten wählen.",
      "allPages": "Alle Seiten",
      "pages": "Seiten",
      "run": "Rotate & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-to-image": {
      "hint": "Lokales Rendering; große Dateien können langsam sein.",
      "scale": "Skalierung",
      "pages": "Seiten (optional)",
      "pagesAll": "Leer lassen für alle",
      "run": "Bilder exportieren",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "images-to-pdf": {
      "hint": "Ein Bild pro Seite in Pixelgröße.",
      "drop": "Bilder ablegen",
      "run": "PDF erstellen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-viewer": {
      "hint": "Lokale Vorschau — nichts wird hochgeladen.",
      "prev": "Zurück",
      "next": "Weiter",
      "scale": "Skalierung",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-page-numbers": {
      "hint": "Format unterstützt {n} und {total}.",
      "format": "Formatieren",
      "fontSize": "Schriftgröße",
      "startFrom": "Beginnen bei",
      "run": "Add & herunterladen",
      "pos": {
        "bottom-center": "Unten Mitte",
        "bottom-left": "Unten links",
        "bottom-right": "Unten rechts",
        "top-center": "Oben Mitte"
      },
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-header-footer": {
      "hint": "Mindestens Kopf- oder Fußzeile angeben.",
      "header": "Header",
      "footer": "Fußzeile",
      "fontSize": "Schriftgröße",
      "run": "Apply & herunterladen",
      "align": {
        "left": "Links",
        "center": "Mitte",
        "right": "Rechts"
      },
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-insert-image": {
      "hint": "Ursprung ist unten links auf der Seite (PDF-Koordinaten).",
      "pdf": "PDF-Datei",
      "image": "Bild (PNG/JPG)",
      "allPages": "Alle Seiten",
      "pages": "Seiten",
      "width": "Breite",
      "run": "Insert & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-add-text": {
      "hint": "Ursprung unten links; komplexes Unicode kann eingeschränkt sein.",
      "text": "Text",
      "allPages": "Alle Seiten",
      "pages": "Seiten",
      "fontSize": "Schriftgröße",
      "color": "Farbe",
      "run": "Add & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-sign": {
      "hint": "Visuelle Signatur (Bildüberlagerung), kein digitales Zertifikat.",
      "upload": "Unterschrift hochladen",
      "draw": "Unterschrift zeichnen",
      "allPages": "Alle Seiten",
      "pages": "Seiten",
      "width": "Breite",
      "run": "Sign & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-metadata": {
      "hint": "Titel, Autor und andere Metadaten bearbeiten, dann herunterladen.",
      "pages": "{{n}} Seiten",
      "run": "Save & herunterladen",
      "fields": {
        "title": "Titel",
        "author": "Autor",
        "subject": "Betreff",
        "keywords": "Schlüsselwörter",
        "creator": "Ersteller",
        "producer": "Produzent"
      },
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-encrypt": {
      "hint": "Öffnungspasswort und Berechtigungen setzen. Reader-Unterstützung variiert.",
      "userPassword": "Benutzerpasswort",
      "ownerPassword": "Besitzerpasswort",
      "ownerHint": "Standard: Benutzerpasswort wenn leer",
      "run": "Encrypt & herunterladen",
      "perm": {
        "printing": "Drucken erlauben",
        "copying": "Kopieren erlauben",
        "modifying": "Ändern erlauben",
        "annotating": "Annotieren erlauben"
      },
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-crop": {
      "hint": "Ränder in PDF-Punkten (pt ≈ 1/72 Zoll).",
      "top": "Oben",
      "right": "Rechts",
      "bottom": "Unten",
      "left": "Links",
      "run": "Crop & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-grayscale": {
      "hint": "Visuelle Graustufen durch erneutes Rastern; Text bleibt nicht auswählbar.",
      "run": "Convert & herunterladen",
      "errors": {
        "EMPTY": "Bitte the input vervollständigen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "pdf-annotate": {
      "hint": "PDF öffnen und Annotationen zeichnen: Stift, Markierung, Rechteck, Ellipse, Kreis, Linie und Text.",
      "drop": "PDF ablegen",
      "stroke": "Strich",
      "fontSize": "Schriftgröße",
      "scale": "Zoom",
      "undo": "Rückgängig",
      "clearPage": "Seite leeren",
      "prev": "Zurück",
      "next": "Weiter",
      "count": "{{n}} Annotation(en)",
      "textPrompt": "annotation text eingeben",
      "needVisitPage": "Zuerst Seite {{n}} öffnen, damit sie vor dem Export gerendert werden kann",
      "run": "Annotiertes PDF exportieren",
      "kinds": {
        "pen": "Stift",
        "highlight": "Hervorhebung",
        "rect": "Rechteck",
        "ellipse": "Ellipse",
        "circle": "Kreis",
        "line": "Linie",
        "text": "Text"
      },
      "errors": {
        "EMPTY": "Zuerst mindestens eine Annotation zeichnen",
        "NOT_PDF": "Bitte a PDF file hochladen",
        "NOT_IMAGE": "Bitte an image file hochladen",
        "LOAD_FAILED": "Fehlgeschlagen: load PDF",
        "NO_PAGES": "Dokument hat keine Seiten",
        "INVALID_RANGE": "Ungültig: page range",
        "TOO_LARGE": "Datei zu groß (empfohlen < 50 MB)",
        "ENCRYPT_FAILED": "Verschlüsselung fehlgeschlagen",
        "PROCESS_FAILED": "Verarbeitung fehlgeschlagen"
      }
    },
    "xsltTransform": {
      "sample": "Beispiel laden",
      "xml": "XML",
      "xmlPlaceholder": "XML… einfügen",
      "xslt": "XSLT",
      "xsltPlaceholder": "XSLT stylesheet… einfügen",
      "output": "Ausgabe",
      "preview": "HTML-Vorschau",
      "err": {
        "EMPTY_XML": "Bitte XML eingeben",
        "EMPTY_XSLT": "Bitte XSLT eingeben",
        "INVALID_XML": "Ungültiges XML",
        "INVALID_XSLT": "Ungültiges XSLT",
        "TRANSFORM": "Transformation fehlgeschlagen"
      }
    }
  }
} satisfies TranslationResources;

export default de;
