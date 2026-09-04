import type { TranslationResources } from '../types';

/** Spanish translation resources */
const es = {
  "app": {
    "docTitle": "SynTools · Caja de herramientas online para desarrolladores"
  },
  "header": {
    "openMenu": "Abrir menú",
    "searchPlaceholder": "Buscar herramientas…",
    "searchAria": "Buscar herramientas",
    "themeAria": "Cambiar tema",
    "langAria": "Cambiar idioma",
    "sourceAria": "Código fuente"
  },
  "sidebar": {
    "nav": "Navegación de herramientas",
    "closeMenu": "Cerrar menú",
    "filter": "Filtrar herramientas",
    "filterPlaceholder": "Filtrar…",
    "filterEmpty": "No hay herramientas coincidentes"
  },
  "home": {
    "title": "Caja de herramientas online para desarrolladores",
    "tagline": "Procesamiento local primero; los datos permanecen en tu navegador (CSP, sin salida) · Pulsa <1>⌘K</1> o <3>/</3> para buscar",
    "favorites": "Favoritos",
    "recent": "Usados recientemente",
    "favoriteAria": "Añadir a favoritos",
    "unfavoriteAria": "Quitar de favoritos"
  },
  "search": {
    "aria": "Buscar herramientas",
    "placeholder": "Buscar herramientas (nombre / palabras clave)…",
    "empty": "No se encontraron herramientas coincidentes"
  },
  "categories": {
    "encoding": "Codificación",
    "text": "Texto",
    "formatting": "Formato",
    "crypto": "Cifrado y hash",
    "datetime": "Fecha y hora",
    "generator": "Generadores",
    "network": "Red",
    "image": "Imágenes",
    "pdf": "PDF",
    "other": "Otros"
  },
  "common": {
    "copy": "Copiar",
    "copied": "Copiado",
    "clear": "Borrar",
    "swap": "Intercambiar",
    "download": "Descargar",
    "share": "Compartir",
    "shareTooLong": "Contenido demasiado largo (> 2KB); no se puede crear el enlace para compartir",
    "retry": "Reintentar",
    "loading": "Cargando",
    "operation": "Acción",
    "encode": "Codificar",
    "decode": "Decodificar",
    "result": "Resultado",
    "rawText": "Texto sin procesar",
    "input": "Entrada",
    "output": "Saída",
    "text": "Texto",
    "file": "Archivo",
    "remove": "Eliminar",
    "bytes": "{{size}} bytes"
  },
  "io": {
    "stats": "{{chars}} caracteres / {{bytes}} bytes",
    "warnLarge": "Ingresso de grandi dimensioni (> 500 KB), el cálculo en tiempo real potrebbe rallentare",
    "overflow": "La entrada supera el límite de 5MB; usa el modo archivo para contenido grande"
  },
  "file": {
    "hint": "Arrastra y suelta un archivo aquí, o haz clic para elegir",
    "max": "Max {{size}}",
    "over": "El archivo supera el límite de {{max}} (actual {{size}})",
    "uploadAria": "Cargar archivo",
    "previewAlt": "Vista previa de {{name}}",
    "pages": "{{n}} pages",
    "encrypted": "Cifrado"
  },
  "pdf": {
    "password": "Contraseña del PDF",
    "passwordPlaceholder": "Introduce la contraseña de apertura",
    "passwordHint": "Este PDF está cifrado. Introduce la contraseña para continuar.",
    "unlock": "Desbloquear",
    "errors": {
      "NEED_PASSWORD": "Este PDF está cifrado. Introduce la contraseña.",
      "WRONG_PASSWORD": "Contraseña incorrecta. Inténtalo de nuevo."
    }
  },
  "tool": {
    "errorTitle": "Error en tiempo de ejecución de la herramienta",
    "localBadge": "Solo local",
    "serverBadge": "Requiere servidor",
    "related": "Herramientas relacionadas",
    "nextSteps": "Siguientes pasos",
    "openIn": "Abrir en {{name}}",
    "progress": "Progreso {{current}} / {{total}}"
  },
  "notFound": {
    "message": "Página o herramienta no encontrada",
    "back": "Volver al inicio"
  },
  "toolsMeta": {
    "base64": {
      "name": "Codificar / decodificar Base64",
      "description": "Convierte texto y Base64 con codificación Unicode segura; admite URL Safe y modo archivo"
    },
    "url-codec": {
      "name": "Codificar / decodificar URL",
      "description": "Modos encodeURIComponent / encodeURI con detección de codificación porcentual malformada"
    },
    "regex-tester": {
      "name": "Herramienta Regex",
      "description": "Resaltado de coincidencias, reemplazo, grupos de captura, preajustes y chuleta"
    },
    "text-diff": {
      "name": "Diff de texto",
      "description": "Editores lado a lado con resaltado en línea, números de línea e ignorar espacios"
    },
    "json-format": {
      "name": "Formateador JSON",
      "description": "Formatea / minifica / valida con sangría de 2/4 espacios y errores línea/columna"
    },
    "json-convert": {
      "name": "Conversor JSON",
      "description": "Analiza JSON y lo convierte a YAML / XML / CSV"
    },
    "timestamp": {
      "name": "Conversor de timestamp",
      "description": "Unix ⇄ hora legible con detección auto de segundos/ms y reloj en vivo"
    },
    "uuid": {
      "name": "Generador UUID",
      "description": "UUID v4 aleatorios / v7 ordenados por tiempo con salida por lotes y opciones de formato"
    },
    "hash": {
      "name": "Calculadora de hash",
      "description": "MD5 / SHA-1 / SHA-256 / SHA-512 para texto y archivos (streaming), salida hex / base64"
    },
    "jwt-parser": {
      "name": "Analizador JWT",
      "description": "Analiza header / payload / signature y lee exp y otras claims de tiempo (solo lectura, sin verificar)"
    },
    "aes-crypto": {
      "name": "Cifrar / descifrar AES",
      "description": "AES-GCM con frase PBKDF2 o clave en bruto; salida base64(salt|iv|ciphertext)"
    },
    "hmac": {
      "name": "HMAC",
      "description": "HMAC-SHA256 / SHA512 con salida hex / base64"
    },
    "totp": {
      "name": "TOTP",
      "description": "TOTP RFC 6238: generar / verificar, 6/8 dígitos, segundos restantes"
    },
    "x509-decode": {
      "name": "Decodificador de certificados X.509",
      "description": "Analiza PEM: huellas SHA-256/SHA-1, tipo, longitud DER, CN"
    },
    "cidr-calc": {
      "name": "Calculadora CIDR",
      "description": "CIDR IPv4: red / broadcast / rango de hosts / máscara / nº de hosts"
    },
    "text-lines": {
      "name": "Herramientas de líneas de texto",
      "description": "Ordenar / únicos / invertir / numerar / quitar líneas vacías"
    },
    "hex-codec": {
      "name": "Codificar / decodificar hex",
      "description": "Hex ↔ texto UTF-8 con espacios opcionales"
    },
    "url-query": {
      "name": "Analizador de consulta URL",
      "description": "Analiza partes de URL y parámetros de consulta; reconstruye tras editar"
    },
    "json-path": {
      "name": "Consulta JSONPath",
      "description": "Consultas de ruta simples como a.b[0].c"
    },
    "gzip-tool": {
      "name": "Compresión Gzip",
      "description": "Comprime texto a base64 con Gzip / descomprime de vuelta a texto"
    },
    "exif-strip": {
      "name": "Quitar EXIF",
      "description": "Lee EXIF JPEG básico y elimina APP1; descarga el archivo limpio"
    },
    "fake-data": {
      "name": "Generador de datos falsos",
      "description": "Genera nombres / emails / UUID / lorem en zh/en, 1–50 elementos"
    },
    "password-gen": {
      "name": "Generador de contraseñas",
      "description": "Contraseñas aleatorias fuertes con opciones de longitud / charset, estimación de entropía y nivel"
    },
    "entity-codec": {
      "name": "Codificar / decodificar HTML",
      "description": "Codifica/decodifica caracteres especiales HTML: con nombre / decimal / hex / escapes \\u"
    },
    "cron-parser": {
      "name": "Analizador de expresiones Cron",
      "description": "Valida expresiones cron, explica campos y previsualiza próximas ejecuciones"
    },
    "convert-data": {
      "name": "Conversor de formatos de datos de configuración",
      "description": "Convierte YAML ⇄ JSON ⇄ TOML mediante un valor JS intermedio sin pérdida"
    },
    "sql-format": {
      "name": "Formateador SQL",
      "description": "Embellece SQL en varios dialectos con sangría y mayúsculas de palabras clave configurables"
    },
    "html-format": {
      "name": "Minificar / embellecer HTML",
      "description": "Minifica y embellece HTML con sangría de 2/4 espacios"
    },
    "js-format": {
      "name": "Minificar / embellecer JS",
      "description": "Minifica y embellece JavaScript con sangría de 2/4 espacios"
    },
    "css-format": {
      "name": "Minificar / embellecer CSS",
      "description": "Minifica y embellece CSS con sangría de 2/4 espacios"
    },
    "xml-format": {
      "name": "Minificar / embellecer XML",
      "description": "Embellece y minifica XML con sangría de 2/4 espacios; se conserva CDATA"
    },
    "xml-json": {
      "name": "XML a JSON",
      "description": "Analiza XML a JSON, conservando atributos con el prefijo @_"
    },
    "qrcode": {
      "name": "Código QR",
      "description": "Genera y decodifica códigos QR con ECC, tamaño, colores y margen"
    },
    "color-converter": {
      "name": "Conversor de color",
      "description": "Convierte y previsualiza formatos HEX / RGB / HSL"
    },
    "radix-converter": {
      "name": "Conversor de bases",
      "description": "Convierte bases 2/8/10/16 y visualiza operaciones bit a bit para enteros con signo de 64 bits"
    },
    "markdown-preview": {
      "name": "Vista previa Markdown",
      "description": "Renderizado GFM en vivo con sanitización DOMPurify para vista previa segura"
    },
    "image-compress": {
      "name": "Comprimir imagen",
      "description": "Compresión y conversión de imagen en el cliente (PNG / JPEG / WebP) con redimensionado y calidad"
    },
    "unicode-codec": {
      "name": "Códec Unicode",
      "description": "Convierte texto a/desde \\uXXXX, puntos de código, entidades HTML y bytes UTF-8"
    },
    "html-color-picker": {
      "name": "Selector de color HTML",
      "description": "Elige colores visualmente y exporta HEX / RGB / HSL más fragmentos HTML/CSS"
    },
    "web-color-table": {
      "name": "Tabla de colores web",
      "description": "Colores con nombre CSS con filtros por grupo y copia de nombre / HEX / RGB"
    },
    "pinyin": {
      "name": "Chino a pinyin",
      "description": "Convierte chino a pinyin con tonos, separador y mayúsculas opcionales"
    },
    "length-converter": {
      "name": "Conversor de longitud",
      "description": "Convierte unidades de longitud métricas e imperiales (mm, cm, m, km, in, ft y más)"
    },
    "zh-convert": {
      "name": "Conversor de chino tradicional",
      "description": "Convierte entre chino simplificado y tradicional"
    },
    "weight-converter": {
      "name": "Conversor de peso",
      "description": "Convierte unidades de peso métricas e imperiales (mg, g, kg, t, oz, lb, st)"
    },
    "text-counter": {
      "name": "Contador de texto",
      "description": "Cuenta caracteres, palabras, líneas, párrafos, caracteres CJK y bytes UTF-8"
    },
    "calendar": {
      "name": "Calendario",
      "description": "Vista mensual con lunar/almanaque para chino y festivos locales para inglés"
    },
    "css-button": {
      "name": "Generador de botones CSS",
      "description": "Ajusta estilos visualmente y genera CSS / HTML de botones"
    },
    "random-number": {
      "name": "Generador de números aleatorios",
      "description": "Genera enteros o decimales aleatorios en un rango, con valores únicos opcionales"
    },
    "random-string": {
      "name": "Generador de cadenas aleatorias",
      "description": "Genera cadenas aleatorias por longitud y charset (alnum / hex / personalizado)"
    },
    "doodle-board": {
      "name": "Pizarra de dibujo",
      "description": "Bloc de dibujo del navegador con pincel, borrador y exportación PNG"
    },
    "calculator": {
      "name": "Calculadora",
      "description": "Calculadora de expresiones segura con aritmética, potencias, módulo y funciones comunes"
    },
    "code-image": {
      "name": "Código a imagen",
      "description": "Renderiza código como tarjeta con resaltado de sintaxis y exporta PNG"
    },
    "image-color-picker": {
      "name": "Selector de color de imagen",
      "description": "Sube una imagen y haz clic en un píxel para muestrear HEX / RGB"
    },
    "ascii-table": {
      "name": "Tabla ASCII",
      "description": "Referencia ASCII 0–127 con búsqueda por decimal, hex o carácter"
    },
    "image-watermark": {
      "name": "Marca de agua en imagen",
      "description": "Añade una marca de agua de texto con posición, opacidad, rotación y mosaico"
    },
    "case-convert": {
      "name": "Conversor de mayúsculas/minúsculas",
      "description": "Convierte mayúsculas/minúsculas y estilos de nombres (camel / snake / kebab, etc.)"
    },
    "bmi-calculator": {
      "name": "Calculadora de IMC",
      "description": "Calcula el IMC a partir de altura y peso con categorías WHO para adultos"
    },
    "placeholder-image": {
      "name": "Imagen de marcador de posición",
      "description": "Genera un PNG de marcador de posición por tamaño, colores y texto opcional"
    },
    "image-merge": {
      "name": "Fusionar imágenes",
      "description": "Une imágenes en horizontal, vertical o cuadrícula en un PNG"
    },
    "cron-generator": {
      "name": "Generador de Crontab",
      "description": "Construye una expresión Cron estándar de 5 campos a partir de minuto/hora/día/mes/día de la semana"
    },
    "ua-parser": {
      "name": "Analizador User-Agent",
      "description": "Analiza un User-Agent del navegador en navegador, motor, SO y dispositivo"
    },
    "latex-editor": {
      "name": "Editor de matemáticas LaTeX",
      "description": "Símbolos rápidos y fórmulas clásicas, vista previa KaTeX, exportar PNG/JPG/SVG"
    },
    "countdown": {
      "name": "Temporizador de cuenta atrás",
      "description": "Define horas, minutos y segundos; pausa, reanuda y alerta al terminar"
    },
    "stopwatch": {
      "name": "Cronómetro",
      "description": "Cronómetro online con inicio, pausa, vuelta y reinicio"
    },
    "svg-to-png": {
      "name": "SVG a PNG",
      "description": "Convierte marcado o archivos SVG a PNG con escala y transparencia"
    },
    "image-frame": {
      "name": "Borde / radio / sombra de imagen",
      "description": "Añade borde, esquinas redondeadas y sombra, luego exporta PNG"
    },
    "image-adjust": {
      "name": "Ajuste de color de imagen",
      "description": "Ajusta brillo, contraste, saturación y tono, luego exporta PNG"
    },
    "gif-frames": {
      "name": "Extractor de fotogramas GIF",
      "description": "Divide un GIF en fotogramas PNG; descarga uno o todos"
    },
    "image-crop": {
      "name": "Recortar imagen",
      "description": "Recorta imágenes a mano alzada o con proporciones fijas a PNG"
    },
    "mbti-test": {
      "name": "Test de personalidad MBTI",
      "description": "Un breve cuestionario estilo MBTI de 24 preguntas (solo entretenimiento)"
    },
    "text-card": {
      "name": "Texto a tarjeta",
      "description": "Maquetación de título y cuerpo en una tarjeta con estilo y exportación PNG"
    },
    "image-card": {
      "name": "Imagen a tarjeta",
      "description": "Tarjeta foto + título/subtítulo con fondos o degradados, exportar PNG"
    },
    "code-highlight": {
      "name": "Resaltador de código",
      "description": "Resaltado de sintaxis en vivo con números de línea y copia de fragmento HTML"
    },
    "image-base64": {
      "name": "Imagen ↔ Base64",
      "description": "Convierte imágenes a Base64 / Data URL y viceversa, totalmente en local"
    },
    "image-ico": {
      "name": "Conversor ICO",
      "description": "Convierte imágenes a ICO multi-tamaño (favicon), o extrae PNG desde ICO"
    },
    "hsv-cmyk": {
      "name": "Conversor HSV / CMYK",
      "description": "Convierte y previsualiza espacios RGB, HSV, CMYK y HEX"
    },
    "ai-prompts": {
      "name": "Biblioteca de prompts de IA",
      "description": "Prompts seleccionados por categoría con búsqueda y copia en un clic"
    },
    "md-mindmap": {
      "name": "Mapa mental Markdown",
      "description": "Convierte Markdown en mapa mental con temas, zoom y exportación PNG/SVG"
    },
    "mermaid-editor": {
      "name": "Editor de diagramas Mermaid",
      "description": "Renderiza Mermaid en local con temas, zoom y exportación PNG/SVG"
    },
    "css-gradient": {
      "name": "Generador de degradados CSS",
      "description": "Edita degradados lineales / radiales con preajustes categorizados y copia CSS"
    },
    "image-to-paper": {
      "name": "Imagen a PDF de papel",
      "description": "Ajusta imágenes a A3/A4/A5/Letter y exporta PDF"
    },
    "md-to-image": {
      "name": "Markdown a imagen",
      "description": "Renderiza Markdown a una tarjeta con estilo y exporta PNG con fuente, tamaño, ancho y colores"
    },
    "chart-generator": {
      "name": "Generador de gráficos",
      "description": "Crea gráficos de barras/líneas/áreas/pastel/anillo/dispersión desde CSV con leyendas y paletas"
    },
    "css3-generator": {
      "name": "Generador de código CSS3",
      "description": "Genera border-radius, sombras, transform, filter y más"
    },
    "xslt-transform": {
      "name": "Transformación XSLT",
      "description": "Transforma XML a HTML con XSLT en el navegador"
    },
    "pdf-merge": {
      "name": "Combinar PDF",
      "description": "Combina varios PDF en un solo archivo"
    },
    "pdf-split": {
      "name": "Dividir PDF",
      "description": "Divide un PDF en un archivo por página"
    },
    "pdf-delete-pages": {
      "name": "Eliminar páginas PDF",
      "description": "Elimina las páginas seleccionadas de un PDF"
    },
    "pdf-extract-pages": {
      "name": "Extraer páginas PDF",
      "description": "Extrae las páginas seleccionadas a un PDF nuevo"
    },
    "pdf-reorder": {
      "name": "Reordenar páginas PDF",
      "description": "Reordena las páginas de un PDF"
    },
    "pdf-rotate": {
      "name": "Rotar páginas PDF",
      "description": "Rota las páginas seleccionadas o todas"
    },
    "pdf-to-image": {
      "name": "PDF a imagen",
      "description": "Renderiza páginas PDF como JPG/PNG"
    },
    "images-to-pdf": {
      "name": "Imágenes a PDF",
      "description": "Combina imágenes en un PDF"
    },
    "pdf-viewer": {
      "name": "Visor PDF",
      "description": "Abre y lee un PDF en local"
    },
    "pdf-page-numbers": {
      "name": "Números de página PDF",
      "description": "Añade números de página a un PDF"
    },
    "pdf-header-footer": {
      "name": "Encabezado y pie PDF",
      "description": "Añade texto de encabezado y pie"
    },
    "pdf-insert-image": {
      "name": "Insertar imagen en PDF",
      "description": "Coloca una imagen en las páginas del PDF"
    },
    "pdf-add-text": {
      "name": "Añadir texto al PDF",
      "description": "Añade texto en las páginas del PDF"
    },
    "pdf-sign": {
      "name": "Firmar PDF",
      "description": "Dibuja o sube una imagen de firma (visual, no certificado)"
    },
    "pdf-metadata": {
      "name": "Metadatos PDF",
      "description": "Ver y editar metadatos PDF"
    },
    "pdf-encrypt": {
      "name": "Cifrar PDF",
      "description": "Define contraseña y flags de permisos"
    },
    "pdf-crop": {
      "name": "Recortar PDF",
      "description": "Recorta márgenes de página mediante cropBox"
    },
    "pdf-grayscale": {
      "name": "PDF en escala de grises",
      "description": "Convierte PDF a escala de grises visual"
    },
    "pdf-annotate": {
      "name": "Anotar PDF",
      "description": "Dibuja resaltados, a mano alzada, formas y texto en páginas PDF"
    }
  },
  "tools": {
    "base64": {
      "direction": {
        "encode": "Codificar (texto → Base64)",
        "decode": "Decodificar (Base64 → texto)"
      },
      "urlSafe": "URL Seguro (- _ sin imbottitura)",
      "labels": {
        "rawText": "Texto sin procesar",
        "base64Input": "Entrada Base64",
        "base64Result": "Resultado Base64",
        "decodeResult": "Resultado decodificado"
      },
      "placeholders": {
        "encode": "Introduce texto para codificar…",
        "decode": "Paste a Base64 string…"
      },
      "fileNote": "Mostrando un resultado Base64 de archivo; al escribir texto se borrará.",
      "fileMode": "Modo archivo: archivo → Base64 (fragmentos ArrayBuffer)",
      "err": {
        "INVALID_PADDING": "Padding no válido \"=\" en posición {{position}}",
        "INVALID_CHAR": "Carácter \" {{char}} \" no válido en la posición {{position}}",
        "INVALID_LENGTH": "Invalid length: Base64 content length mod 4 cannot be 1",
        "DECODE_FAILED": "Error al decodificar: entrada Base64 no válida"
      }
    },
    "url": {
      "modes": {
        "component": "componente (valor de parámetro; codifica caracteres reservados)",
        "full": "URL completa (conserva : / ? & etc.)"
      },
      "mode": "Mode",
      "labels": {
        "rawText": "Texto sin procesar",
        "encodedText": "Texto codificado"
      },
      "placeholders": {
        "encode": "Introduce contenido para codificar…",
        "decode": "Pegar contenido codificado en percentuale..."
      },
      "err": {
        "ENCODE_FAILED": "Error al codificar: la entrada contiene caracteres sustitutos no emparejados",
        "DECODE_FAILED": "Error al decodificar: codificación porcentual malformada"
      }
    },
    "regex": {
      "presets": "Preimpostaciones",
      "presetPlaceholder": "Elige qué rellenar…",
      "expression": "Pattern",
      "expressionPlaceholder": "e.g. \\d+",
      "flags": "Flag",
      "testText": "Texto de prova",
      "testTextPlaceholder": "Pegar el texto para abbinarlo...",
      "matchCount": "{{count}} match(es)",
      "truncated": " (truncado; se muestran los primeros 1000)",
      "position": "Indice",
      "matchContent": "Match",
      "captureGroups": "Grupos",
      "emptyMatch": "(coincidencia vacía)",
      "tableLimit": "Showing first {{count}} rows only",
      "mode": "Mode",
      "modes": {
        "match": "Match",
        "replace": "Reemplazar"
      },
      "replacement": "Reemplazar con",
      "replacementPlaceholder": "Supporta $1, $&,...",
      "replaceResult": "Reemplazar resultado",
      "cheatSheet": "Chuleta (clic para insertar)",
      "cheat": {
        "dot": "Cualquier carácter",
        "digit": "Dígito",
        "word": "Word char",
        "space": "Whitespace",
        "start": "Inizio línea",
        "end": "Fin de línea",
        "star": "0 o más",
        "plus": "1 o más",
        "question": "0 o 1",
        "or": "Alternancia",
        "group": "Grupo de captura",
        "class": "Clase de caracteres",
        "range": "Range",
        "not": "Classe negata"
      },
      "presetsList": {
        "email": "Email",
        "phoneCn": "Telefono (Cina continentale)",
        "idCard": "Carta d'identidad (18 cifre)",
        "url": "URL",
        "ipv4": "Dirección 0",
        "date": "Fecha (yyyy-mm-dd)"
      },
      "err": {
        "EMPTY": "L'expresión regular no puede essere vuota",
        "COMPILE": "Error de compilación: {{message}}",
        "TEXT_TOO_LONG": "El texto supera el límite de {{limit}}K caracteres; se detuvo la coincidencia (protección ReDoS / ejecución larga)"
      }
    },
    "textDiff": {
      "oldText": "Originale",
      "newText": "Revisionato",
      "swapSides": "Inverti lati",
      "stats": "+{{added}} añadidos / −{{removed}} eliminados / {{same}} sin cambios",
      "identical": "Ambos textos son idénticos",
      "renderLimit": "Too many diff rows; rendering first {{count}} only",
      "ignoreWhitespace": "Ignora espacios finali / ripetuti",
      "err": {
        "TOO_LARGE": "El texto combinado supera el límite de {{limit}}K caracteres; se detuvo el diff (protección de ejecución larga)"
      }
    },
    "json": {
      "actions": {
        "format": "Format",
        "compress": "Minify",
        "validate": "Solo convalida"
      },
      "indent": "Rientro",
      "indent2": "2 espacios",
      "indent4": "4 espacios",
      "inputLabel": "Ingresso 0",
      "validateResult": "Resultado convalida",
      "inputPlaceholder": "Pegar JSON, p. ej. {\"a\": 1}...",
      "valid": "✓ Válido JSON",
      "err": {
        "EMPTY": "JSON análisis incorrecto: el input es vacío",
        "UNKNOWN": "JSON análisis incorrecto: error sconosciuto",
        "INVALID_LITERAL": "JSON análisis incorrecto: letterale previsto \" {{literal}} \" (línea {{line}} , columna {{column}} )",
        "NEWLINE_IN_STRING": "Error al analizar JSON: la cadena no puede abarcar líneas (línea {{line}}, columna {{column}})",
        "UNEXPECTED_STRING_END": "JSON análisis incorrecto: cadena terminata inaspettatamente (línea {{line}} , columna {{column}} )",
        "INVALID_UNICODE_ESCAPE": "JSON análisis incorrecto: escape no válido \\u, son necessarie 4 cifre esadecimali (línea {{line}} , columna {{column}} )",
        "INVALID_ESCAPE": "JSON análisis incorrecto: escape no válido \"\\ {{char}} \" (línea {{line}} , columna {{column}} )",
        "INVALID_NUMBER": "JSON análisis incorrecto: número no válido (línea {{line}} , columna {{column}} )",
        "DECIMAL_NO_DIGITS": "JSON análisis incorrecto: cifre richieste después la virgola decimale (línea {{line}} , columna {{column}} )",
        "EXPONENT_NO_DIGITS": "JSON análisis incorrecto: cifre richieste nell'esponente (línea {{line}} , columna {{column}} )",
        "UNEXPECTED_END": "JSON análisis incorrecto: fine imprevista, valor mancante (línea {{line}} , columna {{column}} )",
        "INVALID_CHAR": "JSON análisis incorrecto: carácter \" {{char}} \" no válido (línea {{line}} , columna {{column}} )",
        "TRAILING_COMMA": "JSON análisis incorrecto: virgola finale no consentita (línea {{line}} , columna {{column}} )",
        "KEY_MUST_BE_STRING": "JSON análisis incorrecto: la clave dell'oggetto debe essere una cadena (línea {{line}} , columna {{column}} )",
        "MISSING_COLON": "JSON análisis incorrecto: manca \":\" después la clave dell'oggetto (línea {{line}} , columna {{column}} )",
        "MISSING_VALUE": "JSON análisis incorrecto: valor mancante (línea {{line}} , columna {{column}} )",
        "UNCLOSED_OBJECT": "JSON análisis incorrecto: oggetto no chiuso, \"}\" mancante (línea {{line}} , columna {{column}} )",
        "MISSING_COMMA_OBJECT": "JSON análisis incorrecto: manca \",\" entre los membri dell'oggetto (línea {{line}} , columna {{column}} )",
        "UNCLOSED_ARRAY": "JSON análisis incorrecto: matrice no chiusa, manca \"]\" (línea {{line}} , columna {{column}} )",
        "MISSING_COMMA_ARRAY": "JSON análisis incorrecto: manca \",\" entre los elementi dell'array (línea {{line}} , columna {{column}} )",
        "EXTRA_CONTENT": "JSON análisis incorrecto: contenido extra después el valor (línea {{line}} , columna {{column}} )",
        "UNCLOSED_STRING": "JSON análisis incorrecto: cadena no chiusa (línea {{line}} , columna {{column}} )"
      }
    },
    "timestamp": {
      "currentTime": "Hora actual",
      "pauseTick": "Metti en pausa el orologio",
      "resumeTick": "Riattiva orologio",
      "second": "Secondi",
      "millisecond": "Millisecondi",
      "localPrefix": "Local: {{local}} · {{utc}}",
      "tsToReadable": "Timestamp tiempo → leggibile (detección automatico segundos / ms)",
      "fillCurrentSec": "Rellenar actual (segundos)",
      "tsInput": "Inserimento marca temporale",
      "tsPlaceholder": "e.g. 1725000000 or 1725000000000",
      "localTime": "Hora local",
      "relative": "Relativo (detectado como {{unit}} )",
      "unitSeconds": "seconds",
      "unitMilliseconds": "milliseconds",
      "dateToTs": "→ Timestamp leggibile (el spazio separato utilizza el zona horaria local)",
      "dateInput": "Entrada de fecha/hora",
      "datePlaceholder": "e.g. 2026-09-01 12:00:00 or 2026-09-01T04:00:00Z",
      "relativeAgo": "{{count}} {{unit}} ago",
      "relativeLater": "{{count}} {{unit}} from now",
      "units": {
        "second": "seconds",
        "minute": "minutes",
        "hour": "hours",
        "day": "days",
        "year": "years"
      },
      "err": {
        "NOT_NUMERIC": "El timestamp debe ser numérico (se permiten negativos)",
        "OUT_OF_RANGE": "Timestamp fuera dall'intervallo numerico",
        "TS_TOO_LARGE": "Timestamp fuera intervallo rappresentabile (±275760 anni)",
        "DATE_EMPTY": "Introduce una fecha",
        "DATE_INVALID": "No se puede analizar fecha/hora (p. ej. 2026-09-01 12:00:00 o ISO 8601)"
      }
    },
    "uuid": {
      "version": "Version",
      "versions": {
        "v4": "v4 (random)",
        "v7": "v7 (time-ordered)"
      },
      "count": "Cantidad",
      "uppercase": "Uppercase",
      "hyphens": "Sillabaciones",
      "braces": "Llaves",
      "generate": "Generar",
      "output": "Generado (uno por línea)",
      "err": {
        "INVALID_COUNT": "La cantidad debe ser un entero ≥ 1",
        "TOO_MANY": "Máximo {{max}} UUID para lotto"
      }
    },
    "hash": {
      "algorithm": "Algoritmo",
      "encoding": "Saída",
      "encodings": {
        "hex": "hex (hexadecimal)",
        "base64": "base64"
      },
      "source": "Source",
      "textInput": "Input de texto",
      "textPlaceholder": "Introduce texto para calcular el hash…",
      "result": "{{algorithm}} result",
      "computing": "Calculando…",
      "fileHint": "Arrastra y suelta un archivo aquí, o haz clic para elegir (MD5 en streaming; archivos grandes seguros en memoria)",
      "limitHint": "Nota: los algoritmos distintos de MD5 cargan el archivo completo en memoria; archivos muy grandes pueden agotar la memoria",
      "err": {
        "UNSUPPORTED": "Error de hash: algoritmo no compatible en este entorno",
        "FILE_HASH": "Error de hash del archivo: {{message}}",
        "FILE_READ": "No se pudo leer el contenido del archivo"
      }
    },
    "jwt": {
      "mode": "Mode",
      "modes": {
        "parse": "Analizza",
        "sign": "Cartello (HS256)"
      },
      "secretPlaceholder": "Secreto HMAC…",
      "payloadJson": "Carico utile",
      "payloadPlaceholder": "{ \"sub\": \"123\", \"name\": \"Alice\" }",
      "signedToken": "Token firmado",
      "signNote": "Segni con HS256 en el navegador; el secreto no lascia mai el dispositivo",
      "inputLabel": "Ingresso 0",
      "inputPlaceholder": "Pegar un JWT (prefijo del portatore compatible), p. ej. eyJhbGci...",
      "header": "Header",
      "payload": "Carico utile",
      "signature": "Signature",
      "note": "Solo analisi, ninguna verifica de la firma: la verifica richiede una clave; todas las elaboraciones rimangono en el navegador",
      "alg": "Algoritmo",
      "expired": "Caducado",
      "notExpired": "Non caducado",
      "claims": {
        "exp": "Caducidad exp",
        "nbf": "Non antes",
        "iat": "Emesso a"
      },
      "err": {
        "EMPTY": "Incollare un JWT",
        "INVALID_PARTS": "Formato no válido: un JWT es costituito desde header.payload.signature",
        "INVALID_HEADER": "No se pudo analizar el encabezado: JSON en base64url no válido",
        "INVALID_PAYLOAD": "No se pudo analizar el payload: JSON en base64url no válido",
        "SIGN_FAILED": "Firma no correcta"
      }
    },
    "aes-crypto": {
      "encrypt": "Cifrar",
      "decrypt": "Descifrar",
      "keyMode": "Modalidad clave",
      "passphrase": "Passphrase (PBKDF2)",
      "rawKey": "Clave grezza (esadecimale)",
      "passphrasePlaceholder": "Introduce la frase de contraseña…",
      "keyHexPlaceholder": "32 o 64 caracteres hex (AES-128/256)…",
      "ivPlaceholder": "Facoltativo IV (24 caracteres esadecimali/ 12 byte); casuale si vacío",
      "plaintext": "Plaintext",
      "ciphertext": "Texto cifrado (base64)",
      "inputPlaceholder": "Introduce contenido…",
      "note": "Salida cifrada: base64(salt|iv|ciphertext+tag); la frase de contraseña usa PBKDF2-SHA256",
      "err": {
        "EMPTY": "Introduce el contenido",
        "INVALID_KEY": "Clave no válida: controlla la passphrase o la lunghezza de la clave esadecimale",
        "DECRYPT_FAILED": "Error al descifrar: clave incorrecta o datos corruptos",
        "INVALID_INPUT": "Input no válido: texto cifrato errato o IV"
      }
    },
    "hmac": {
      "algorithm": "Algoritmo",
      "encoding": "Saída",
      "secretPlaceholder": "Secreto HMAC…",
      "message": "Messaje",
      "messagePlaceholder": "Messaje desde autenticare...",
      "err": {
        "EMPTY": "Introduce un mensaje",
        "INVALID_KEY": "Inserire un codice válido"
      }
    },
    "totp": {
      "digits": "Dígitos",
      "secret": "Secreto Base32",
      "secretPlaceholder": "Pegar Authenticator secret (Base32)...",
      "code": "Código actual",
      "remaining": "segundos rimasti",
      "verify": "Codice de verifica (facoltativo)",
      "verifyPlaceholder": "Introduce un código de 6/8 dígitos…",
      "verifyOk": "Verifica effettuata",
      "verifyFail": "Verifica no correcta",
      "err": {
        "EMPTY": "Introduce la clave segreta",
        "INVALID_SECRET": "El secreto no es Base32 válido"
      }
    },
    "cidr-calc": {
      "input": "CIDR",
      "placeholder": "e.g. 192.168.1.0/24",
      "fields": {
        "network": "Red",
        "broadcast": "Broadcast",
        "firstHost": "Primer host",
        "lastHost": "Ultimo host",
        "netmask": "子网掩码",
        "wildcard": "Wildcard",
        "prefix": "Prefisso",
        "hostCount": "Conteggio de los host",
        "totalAddresses": "Total indirizzi IP"
      },
      "err": {
        "EMPTY": "Per favore introduce un",
        "INVALID": "CIDR (IPv4/prefijo no válido, p. ej. 10.0.0.0/8)"
      }
    },
    "text-lines": {
      "placeholder": "Un articolo por línea...",
      "ops": {
        "sort-asc": "Crescente",
        "sort-desc": "Decrescente",
        "unique": "Único",
        "reverse": "Reverse",
        "number": "Numero líneas",
        "trim-empty": "Taglia líneas vuote"
      },
      "err": {
        "EMPTY": "Si prega de inserire el texto"
      }
    },
    "hex-codec": {
      "spaced": "Byte separati desde espacios",
      "placeholder": "Texto o esadecimale...",
      "err": {
        "EMPTY": "Introduce el contenido",
        "INVALID_HEX": "Hex no válido (lunghezza pari, 0-9a-f)"
      }
    },
    "url-query": {
      "input": "URL",
      "placeholder": "https://example.com/path?a=1&b=2",
      "addParam": "Añadir parámetro",
      "key": "Key",
      "value": "Valore",
      "rebuilt": "Ricostruito",
      "parts": {
        "protocol": "Protocollo",
        "hostname": "Host",
        "port": "Port",
        "pathname": "Path",
        "hash": "Hash",
        "origin": "Provenienza"
      },
      "err": {
        "EMPTY": "Per favore introduce un",
        "INVALID_URL": "{0} no válido.&#x0D;"
      }
    },
    "json-path": {
      "pathPlaceholder": "Percorso, p. ej. a.b[0].c o $.a.b[0]",
      "json": "JSON",
      "jsonPlaceholder": "Pegar",
      "err": {
        "EMPTY": "Introduce JSON y un ruta",
        "INVALID_JSON": "Parse fallido!",
        "NOT_FOUND": "Impossibile trovare el ruta"
      }
    },
    "gzip-tool": {
      "compress": "Comprimir (texto → base64)",
      "decompress": "Descomprimir (base64 → texto)",
      "placeholder": "Texto o gzip base64...",
      "err": {
        "EMPTY": "Introduce el contenido",
        "INVALID": "Input no válido",
        "DECOMPRESS_FAILED": "Error al descomprimir: datos gzip no válidos"
      }
    },
    "x509-decode": {
      "input": "Certificado PEM",
      "placeholder": "-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----",
      "fields": {
        "pemType": "Type",
        "derLength": "Longitud DER",
        "sha256": "SHA-256",
        "sha1": "SHA-1",
        "subject": "Soggetto CN",
        "issuer": "CN emittente"
      },
      "err": {
        "EMPTY": "Si prega de incollare PEM",
        "INVALID_PEM": "PEM no válido"
      }
    },
    "exif-strip": {
      "hint": "JPEG only: strip APP1 (EXIF) and download.",
      "drop": "Suelta una imagen JPEG",
      "hasExif": "Tiene EXIF",
      "orientation": "Orientamento",
      "make": "Marca de cámara",
      "yes": "Yes",
      "no": "No",
      "download": "Descargar archivo limpio",
      "err": {
        "EMPTY": "Per favore elige un archivo",
        "UNSUPPORTED": "solo 0",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "fake-data": {
      "kind": "Kind",
      "locale": "Impostaciones locali",
      "count": "Cantidad",
      "generate": "Generar",
      "kinds": {
        "name": "Name",
        "email": "Email",
        "uuid": "UUID",
        "lorem": "Paragrafo"
      },
      "err": {
        "EMPTY": "Completa las opciones",
        "INVALID_COUNT": "La cantidad debe ser un entero de 1 a 50"
      }
    },
    "password": {
      "length": "Lung.",
      "generate": "Generar",
      "lowercase": "Minuscole (a-z)",
      "uppercase": "Lettere mayúsculas desde la A a la Z",
      "digits": "Dígitos (0-9)",
      "symbols": "Simbologia",
      "excludeAmbiguous": "Excluir caracteres ambiguos (0 O 1 l I etc.)",
      "ensureEach": "Includi almeno un carácter desde ciascun set SELECTto",
      "output": "Resultado",
      "outputPlaceholder": "Haz clic en «Generar» para crear una contraseña",
      "entropy": "Entropía ≈ {{bits}} bits",
      "strength": {
        "weak": "Weak",
        "medium": "Medio",
        "strong": "Strong"
      },
      "err": {
        "NO_SETS": "Seleccionar almeno un set de caracteres",
        "INVALID_LENGTH": "La lunghezza debe essere compresa entre 4 y 128"
      }
    },
    "entity": {
      "direction": "Dirección",
      "encode": "Codificar",
      "decode": "Decodificar",
      "mode": "Format",
      "modes": {
        "named": "Con nome (&amp;)",
        "decimal": "Decimal (&)",
        "hex": "Esagonale (&)",
        "unicode": "\\u escape (\\u4E2D)"
      },
      "scope": "Scope",
      "scopes": {
        "special": "Solo caracteres speciali (&, <, > ecc.)",
        "nonascii": "Caracteres speciali + no ASCII"
      },
      "input": "Entrada",
      "output": "Saída",
      "inputEncodePlaceholder": "Texto desde codificare, p. ej. <b>Ciao</b>...",
      "inputDecodePlaceholder": "Texto desde decodificare, p. ej. &lt;b&gt;&#20320;&#22909;...",
      "unknown": "Entidad no riconosciute (mantenute così como son)"
    },
    "cron": {
      "expression": "Expresión",
      "placeholder": "e.g. */5 8-18 * * 1-5 or @daily (5 fields, 6 with seconds)",
      "count": "Cantidad",
      "normalized": "Normalizzato",
      "fieldsTitle": "Desglose de campos",
      "colField": "Campo",
      "colValue": "Valore",
      "colMeaning": "Significato",
      "nextTitle": "Prossime {{count}} corse",
      "fieldNames": {
        "second": "Segundo",
        "minute": "Minuto",
        "hour": "Hour",
        "day": "Day",
        "month": "Mes",
        "week": "Día lavorativo"
      },
      "err": {
        "EMPTY": "Introduce un'expresión cron",
        "INVALID": "No se puede analizar: comprueba el nº de campos (5 o 6) y los rangos (min 0-59 / hora 0-23 / día 1-31 / mes 1-12 / día sem. 0-7)"
      },
      "desc": {
        "every": {
          "second": "cada attimo,",
          "minute": "cada minuto",
          "hour": "cada ahora",
          "day": "cada día",
          "month": "cada mese",
          "week": "cada día de la settimana"
        },
        "step": "cada {{n}} {{unit}}",
        "at": "{{noun}}{{values}}",
        "range": "{{noun}}{{a}}–{{b}}",
        "rangeStep": "{{noun}}{{a}}–{{b}}, every {{n}}",
        "units": {
          "second": "seconds",
          "minute": "minutes",
          "hour": "hours",
          "day": "days",
          "month": "months",
          "week": "days"
        },
        "nouns": {
          "second": "secondo",
          "minute": "minuto",
          "hour": "ahora",
          "day": "day ",
          "month": "mese ",
          "week": "día de la settimana"
        },
        "sep": ", ",
        "days": [
          "Domingo",
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado"
        ],
        "months": [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec"
        ]
      }
    },
    "convert": {
      "from": "From",
      "to": "To",
      "formats": {
        "yaml": "YAML",
        "json": "JSON",
        "toml": "TOML"
      },
      "input": "Entrada",
      "output": "Saída",
      "placeholder": "Pegar el contenido desde convertire...",
      "err": {
        "PARSE": "No se pudo analizar la entrada: comprueba la sintaxis",
        "STRINGIFY": "No se puede convertir al formato de destino (p. ej. TOML no admite arrays/escalares de nivel superior)"
      }
    },
    "sql": {
      "dialect": "Dialecto",
      "indent": "Rientro",
      "keywordCase": "Keyword case",
      "cases": {
        "upper": "UPPERCASE",
        "lower": "lowercase",
        "preserve": "Conservare"
      },
      "languages": {
        "sql": "SQL genérico",
        "mysql": "Mysql",
        "postgresql": "PostgreSQL",
        "sqlite": "(SQLITE).",
        "mariadb": "MariaDB",
        "transactsql": "SQL Server",
        "plsql": "PL/SQL"
      },
      "input": "Input SQL",
      "output": "Saída",
      "placeholder": "Pegar SQL, p. ej. SELECT * desde los utenti donde id = 1...",
      "err": {
        "INVALID": "No se puede analizar este SQL: comprueba la sintaxis"
      }
    },
    "html": {
      "actions": {
        "format": "Embellecer",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 espacios",
      "indent4": "4 espacios",
      "input": "Entrada HTML",
      "placeholder": "Pegar HTML, p. ej. <div><span>Ciao</span></div>…",
      "err": {
        "EMPTY": "Introduce el contenido",
        "INVALID": "Elaboración no correcta: controlla si el HTML es válido"
      }
    },
    "js": {
      "actions": {
        "format": "Embellecer",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 espacios",
      "indent4": "4 espacios",
      "input": "Input JavaScript",
      "placeholder": "Pegar JS, p. ej. función hello(){return 1}...",
      "err": {
        "EMPTY": "Introduce el contenido",
        "INVALID": "Elaboración no correcta: controllare la sintassi"
      }
    },
    "css": {
      "actions": {
        "format": "Embellecer",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 espacios",
      "indent4": "4 espacios",
      "input": "Entrada CSS",
      "placeholder": "Pegar CSS, p. ej. .box{color:red}...",
      "err": {
        "EMPTY": "Introduce el contenido",
        "INVALID": "Elaboración no correcta: controlla si el CSS es válido"
      }
    },
    "qr": {
      "input": "Contenuti testuali",
      "placeholder": "Introduce texto o URL, p. ej. https://example.com…",
      "level": "Corrección de errores",
      "size": "Size",
      "margin": "Margen",
      "foreground": "Primer plano",
      "background": "Fondo",
      "levels": {
        "L": "L/7",
        "M": "M 15",
        "Q": "d25",
        "H": "H : 30"
      },
      "preview": "QR code preview",
      "decodeTitle": "Decodificar código QR",
      "decodeHint": "Suelta o elige una imagen con un código QR (PNG / JPG, etc.)",
      "decodeOutput": "Resultado decodificado",
      "err": {
        "EMPTY": "Introduce el contenido a codificar",
        "TOO_LONG": "El contenido es demasiado largo para un código QR: acórtalo o baja el nivel de corrección de errores",
        "NOT_FOUND": "No QR code found in the image",
        "DECODE": "No se pudo decodificar la imagen",
        "LOAD": "No se pudo cargar la imagen: asegúrate de que sea un archivo de imagen válido",
        "INVALID_COLOR": "El color debe ser #RGB o #RRGGBB",
        "INVALID_MARGIN": "El margen debe ser un entero de 0 a 10 (módulos)"
      }
    },
    "color": {
      "input": "Color",
      "placeholder": "e.g. #3b82f6, rgb(59,130,246), hsl(217,91%,60%)…",
      "preview": "Vista previa del color",
      "supportHint": "Supporta HEX / RGB / HSL (incluidos stenografia y percentuali)",
      "err": {
        "EMPTY": "Introduce un valor de color válido.",
        "INVALID": "No se puede analizar: usa formato HEX, RGB o HSL"
      }
    },
    "radix": {
      "radix": "Radix",
      "auto": "Detección automática",
      "input": "Ingresso intero",
      "placeholder": "e.g. 255, 0xff, 0b11111111, 0377…",
      "bitPattern": "Patrón de bits",
      "twosComplement": "two's complement",
      "bitOps": "Operaciones bit a bit",
      "operator": "Addetto a la condución",
      "operandB": "Operando B",
      "opHint": "L'operando A riutilizza el input de cui arriba; los risultati rimangono all'interno dell'intervallo de números interi con segno a 64 bit",
      "ops": {
        "and": "AND",
        "or": "OR",
        "xor": "XOR",
        "shl": "<< (shift left)",
        "shr": ">> (shift right)",
        "not": "NOT"
      },
      "err": {
        "EMPTY": "Immettere un número intero positivo.",
        "INVALID": "No se puede analizar: comprueba la base y el formato del número",
        "RANGE": "El valor está fuera del rango de enteros con signo de 64 bits (−2⁶³ ~ 2⁶³−1)"
      }
    },
    "markdown": {
      "gfm": "GFM (tablas / tachado / listas de tareas)",
      "breaks": "Interruciones línea",
      "input": "Editor ribassi",
      "placeholder": "Introduce Markdown, p. ej. # Heading…",
      "preview": "Vista previa",
      "shortcuts": "Scorciatoie: + Ctrl+B grassetto · + Ctrl+I corsivo · + Ctrl+K link · + Ctrl+E codice inline",
      "toolbar": {
        "aria": "Barra de los herramientas de modifica de los ribassi",
        "bold": "Negrita (**)",
        "italic": "Corsivo",
        "strike": "Barrato",
        "h1": "Encabezado 1 (#)",
        "h2": "Encabezado 2 (##)",
        "h3": "Encabezado 3 (###)",
        "h4": "Encabezado 4 (####)",
        "h5": "Encabezado 5 (#####)",
        "h6": "Encabezado 6 (######)",
        "quote": "Preventivo",
        "code": "Codice inline (`)",
        "codeBlock": "Bloque de código (```)",
        "link": "Link",
        "image": "Imagen",
        "ul": "Lista con viñetas",
        "ol": "Lista numerato",
        "hr": "Elemento HTML",
        "table": "Table"
      },
      "err": {
        "EMPTY": "Introduce el contenido",
        "PARSE": "Rendering no correcto: controlla la sintassi de Markdown"
      }
    },
    "image": {
      "format": "Formato output",
      "quality": "Calidad",
      "maxDim": "MAx tamaño",
      "original": "Tamaño Originale",
      "dropHint": "Arrastra y suelta una imagen aquí, o haz clic para elegir (PNG / JPEG / WebP / GIF, etc.)",
      "before": "Originale",
      "after": "Saída",
      "saved": "Size reduced by {{ratio}}%",
      "increased": "Dimensiones aumentate del {{ratio}} %",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "ENCODE": "Codificación imagen no correcta: asegúrate che el browser supporti este formato o prova un'otra imagen"
      }
    },
    "jsonConvert": {
      "target": "Formato dati de destinación",
      "targets": {
        "yaml": "YAML",
        "xml": "XML",
        "csv": "CSV"
      },
      "input": "Ingresso 0",
      "placeholder": "Pegar JSON, p. ej. [{\"id\":1,\"name\":\"a\"}]...",
      "err": {
        "PARSE": "JSON análisis incorrecto: controllare la sintassi",
        "CONVERT": "No se puede convertir al formato de destino (CSV requiere un array de objetos)"
      }
    },
    "xml": {
      "actions": {
        "format": "Embellecer",
        "compress": "Minify"
      },
      "indent": "Rientro",
      "indent2": "2 espacios",
      "indent4": "4 espacios",
      "input": "Ingresso 0",
      "placeholder": "Pegar XML, p. ej. <root><item>un</item></root>...",
      "err": {
        "EMPTY": "Introduce el contenido",
        "INVALID": "Elaboración no correcta: controlla si el XML es válido"
      }
    },
    "xmlJson": {
      "indent": "Rientro",
      "indent2": "2 espacios",
      "indent4": "4 espacios",
      "input": "Ingresso 0",
      "output": "JSON output",
      "placeholder": "Pegar XML, p. ej. <root a=\"1\"><item>x</item></root>...",
      "err": {
        "EMPTY": "Introduce el contenido",
        "PARSE": "XML análisis incorrecto: controllare la sintassi"
      }
    },
    "unicode": {
      "format": "Format",
      "formats": {
        "js": "JS \\uXXXX",
        "jsBrace": "JS \\u{…}",
        "codePoint": "Punto de código U+",
        "htmlHex": "0 X",
        "htmlDec": "HTML &#…;",
        "utf8": "0 byte"
      },
      "raw": "Texto normale",
      "encoded": "Texto codificado",
      "placeholderEncode": "Introduce texto, p. ej. 中 / A / 😀…",
      "placeholderDecode": "Introduce \\u4e2d, U+4E2D, &#x4E2D; o E4 B8 AD…",
      "hint": "La decodificación acepta notaciones mixtas; la codificación usa el formato seleccionado",
      "err": {
        "EMPTY": "Introduce el contenido",
        "INVALID": "No se puede analizar: comprueba la representación Unicode / UTF-8"
      }
    },
    "colorPicker": {
      "picker": "Addetto al picking",
      "input": "Valore",
      "placeholder": "#3b82f6 / rgb(59,130,246)…",
      "eyedropper": "Contagocce para schermo",
      "preview": "Vista previa del color",
      "fields": {
        "hex": "HEX",
        "rgb": "RGB",
        "hsl": "HSL",
        "cssColor": "Color CSS",
        "cssBg": "Fondo CSS",
        "htmlInline": "Estilo HTML"
      },
      "err": {
        "EMPTY": "Inserire un color válido",
        "INVALID": "Formato color no riconosciuto"
      }
    },
    "webColorTable": {
      "search": "Search",
      "searchPlaceholder": "Nome / HEX / RGB…",
      "group": "Grupo",
      "groups": {
        "all": "All",
        "red": "Red",
        "orange": "Arancia",
        "yellow": "Yellow",
        "green": "Fagiolini",
        "cyan": "Cyan",
        "blue": "Blue",
        "purple": "Viola",
        "pink": "Pink",
        "brown": "Brown",
        "white": "White",
        "gray": "Gray",
        "black": "Black"
      },
      "count": "Mostrar {{n}} / {{total}} colores",
      "empty": "Nessun color corrispondente",
      "swatch": "Swatch",
      "name": "Name",
      "hex": "HEX",
      "rgb": "RGB",
      "copyName": "Name",
      "copyHex": "HEX",
      "copyRgb": "RGB",
      "hint": "Colores con nombre CSS (incl. alias Grey y RebeccaPurple) para color / fondo."
    },
    "pinyin": {
      "input": "Chino",
      "output": "Pinyin",
      "placeholder": "Introduce chino, p. ej. 你好世界…",
      "separator": "Separatore",
      "separators": {
        "space": "Spazio",
        "none": "None",
        "dash": "Guion -"
      },
      "letterCase": "Case",
      "cases": {
        "lower": "Minuscolo",
        "upper": "Uppercase"
      },
      "tone": "Activar tonos",
      "hint": "Utilizza letture comuni; los caracteres polifonicos utilizzano la lettura predeterminada",
      "err": {
        "EMPTY": "Introduce el texto cinese"
      }
    },
    "length": {
      "value": "Valore",
      "from": "Unit",
      "placeholder": "e.g. 1.5",
      "units": {
        "mm": "Millimetri (mm)",
        "cm": "Centímetro cm",
        "m": "Metri (m):",
        "km": "Chilometri (km):",
        "in": "pollicos (en)",
        "ft": "Pie ft",
        "yd": "Cortile iarda",
        "mi": "Mile mi",
        "nmi": "Miglio nautico"
      },
      "err": {
        "EMPTY": "Introduce un número",
        "INVALID": "Inserire un número válido"
      }
    },
    "zhConvert": {
      "s2t": "→ Tradizionale semplificato",
      "t2s": "Tradizionale → semplificato",
      "simplified": "Simplified Chinese",
      "traditional": "Cinese tradizionale",
      "placeholderS2t": "Introduce chino simplificado…",
      "placeholderT2s": "Introduce chino tradicional…",
      "hint": "Mapeo a nivel de carácter; los nombres propios pueden diferir de los diccionarios de frases OpenCC",
      "err": {
        "EMPTY": "Si prega de inserire el texto"
      }
    },
    "weight": {
      "value": "Valore",
      "from": "Unit",
      "placeholder": "e.g. 1.5",
      "units": {
        "mg": "Milligrammo - mg",
        "g": "Gramo g",
        "kg": "Chilogrammo (kg)",
        "t": "Tonnellata t",
        "oz": "Oncia oz",
        "lb": "Libbra libbra",
        "st": "Stone st"
      },
      "err": {
        "EMPTY": "Introduce un número",
        "INVALID": "Inserire un número válido"
      }
    },
    "textCounter": {
      "input": "Texto",
      "placeholder": "Pegar o digita el texto desde contare...",
      "emptyHint": "Le statisticas appariranno después aver inserito el texto",
      "stats": {
        "chars": "Caracteres (con espacios)",
        "charsNoSpace": "Caracteres (sin espacios)",
        "words": "Words",
        "cjk": "Caracteres CJK",
        "lines": "Linee",
        "paragraphs": "Paragrafi",
        "spaces": "Whitespace",
        "bytes": "0 byte",
        "utf16Length": "Lunghezza UTF-16"
      }
    },
    "calendar": {
      "title": "{{year}}-{{month}}",
      "weekStart": "Día de inizio de la settimana",
      "weekStarts": {
        "mon": "Lunes",
        "sun": "Domingo"
      },
      "today": "Oggi",
      "prev": "Mes precedente",
      "next": "Mes successivo",
      "selected": "Fecha SELECTta",
      "lunar": "Fecha lunare",
      "ganZhi": "Pilar del día {{day}}",
      "festivals": "Ferie / termini",
      "restLabel": "Tipo de día",
      "yi": "Adatto",
      "ji": "Evitar",
      "legendZh": "Il rosso segna los fine settimana o las feste; 休 = riposo legale, 班 = día lavorativo de trucco. Punte dell'almanacco a destra.",
      "legendEn": "I días rossi son fine settimana o festivi. L'inglese utilizza los días festivi statunitensi (en-GB utilizza los días festivi del Regno Unito).",
      "rest": {
        "off": "Festivo",
        "work": "Workday",
        "weekend": "Fine settimana"
      },
      "weekdays": {
        "0": "Sun",
        "1": "Mon",
        "2": "Tue",
        "3": "Wed",
        "4": "Thu",
        "5": "Fri",
        "6": "Sat"
      },
      "formats": {
        "iso": "ISO",
        "slash": "<g id=\"MIFDocuments.YellowBackgroundColor\">Slash</g>",
        "locale": "Impostaciones locali"
      }
    },
    "cssButton": {
      "label": "Label",
      "bg": "Fondo",
      "color": "Texto",
      "hoverBg": "Passaje del mouse",
      "borderColor": "Borde",
      "radius": "Raje",
      "paddingX": "Bombatura X",
      "paddingY": "Bombatura Y",
      "fontSize": "Tamaño de fuente",
      "borderWidth": "Ancho del borde",
      "fontWeight": "Weight",
      "shadow": "Shadow",
      "fullWidth": "Ancho completo",
      "previewFallback": "Botón",
      "css": "CSS",
      "html": "HTML"
    },
    "randomNumber": {
      "min": "Min",
      "max": "Max",
      "count": "Cantidad",
      "decimals": "Decimals",
      "unique": "Único",
      "generate": "Generar",
      "err": {
        "INVALID_RANGE": "Intervalo no válido: garantire min ≤ max y spazio sufficiente cuando único",
        "INVALID_COUNT": "La cantidad debe ser un entero de 1 a 1000",
        "INVALID_DECIMALS": "Los decimales deben ser un entero de 0 a 10"
      }
    },
    "randomString": {
      "length": "Lung.",
      "count": "Cantidad",
      "preset": "Juego de caracteres",
      "presets": {
        "alnum": "Alfanumérico",
        "alpha": "Lettere",
        "hex": "Hex",
        "base64": "Base64",
        "custom": "Personalizado"
      },
      "custom": "Caracteres personalizados",
      "customPlaceholder": "Introduce caracteres permitidos…",
      "generate": "Generar",
      "err": {
        "EMPTY_CHARSET": "Fornisci un set de caracteres no vacío",
        "INVALID_LENGTH": "La lunghezza debe essere un número intero compreso entre 1 y 256",
        "INVALID_COUNT": "La cantidad debe ser un entero de 1 a 100"
      }
    },
    "doodle": {
      "size": "Size",
      "eraser": "Borrador",
      "clear": "Borrar",
      "download": "Exportar PNG",
      "hint": "Arrastra en el lienzo para dibujar; admite ratón y táctil"
    },
    "calculator": {
      "expression": "Expresión",
      "placeholder": "e.g. (1+2)*3 or sqrt(9)+pi",
      "functions": "Funciones",
      "hint": "Supporta + - * / % ^ () y sqrt/abs/sin/cos/tan/ln/log/floor/ceil/round, más pi ed y",
      "err": {
        "EMPTY": "Introduce un'expresión",
        "SYNTAX": "Sintassi dell'expresión no válida",
        "DIV_ZERO": "División por cero"
      }
    },
    "codeImage": {
      "language": "Idioma",
      "theme": "Theme",
      "themes": {
        "dark": "Dark",
        "light": "Chiaro"
      },
      "lineNumbers": "Numeri de línea:",
      "padding": "Imbottiture",
      "download": "Exportar PNG",
      "exporting": "Exportando…",
      "input": "Code",
      "preview": "Vista previa",
      "placeholder": " Pegar codice"
    },
    "imageColor": {
      "dropHint": "Suelta o elige una imagen (PNG / JPEG / WebP / GIF, etc.)",
      "empty": "Cargar un'imagen, por tanto haz clic para campionare un color",
      "picked": "Color prelevato",
      "preview": "Vista previa del color",
      "clickHint": "Haz clic en un píxel de la imagen para muestrear",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "LOAD": "No se pudo cargar la imagen"
      }
    },
    "ascii": {
      "search": "Search",
      "searchPlaceholder": "Decimal / hex / carácter / nombre…",
      "dec": "Dec",
      "hex": "Hex",
      "char": "Char",
      "name": "Name",
      "hint": "Los caracteres de control sin glifo se muestran como ·; copia el carácter o \\xHH"
    },
    "watermark": {
      "text": "Texto filigrana",
      "position": "Posición",
      "positions": {
        "top-left": "Izquierda en alto",
        "top-right": "Derecha en alto",
        "center": "Centro",
        "bottom-left": "Abajo izquierda",
        "bottom-right": "Abajo derecha",
        "tile": "Tile"
      },
      "color": "Color",
      "fontSize": "Tamaño de fuente",
      "opacity": "Opacidad",
      "rotate": "Ruotare",
      "gap": "Gap",
      "dropHint": "Suelta o elige una imagen para marcar",
      "original": "Originale",
      "result": "Resultado",
      "download": "Descargar PNG",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "ENCODE": "Elaboración no correcta: prova un'otra imagen"
      }
    },
    "caseConvert": {
      "mode": "Mode",
      "placeholder": "Introduce texto para convertir…",
      "modes": {
        "upper": "UPPER CASE",
        "lower": "lettera minuscola",
        "title": "Iniziali mayúsculas",
        "sentence": "Maiuscole/minúsculas en la frase",
        "swap": "sWAP cASE",
        "camel": "camelCase",
        "pascal": "PascalCase",
        "snake": "snake_case",
        "kebab": "kebab-case",
        "constant": "CONSTANT_CASE"
      },
      "err": {
        "EMPTY": "Inserisca algunas parole"
      }
    },
    "bmi": {
      "unit": "Sistema de unidad de misura",
      "metric": "Metrico (cm, kg)",
      "imperial": "Imperiale (en / lb)",
      "heightCm": "Altura (cm, o metros)",
      "heightIn": "Altura (pulgadas)",
      "weightKg": "Peso (kg)",
      "weightLb": "Peso (libbre)",
      "bmi": "BMI",
      "category": "Categoría",
      "categories": {
        "underweight": "Sotto Peso",
        "normal": "Normale",
        "overweight": "Sovrappeso",
        "obese": "Obeso"
      },
      "hint": "Las categorías siguen los umbrales WHO para adultos solo como referencia — no es consejo médico.",
      "err": {
        "INVALID": "Introduce una altura y un peso válidos",
        "RANGE": "I valores son fuera desde un intervallo ragionevole; controllare las unidad"
      }
    },
    "placeholder": {
      "width": "Width",
      "height": "Alto",
      "bg": "Fondo",
      "fg": "Color del texto",
      "text": "Texto",
      "textPlaceholder": "Por defecto usa las dimensiones",
      "download": "Descargar PNG",
      "err": {
        "INVALID_SIZE": "La tamaño debe essere un número intero compreso entre 16 y 4000",
        "INVALID_COLOR": "El color debe ser #RGB o #RRGGBB"
      }
    },
    "imageMerge": {
      "direction": "Layout",
      "directions": {
        "horizontal": "Orizzontali",
        "vertical": "Vertical",
        "grid": "Grid"
      },
      "gap": "Espacio (px)",
      "dropHint": "Añade imágenes una a una (hasta {{max}})",
      "download": "Descargar PNG combinado",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "TOO_MANY": "Limite imagen raggiunto",
        "ENCODE": "Unione no correcta; riprova",
        "EMPTY": "Añade al menos una imagen"
      }
    },
    "cronGen": {
      "preset": "Preimpostaciones",
      "presetPick": "Elige un preajuste…",
      "presets": {
        "everyMinute": "Cada minuto",
        "hourly": "Ogni ahora (all'ahora)",
        "daily": "Diario a las 00:00",
        "weekly": "Lun settimanale 00:00",
        "monthly": "Mensile el día 1 a las 00:00"
      },
      "fields": {
        "minute": "Minuto",
        "hour": "Hour",
        "day": "Día del mes",
        "month": "Mes",
        "weekday": "Día de la semana"
      },
      "modes": {
        "every": "Cada (*)",
        "value": "valor specificas",
        "range": "Range",
        "step": "Step",
        "list": "List"
      },
      "listPlaceholder": "e.g. 1,3,5",
      "everyHint": "Corrisponde a cada valor en este campo",
      "expression": "Expresión",
      "openParser": "Vista previa en Cron parser",
      "hint": "Standard 5 campi: minuto ahora día mese día feriale (0 = domenica)",
      "err": {
        "INVALID_FIELD": "Valore del campo no válido; intervalli ed elenchi de controllo"
      }
    },
    "uaParser": {
      "input": "Agente utente",
      "placeholder": "Pegar una cadena User-Agent...",
      "useCurrent": "Usa el browser actual",
      "field": "Campo",
      "name": "Name",
      "version": "Version",
      "extra": "Extra",
      "fields": {
        "browser": "Navegador",
        "engine": "Motor",
        "os": "OS",
        "device": "Dispositivo",
        "cpu": "CPU"
      },
      "err": {
        "EMPTY": "Introduce un User-Agent"
      }
    },
    "latex": {
      "input": "LaTeX",
      "placeholder": "e.g. E = mc^2 or \\frac{a}{b}",
      "preview": "Vista previa",
      "displayMode": "Modo de visualización",
      "copyHtml": "Copiar HTML",
      "symbols": "Simboli rapidi",
      "formulasTitle": "Fórmulas clásicas",
      "downloadPng": "Exportar PNG",
      "downloadJpg": "Exportar JPG",
      "downloadSvg": "Exportar SVG",
      "exporting": "Exportando…",
      "empty": "Introduce una fórmula para previsualizar",
      "hint": "Haz clic en un símbolo para insertarlo en el cursor; las fórmulas clásicas reemplazan el editor. Renderizado con KaTeX; macros exóticas pueden fallar.",
      "categories": {
        "operators": "Operatori",
        "relations": "internazionali",
        "greek": "Letras griegas",
        "trig": "Trigonometria",
        "calculus": "Cálculo",
        "sumprod": "Somme & prodotti",
        "set": "Teoria de los insiemi",
        "logic": "Logica",
        "arrows": "Flechas",
        "matrix": "Matricos y vettori",
        "special": "Special"
      },
      "formulas": {
        "einstein": "Massa-energia",
        "quadratic": "2. Formula quadratica",
        "pythagorean": "Teorema de Pitagora",
        "euler": "Identidad de Euler",
        "binomial": "Teorema del binomio",
        "taylor": "Serie de Taylor.",
        "gaussian": "Integral gaussiana",
        "cauchySchwarz": "Cauchy–Schwarz",
        "bayes": "Teorema de Bayes",
        "derivative": "Definición de derivada",
        "fourier": "Transformada de Fourier",
        "navierStokes": "Navier–Stokes",
        "maxwell": "Equación de Maxwell",
        "schrodinger": "L'equación de Schrödinger",
        "normalDist": "Distribución normale ",
        "matrix2x2Det": "Determinante 2×2"
      },
      "err": {
        "EMPTY": "Inserire una fórmula valida",
        "RENDER": "Rendering no correcto: {{message}}"
      }
    },
    "countdown": {
      "hours": "H",
      "minutes": "M",
      "seconds": "S",
      "start": "Start",
      "pause": "Metti en pausa",
      "resume": "Resume",
      "reset": "Reset",
      "done": "Il tiempo es caducado!",
      "err": {
        "INVALID": "Introduce horas / minutos / segundos válidos",
        "ZERO": "La duración debe ser mayor que 0"
      }
    },
    "stopwatch": {
      "start": "Start",
      "pause": "Metti en pausa",
      "resume": "Resume",
      "reset": "Reset",
      "lap": "Lap",
      "lapIndex": "Lap",
      "lapTime": "Tiempo de esecución",
      "totalTime": "Total"
    },
    "svgPng": {
      "input": "SVG source",
      "placeholder": "Pegar SVG markup...",
      "dropHint": "Suelta o elige un archivo .svg",
      "scale": "Scale",
      "transparent": "Fondo trasparente",
      "download": "Descargar PNG",
      "sizeHint": "Sorgente {{sw}} × {{sh}} → uscita {{pw}} × {{ph}}",
      "err": {
        "EMPTY": "Introduce SVG",
        "INVALID_SVG": "Not a valid SVG",
        "INVALID_SIZE": "Tamaño de uscita no válida (escala de controllo; borde máximo 8192)",
        "ENCODE": "La conversión falló; comprueba el SVG o reduce la escala"
      }
    },
    "imageFrame": {
      "borderWidth": "Ancho del borde",
      "borderColor": "Color del borde",
      "radius": "Raje",
      "shadowBlur": "Sfocatura sombra:",
      "shadowOffsetY": "Spostamento X sombra",
      "shadowOpacity": "Opacidad sombra",
      "dropHint": "Suelta o elige una imagen",
      "download": "Descargar PNG",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "ENCODE": "Elaboración no correcta; prova un'otra imagen"
      }
    },
    "imageAdjust": {
      "brightness": "Brillo",
      "contrast": "Contraste",
      "saturate": "Saturación",
      "hue": "Hue",
      "reset": "Reset",
      "dropHint": "Suelta o elige una imagen para ajustar",
      "original": "Originale",
      "download": "Descargar PNG",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "ENCODE": "Elaboración no correcta; prova un'otra imagen"
      }
    },
    "gifFrames": {
      "dropHint": "Suelta o elige un archivo GIF",
      "meta": "{{w}}×{{h}} · {{n}} frames",
      "download": "Descargar",
      "downloadAll": "Descargar todos los fotogramas",
      "err": {
        "NOT_GIF": "Per favore elige un archivo",
        "EMPTY": "El archivo está vacío",
        "PARSE": "No se pudo analizar el GIF"
      }
    },
    "imageCrop": {
      "aspect": "Aspecto",
      "aspects": {
        "free": "Free",
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
      "dropHint": "Suelta o elige una imagen para recortar",
      "hint": "Arrastra para seleccionar en modo libre, o edita los valores abajo",
      "download": "Descargar PNG",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "ENCODE": "Error al recortar; inténtalo de nuevo",
        "INVALID": "Regione de coltura no válida"
      }
    },
    "mbti": {
      "progress": "Respondidas {{done}} / {{total}}",
      "questionIndex": "Domanda {{n}} / {{total}}",
      "prev": "Anterior",
      "next": "Next",
      "submit": "vedi risultati",
      "reset": "Borrar",
      "retake": "Ripeti",
      "yourType": "Tendenza del tuo tipo",
      "hint": "Elige el opción más adatta a te; invia cuando hai risposto a todos.",
      "disclaimer": "Questo es un quiz semplificato solo para intrattenimento, no una valutación clinica.",
      "dims": {
        "EI": "Extraversión E / Introversión I",
        "SN": "Sensing S / Intuition N",
        "TF": "Thinking T / Feeling F",
        "JP": "Giudizio J / Perceción P"
      }
    },
    "textCard": {
      "theme": "Theme",
      "themes": {
        "slate": "Ardesia",
        "ocean": "Mare",
        "sunset": "TRAMONTO",
        "forest": "Foresta",
        "mono": "Mono",
        "paper": "Carta"
      },
      "align": "Alinear",
      "aligns": {
        "left": "Left",
        "center": "Centro",
        "right": "Derecha"
      },
      "fontSize": "Tamaño de fuente",
      "padding": "Imbottiture",
      "width": "Width",
      "title": "Title",
      "titlePlaceholder": "Título opcional…",
      "body": "Body",
      "bodyPlaceholder": "Introduce texto para la tarjeta…",
      "preview": "Vista previa",
      "empty": "Introduce un título o cuerpo para previsualizar",
      "download": "Exportar PNG",
      "exporting": "Exportando…"
    },
    "imageCard": {
      "shadow": "Shadow",
      "padding": "Imbottiture",
      "radius": "Radio del bloque",
      "width": "Width",
      "textPosition": "Posición del pie de foto",
      "positions": {
        "below": "Debajo de la foto",
        "above": "Sobre la foto"
      },
      "align": "Alinear",
      "aligns": {
        "left": "Left",
        "center": "Centro",
        "right": "Derecha"
      },
      "textPadding": "<code>Padding</code> del texto.",
      "textBg": "Fondo texto",
      "titleSize": "Tamaño título",
      "subtitleSize": "Tamaño del sottotitolo",
      "rotate": "Rotación foto",
      "backdrop": "Fondo",
      "backdropModes": {
        "preset": "Preimpostación",
        "color": "Solid",
        "gradient": "Degradado"
      },
      "backdropColor": "Color de fondo",
      "gradientFrom": "From",
      "gradientTo": "To",
      "gradientAngle": "Ángulo",
      "backdrops": {
        "paper": "Carta",
        "fog": "Fog",
        "night": "Notte",
        "mint": "Mint",
        "sand": "Sand",
        "ink": "Ink",
        "sunset": "TRAMONTO",
        "ocean": "Mare",
        "lavender": "Lavanda",
        "peach": "Pesca ",
        "aurora": "Aurora",
        "charcoal": "Charcoal"
      },
      "title": "Title",
      "titlePlaceholder": "Título de tarjeta…",
      "subtitle": "Subtitle",
      "subtitlePlaceholder": "Linea de supporto...",
      "dropHint": "Suelta o elige una imagen para la tarjeta",
      "empty": "Cargar un'imagen para visualizzare el vista previa de la carta",
      "download": "Exportar PNG",
      "exporting": "Exportando…",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "ENCODE": "Error al exportar; prueba con otra imagen"
      }
    },
    "codeHighlight": {
      "language": "Idioma",
      "theme": "Theme",
      "themes": {
        "dark": "Dark",
        "light": "Chiaro"
      },
      "lineNumbers": "Numeri de línea:",
      "input": "Code",
      "preview": "Vista previa evidenziata",
      "placeholder": " Pegar codice",
      "copyCode": "Copiar código",
      "copyHtml": "Copiar HTML",
      "hint": "Powered by Prism; copy the HTML snippet for blogs and docs."
    },
    "imageBase64": {
      "upload": "Imagen 0",
      "uploadHint": "Suelta o elige una imagen",
      "copyDataUrl": "Copiar Data URL",
      "base64Out": "Base64",
      "paste": "Base64 → imagen",
      "pastePlaceholder": "Pegar un dato URL o RAW Base64...",
      "err": {
        "EMPTY": "Introduce Base64 o elige una imagen",
        "INVALID_BASE64": "{0} no válido.&#x0D;",
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC"
      }
    },
    "imageIco": {
      "mode": "Mode",
      "toIco": "Imagen → ICO",
      "fromIco": "ICO",
      "sizes": "Misure",
      "uploadImageHint": "Suelta o elige una imagen PNG / JPG / WebP",
      "uploadIcoHint": "Suelta o elige un archivo .ico",
      "convert": "Crear ICO",
      "converting": "Al lavoro...",
      "downloadIco": "Descargar ICO",
      "downloadPng": "Descargar PNG",
      "extracted": "Se extrajeron {{n}} tamaños de {{name}}",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "NOT_ICO": "Elige un archivo ICO",
        "USE_FROM_ICO": "Passa a \"ICO → PNG\" para aprire un archivo ICO",
        "NO_SIZES": "SELECTre almeno un'opción",
        "EMPTY": "El archivo está vacío",
        "INVALID_ICO": "\"Archivo danneggiato o no válido\"",
        "ENCODE": "La conversión falló; prueba con otra imagen"
      }
    },
    "hsvCmyk": {
      "preview": "Vista previa del color"
    },
    "aiPrompts": {
      "search": "Search",
      "searchPlaceholder": "Parole clave",
      "category": "Categoría",
      "empty": "Nessuna richiesta corrispondente",
      "cat": {
        "all": "All",
        "writing": "Writing",
        "coding": "Programación",
        "translate": "Translate",
        "marketing": "Obiettivi",
        "learning": "Apprendimento",
        "career": "Carrera"
      }
    },
    "mdMindmap": {
      "input": "Markdown",
      "placeholder": "# Tema\n## Rama\n- Punto…",
      "preview": "Mappa mentale",
      "theme": "Theme",
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
      "zoomHint": "Tieni premuto CTRL /y scorri para ingrandire el vista previa",
      "downloadSvg": "Exportar SVG",
      "downloadPng": "Exportar PNG",
      "download": "Exportar SVG",
      "exporting": "Exportando…",
      "empty": "Introduce encabezados o listas Markdown para generar un mapa",
      "err": {
        "EMPTY": "Introduce un ribasso"
      }
    },
    "mermaid": {
      "input": "Sirena",
      "placeholder": "diagrama de flusso TD\n A-->B",
      "preview": "Vista previa",
      "theme": "Theme",
      "themes": {
        "default": "Predeterminado",
        "neutral": "Indifferente",
        "forest": "Foresta",
        "dark": "Dark",
        "ocean": "Mare",
        "sunset": "TRAMONTO",
        "mono": "Mono"
      },
      "zoomIn": "Ingrandisci",
      "zoomOut": "Riduci",
      "zoomReset": "Reimposta zoom",
      "zoomHint": "Tieni premuto CTRL /y scorri para ingrandire el vista previa",
      "downloadSvg": "Exportar SVG",
      "downloadPng": "Exportar PNG",
      "download": "Exportar SVG",
      "exporting": "Exportando…",
      "empty": "Introduce sintaxis Mermaid para renderizar",
      "rendering": "Rendering…",
      "err": {
        "RENDER": "Rendering no correcto: {{message}}"
      }
    },
    "cssGradient": {
      "type": "Type",
      "linear": "Lineare",
      "radial": "Segni",
      "angle": "Ángulo",
      "shape": "Shape",
      "preview": "Vista previa del degradado",
      "stops": "Stops",
      "addStop": "Añadir parada",
      "position": "Posición %",
      "removeStop": "Eliminar",
      "css": "CSS",
      "presetsTitle": "Preimpostaciones",
      "presetCategories": {
        "warm": "Warm",
        "cool": "Cool",
        "nature": "Nature Green",
        "pink": "Rosa romantico",
        "purple": "Viola misterioso",
        "dark": "Dark",
        "light": "Chiaro",
        "rainbow": "Multicolore",
        "sunset": "TRAMONTO",
        "ocean": "Mare"
      },
      "presetNames": {
        "warm-golden": "sole d'oro",
        "warm-peach": "Pesca ",
        "warm-coral": "Coral",
        "warm-amber": "Amber",
        "warm-spice": "Arancia speziata",
        "warm-rose-gold": "Oro rosa",
        "warm-papaya": "Crema de papaya",
        "warm-flame": "Fiamma",
        "warm-honey": "Oro miele",
        "warm-terracotta": "Terracotta",
        "warm-mango": "Mango",
        "warm-autumn": "Autumn",
        "warm-cinnamon": "Cinnamon",
        "warm-tangerine": "Mandarino ",
        "warm-sunset-orange": "Arancione",
        "warm-brick": "Brick red",
        "warm-caramel": "Caramel",
        "warm-radial": "Bagliore caldo",
        "warm-saffron": "Zafferano",
        "warm-burnt": "Burnt sienna",
        "warm-apricot": "Apricot",
        "cool-arctic": "Arctic blue",
        "cool-ice": "Azzurro ghiaccio",
        "cool-frost": "Gelo",
        "cool-steel": "Steel gray",
        "cool-mint-ice": "Gelato de menta",
        "cool-glacier": "ghiacciai.",
        "cool-skyline": "Orizzonte",
        "cool-polar": "Polare",
        "cool-nordic": "Nordic gray",
        "cool-periwinkle": "Pervinca",
        "cool-cobalt": "Cobalt",
        "cool-teal-breeze": "Teal breeze",
        "cool-sapphire": "Zaffiro",
        "cool-winter": "Winter",
        "cool-azure": "Tricolor azur",
        "cool-denim": "Denim blue",
        "cool-moonlight": "MOONLIGHT",
        "cool-cyan": "Cyan blue",
        "cool-harbor": "Porto",
        "cool-iceberg": "Iceberg",
        "nature-forest": "Foresta",
        "nature-moss": "Moss",
        "nature-jungle": "Giungla",
        "nature-spring": "Spring",
        "nature-fern": "Fern",
        "nature-matcha": "Matcha",
        "nature-emerald": "Emerald",
        "nature-leaf": "Bagliore fogliare",
        "nature-bamboo": "Bamboo",
        "nature-pine": "Pineta",
        "nature-sage": "Sage",
        "nature-meadow": "Prato",
        "nature-rainforest": "Foresta pluviale",
        "nature-olive": "Verde oliva",
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
        "pink-lotus": "Loto",
        "pink-peony": "Peonia",
        "pink-strawberry": "Strawberry",
        "pink-fairy": "Rosa hada",
        "pink-magnolia": "Magnolia",
        "pink-petal": "Petalo",
        "pink-candy": "Candy pink",
        "pink-radial": "Pink Glow",
        "pink-rosewater": "Acqua de rose",
        "pink-ballet": "Ballet pink",
        "purple-galaxy": "Galassia",
        "purple-mystic": "Viola mistico",
        "purple-amethyst": "Amethyst",
        "purple-velvet": "Porpora vellutato",
        "purple-neon": "Neon purple",
        "purple-twilight": "Viola crepuscolare",
        "purple-royal": "ROYAL PURPLE",
        "purple-orb": "Sfera viola",
        "purple-lilac": "Lillà",
        "purple-indigo": "Viola indaco",
        "purple-plum": "Plum",
        "purple-cosmic": "Cosmic purple",
        "purple-dusk": "Crepuscolo viola",
        "purple-wine": "Viola vino",
        "purple-iris": "Iris",
        "purple-void": "Void",
        "purple-haze": "Purple Haze",
        "purple-orchid": "Violetto claro",
        "purple-aurora": "Aurora viola",
        "purple-midnight": "Midnight Purple",
        "dark-charcoal": "Charcoal",
        "dark-midnight": "Mezzanotte",
        "dark-slate": "Ardesia",
        "dark-eclipse": "Eclipse",
        "dark-carbon": "Carbon",
        "dark-noir": "Noir",
        "dark-abyss": "Abyss",
        "dark-spotlight": "Riflettore oscuro",
        "dark-obsidian": "nera",
        "dark-graphite": "Grafite",
        "dark-onyx": "Onyx",
        "dark-storm": "Notte de tempesta",
        "dark-ink": "Nero inchiostro",
        "dark-vignette": "Vignette",
        "dark-smoke": "Smoke gray",
        "dark-raven": "Corvo",
        "dark-void": "Void black",
        "light-cloud": "Cloud",
        "light-pearl": "CAB",
        "light-mist": "Mist",
        "light-cream": "Cream",
        "light-linen": "Lino",
        "light-sand": "Sand",
        "light-lavender": "nebbia de lavanda",
        "light-glow": "Soft glow",
        "light-ivory": "Avorio",
        "light-snow": "Snow white",
        "light-blush": "Blush",
        "light-morning": "Mattina",
        "light-silk": "Silk",
        "light-frost": "Frost white",
        "light-champagne": "Champagne",
        "light-dawn": "Dawn",
        "light-powder": "Blu polvere",
        "light-cotton": "Cotton white",
        "rainbow-classic": "Classic rainbow",
        "rainbow-neon": "Neon multicolor",
        "rainbow-candy": "Candy",
        "rainbow-aurora": "Aurora",
        "rainbow-sunset": "Miscela tramonto",
        "rainbow-pastel": "Pastello",
        "rainbow-vivid": "Tricolore vivace",
        "rainbow-prism": "Prisma",
        "rainbow-spectrum": "Spectrum",
        "rainbow-holo": "Holographic",
        "rainbow-pop": "POP Art",
        "rainbow-soda": "Soda pop",
        "rainbow-tropical": "Tropicale",
        "rainbow-laser": "Laser",
        "rainbow-universe": "Universo",
        "rainbow-dream": "Dream color",
        "rainbow-galaxy": "Color de la galassia",
        "rainbow-confetti": "Confetti",
        "rainbow-cyber": "Cyber",
        "rainbow-retro": "Retro duo",
        "rainbow-synth": "Synthwave",
        "rainbow-cotton": "Cotton candy",
        "rainbow-electric": "Electric",
        "rainbow-sunrise": "Miscela Sunrise",
        "sunset-dusk": "Dusk",
        "sunset-horizon": "Orizzonte",
        "sunset-glow": "Afterglow",
        "sunset-beach": "Beach sunset",
        "sunset-desert": "Desert dusk",
        "sunset-evening": "Tarde-noche",
        "sunset-fire": "Cielo de fuego",
        "sunset-radial": "Tramonto radiale",
        "sunset-amber": "Amber dusk",
        "sunset-crimson": "Crimson dusk",
        "sunset-twilight": "Crepuscolo",
        "sunset-mango": "Crepuscolo de mango",
        "sunset-ember": "Ember",
        "sunset-sky": "Sky Dusk",
        "sunset-sahara": "Sahara",
        "sunset-golden": "Golden dusk",
        "sunset-coast": "Coastal dusk",
        "sunset-violet": "Crepuscolo viola",
        "sunset-radial-glow": "Sun disc Glow",
        "sunset-lake": "Crepuscolo del lago",
        "ocean-deep": "Deep ocean",
        "ocean-wave": "onda oceanica<g id=\"1\"> </g>",
        "ocean-lagoon": "Laguna",
        "ocean-reef": "Coral reef",
        "ocean-abyss": "Ocean abyss",
        "ocean-tide": "Tide",
        "ocean-coral": "Taupe",
        "ocean-bubble": "Sea bubble",
        "ocean-marine": "Marine blue",
        "ocean-aqua": "Aqua",
        "ocean-storm": "Mare IN tempesta",
        "ocean-seafoam": "Seafoam",
        "ocean-caribbean": "Caribbean",
        "ocean-pacific": "Pacific",
        "ocean-arctic": "Arctic sea",
        "ocean-turquoise": "Ciano",
        "ocean-depth": "Deep glow",
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
      "contain": "Contener",
      "cover": "Cubrir",
      "margin": "Margen (mm)",
      "uploadHint": "Suelta o elige una imagen",
      "downloadPng": "Descargar PNG",
      "downloadPdf": "Exportar PDF",
      "exporting": "Exportando…",
      "err": {
        "NOT_IMAGE": "Elige un'imagen desde el tuo PC",
        "INVALID_MARGIN": "Margen superiore no válido.",
        "INVALID_IMAGE": "Tamaño dell'imagen no válido"
      }
    },
    "mdToImage": {
      "gfm": "GFM",
      "breaks": "Interruciones línea",
      "font": "Font",
      "fonts": {
        "sans": "Sans-serif",
        "serif": "Serif",
        "mono": "Monospace",
        "song": "Canzone (serif CJK)",
        "hei": "Hei (sin CJK)"
      },
      "fontSize": "Tamaño de fuente",
      "width": "Width",
      "padding": "Imbottiture",
      "lineHeight": "Arriba de la linea",
      "fg": "Color del texto",
      "bg": "Fondo",
      "download": "Exportar PNG",
      "exporting": "Exportando…",
      "input": "Markdown",
      "placeholder": "# Título\nCuerpo…",
      "preview": "Vista previa",
      "err": {
        "EMPTY": "Introduce un ribasso",
        "PARSE": "Parse fallido!",
        "INVALID_COLOR": "El color debe ser #RGB o #RRGGBB",
        "INVALID_SIZE": "Tamaño de fuente / ancho / padding / interlineado fuera de rango",
        "INVALID_FONT": "Carácter no compatible"
      }
    },
    "chartGenerator": {
      "type": "Type",
      "types": {
        "bar": "Bar",
        "hbar": "Barra orizzontale",
        "line": "Line",
        "area": "Area",
        "pie": "Pie",
        "doughnut": "Donut",
        "scatter": "Dispersione"
      },
      "bar": "Bar",
      "line": "Line",
      "pie": "Pie",
      "title": "Title",
      "seriesLabel": "Etichetta serie",
      "legend": "Legend",
      "legends": {
        "top": "Top",
        "bottom": "Abajo",
        "left": "Left",
        "right": "Derecha",
        "none": "Oculto"
      },
      "colorScheme": "Esquema de color",
      "schemes": {
        "vibrant": "Vibrant",
        "pastel": "Pastello",
        "ocean": "Mare",
        "sunset": "TRAMONTO",
        "forest": "Foresta",
        "mono": "Mono",
        "rainbow": "raiNbow"
      },
      "xLabel": "Etichetta Asse X",
      "yLabel": "Etichetta Asse Y",
      "xLabelPlaceholder": "e.g. Month",
      "yLabelPlaceholder": "e.g. Sales",
      "color": "Color",
      "width": "Width",
      "height": "Alto",
      "data": "Datos (CSV)",
      "dataPlaceholder": "label,value\napple,30\nbanana,20",
      "preview": "Vista previa",
      "downloadSvg": "Descargar SVG",
      "downloadPng": "Descargar PNG",
      "copySvg": "Copiar SVG",
      "err": {
        "EMPTY": "Inserire todos los dati",
        "INVALID": "Formato dati no válido",
        "NO_NUMERIC": "Nessun valor numerico encontrado"
      }
    },
    "css3Generator": {
      "linked": "Collega los angoli",
      "topLeft": "Izquierda en alto",
      "topRight": "Derecha en alto",
      "bottomRight": "Abajo derecha",
      "bottomLeft": "Abajo izquierda",
      "offsetX": "Offset X",
      "offsetY": "Offset Y",
      "blur": "Blur",
      "spread": "Spread",
      "color": "Color",
      "inset": "Inset",
      "translateX": "Trasla X",
      "translateY": "Trasla Y",
      "rotate": "Ruotare",
      "scale": "Scale",
      "skewX": "Inclinación X:",
      "property": "Proprietà",
      "duration": "Duración (s)",
      "timing": "Timing",
      "delay": "Retraso (s)",
      "brightness": "Brillo",
      "contrast": "Contraste",
      "saturate": "Satura",
      "grayscale": "Escala de grises",
      "hueRotate": "Tinta-Rotación",
      "preview": "Vista previa",
      "previewLabel": "Vista previa",
      "css": "CSS",
      "modules": {
        "borderRadius": "Raje",
        "boxShadow": "Sombra de caja",
        "textShadow": "Sombra texto",
        "transform": "Transform",
        "transition": "Transition",
        "filter": "Filtrar"
      }
    },
    "pdf-merge": {
      "hint": "Unisce localmente — no viene cargado nulla. Preferisci archivo < 50 MB.",
      "drop": "Suelta varios PDF",
      "run": "Combinar y descarga",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-split": {
      "hint": "Si divide en un PDF para página y descarga cada.",
      "asZip": "Descargar como ZIP",
      "drop": "Suelta un PDF",
      "run": "Dividir y descarga",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-delete-pages": {
      "hint": "Páginas desde eliminare, p. ej. 1,3-5. Deve rimanere almeno una página.",
      "pages": "Páginas desde eliminare",
      "run": "Eliminar y descargar",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-extract-pages": {
      "hint": "Páginas desde estrarre, p. ej. 1,3-5.",
      "pages": "Páginas desde estrarre",
      "run": "Extraer y descargar",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-reorder": {
      "hint": "Utilizzare las frecce para riordinare las páginas, por tanto esportare.",
      "pagesUnit": "pages",
      "pageLabel": "Page {{n}}",
      "run": "Aplicar y descargar",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-rotate": {
      "hint": "Elige un ángulo para todas las páginas o las seleccionadas.",
      "allPages": "Todas las páginas",
      "pages": "Pages",
      "run": "Rotar y descarga",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-to-image": {
      "hint": "Esegue el rendering localmente; los archivo de grandi dimensioni potrebbero essere lenti.",
      "scale": "Scale",
      "pages": "Páginas (facoltativo)",
      "pagesAll": "Lasciare vacío para todos",
      "run": "Exportar imágenes",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "images-to-pdf": {
      "hint": "Un'imagen para página en formato pixel.",
      "drop": "Suelta imágenes",
      "run": "Crear PDF",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-viewer": {
      "hint": "Vista previa local — no viene cargado nulla.",
      "prev": "Prev",
      "next": "Next",
      "scale": "Scale",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-page-numbers": {
      "hint": "El formato admite {n} y {total}.",
      "format": "Format",
      "fontSize": "Tamaño de fuente",
      "startFrom": "Inizia desde",
      "run": "Añadir y descargar",
      "pos": {
        "bottom-center": "Abajo centro",
        "bottom-left": "Abajo izquierda",
        "bottom-right": "Abajo derecha",
        "top-center": "Centro en alto"
      },
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-header-footer": {
      "hint": "Fornire almeno un'encabezado o un pie de página.",
      "header": "Header",
      "footer": "Footer",
      "fontSize": "Tamaño de fuente",
      "run": "Aplicar y descargar",
      "align": {
        "left": "Left",
        "center": "Centro",
        "right": "Derecha"
      },
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-insert-image": {
      "hint": "L'origine es en basso a sinistra de la página (PDF corde).",
      "pdf": "PDF file",
      "image": "Imagen (PNG/JPG)",
      "allPages": "Todas las páginas",
      "pages": "Pages",
      "width": "Width",
      "run": "Introduce Download",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-add-text": {
      "hint": "L'origine es en basso a sinistra; el complejo Unicode puede essere limitado.",
      "text": "Texto",
      "allPages": "Todas las páginas",
      "pages": "Pages",
      "fontSize": "Tamaño de fuente",
      "color": "Color",
      "run": "Añadir y descargar",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-sign": {
      "hint": "Firma visiva (imagen sovrapposta), no certificato digitale.",
      "upload": "Cargar firma",
      "draw": "Dibujar firma",
      "allPages": "Todas las páginas",
      "pages": "Pages",
      "width": "Width",
      "run": "Firma y descarga",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-metadata": {
      "hint": "Edita título, autor y otros metadatos, luego descarga.",
      "pages": "{{n}} pages",
      "run": "Guardar y descarga",
      "fields": {
        "title": "Title",
        "author": "Autor",
        "subject": "Subject",
        "keywords": "Keywords",
        "creator": "Creador",
        "producer": "Produttore"
      },
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-encrypt": {
      "hint": "Imposta contraseña y autorizzaciones de apertura. Il supporto del lettore varia.",
      "userPassword": "Contraseña utente",
      "ownerPassword": "Proprietario Contraseña",
      "ownerHint": "Si está vacío, usa la contraseña de usuario",
      "run": "Cifrar y descargar",
      "perm": {
        "printing": "Permitir imprimir",
        "copying": "Permitir copiar",
        "modifying": "Permitir modificar",
        "annotating": "Permitir anotar"
      },
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-crop": {
      "hint": "Margini en PDF punti (pt ≈ 1/72 pollicos).",
      "top": "Top",
      "right": "Derecha",
      "bottom": "Abajo",
      "left": "Left",
      "run": "Recortar y descargar",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-grayscale": {
      "hint": "Escala de grigi visiva mediante la ri-rasterizzación de las páginas; el texto no rimarrà SELECTbile.",
      "run": "Convertir y descargar",
      "errors": {
        "EMPTY": "Si prega de completare el input",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "pdf-annotate": {
      "hint": "Abrir un PDF y disegna annotaciones sobre la página: penna, evidenziación, rettangolo, ellisse, cerchio, linea y texto.",
      "drop": "Suelta un PDF",
      "stroke": "Stroke",
      "fontSize": "Tamaño de fuente",
      "scale": "Zoom",
      "undo": "Undo",
      "clearPage": "Borrar página",
      "prev": "Prev",
      "next": "Next",
      "count": "{{n}} annotation(s)",
      "textPrompt": "Introduce texto de anotación",
      "needVisitPage": "Open page {{n}} first so it can be rendered before export",
      "run": "Exportar PDF anotado",
      "kinds": {
        "pen": "Pen",
        "highlight": "Resaltar",
        "rect": "Rettangolo",
        "ellipse": "Elipse",
        "circle": "Círculo",
        "line": "Line",
        "text": "Texto"
      },
      "errors": {
        "EMPTY": "Dibuja al menos una anotación primero",
        "NOT_PDF": "Si prega de caricare un archivo",
        "NOT_IMAGE": "Si prega de caricare un'imagen.",
        "LOAD_FAILED": "No se pudo cargar el PDF",
        "NO_PAGES": "El documento no tiene páginas",
        "INVALID_RANGE": "Intervalo páginas no válido.",
        "TOO_LARGE": "Archivo demasiado grande (recomendado < 50MB)",
        "ENCRYPT_FAILED": "Error de cifrado",
        "PROCESS_FAILED": "Elaboración no correcta. "
      }
    },
    "xsltTransform": {
      "sample": "Cargar ejemplo",
      "xml": "XML",
      "xmlPlaceholder": "Pegar",
      "xslt": "XSLT",
      "xsltPlaceholder": "Pegar foglio de stile XSLT...",
      "output": "Saída",
      "preview": "Vista previa HTML",
      "err": {
        "EMPTY_XML": "Introduce XML",
        "EMPTY_XSLT": "Per favore introduce",
        "INVALID_XML": "{0} no válido.&#x0D;",
        "INVALID_XSLT": "XSLT no válido",
        "TRANSFORM": "Trasformación no correcta"
      }
    }
  }
} satisfies TranslationResources;

export default es;
