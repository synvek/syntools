import type { ShellResources } from '../types';

/** es 文案资源（外壳 + 工具元数据；`tools.*` 见 es.tools.ts） */
const es = {
  app: {
    docTitle: 'SynTools · Caja de herramientas online',
  },
  header: {
    openMenu: 'Abrir menú',
    searchPlaceholder: 'Buscar herramientas…',
    searchAria: 'Buscar herramientas',
    themeAria: 'Cambiar tema',
    langAria: 'Cambiar idioma',
    downloadAria: 'Descargar app de escritorio',
    sourceAria: 'Código fuente',
  },
  sidebar: {
    nav: 'Navegación de herramientas',
    closeMenu: 'Cerrar menú',
    filter: 'Filtrar herramientas',
    filterPlaceholder: 'Filtrar…',
    filterEmpty: 'No hay herramientas coincidentes',
    categoryActions: 'Acciones de categoría',
    expandAll: 'Expandir todas las categorías',
    collapseAll: 'Contraer todas las categorías',
  },
  home: {
    title: 'Caja de herramientas online',
    tagline:
      'Procesamiento local primero; los datos permanecen en tu navegador (CSP, sin salida) · Pulsa <1>⌘K</1> o <3>/</3> para buscar',
    favorites: 'Favoritos',
    recent: 'Usados recientemente',
    favoriteAria: 'Añadir a favoritos',
    unfavoriteAria: 'Quitar de favoritos',
  },
  search: {
    aria: 'Buscar herramientas',
    placeholder: 'Buscar herramientas (nombre / palabras clave)…',
    empty: 'No se encontraron herramientas coincidentes',
  },
  categories: {
    file: 'Archivos',
    media: 'Audio y vídeo',
    cheatsheet: 'Hojas de referencia',
    advanced: 'Documentos y creación',
    encoding: 'Codificación',
    text: 'Texto',
    formatting: 'Formato',
    crypto: 'Cifrado y hash',
    datetime: 'Fecha y hora',
    generator: 'Generadores',
    network: 'Red',
    image: 'Imágenes',
    pdf: 'PDF',
    other: 'Otros',
  },
  common: {
    copy: 'Copiar',
    copied: 'Copiado',
    clear: 'Borrar',
    discardConfirm: 'El documento actual no está guardado. Crear uno nuevo lo descartará. ¿Seguro?',
    swap: 'Intercambiar',
    newDoc: 'Nuevo documento',
    saved: 'Guardado en el borrador local',
    saving: 'Se guarda automáticamente al dejar de escribir',
    download: 'Descargar',
    share: 'Compartir',
    shareTooLong: 'Contenido demasiado largo (> 2KB); no se puede crear el enlace para compartir',
    retry: 'Reintentar',
    loading: 'Cargando',
    operation: 'Acción',
    encode: 'Codificar',
    decode: 'Decodificar',
    result: 'Resultado',
    rawText: 'Texto sin procesar',
    input: 'Entrada',
    output: 'Saída',
    text: 'Texto',
    file: 'Archivo',
    remove: 'Eliminar',
    bytes: '{{size}} bytes',
  },
  io: {
    stats: '{{chars}} caracteres / {{bytes}} bytes',
    warnLarge:
      'Ingresso de grandi dimensioni (> 500 KB), el cálculo en tiempo real potrebbe rallentare',
    overflow: 'La entrada supera el límite de 5MB; usa el modo archivo para contenido grande',
  },
  file: {
    hint: 'Arrastra y suelta un archivo aquí, o haz clic para elegir',
    max: 'Max {{size}}',
    over: 'El archivo supera el límite de {{max}} (actual {{size}})',
    uploadAria: 'Cargar archivo',
    previewAlt: 'Vista previa de {{name}}',
    pages: '{{n}} pages',
    encrypted: 'Cifrado',
  },
  pdf: {
    password: 'Contraseña del PDF',
    passwordPlaceholder: 'Introduce la contraseña de apertura',
    passwordHint: 'Este PDF está cifrado. Introduce la contraseña para continuar.',
    unlock: 'Desbloquear',
    errors: {
      NEED_PASSWORD: 'Este PDF está cifrado. Introduce la contraseña.',
      WRONG_PASSWORD: 'Contraseña incorrecta. Inténtalo de nuevo.',
    },
  },
  tool: {
    errorTitle: 'Error en tiempo de ejecución de la herramienta',
    localBadge: 'Solo local',
    serverBadge: 'Requiere servidor',
    related: 'Herramientas relacionadas',
    nextSteps: 'Siguientes pasos',
    openIn: 'Abrir en {{name}}',
    progress: 'Progreso {{current}} / {{total}}',
  },
  notFound: {
    message: 'Página o herramienta no encontrada',
    back: 'Volver al inicio',
  },
  toolsMeta: {
    'code-editor': {
      name: 'Editor de código',
      description:
        'Editor con resaltado de sintaxis, formato por lenguaje, 10 temas y exportación a código / HTML / imagen',
    },
    'video-convert': {
      name: 'Convertidor de vídeo',
      description:
        'Transcodificación WebCodecs primero (MP4 / WebM / MKV) con fallback a ffmpeg.wasm',
    },
    'video-to-gif': {
      name: 'Vídeo a GIF',
      description: 'Recorta un vídeo en GIF animado (todo en el navegador)',
    },
    'audio-convert': {
      name: 'Convertidor de audio',
      description:
        'Conversión de audio: WAV (nativo) y MP3 / M4A / OGG / FLAC (WebCodecs primero, fallback ffmpeg.wasm)',
    },
    'subtitle-tool': {
      name: 'Conversor de subtítulos',
      description: 'Convierte entre SRT / WebVTT con desplazamiento de tiempo',
    },
    'git-cheatsheet': {
      name: 'Chuleta de Git',
      description: 'Comandos Git comunes por categoría, con búsqueda',
    },
    'mime-types': {
      name: 'Tipos MIME',
      description: 'Tabla extensión ↔ tipo MIME, con búsqueda',
    },
    'http-status': {
      name: 'Códigos HTTP',
      description: 'Referencia de códigos de estado HTTP con clase, nombre y significado',
    },
    'id-photo': {
      name: 'Foto carnet',
      description: 'Recorta a tamaños estándar (1”, 2”, pasaporte) con fondo y DPI',
    },
    'image-grid-cut': {
      name: 'Cortar en cuadrícula',
      description: 'Divide una imagen en cuadrícula (p. ej. 3×3) y descarga cada parte',
    },
    'image-ascii': {
      name: 'Imagen a ASCII',
      description: 'Convierte imágenes a arte ASCII (juego de caracteres, ancho, inversión)',
    },
    'timezone-converter': {
      name: 'Conversor de zonas',
      description: 'Convierte horas entre zonas IANA con desplazamiento UTC',
    },
    'tax-loan-calculator': {
      name: 'Préstamo / Impuestos',
      description: 'Amortización (cuota constante / capital constante) y estimación de impuesto',
    },
    'unit-converter': {
      name: 'Conversor de unidades',
      description:
        'Convierte longitud / masa / área / volumen / temperatura / velocidad / datos / tiempo',
    },
    'bulk-rename': {
      name: 'Renombrado masivo',
      description:
        'Genera nombres con prefijo/sufijo, reemplazo (regex), numeración, extensión y mayúsculas',
    },
    'file-split-merge': {
      name: 'Dividir / Unir archivo',
      description: 'Divide un archivo por tamaño o número, o une las partes',
    },
    'zip-manager': {
      name: 'Gestor ZIP',
      description: 'Empaqueta varios archivos en ZIP o extrae entradas individuales (JSZip)',
    },
    barcode: {
      name: 'Generador de códigos de barras',
      description: 'Genera códigos Code 39 / Code 128 / EAN-13 en SVG',
    },
    'id-generator': {
      name: 'Generador de ID',
      description: 'Genera ULID / NanoID / Snowflake / ObjectId de MongoDB en lote',
    },
    'code-minify': {
      name: 'Minificador',
      description: 'Minifica CSS / HTML / JS / JSON (CSS con csso; JS/HTML conservador)',
    },
    'csv-tool': {
      name: 'Herramienta CSV',
      description: 'Conversión CSV ↔ JSON con delimitador, cabecera y comillas (RFC 4180)',
    },
    'key-converter': {
      name: 'Conversor de claves',
      description: 'Convierte claves RSA entre PEM / DER / JWK / OpenSSH (WebCrypto)',
    },
    'rsa-crypto': {
      name: 'Cifrado RSA',
      description:
        'RSA-OAEP cifrar/descifrar, RSA-PSS firmar/verificar y generación de claves (WebCrypto)',
    },
    'password-hash': {
      name: 'Hash de contraseña (PBKDF2)',
      description: 'Derivación PBKDF2 con WebCrypto, con salt e iteraciones personalizadas',
    },
    'password-strength': {
      name: 'Fuerza de contraseña',
      description: 'Estima la fuerza localmente: entropía, juego de caracteres y patrones débiles',
    },
    checksum: {
      name: 'Suma de comprobación',
      description: 'Calcula CRC-32 / Adler-32 / FNV-1a (en el navegador)',
    },
    'encoding-rescue': {
      name: 'Reparador de mojibake',
      description: 'Recodifica texto corrupto (UTF-8 mal leído) con GBK / Big5 / Shift-JIS',
    },
    'escape-unescape': {
      name: 'Escape / Unescape',
      description: 'Escapa y desescapa JSON / JS / HTML / XML / URL',
    },
    'caesar-cipher': {
      name: 'César / ROT13 / Rail',
      description: 'Cifrado César, ROT13, Atbash y Rail Fence',
    },
    'morse-code': {
      name: 'Código Morse',
      description: 'Convierte texto y código Morse, con letras, dígitos y espacios',
    },
    'base-encoding': {
      name: 'Codificador Base',
      description: 'Codifica/decodifica Base16/32/32Hex/58/64/64URL (en el navegador)',
    },
    'pdf-compress': {
      name: 'Compresor de PDF',
      description: 'Comprime PDF: flujos de objetos sin pérdida o recodificación JPEG con pérdida',
    },
    'pdf-watermark': {
      name: 'Marca de agua PDF',
      description:
        'Añade marca de agua de texto al PDF (mosaico, rotación, opacidad, rango de páginas)',
    },
    'pdf-decrypt': {
      name: 'Desbloqueo de PDF',
      description: 'Carga con contraseña y exporta un PDF sin protección (como qpdf --decrypt)',
    },
    'pdf-extract-text': {
      name: 'Extractor de texto PDF',
      description: 'Extrae texto copiable de todas las páginas PDF (local, soporta cifrados)',
    },
    'random-port': {
      name: 'Puerto y dirección aleatorios',
      description: 'Genera puertos, IPv4 privada, MAC e IPv6 (deduplica y evita puertos comunes)',
    },
    'websocket-tester': {
      name: 'Probador de WebSocket',
      description: 'Conecta a WebSocket, envía/recibe texto/binario con registro',
    },
    'http-request': {
      name: 'Depurador HTTP',
      description:
        'Envía peticiones HTTP en el navegador, inspecciona estado, tiempo, cabeceras (CORS)',
    },
    'http-headers': {
      name: 'Generador de cabeceras de seguridad',
      description: 'Genera CSP / HSTS / Referrer-Policy (nginx / Apache / Express / Vercel)',
    },
    'ua-generator': {
      name: 'Generador de User-Agent',
      description: 'Genera User-Agent por navegador/SO, con librería UA común',
    },
    'url-parser': {
      name: 'Analizador de URL',
      description: 'Descompone la URL en protocolo, host, puerto, ruta, parámetros y ancla',
    },
    'mac-address': {
      name: 'Herramienta MAC',
      description: 'Formato MAC, búsqueda de fabricante (OUI), EUI-64 y generación masiva',
    },
    'ip-calc': {
      name: 'Calculadora de IP',
      description: 'Direccionamiento IPv4/IPv6, subnetting (VLSM), supernet y máscara comodín',
    },
    'flowchart-editor': {
      name: 'Editor de diagramas',
      description:
        'Crea diagramas de flujo localmente: nodos, conexiones, plantillas, auto diseño y exportación PNG/SVG',
    },
    'mindmap-editor': {
      name: 'Editor de mapas mentales',
      description:
        'Crea mapas mentales en local: nodos por teclado, ramas plegables, diseños, temas y exportación PNG/SVG/Markdown',
    },
    'photo-editor': {
      name: 'Editor de fotos',
      description:
        'Edición de fotos por capas en el navegador: capas, selecciones, recorte, ajustes, filtros, pincel y texto, con proyecto re-editable',
    },
    base64: {
      name: 'Codificar / decodificar Base64',
      description:
        'Convierte texto y Base64 con codificación Unicode segura; admite URL Safe y modo archivo',
    },
    'url-codec': {
      name: 'Codificar / decodificar URL',
      description:
        'Modos encodeURIComponent / encodeURI con detección de codificación porcentual malformada',
    },
    'regex-tester': {
      name: 'Herramienta Regex',
      description: 'Resaltado de coincidencias, reemplazo, grupos de captura, preajustes y chuleta',
    },
    'text-diff': {
      name: 'Diff de texto',
      description:
        'Editores lado a lado con resaltado en línea, números de línea e ignorar espacios',
    },
    'json-format': {
      name: 'Formateador JSON',
      description:
        'Formatea / minifica / valida con sangría de 2/4 espacios y errores línea/columna',
    },
    'json-convert': {
      name: 'Conversor JSON',
      description: 'Analiza JSON y lo convierte a YAML / XML / CSV',
    },
    timestamp: {
      name: 'Conversor de timestamp',
      description: 'Unix ⇄ hora legible con detección auto de segundos/ms y reloj en vivo',
    },
    uuid: {
      name: 'Generador UUID',
      description:
        'UUID v4 aleatorios / v7 ordenados por tiempo con salida por lotes y opciones de formato',
    },
    hash: {
      name: 'Calculadora de hash',
      description:
        'MD5 / SHA-1 / SHA-256 / SHA-512 para texto y archivos (streaming), salida hex / base64',
    },
    'jwt-parser': {
      name: 'Analizador JWT',
      description:
        'Analiza header / payload / signature y lee exp y otras claims de tiempo (solo lectura, sin verificar)',
    },
    'aes-crypto': {
      name: 'Cifrar / descifrar AES',
      description: 'AES-GCM con frase PBKDF2 o clave en bruto; salida base64(salt|iv|ciphertext)',
    },
    hmac: {
      name: 'HMAC',
      description: 'HMAC-SHA256 / SHA512 con salida hex / base64',
    },
    totp: {
      name: 'TOTP',
      description: 'TOTP RFC 6238: generar / verificar, 6/8 dígitos, segundos restantes',
    },
    'x509-decode': {
      name: 'Decodificador de certificados X.509',
      description: 'Analiza PEM: huellas SHA-256/SHA-1, tipo, longitud DER, CN',
    },
    'cidr-calc': {
      name: 'Calculadora CIDR',
      description: 'CIDR IPv4: red / broadcast / rango de hosts / máscara / nº de hosts',
    },
    'text-lines': {
      name: 'Herramientas de líneas de texto',
      description: 'Ordenar / únicos / invertir / numerar / quitar líneas vacías',
    },
    'hex-codec': {
      name: 'Codificar / decodificar hex',
      description: 'Hex ↔ texto UTF-8 con espacios opcionales',
    },
    'url-query': {
      name: 'Analizador de consulta URL',
      description: 'Analiza partes de URL y parámetros de consulta; reconstruye tras editar',
    },
    'json-path': {
      name: 'Consulta JSONPath',
      description: 'Consultas de ruta simples como a.b[0].c',
    },
    'gzip-tool': {
      name: 'Compresión Gzip',
      description: 'Comprime texto a base64 con Gzip / descomprime de vuelta a texto',
    },
    'exif-strip': {
      name: 'Quitar EXIF',
      description: 'Lee EXIF JPEG básico y elimina APP1; descarga el archivo limpio',
    },
    'fake-data': {
      name: 'Generador de datos falsos',
      description: 'Genera nombres / emails / UUID / lorem en zh/en, 1–50 elementos',
    },
    'password-gen': {
      name: 'Generador de contraseñas',
      description:
        'Contraseñas aleatorias fuertes con opciones de longitud / charset, estimación de entropía y nivel',
    },
    'entity-codec': {
      name: 'Codificar / decodificar HTML',
      description:
        'Codifica/decodifica caracteres especiales HTML: con nombre / decimal / hex / escapes \\u',
    },
    'cron-parser': {
      name: 'Analizador de expresiones Cron',
      description: 'Valida expresiones cron, explica campos y previsualiza próximas ejecuciones',
    },
    'convert-data': {
      name: 'Conversor de formatos de datos de configuración',
      description: 'Convierte YAML ⇄ JSON ⇄ TOML mediante un valor JS intermedio sin pérdida',
    },
    'sql-format': {
      name: 'Formateador SQL',
      description:
        'Embellece SQL en varios dialectos con sangría y mayúsculas de palabras clave configurables',
    },
    'html-format': {
      name: 'Minificar / embellecer HTML',
      description: 'Minifica y embellece HTML con sangría de 2/4 espacios',
    },
    'js-format': {
      name: 'Minificar / embellecer JS',
      description: 'Minifica y embellece JavaScript con sangría de 2/4 espacios',
    },
    'css-format': {
      name: 'Minificar / embellecer CSS',
      description: 'Minifica y embellece CSS con sangría de 2/4 espacios',
    },
    'xml-format': {
      name: 'Minificar / embellecer XML',
      description: 'Embellece y minifica XML con sangría de 2/4 espacios; se conserva CDATA',
    },
    'xml-json': {
      name: 'XML a JSON',
      description: 'Analiza XML a JSON, conservando atributos con el prefijo @_',
    },
    qrcode: {
      name: 'Código QR',
      description: 'Genera y decodifica códigos QR con ECC, tamaño, colores y margen',
    },
    'color-converter': {
      name: 'Conversor de color',
      description: 'Convierte y previsualiza formatos HEX / RGB / HSL',
    },
    'radix-converter': {
      name: 'Conversor de bases',
      description:
        'Convierte bases 2/8/10/16 y visualiza operaciones bit a bit para enteros con signo de 64 bits',
    },
    'markdown-preview': {
      name: 'Editor de Markdown',
      description:
        'Edición y vista previa en vivo, esquema, recuento de palabras, abrir/guardar .md y exportar HTML',
    },
    'image-compress': {
      name: 'Comprimir imagen',
      description:
        'Compresión y conversión de imagen en el cliente (PNG / JPEG / WebP) con redimensionado y calidad',
    },
    'unicode-codec': {
      name: 'Códec Unicode',
      description:
        'Convierte texto a/desde \\uXXXX, puntos de código, entidades HTML y bytes UTF-8',
    },
    'html-color-picker': {
      name: 'Selector de color HTML',
      description: 'Elige colores visualmente y exporta HEX / RGB / HSL más fragmentos HTML/CSS',
    },
    'web-color-table': {
      name: 'Tabla de colores web',
      description: 'Colores con nombre CSS con filtros por grupo y copia de nombre / HEX / RGB',
    },
    pinyin: {
      name: 'Chino a pinyin',
      description: 'Convierte chino a pinyin con tonos, separador y mayúsculas opcionales',
    },
    'length-converter': {
      name: 'Conversor de longitud',
      description:
        'Convierte unidades de longitud métricas e imperiales (mm, cm, m, km, in, ft y más)',
    },
    'zh-convert': {
      name: 'Conversor de chino tradicional',
      description: 'Convierte entre chino simplificado y tradicional',
    },
    'weight-converter': {
      name: 'Conversor de peso',
      description: 'Convierte unidades de peso métricas e imperiales (mg, g, kg, t, oz, lb, st)',
    },
    'text-counter': {
      name: 'Contador de texto',
      description: 'Cuenta caracteres, palabras, líneas, párrafos, caracteres CJK y bytes UTF-8',
    },
    calendar: {
      name: 'Calendario',
      description: 'Vista mensual con lunar/almanaque para chino y festivos locales para inglés',
    },
    'css-button': {
      name: 'Generador de botones CSS',
      description: 'Ajusta estilos visualmente y genera CSS / HTML de botones',
    },
    'random-number': {
      name: 'Generador de números aleatorios',
      description:
        'Genera enteros o decimales aleatorios en un rango, con valores únicos opcionales',
    },
    'random-string': {
      name: 'Generador de cadenas aleatorias',
      description: 'Genera cadenas aleatorias por longitud y charset (alnum / hex / personalizado)',
    },
    'doodle-board': {
      name: 'Pizarra de dibujo',
      description:
        'Pizarra de dibujo en el navegador: lápiz/rotulador/borrador, formas y polígonos, cuentagotas, mover y zoom, exportación multiformato',
    },
    calculator: {
      name: 'Calculadora',
      description:
        'Calculadora de expresiones segura con aritmética, potencias, módulo y funciones comunes',
    },
    'code-image': {
      name: 'Código a imagen',
      description: 'Renderiza código como tarjeta con resaltado de sintaxis y exporta PNG',
    },
    'image-color-picker': {
      name: 'Selector de color de imagen',
      description: 'Sube una imagen y haz clic en un píxel para muestrear HEX / RGB',
    },
    'ascii-table': {
      name: 'Tabla ASCII',
      description: 'Referencia ASCII 0–127 con búsqueda por decimal, hex o carácter',
    },
    'image-watermark': {
      name: 'Marca de agua en imagen',
      description: 'Añade una marca de agua de texto con posición, opacidad, rotación y mosaico',
    },
    'case-convert': {
      name: 'Conversor de mayúsculas/minúsculas',
      description:
        'Convierte mayúsculas/minúsculas y estilos de nombres (camel / snake / kebab, etc.)',
    },
    'bmi-calculator': {
      name: 'Calculadora de IMC',
      description: 'Calcula el IMC a partir de altura y peso con categorías WHO para adultos',
    },
    'placeholder-image': {
      name: 'Imagen de marcador de posición',
      description: 'Genera un PNG de marcador de posición por tamaño, colores y texto opcional',
    },
    'image-merge': {
      name: 'Fusionar imágenes',
      description: 'Une imágenes en horizontal, vertical o cuadrícula en un PNG',
    },
    'cron-generator': {
      name: 'Generador de Crontab',
      description:
        'Construye una expresión Cron estándar de 5 campos a partir de minuto/hora/día/mes/día de la semana',
    },
    'ua-parser': {
      name: 'Analizador User-Agent',
      description: 'Analiza un User-Agent del navegador en navegador, motor, SO y dispositivo',
    },
    'latex-editor': {
      name: 'Editor de matemáticas LaTeX',
      description: 'Símbolos rápidos y fórmulas clásicas, vista previa KaTeX, exportar PNG/JPG/SVG',
    },
    countdown: {
      name: 'Temporizador de cuenta atrás',
      description: 'Define horas, minutos y segundos; pausa, reanuda y alerta al terminar',
    },
    stopwatch: {
      name: 'Cronómetro',
      description: 'Cronómetro online con inicio, pausa, vuelta y reinicio',
    },
    'svg-to-png': {
      name: 'SVG a PNG',
      description: 'Convierte marcado o archivos SVG a PNG con escala y transparencia',
    },
    'image-frame': {
      name: 'Borde / radio / sombra de imagen',
      description: 'Añade borde, esquinas redondeadas y sombra, luego exporta PNG',
    },
    'image-adjust': {
      name: 'Ajuste de color de imagen',
      description: 'Ajusta brillo, contraste, saturación y tono, luego exporta PNG',
    },
    'gif-frames': {
      name: 'Extractor de fotogramas GIF',
      description: 'Divide un GIF en fotogramas PNG; descarga uno o todos',
    },
    'image-crop': {
      name: 'Recortar imagen',
      description: 'Recorta imágenes a mano alzada o con proporciones fijas a PNG',
    },
    'mbti-test': {
      name: 'Test de personalidad MBTI',
      description: 'Un breve cuestionario estilo MBTI de 24 preguntas (solo entretenimiento)',
    },
    'text-card': {
      name: 'Texto a tarjeta',
      description: 'Maquetación de título y cuerpo en una tarjeta con estilo y exportación PNG',
    },
    'image-card': {
      name: 'Imagen a tarjeta',
      description: 'Tarjeta foto + título/subtítulo con fondos o degradados, exportar PNG',
    },
    'code-highlight': {
      name: 'Resaltador de código',
      description: 'Resaltado de sintaxis en vivo con números de línea y copia de fragmento HTML',
    },
    'image-base64': {
      name: 'Imagen ↔ Base64',
      description: 'Convierte imágenes a Base64 / Data URL y viceversa, totalmente en local',
    },
    'image-ico': {
      name: 'Conversor ICO',
      description: 'Convierte imágenes a ICO multi-tamaño (favicon), o extrae PNG desde ICO',
    },
    'hsv-cmyk': {
      name: 'Conversor HSV / CMYK',
      description: 'Convierte y previsualiza espacios RGB, HSV, CMYK y HEX',
    },
    'ai-prompts': {
      name: 'Biblioteca de prompts de IA',
      description: 'Prompts seleccionados por categoría con búsqueda y copia en un clic',
    },
    'md-mindmap': {
      name: 'Mapa mental Markdown',
      description: 'Convierte Markdown en mapa mental con temas, zoom y exportación PNG/SVG',
    },
    'mermaid-editor': {
      name: 'Editor de diagramas Mermaid',
      description: 'Renderiza Mermaid en local con temas, zoom y exportación PNG/SVG',
    },
    'css-gradient': {
      name: 'Generador de degradados CSS',
      description: 'Edita degradados lineales / radiales con preajustes categorizados y copia CSS',
    },
    'image-to-paper': {
      name: 'Imagen a PDF de papel',
      description: 'Ajusta imágenes a A3/A4/A5/Letter y exporta PDF',
    },
    'md-to-image': {
      name: 'Markdown a imagen',
      description:
        'Renderiza Markdown a una tarjeta con estilo y exporta PNG con fuente, tamaño, ancho y colores',
    },
    'chart-generator': {
      name: 'Generador de gráficos',
      description:
        'Crea gráficos de barras/líneas/áreas/pastel/anillo/dispersión desde CSV con leyendas y paletas',
    },
    'css3-generator': {
      name: 'Generador de código CSS3',
      description: 'Genera border-radius, sombras, transform, filter y más',
    },
    'xslt-transform': {
      name: 'Transformación XSLT',
      description: 'Transforma XML a HTML con XSLT en el navegador',
    },
    'rich-text-editor': {
      name: 'Procesador de texto',
      description:
        'Escritura local con importación y exportación de Word (.docx) y dos modos de exportación PDF',
    },
    'slide-editor': {
      name: 'Editor de diapositivas',
      description:
        'Edición local en canvas con importación y exportación PowerPoint (.pptx) y modo presentación',
    },
    'spreadsheet-editor': {
      name: 'Editor de hojas de cálculo',
      description:
        'Edición local con importación y exportación de Excel (.xlsx), fórmulas y varias hojas',
    },
    'pdf-merge': {
      name: 'Combinar PDF',
      description: 'Combina varios PDF en un solo archivo',
    },
    'pdf-split': {
      name: 'Dividir PDF',
      description: 'Divide un PDF en un archivo por página',
    },
    'pdf-delete-pages': {
      name: 'Eliminar páginas PDF',
      description: 'Elimina las páginas seleccionadas de un PDF',
    },
    'pdf-extract-pages': {
      name: 'Extraer páginas PDF',
      description: 'Extrae las páginas seleccionadas a un PDF nuevo',
    },
    'pdf-reorder': {
      name: 'Reordenar páginas PDF',
      description: 'Reordena las páginas de un PDF',
    },
    'pdf-rotate': {
      name: 'Rotar páginas PDF',
      description: 'Rota las páginas seleccionadas o todas',
    },
    'pdf-to-image': {
      name: 'PDF a imagen',
      description: 'Renderiza páginas PDF como JPG/PNG',
    },
    'images-to-pdf': {
      name: 'Imágenes a PDF',
      description: 'Combina imágenes en un PDF',
    },
    'pdf-viewer': {
      name: 'Visor PDF',
      description: 'Abre y lee un PDF en local',
    },
    'pdf-page-numbers': {
      name: 'Números de página PDF',
      description: 'Añade números de página a un PDF',
    },
    'pdf-header-footer': {
      name: 'Encabezado y pie PDF',
      description: 'Añade texto de encabezado y pie',
    },
    'pdf-insert-image': {
      name: 'Insertar imagen en PDF',
      description: 'Coloca una imagen en las páginas del PDF',
    },
    'pdf-add-text': {
      name: 'Añadir texto al PDF',
      description: 'Añade texto en las páginas del PDF',
    },
    'pdf-sign': {
      name: 'Firmar PDF',
      description: 'Dibuja o sube una imagen de firma (visual, no certificado)',
    },
    'pdf-metadata': {
      name: 'Metadatos PDF',
      description: 'Ver y editar metadatos PDF',
    },
    'pdf-encrypt': {
      name: 'Cifrar PDF',
      description: 'Define contraseña y flags de permisos',
    },
    'pdf-crop': {
      name: 'Recortar PDF',
      description: 'Recorta márgenes de página mediante cropBox',
    },
    'pdf-grayscale': {
      name: 'PDF en escala de grises',
      description: 'Convierte PDF a escala de grises visual',
    },
    'pdf-annotate': {
      name: 'Anotar PDF',
      description: 'Dibuja resaltados, a mano alzada, formas y texto en páginas PDF',
    },
  },
} satisfies ShellResources;

export default es;
