import type { ShellResources } from '../types';

/** pt 文案资源（外壳 + 工具元数据；`tools.*` 见 pt.tools.ts） */
const pt = {
  app: {
    docTitle: 'SynTools · Caixa de ferramentas online',
  },
  header: {
    openMenu: 'Abrir menu',
    searchPlaceholder: 'Pesquisar ferramentas…',
    searchAria: 'Pesquisar ferramentas',
    themeAria: 'Alternar tema',
    langAria: 'Mudar idioma',
    downloadAria: 'Baixar app para desktop',
    sourceAria: 'Código-fonte',
  },
  sidebar: {
    nav: 'Navegação de ferramentas',
    closeMenu: 'Fechar menu',
    filter: 'Filtrar ferramentas',
    filterPlaceholder: 'Filtrar…',
    filterEmpty: 'Nenhuma ferramenta correspondente',
    categoryActions: 'Ações da categoria',
    expandAll: 'Expandir todas as categorias',
    collapseAll: 'Recolher todas as categorias',
  },
  home: {
    title: 'Caixa de ferramentas online',
    tagline:
      'Processamento local primeiro; os dados ficam no seu browser (CSP, sem saída) · Prima <1>⌘K</1> ou <3>/</3> para pesquisar',
    favorites: 'Favoritos',
    recent: 'Usados recentemente',
    favoriteAria: 'Adicionar aos favoritos',
    unfavoriteAria: 'Remover dos favoritos',
  },
  search: {
    aria: 'Pesquisar ferramentas',
    placeholder: 'Pesquisar ferramentas (nome / palavras-chave)…',
    empty: 'Nenhuma ferramenta correspondente encontrada',
  },
  categories: {
    file: 'Arquivos',
    media: 'Áudio e vídeo',
    cheatsheet: 'Folhas de consulta',
    advanced: 'Documentos e criação',
    encoding: 'Codificação',
    text: 'Texto',
    formatting: 'Formatação',
    crypto: 'Criptografia e hash',
    datetime: 'Data e hora',
    generator: 'Geradores',
    network: 'Rede',
    image: 'Imagens',
    pdf: 'PDF',
    other: 'Outros',
  },
  common: {
    copy: 'Copiar',
    copied: 'Copiado',
    clear: 'Limpar',
    discardConfirm:
      'O documento atual não está guardado. Criar um novo irá descartá-lo. Tem certeza?',
    swap: 'Trocar',
    newDoc: 'Novo documento',
    saved: 'Guardado no rascunho local',
    saving: 'Guarda automaticamente após parar de escrever',
    download: 'Transferir',
    share: 'Partilhar',
    shareTooLong: 'Conteúdo demasiado longo (> 2KB); não é possível criar a ligação de partilha',
    retry: 'Tentar novamente',
    loading: 'A carregar',
    operation: 'Ação',
    encode: 'Codificar',
    decode: 'Descodificar',
    result: 'Resultado',
    rawText: 'Texto em bruto',
    input: 'Entrada',
    output: 'Saída',
    text: 'Texto',
    file: 'Ficheiro',
    remove: 'Remover',
    bytes: '{{size}} bytes',
  },
  io: {
    stats: '{{chars}} caracteres / {{bytes}} bytes',
    warnLarge:
      'Ingresso de grandi dimensioni (> 500 KB), ou cálculo em tempo real potrebbe rallentare',
    overflow: 'A entrada excede o limite de 5MB; use o modo ficheiro para conteúdo grande',
  },
  file: {
    hint: 'Arraste e largue um ficheiro aqui, ou clique para escolher',
    max: 'Max {{size}}',
    over: 'O ficheiro excede o limite de {{max}} (atual {{size}})',
    uploadAria: 'Carregar ficheiro',
    previewAlt: 'Pré-visualização de {{name}}',
    pages: '{{n}} pages',
    encrypted: 'Encriptado',
  },
  pdf: {
    password: 'Palavra-passe do PDF',
    passwordPlaceholder: 'Introduza a palavra-passe de abertura',
    passwordHint: 'Este PDF está encriptado. Introduza a palavra-passe para continuar.',
    unlock: 'Desbloquear',
    errors: {
      NEED_PASSWORD: 'Este PDF está encriptado. Introduza a palavra-passe.',
      WRONG_PASSWORD: 'Palavra-passe incorreta. Tente novamente.',
    },
  },
  tool: {
    errorTitle: 'Erro em tempo de execução da ferramenta',
    localBadge: 'Apenas local',
    serverBadge: 'Requer servidor',
    related: 'Ferramentas relacionadas',
    nextSteps: 'Próximos passos',
    openIn: 'Abrir em {{name}}',
    progress: 'Progresso {{current}} / {{total}}',
  },
  notFound: {
    message: 'Página ou ferramenta não encontrada',
    back: 'Voltar ao início',
  },
  toolsMeta: {
    'code-editor': {
      name: 'Editor de código',
      description:
        'Editor com destaque de sintaxe, formatação por linguagem, 10 temas e exportação para código / HTML / imagem',
    },
    'video-convert': {
      name: 'Conversor de vídeo',
      description:
        'Transcodificação WebCodecs primeiro (MP4 / WebM / MKV) com fallback para ffmpeg.wasm',
    },
    'video-to-gif': {
      name: 'Vídeo para GIF',
      description: 'Recorta um vídeo em GIF animado (tudo no navegador)',
    },
    'audio-convert': {
      name: 'Conversor de áudio',
      description:
        'Conversão de áudio: WAV (nativo) e MP3 / M4A / OGG / FLAC (WebCodecs primeiro, fallback ffmpeg.wasm)',
    },
    'subtitle-tool': {
      name: 'Conversor de legendas',
      description: 'Converte entre SRT / WebVTT com deslocamento de tempo',
    },
    'git-cheatsheet': {
      name: 'Cola do Git',
      description: 'Comandos Git comuns por categoria, com pesquisa',
    },
    'mime-types': {
      name: 'Tipos MIME',
      description: 'Tabela extensão ↔ tipo MIME, com pesquisa',
    },
    'http-status': {
      name: 'Códigos HTTP',
      description: 'Referência de códigos de status HTTP com classe, nome e significado',
    },
    'id-photo': {
      name: 'Foto 3x4',
      description: 'Recorta para tamanhos padrão (1”, 2”, passaporte) com fundo e DPI',
    },
    'image-grid-cut': {
      name: 'Cortar em grade',
      description: 'Divide uma imagem em grade (ex. 3×3) e baixa cada parte',
    },
    'image-ascii': {
      name: 'Imagem para ASCII',
      description: 'Converte imagens em arte ASCII (conjunto de caracteres, largura, inversão)',
    },
    'timezone-converter': {
      name: 'Conversor de fuso',
      description: 'Converte horários entre fusos IANA com deslocamento UTC',
    },
    'tax-loan-calculator': {
      name: 'Empréstimo / Imposto',
      description: 'Amortização (prestação fixa / capital fixo) e estimativa de imposto',
    },
    'unit-converter': {
      name: 'Conversor de unidades',
      description:
        'Converte comprimento / massa / área / volume / temperatura / velocidade / dados / tempo',
    },
    'bulk-rename': {
      name: 'Renomeação em massa',
      description:
        'Gera nomes com prefixo/sufixo, substituição (regex), numeração, extensão e maiúsculas',
    },
    'file-split-merge': {
      name: 'Dividir / Juntar arquivo',
      description: 'Divide um arquivo por tamanho ou número, ou junta as partes',
    },
    'zip-manager': {
      name: 'Gerenciador ZIP',
      description: 'Empacota vários arquivos em ZIP ou extrai entradas individuais (JSZip)',
    },
    barcode: {
      name: 'Gerador de código de barras',
      description: 'Gera códigos Code 39 / Code 128 / EAN-13 em SVG',
    },
    'id-generator': {
      name: 'Gerador de ID',
      description: 'Gera ULID / NanoID / Snowflake / ObjectId do MongoDB em lote',
    },
    'code-minify': {
      name: 'Minificador',
      description: 'Minifica CSS / HTML / JS / JSON (CSS com csso; JS/HTML conservador)',
    },
    'csv-tool': {
      name: 'Ferramenta CSV',
      description: 'Conversão CSV ↔ JSON com delimitador, cabeçalho e aspas (RFC 4180)',
    },
    'key-converter': {
      name: 'Conversor de chaves',
      description: 'Converte chaves RSA entre PEM / DER / JWK / OpenSSH (WebCrypto)',
    },
    'rsa-crypto': {
      name: 'RSA criptografar',
      description:
        'RSA-OAEP cifrar/decifrar, RSA-PSS assinar/verificar e geração de chaves (WebCrypto)',
    },
    'password-hash': {
      name: 'Hash de senha (PBKDF2)',
      description: 'Derivação PBKDF2 via WebCrypto, com salt e iterações personalizados',
    },
    'password-strength': {
      name: 'Força da senha',
      description: 'Estima a força localmente: entropia, conjunto de caracteres e padrões fracos',
    },
    checksum: {
      name: 'Checksum',
      description: 'Calcula CRC-32 / Adler-32 / FNV-1a (no navegador)',
    },
    'encoding-rescue': {
      name: 'Corretor de mojibake',
      description: 'Recodifica texto corrompido (UTF-8 mal lido) com GBK / Big5 / Shift-JIS',
    },
    'escape-unescape': {
      name: 'Escape / Unescape',
      description: 'Escapa e desescapa JSON / JS / HTML / XML / URL',
    },
    'caesar-cipher': {
      name: 'César / ROT13 / Rail',
      description: 'Cifra de César, ROT13, Atbash e Rail Fence',
    },
    'morse-code': {
      name: 'Código Morse',
      description: 'Converte texto e código Morse, com letras, dígitos e espaços',
    },
    'base-encoding': {
      name: 'Codificador Base',
      description: 'Codifica/decodifica Base16/32/32Hex/58/64/64URL (no navegador)',
    },
    'pdf-compress': {
      name: 'Compressor de PDF',
      description: 'Comprime PDF: fluxo de objetos sem perda ou re-codificação JPEG com perda',
    },
    'pdf-watermark': {
      name: "Marca d'água PDF",
      description:
        "Adiciona marca d'água de texto ao PDF (ladrilho, rotação, opacidade, intervalo)",
    },
    'pdf-decrypt': {
      name: 'Desbloqueio de PDF',
      description: 'Carrega com senha e exporta um PDF sem proteção (como qpdf --decrypt)',
    },
    'pdf-extract-text': {
      name: 'Extrator de texto PDF',
      description: 'Extrai texto copiável de todas as páginas PDF (local, suporta criptografados)',
    },
    'random-port': {
      name: 'Porta e endereço aleatórios',
      description: 'Gera portas, IPv4 privada, MAC e IPv6 (deduplica e evita portas comuns)',
    },
    'websocket-tester': {
      name: 'Testador de WebSocket',
      description: 'Conecta a WebSocket, envia/recebe texto/binário com log',
    },
    'http-request': {
      name: 'Depurador HTTP',
      description:
        'Envia requisições HTTP no navegador, inspeciona status, tempo, cabeçalhos (CORS)',
    },
    'http-headers': {
      name: 'Gerador de cabeçalhos de segurança',
      description: 'Gera CSP / HSTS / Referrer-Policy (nginx / Apache / Express / Vercel)',
    },
    'ua-generator': {
      name: 'Gerador de User-Agent',
      description: 'Gera User-Agent por navegador/SO, com biblioteca UA comum',
    },
    'url-parser': {
      name: 'Analisador de URL',
      description: 'Divide a URL em protocolo, host, porta, caminho, parâmetros e âncora',
    },
    'mac-address': {
      name: 'Ferramenta MAC',
      description: 'Formatação MAC, busca de fabricante (OUI), EUI-64 e geração em massa',
    },
    'ip-calc': {
      name: 'Calculadora de IP',
      description: 'Endereçamento IPv4/IPv6, subnetting (VLSM), supernet e máscara curinga',
    },
    'flowchart-editor': {
      name: 'Editor de fluxogramas',
      description:
        'Crie fluxogramas localmente: nós, conexões, modelos, auto layout e exportação PNG/SVG',
    },
    'mindmap-editor': {
      name: 'Editor de mapas mentais',
      description:
        'Crie mapas mentais localmente: nós por teclado, ramificações recolhíveis, layouts, temas e exportação PNG/SVG/Markdown',
    },
    'photo-editor': {
      name: 'Editor de fotos',
      description:
        'Edição de fotos por camadas no navegador: camadas, seleções, recorte, ajustes, filtros, pincel e texto, com projeto reeditável',
    },
    base64: {
      name: 'Codificar / descodificar Base64',
      description:
        'Converte texto e Base64 com codificação Unicode segura; suporta URL Safe e modo ficheiro',
    },
    'url-codec': {
      name: 'Codificar / descodificar URL',
      description:
        'Modos encodeURIComponent / encodeURI com deteção de codificação percentual malformada',
    },
    'regex-tester': {
      name: 'Ferramenta Regex',
      description:
        'Realce de correspondências, substituição, grupos de captura, predefinições e folha de consulta',
    },
    'text-diff': {
      name: 'Diff de texto',
      description: 'Editores lado a lado com realce em linha, números de linha e ignorar espaços',
    },
    'json-format': {
      name: 'Formatador JSON',
      description: 'Formata / minifica / valida com indentação de 2/4 espaços e erros linha/coluna',
    },
    'json-convert': {
      name: 'Conversor JSON',
      description: 'Analisa JSON e converte-o para YAML / XML / CSV',
    },
    timestamp: {
      name: 'Conversor de timestamp',
      description: 'Unix ⇄ hora legível com deteção auto de segundos/ms e relógio em direto',
    },
    uuid: {
      name: 'Gerador UUID',
      description:
        'UUID v4 aleatórios / v7 ordenados por tempo com saída em lote e opções de formatação',
    },
    hash: {
      name: 'Calculadora de hash',
      description:
        'MD5 / SHA-1 / SHA-256 / SHA-512 para texto e ficheiros (streaming), saída hex / base64',
    },
    'jwt-parser': {
      name: 'Analisador JWT',
      description:
        'Analisa header / payload / signature e lê exp e outras claims de tempo (só leitura, sem verificar)',
    },
    'aes-crypto': {
      name: 'Encriptar / desencriptar AES',
      description:
        'AES-GCM com frase-passe PBKDF2 ou chave em bruto; saída base64(salt|iv|ciphertext)',
    },
    hmac: {
      name: 'HMAC',
      description: 'HMAC-SHA256 / SHA512 com saída hex / base64',
    },
    totp: {
      name: 'TOTP',
      description: 'TOTP RFC 6238: gerar / verificar, 6/8 dígitos, segundos restantes',
    },
    'x509-decode': {
      name: 'Descodificador de certificados X.509',
      description: 'Analisa PEM: impressões SHA-256/SHA-1, tipo, comprimento DER, CN',
    },
    'cidr-calc': {
      name: 'Calculadora CIDR',
      description: 'CIDR IPv4: rede / broadcast / intervalo de hosts / máscara / nº de hosts',
    },
    'text-lines': {
      name: 'Ferramentas de linhas de texto',
      description: 'Ordenar / únicos / inverter / numerar / remover linhas vazias',
    },
    'hex-codec': {
      name: 'Codificar / descodificar hex',
      description: 'Hex ↔ texto UTF-8 com espaços opcionais',
    },
    'url-query': {
      name: 'Analisador de consulta URL',
      description: 'Analisa partes da URL e parâmetros de consulta; reconstrói após editar',
    },
    'json-path': {
      name: 'Consulta JSONPath',
      description: 'Consultas de caminho simples como a.b[0].c',
    },
    'gzip-tool': {
      name: 'Compressão Gzip',
      description: 'Comprime texto para base64 com Gzip / descomprime de volta para texto',
    },
    'exif-strip': {
      name: 'Remover EXIF',
      description: 'Lê EXIF JPEG básico e remove APP1; transfira o ficheiro limpo',
    },
    'fake-data': {
      name: 'Gerador de dados falsos',
      description: 'Gera nomes / emails / UUID / lorem em zh/en, 1–50 itens',
    },
    'password-gen': {
      name: 'Gerador de palavras-passe',
      description:
        'Palavras-passe aleatórias fortes com opções de comprimento / charset, estimativa de entropia e nível',
    },
    'entity-codec': {
      name: 'Codificar / descodificar HTML',
      description:
        'Codifica/descodifica caracteres especiais HTML: com nome / decimal / hex / escapes \\u',
    },
    'cron-parser': {
      name: 'Analisador de expressões Cron',
      description: 'Valida expressões cron, explica campos e pré-visualiza próximas execuções',
    },
    'convert-data': {
      name: 'Conversor de formatos de dados de configuração',
      description: 'Converte YAML ⇄ JSON ⇄ TOML através de um valor JS intermédio sem perda',
    },
    'sql-format': {
      name: 'Formatador SQL',
      description:
        'Embeleza SQL em vários dialetos com indentação e maiúsculas de palavras-chave configuráveis',
    },
    'html-format': {
      name: 'Minificar / embelezar HTML',
      description: 'Minifica e embeleza HTML com indentação de 2/4 espaços',
    },
    'js-format': {
      name: 'Minificar / embelezar JS',
      description: 'Minifica e embeleza JavaScript com indentação de 2/4 espaços',
    },
    'css-format': {
      name: 'Minificar / embelezar CSS',
      description: 'Minifica e embeleza CSS com indentação de 2/4 espaços',
    },
    'xml-format': {
      name: 'Minificar / embelezar XML',
      description: 'Embeleza e minifica XML com indentação de 2/4 espaços; CDATA preservado',
    },
    'xml-json': {
      name: 'XML para JSON',
      description: 'Analisa XML para JSON, mantendo atributos com o prefixo @_',
    },
    qrcode: {
      name: 'Código QR',
      description: 'Gera e descodifica códigos QR com ECC, tamanho, cores e margem',
    },
    'color-converter': {
      name: 'Conversor de cores',
      description: 'Converte e pré-visualiza formatos HEX / RGB / HSL',
    },
    'radix-converter': {
      name: 'Conversor de bases',
      description:
        'Converte bases 2/8/10/16 e visualiza operações bit a bit para inteiros com sinal de 64 bits',
    },
    'markdown-preview': {
      name: 'Editor de Markdown',
      description:
        'Edição e pré-visualização ao vivo, estrutura, contagem de palavras, abrir/salvar .md e exportar HTML',
    },
    'image-compress': {
      name: 'Comprimir imagem',
      description:
        'Compressão e conversão de imagem no cliente (PNG / JPEG / WebP) com redimensionamento e qualidade',
    },
    'unicode-codec': {
      name: 'Codec Unicode',
      description: 'Converte texto para/de \\uXXXX, pontos de código, entidades HTML e bytes UTF-8',
    },
    'html-color-picker': {
      name: 'Seletor de cor HTML',
      description: 'Escolha cores visualmente e exporte HEX / RGB / HSL mais excertos HTML/CSS',
    },
    'web-color-table': {
      name: 'Tabela de cores web',
      description: 'Cores com nome CSS com filtros por grupo e cópia de nome / HEX / RGB',
    },
    pinyin: {
      name: 'Chinês para pinyin',
      description: 'Converte chinês para pinyin com tons, separador e maiúsculas opcionais',
    },
    'length-converter': {
      name: 'Conversor de comprimento',
      description:
        'Converte unidades de comprimento métricas e imperiais (mm, cm, m, km, in, ft e mais)',
    },
    'zh-convert': {
      name: 'Conversor de chinês tradicional',
      description: 'Converte entre chinês simplificado e tradicional',
    },
    'weight-converter': {
      name: 'Conversor de peso',
      description: 'Converte unidades de peso métricas e imperiais (mg, g, kg, t, oz, lb, st)',
    },
    'text-counter': {
      name: 'Contador de texto',
      description: 'Conta caracteres, palavras, linhas, parágrafos, caracteres CJK e bytes UTF-8',
    },
    calendar: {
      name: 'Calendário',
      description: 'Vista mensal com lunar/almanaque para chinês e feriados locais para inglês',
    },
    'css-button': {
      name: 'Gerador de botões CSS',
      description: 'Ajuste estilos visualmente e gere CSS / HTML de botões',
    },
    'random-number': {
      name: 'Gerador de números aleatórios',
      description:
        'Gera inteiros ou decimais aleatórios num intervalo, com valores únicos opcionais',
    },
    'random-string': {
      name: 'Gerador de cadeias aleatórias',
      description:
        'Gera cadeias aleatórias por comprimento e charset (alnum / hex / personalizado)',
    },
    'doodle-board': {
      name: 'Quadro de desenho',
      description:
        'Lousa de desenho no navegador: caneta/marca-texto/borracha, formas e polígonos, conta-gotas, mover e zoom, exportação em vários formatos',
    },
    calculator: {
      name: 'Calculadora',
      description:
        'Calculadora de expressões segura com aritmética, potências, módulo e funções comuns',
    },
    'code-image': {
      name: 'Código para imagem',
      description: 'Renderiza código como cartão com realce de sintaxe e exporta PNG',
    },
    'image-color-picker': {
      name: 'Seletor de cor de imagem',
      description: 'Carregue uma imagem e clique num píxel para amostrar HEX / RGB',
    },
    'ascii-table': {
      name: 'Tabela ASCII',
      description: 'Referência ASCII 0–127 com pesquisa por decimal, hex ou carácter',
    },
    'image-watermark': {
      name: 'Marca de água em imagem',
      description: 'Adicione uma marca de água de texto com posição, opacidade, rotação e mosaico',
    },
    'case-convert': {
      name: 'Conversor de maiúsculas/minúsculas',
      description:
        'Converte maiúsculas/minúsculas e estilos de nomes (camel / snake / kebab, etc.)',
    },
    'bmi-calculator': {
      name: 'Calculadora de IMC',
      description: 'Calcula o IMC a partir da altura e do peso com categorias WHO para adultos',
    },
    'placeholder-image': {
      name: 'Imagem de marcador de posição',
      description: 'Gera um PNG de marcador de posição por tamanho, cores e texto opcional',
    },
    'image-merge': {
      name: 'Unir imagens',
      description: 'Une imagens na horizontal, vertical ou grelha num PNG',
    },
    'cron-generator': {
      name: 'Gerador de Crontab',
      description:
        'Constrói uma expressão Cron padrão de 5 campos a partir de minuto/hora/dia/mês/dia da semana',
    },
    'ua-parser': {
      name: 'Analisador User-Agent',
      description: 'Analisa um User-Agent do browser em browser, motor, SO e dispositivo',
    },
    'latex-editor': {
      name: 'Editor de matemática LaTeX',
      description:
        'Símbolos rápidos e fórmulas clássicas, pré-visualização KaTeX, exportar PNG/JPG/SVG',
    },
    countdown: {
      name: 'Temporizador de contagem decrescente',
      description: 'Defina horas, minutos e segundos; pause, retome e alerta ao terminar',
    },
    stopwatch: {
      name: 'Cronómetro',
      description: 'Cronómetro online com início, pausa, volta e reposição',
    },
    'svg-to-png': {
      name: 'SVG para PNG',
      description: 'Converte marcação ou ficheiros SVG para PNG com escala e transparência',
    },
    'image-frame': {
      name: 'Margem / raio / sombra de imagem',
      description: 'Adicione margem, cantos arredondados e sombra, depois exporte PNG',
    },
    'image-adjust': {
      name: 'Ajuste de cor de imagem',
      description: 'Ajuste brilho, contraste, saturação e matiz, depois exporte PNG',
    },
    'gif-frames': {
      name: 'Extrator de fotogramas GIF',
      description: 'Divide um GIF em fotogramas PNG; transfira um ou todos',
    },
    'image-crop': {
      name: 'Recortar imagem',
      description: 'Recorta imagens à mão livre ou com proporções fixas para PNG',
    },
    'mbti-test': {
      name: 'Teste de personalidade MBTI',
      description: 'Um questionário curto estilo MBTI de 24 perguntas (apenas entretenimento)',
    },
    'text-card': {
      name: 'Texto para cartão',
      description: 'Layout de título e corpo num cartão com estilo e exportação PNG',
    },
    'image-card': {
      name: 'Imagem para cartão',
      description: 'Cartão foto + título/subtítulo com fundos ou gradientes, exportar PNG',
    },
    'code-highlight': {
      name: 'Realçador de código',
      description: 'Realce de sintaxe em direto com números de linha e cópia de excerto HTML',
    },
    'image-base64': {
      name: 'Imagem ↔ Base64',
      description: 'Converte imagens para Base64 / Data URL e vice-versa, totalmente em local',
    },
    'image-ico': {
      name: 'Conversor ICO',
      description: 'Converte imagens para ICO multi-tamanho (favicon), ou extrai PNG de ICO',
    },
    'hsv-cmyk': {
      name: 'Conversor HSV / CMYK',
      description: 'Converte e pré-visualiza espaços RGB, HSV, CMYK e HEX',
    },
    'ai-prompts': {
      name: 'Biblioteca de prompts de IA',
      description: 'Prompts selecionados por categoria com pesquisa e cópia com um clique',
    },
    'md-mindmap': {
      name: 'Mapa mental Markdown',
      description: 'Converte Markdown num mapa mental com temas, zoom e exportação PNG/SVG',
    },
    'mermaid-editor': {
      name: 'Editor de diagramas Mermaid',
      description: 'Renderiza Mermaid em local com temas, zoom e exportação PNG/SVG',
    },
    'css-gradient': {
      name: 'Gerador de gradientes CSS',
      description:
        'Edite gradientes lineares / radiais com predefinições categorizadas e copie CSS',
    },
    'image-to-paper': {
      name: 'Imagem para PDF de papel',
      description: 'Ajusta imagens a A3/A4/A5/Letter e exporta PDF',
    },
    'md-to-image': {
      name: 'Markdown para imagem',
      description:
        'Renderiza Markdown num cartão com estilo e exporta PNG com tipo de letra, tamanho, largura e cores',
    },
    'chart-generator': {
      name: 'Gerador de gráficos',
      description:
        'Cria gráficos de barras/linhas/áreas/circular/anel/dispersão a partir de CSV com legendas e paletas',
    },
    'css3-generator': {
      name: 'Gerador de código CSS3',
      description: 'Gera border-radius, sombras, transform, filter e mais',
    },
    'xslt-transform': {
      name: 'Transformação XSLT',
      description: 'Transforma XML para HTML com XSLT no browser',
    },
    'rich-text-editor': {
      name: 'Processador de texto',
      description:
        'Escrita local com importação e exportação Word (.docx) e dois modos de exportação PDF',
    },
    'slide-editor': {
      name: 'Editor de diapositivos',
      description:
        'Edição local em canvas com importação e exportação PowerPoint (.pptx) e modo apresentação',
    },
    'spreadsheet-editor': {
      name: 'Editor de folhas de cálculo',
      description:
        'Edição local com importação e exportação Excel (.xlsx), fórmulas e várias folhas',
    },
    'pdf-merge': {
      name: 'Unir PDF',
      description: 'Une vários PDF num único ficheiro',
    },
    'pdf-split': {
      name: 'Dividir PDF',
      description: 'Divide um PDF num ficheiro por página',
    },
    'pdf-delete-pages': {
      name: 'Eliminar páginas PDF',
      description: 'Remove as páginas selecionadas de um PDF',
    },
    'pdf-extract-pages': {
      name: 'Extrair páginas PDF',
      description: 'Extrai as páginas selecionadas para um novo PDF',
    },
    'pdf-reorder': {
      name: 'Reordenar páginas PDF',
      description: 'Reordena as páginas de um PDF',
    },
    'pdf-rotate': {
      name: 'Rodar páginas PDF',
      description: 'Roda as páginas selecionadas ou todas',
    },
    'pdf-to-image': {
      name: 'PDF para imagem',
      description: 'Renderiza páginas PDF como JPG/PNG',
    },
    'images-to-pdf': {
      name: 'Imagens para PDF',
      description: 'Combina imagens num PDF',
    },
    'pdf-viewer': {
      name: 'Visualizador PDF',
      description: 'Abre e lê um PDF em local',
    },
    'pdf-page-numbers': {
      name: 'Números de página PDF',
      description: 'Adiciona números de página a um PDF',
    },
    'pdf-header-footer': {
      name: 'Cabeçalho e rodapé PDF',
      description: 'Adiciona texto de cabeçalho e rodapé',
    },
    'pdf-insert-image': {
      name: 'Inserir imagem no PDF',
      description: 'Coloca uma imagem nas páginas do PDF',
    },
    'pdf-add-text': {
      name: 'Adicionar texto ao PDF',
      description: 'Adiciona texto nas páginas do PDF',
    },
    'pdf-sign': {
      name: 'Assinar PDF',
      description: 'Desenhe ou carregue uma imagem de assinatura (visual, não certificado)',
    },
    'pdf-metadata': {
      name: 'Metadados PDF',
      description: 'Ver e editar metadados PDF',
    },
    'pdf-encrypt': {
      name: 'Encriptar PDF',
      description: 'Defina palavra-passe e flags de permissões',
    },
    'pdf-crop': {
      name: 'Recortar PDF',
      description: 'Recorta margens de página via cropBox',
    },
    'pdf-grayscale': {
      name: 'PDF em escala de cinzentos',
      description: 'Converte PDF para escala de cinzentos visual',
    },
    'pdf-annotate': {
      name: 'Anotar PDF',
      description: 'Desenhe realces, à mão livre, formas e texto em páginas PDF',
    },
  },
} satisfies ShellResources;

export default pt;
